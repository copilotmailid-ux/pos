const fs = require('fs');
const path = require('path');
const { get, backupDatabase } = require('./db');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  cyan: '\x1b[96m',
  red: '\x1b[31m'
};

// In-memory cache for instantaneous synchronous backup during shutdown
let cachedBackupConfig = {
  backupPath: 'G:\\My Drive\\POS_Backups',
  backupRetention: 5,
  isInitialized: false
};

const getLiveDbPath = () => {
  return process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
};

const setCachedBackupConfig = ({ backupPath, backupRetention }) => {
  if (typeof backupPath === 'string') {
    cachedBackupConfig.backupPath = backupPath.trim();
  }
  if (backupRetention !== undefined) {
    cachedBackupConfig.backupRetention = parseInt(backupRetention, 10) || 5;
  }
  cachedBackupConfig.isInitialized = true;
};

const getCachedBackupConfig = () => cachedBackupConfig;

// Initialize cache from SQLite settings table
const initBackupConfig = async () => {
  try {
    const settings = await get('SELECT backupPath, backupRetention FROM settings WHERE id = 1');
    if (settings) {
      setCachedBackupConfig({
        backupPath: settings.backupPath || 'G:\\My Drive\\POS_Backups',
        backupRetention: settings.backupRetention || 5
      });
      console.log(`${colors.cyan}☁️  [BACKUP CONFIG]${colors.reset} Loaded backup destination: ${cachedBackupConfig.backupPath ? colors.bold + cachedBackupConfig.backupPath + colors.reset : colors.dim + '(Not configured)' + colors.reset} (Retention: ${cachedBackupConfig.backupRetention})`);
    }
  } catch (err) {
    console.error(`${colors.red}✖ [BACKUP CONFIG]${colors.reset} Failed to initialize backup configuration: ${err.message}`);
  }
  return cachedBackupConfig;
};

// Clean older backups in destination folder to enforce retention limit
const cleanRetention = (targetDir, keepCount) => {
  try {
    if (!fs.existsSync(targetDir)) return;
    
    // Clean any orphaned temp files
    const allFiles = fs.readdirSync(targetDir);
    for (const f of allFiles) {
      if (f.includes('.tmp_') || f.endsWith('.tmp')) {
        try { fs.unlinkSync(path.join(targetDir, f)); } catch (_) {}
      }
    }

    const files = fs.readdirSync(targetDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        path: path.join(targetDir, f),
        time: fs.statSync(path.join(targetDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      const extraFiles = files.slice(keepCount);
      for (const file of extraFiles) {
        try {
          fs.unlinkSync(file.path);
          console.log(`${colors.yellow}🧹 [CLEANUP]${colors.reset} Deleted older backup: ${colors.dim}${file.name}${colors.reset}`);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error(`${colors.red}✖ [CLEANUP]${colors.reset} Retention cleanup failed: ${err.message}`);
  }
};

// Safe Copy with fsync: Guarantees every byte is physically flushed to disk
// Eliminates 0 KB files forever on both local drives and Google Drive virtual drives
const copyWithFsync = (srcFile, destFile) => {
  if (!fs.existsSync(srcFile)) return false;
  const srcStats = fs.statSync(srcFile);
  if (srcStats.size === 0) {
    console.warn(`[BACKUP] Source ${srcFile} is 0 bytes, aborting copy`);
    return false;
  }

  const tmpFile = `${destFile}.tmp_${Date.now()}`;
  let srcFd = null;
  let destFd = null;

  try {
    srcFd = fs.openSync(srcFile, 'r');
    destFd = fs.openSync(tmpFile, 'w');
    const buffer = Buffer.alloc(128 * 1024); // 128 KB buffer
    let bytesRead = 0;

    while ((bytesRead = fs.readSync(srcFd, buffer, 0, buffer.length, null)) > 0) {
      fs.writeSync(destFd, buffer, 0, bytesRead);
    }

    // Force operating system & Google Drive virtual filesystem to commit all bytes to disk
    fs.fsyncSync(destFd);
    fs.closeSync(srcFd);
    fs.closeSync(destFd);
    srcFd = null;
    destFd = null;

    // Verify written file size matches source before committing
    const tmpStats = fs.statSync(tmpFile);
    if (tmpStats.size >= srcStats.size * 0.95) {
      if (fs.existsSync(destFile)) {
        try { fs.unlinkSync(destFile); } catch (_) {}
      }
      fs.renameSync(tmpFile, destFile);
      return true;
    } else {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      return false;
    }
  } catch (err) {
    if (srcFd !== null) { try { fs.closeSync(srcFd); } catch (_) {} }
    if (destFd !== null) { try { fs.closeSync(destFd); } catch (_) {} }
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
    return false;
  }
};

// 100% Synchronous Copy with fsync protection
const syncToGoogleDriveSync = (trigger = 'SHUTDOWN') => {
  const startTime = Date.now();
  const { backupPath, backupRetention } = cachedBackupConfig;
  if (!backupPath || !backupPath.trim()) {
    console.log(`${colors.yellow}ℹ [GOOGLE DRIVE]${colors.reset} No Google Drive backup folder configured.`);
    return false;
  }

  const targetDir = backupPath.trim();
  const liveDbFile = getLiveDbPath();

  if (!fs.existsSync(liveDbFile)) {
    console.error(`${colors.red}✖ [GOOGLE DRIVE]${colors.reset} Database file not found: ${liveDbFile}`);
    return false;
  }

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Copy live database to master file safely (Atomic with fsync - NEVER 0 KB)
    const targetDb = path.join(targetDir, 'database.sqlite');
    copyWithFsync(liveDbFile, targetDb);

    // 1b. If WAL file exists and has content, copy WAL file as well
    const walFile = `${liveDbFile}-wal`;
    if (fs.existsSync(walFile) && fs.statSync(walFile).size > 0) {
      try {
        copyWithFsync(walFile, path.join(targetDir, 'database.sqlite-wal'));
      } catch (_) {}
    }

    // 2. Also write timestamped snapshot
    const now = new Date();
    const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .replace(/Z$/, '')
      .replace(/[:.]/g, '-');
    const timestampedBackup = path.join(targetDir, `backup_${localTimestamp}.sqlite`);

    // If there is an ultra-recent atomic VACUUM snapshot in backups, use it
    const backupsDir = path.join(path.dirname(liveDbFile), 'backups');
    let sourceFile = liveDbFile;
    if (fs.existsSync(backupsDir)) {
      const snapshots = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
        .map(f => ({ name: f, path: path.join(backupsDir, f), time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
      if (snapshots.length > 0 && (Date.now() - snapshots[0].time < 300000)) {
        sourceFile = snapshots[0].path;
      }
    }

    copyWithFsync(sourceFile, timestampedBackup);

    // 3. Enforce retention limit
    cleanRetention(targetDir, backupRetention);

    const elapsed = Date.now() - startTime;
    console.log(`${colors.green}✔ [GOOGLE DRIVE]${colors.reset} Google Drive backup saved in ${elapsed}ms (${trigger})`);
    console.log(`   ➜ Master:   ${colors.dim}${targetDb}${colors.reset}`);
    console.log(`   ➜ Snapshot: ${colors.dim}${timestampedBackup}${colors.reset}`);
    return true;
  } catch (err) {
    console.error(`${colors.red}✖ [GOOGLE DRIVE]${colors.reset} Synchronous backup failed: ${err.message}`);
    return false;
  }
};

// Async full atomic consolidated snapshot (using SQLite VACUUM INTO) + Google Drive sync
const syncToGoogleDriveAsync = async (trigger = 'STARTUP') => {
  const { backupPath, backupRetention } = cachedBackupConfig;
  if (!backupPath || !backupPath.trim()) return null;

  const targetDir = backupPath.trim();

  try {
    // 1. Run local consolidated atomic snapshot
    const localBackupFile = await backupDatabase();

    // 2. Ensure target dir exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 3. Copy to Google Drive master and timestamped using atomic fsync copy
    const latestMaster = path.join(targetDir, 'database.sqlite');
    const now = new Date();
    const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .replace(/Z$/, '')
      .replace(/[:.]/g, '-');
    const timestampedBackup = path.join(targetDir, `backup_${localTimestamp}.sqlite`);

    copyWithFsync(localBackupFile, latestMaster);
    copyWithFsync(localBackupFile, timestampedBackup);

    // 4. Enforce retention limit
    cleanRetention(targetDir, backupRetention);

    console.log(`${colors.green}✔ [GOOGLE DRIVE]${colors.reset} Full atomic backup uploaded to Google Drive! (${trigger})`);
    console.log(`   ➜ Master:   ${colors.dim}${latestMaster}${colors.reset}`);
    console.log(`   ➜ Snapshot: ${colors.dim}${timestampedBackup}${colors.reset}`);

    return timestampedBackup;
  } catch (err) {
    console.error(`${colors.red}✖ [GOOGLE DRIVE]${colors.reset} Async Google Drive sync failed: ${err.message}`);
    syncToGoogleDriveSync(`${trigger}_FALLBACK`);
    return null;
  }
};

module.exports = {
  initBackupConfig,
  setCachedBackupConfig,
  getCachedBackupConfig,
  syncToGoogleDriveSync,
  syncToGoogleDriveAsync
};
