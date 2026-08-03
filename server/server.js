const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDB, backupDatabase, db, get } = require('./config/db');

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
  .then(() => {
    console.log(`${colors.green}✔ [DB]${colors.reset}      Database connected & schema initialized`);
    // Trigger startup database backup after 10 seconds to ensure launch is instant and unblocked
    setTimeout(() => {
      backupDatabase()
        .catch((err) => console.error(`${colors.red}✖ [BACKUP]${colors.reset}  Startup database backup failed: ${err.message}`));
    }, 10000);
  })
  .catch((err) => {
    console.error(`${colors.red}✖ [DB]${colors.reset}      SQLite Database Initialization Error:`, err);
    process.exit(1);
  });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Shutdown endpoint called by Electron on exit to close SQLite connection and flush WAL cleanly on Windows
app.post('/api/internal/shutdown', async (req, res) => {
  res.json({ message: 'Shutting down...' });
  console.log(`${colors.yellow}🛑 [SHUTDOWN]${colors.reset} Commencing graceful cleanup...`);

  let backupPath = '';
  let backupRetention = 5;
  
  try {
    const settings = await get('SELECT backupPath, backupRetention FROM settings WHERE id = 1');
    if (settings) {
      backupPath = settings.backupPath;
      backupRetention = settings.backupRetention || 5;
    }
  } catch (err) {
    console.error(`${colors.red}✖ [SHUTDOWN]${colors.reset} Failed to read settings: ${err.message}`);
  }

  db.close((err) => {
    if (err) {
      console.error(`${colors.red}✖ [SHUTDOWN]${colors.reset} Error closing SQLite database: ${err.message}`);
    } else {
      console.log(`${colors.green}✔ [SHUTDOWN]${colors.reset} SQLite database connection closed cleanly`);

      if (backupPath) {
        try {
          const fs = require('fs');
          const path = require('path');
          
          if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
          }

          const liveDbFile = process.env.SQLITE_DB_PATH || path.join(__dirname, 'database.sqlite');
          if (fs.existsSync(liveDbFile)) {
            // Copy 1: Overwrite static latest copy
            const latestBackup = path.join(backupPath, 'database.sqlite');
            fs.copyFileSync(liveDbFile, latestBackup);

            // Copy 2: Save timestamped incremental backup file using local timezone
            const now = new Date();
            const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
              .toISOString()
              .replace(/Z$/, '')
              .replace(/[:.]/g, '-');
            const timestampedBackup = path.join(backupPath, `backup_${localTimestamp}.sqlite`);
            fs.copyFileSync(liveDbFile, timestampedBackup);

            console.log(`${colors.green}📦 [BACKUP]${colors.reset}  Database saved to: ${colors.dim}${backupPath}${colors.reset}`);

            // Clean up old timestamped backups to enforce retention limit
            const files = fs.readdirSync(backupPath)
              .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
              .map(f => ({
                name: f,
                path: path.join(backupPath, f),
                time: fs.statSync(path.join(backupPath, f)).mtime.getTime()
              }))
              .sort((a, b) => b.time - a.time); // Newest first

            if (files.length > backupRetention) {
              const extraFiles = files.slice(backupRetention);
              for (const file of extraFiles) {
                fs.unlinkSync(file.path);
                console.log(`${colors.yellow}🧹 [CLEANUP]${colors.reset} Deleted old backup: ${colors.dim}${file.name}${colors.reset}`);
              }
            }
          }
        } catch (backupErr) {
          console.error(`${colors.red}✖ [BACKUP]${colors.reset}  Automatic shutdown backup failed: ${backupErr.message}`);
        }
      }
    }
    process.exit(0);
  });
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
  server = app.listen(PORT, () => {
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

const gracefulShutdown = () => {
  console.log(`\n${colors.yellow}🛑 [SHUTDOWN]${colors.reset} Shutting down server gracefully...`);
  db.close((err) => {
    if (err) {
      console.error(`${colors.red}✖ [SHUTDOWN]${colors.reset} Error closing SQLite database: ${err.message}`);
    } else {
      console.log(`${colors.green}✔ [SHUTDOWN]${colors.reset} SQLite database connection closed cleanly`);
    }
    if (server) {
      server.close(() => {
        console.log(`${colors.green}✔ [SHUTDOWN]${colors.reset} Express server stopped cleanly`);
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
    setTimeout(() => process.exit(0), 500);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
