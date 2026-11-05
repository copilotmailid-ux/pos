const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const rootDir = path.join(__dirname, '..');
const stagingDir = path.join(rootDir, '.build-staging');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[96m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

function log(msg) {
  console.log(`${colors.cyan}[SECURE BUILD]${colors.reset} ${msg}`);
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest, ignoreList = []) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      if (ignoreList.some(ign => item.includes(ign))) continue;
      copyRecursive(path.join(src, item), path.join(dest, item), ignoreList);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item.startsWith('.')) continue;
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function runSecureBuild() {
  console.log(`\n${colors.bold}${colors.green}========================================${colors.reset}`);
  console.log(`${colors.bold}${colors.green}  SuperMart POS Secure Enterprise Build ${colors.reset}`);
  console.log(`${colors.bold}${colors.green}========================================${colors.reset}\n`);

  // Step 1: Build Frontend
  log('Step 1/5: Building React frontend via Vite...');
  execSync('npm run build:client', { cwd: rootDir, stdio: 'inherit' });

  // Step 2: Prepare Clean Staging Directory
  log('Step 2/5: Creating isolated staging directory (.build-staging)...');
  cleanDir(stagingDir);
  fs.mkdirSync(stagingDir, { recursive: true });

  // Copy main files
  fs.copyFileSync(path.join(rootDir, 'main.js'), path.join(stagingDir, 'main.js'));
  fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(stagingDir, 'package.json'));

  // Copy client/dist
  copyRecursive(path.join(rootDir, 'client', 'dist'), path.join(stagingDir, 'client', 'dist'));

  // Copy server (exclude live database and backups)
  copyRecursive(
    path.join(rootDir, 'server'),
    path.join(stagingDir, 'server'),
    ['database.sqlite', 'database.sqlite-wal', 'database.sqlite-shm', 'backups', '.tmp']
  );

  // Step 3: Obfuscate Staged JavaScript Files
  log('Step 3/5: Encrypting and obfuscating backend source files...');
  const jsFiles = [
    path.join(stagingDir, 'main.js'),
    ...getAllJsFiles(path.join(stagingDir, 'server'))
  ];

  let obfuscatedCount = 0;
  for (const file of jsFiles) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.8,
        transformObjectKeys: false, // Preserves Express route keys safely
        deadCodeInjection: false,   // Preserves 100% native performance
        controlFlowFlattening: false // Keeps CPU usage near zero
      });
      fs.writeFileSync(file, obfuscationResult.getObfuscatedCode(), 'utf8');
      obfuscatedCount++;
    } catch (err) {
      console.warn(`  ${colors.yellow}⚠️ Warning:${colors.reset} Could not obfuscate ${path.basename(file)}: ${err.message}`);
    }
  }
  log(`  ${colors.green}✔ Protected ${obfuscatedCount} backend source files with binary string encryption.${colors.reset}`);

  // Step 4: Package into ASAR Executable
  log('Step 4/5: Packaging into sealed ASAR executable via electron-packager...');
  const packCmd = `npx electron-packager "${stagingDir}" "SuperMart POS" --platform=win32 --arch=x64 --out="${path.join(rootDir, 'dist-desktop')}" --overwrite --asar`;
  execSync(packCmd, { cwd: rootDir, stdio: 'inherit' });

  // Step 5: Clean Up Staging Directory
  log('Step 5/5: Cleaning up staging files...');
  cleanDir(stagingDir);

  console.log(`\n${colors.bold}${colors.green}✔ SUCCESS! Enterprise Secure Build Complete.${colors.reset}`);
  console.log(`   ➜ Executable: ${colors.cyan}dist-desktop\\SuperMart POS-win32-x64\\SuperMart POS.exe${colors.reset}`);
  console.log(`   ➜ Your original source code in server/ and client/ was ${colors.bold}100% untouched${colors.reset}.\n`);
}

runSecureBuild().catch(err => {
  console.error(`${colors.red}✖ Secure build failed:${colors.reset}`, err);
  cleanDir(stagingDir);
  process.exit(1);
});
