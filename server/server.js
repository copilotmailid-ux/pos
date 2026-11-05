const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDB, backupDatabase, db, get } = require('./config/db');
const { initBackupConfig, syncToGoogleDriveSync, syncToGoogleDriveAsync } = require('./config/cloudBackup');

// Crash protection: Exit Node on critical errors so Electron auto-healing can spawn a clean process
process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL UNHANDLED REJECTION:', reason);
});

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
  cyan: '\x1b[96m',
  red: '\x1b[31m'
};

// Load env vars
const path = require('path');
const fs = require('fs');

// Check if an external .env file exists next to the SuperMart POS.exe file
const externalEnvPath = path.join(path.dirname(process.execPath), '.env');

if (fs.existsSync(externalEnvPath)) {
  dotenv.config({ path: externalEnvPath });
  console.log(`${colors.blue}ℹ [CONFIG]${colors.reset}  External config loaded: ${colors.dim}${externalEnvPath}${colors.reset}`);
} else {
  // Fall back to the internal default one inside the package
  dotenv.config({ path: path.join(__dirname, '.env') });
}

// Connect and initialize database
initializeDB()
  .then(async () => {
    console.log(`${colors.green}✔ [DB]${colors.reset}      Database connected & schema initialized`);
    await initBackupConfig();
    // Trigger startup database backup & Google Drive sync
    setTimeout(() => {
      syncToGoogleDriveAsync('SERVER_STARTUP')
        .catch((err) => console.error(`${colors.red}✖ [BACKUP]${colors.reset}  Startup database backup failed: ${err.message}`));
    }, 1500);
    // Periodic auto-backup to Google Drive every 15 minutes
    setInterval(() => {
      syncToGoogleDriveAsync('AUTO_15MIN')
        .catch((err) => console.error(`${colors.red}✖ [BACKUP]${colors.reset}  Periodic backup failed: ${err.message}`));
    }, 15 * 60 * 1000);
  })
  .catch((err) => {
    console.error(`${colors.red}✖ [DB]${colors.reset}      SQLite Database Initialization Error:`, err);
    process.exit(1);
  });

const app = express();

// Ensure uploads/products directory exists for local image storage
const uploadsDir = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve local product images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/quotations', require('./routes/quotations'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


let isShuttingDown = false;

const performGracefulShutdownAndBackup = (source = 'TERMINAL') => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${colors.yellow}🛑 [SHUTDOWN]${colors.reset} Commencing shutdown (Triggered by: ${colors.bold}${source}${colors.reset})...`);

  // 1. Ultra-fast synchronous copy to Google Drive & local backup (completes in ~15ms before Windows can terminate Node)
  try {
    syncToGoogleDriveSync(source);
  } catch (err) {
    console.error(`${colors.red}✖ [SHUTDOWN BACKUP]${colors.reset} Error: ${err.message}`);
  }

  // 2. Safely close SQLite DB connection
  try {
    db.close((err) => {
      if (!err) {
        console.log(`${colors.green}✔ [SHUTDOWN]${colors.reset} SQLite database connection closed cleanly`);
      }
    });
  } catch (_) {}

  // 3. Stop express server
  if (server) {
    try { server.close(); } catch (_) {}
  }

  console.log(`${colors.green}✔ [SHUTDOWN]${colors.reset} All shutdown tasks completed. Goodbye!\n`);
  process.exit(0);
};

// Shutdown endpoint called by Electron on exit to close SQLite connection and flush WAL cleanly on Windows
app.post('/api/internal/shutdown', (req, res) => {
  try {
    console.log(`\n${colors.yellow}🛑 [SHUTDOWN]${colors.reset} Electron initiated shutdown. Performing backup...`);
    syncToGoogleDriveSync('ELECTRON_SHUTDOWN');
    res.json({ success: true, message: 'Shutdown backup completed cleanly.' });
  } catch (err) {
    console.error('Shutdown backup error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    setTimeout(() => {
      try { db.close(); } catch (_) {}
      if (server) { try { server.close(); } catch (_) {} }
      process.exit(0);
    }, 150);
  }
});

// Serve frontend static build files
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message,
  });
});

const net = require('net');
const { exec } = require('child_process');

const PORT = process.env.PORT || 5000;
let server;

function checkPort(port, host, callback) {
  const checkNetServer = net.createServer();
  checkNetServer.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      callback(true);
    } else {
      callback(false);
    }
  });
  checkNetServer.once('listening', () => {
    checkNetServer.close();
    callback(false);
  });
  checkNetServer.listen(port, host);
}

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      // macOS/Linux
      exec(`lsof -t -i:${port}`, (err, stdout) => {
        if (!err && stdout.trim()) {
          const pid = stdout.trim();
          exec(`kill -9 ${pid}`, () => resolve(true));
        } else {
          resolve(false);
        }
      });
      return;
    }

    // Windows
    exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
      if (err || !stdout) {
        return resolve(false);
      }

      const lines = stdout.split('\n');
      const pidsToKill = new Set();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const localAddress = parts[1];
          const pid = parts[parts.length - 1];
          if ((localAddress.endsWith(`:${port}`) || localAddress.endsWith(`]:${port}`)) && parseInt(pid, 10) !== process.pid) {
            pidsToKill.add(parseInt(pid, 10));
          }
        }
      }

      if (pidsToKill.size === 0) {
        return resolve(false);
      }

      const killPromises = Array.from(pidsToKill).map((pid) => {
        return new Promise((res) => {
          exec(`taskkill /F /PID ${pid}`, () => res());
        });
      });

      Promise.all(killPromises).then(() => resolve(true));
    });
  });
}

const startListening = () => {
  server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`
${colors.cyan}┌────────────────────────────────────────────────────────┐${colors.reset}
${colors.cyan}│${colors.reset}                                                        ${colors.cyan}│${colors.reset}
${colors.cyan}│${colors.reset}   ${colors.bold}${colors.green}🚀 SuperMart POS Server Running${colors.reset}                       ${colors.cyan}│${colors.reset}
${colors.cyan}│${colors.reset}                                                        ${colors.cyan}│${colors.reset}
${colors.cyan}│${colors.reset}   ${colors.bold}➜  Local:${colors.reset}    ${colors.cyan}http://localhost:${PORT}${colors.reset}                  ${colors.cyan}│${colors.reset}
${colors.cyan}│${colors.reset}   ${colors.bold}➜  Mode:${colors.reset}     ${colors.yellow}SQLite WAL Mode Enabled${colors.reset}               ${colors.cyan}│${colors.reset}
${colors.cyan}│${colors.reset}   ${colors.bold}➜  Status:${colors.reset}   ${colors.green}Online & Ready${colors.reset}                        ${colors.cyan}│${colors.reset}
${colors.cyan}│${colors.reset}                                                        ${colors.cyan}│${colors.reset}
${colors.cyan}└────────────────────────────────────────────────────────┘${colors.reset}
`);
  });
};

checkPort(PORT, '127.0.0.1', async (inUse) => {
  if (inUse) {
    console.log(`${colors.yellow}⚠️ [PORT]${colors.reset}    Port ${PORT} is occupied. Attempting process termination...`);
    const killed = await killProcessOnPort(PORT);
    if (killed) {
      console.log(`${colors.green}✔ [PORT]${colors.reset}    Conflicting process terminated. Waiting for port release...`);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
  startListening();
});

if (process.platform === 'win32' && process.stdin && process.stdin.isTTY) {
  try {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', () => {
      performGracefulShutdownAndBackup('TERMINAL_CTRL_C');
    });
  } catch (_) {}
}

process.on('SIGINT', () => performGracefulShutdownAndBackup('TERMINAL_CTRL_C'));
process.on('SIGTERM', () => performGracefulShutdownAndBackup('TERMINAL_SIGTERM'));
process.once('SIGUSR2', async () => {
  await performGracefulShutdownAndBackup('NODEMON_RESTART');
  process.kill(process.pid, 'SIGUSR2');
});

process.on('exit', () => {
  if (!isShuttingDown) {
    try { syncToGoogleDriveSync('PROCESS_EXIT'); } catch (_) {}
  }
});
