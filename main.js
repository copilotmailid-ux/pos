const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const net = require('net');
const fs = require('fs');

function writeLog(message) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'app.log');

    // Roll/Rotate logs if the file exceeds 5MB
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > 5 * 1024 * 1024) {
        const oldLog = path.join(logDir, 'app.log.old');
        if (fs.existsSync(oldLog)) {
          fs.unlinkSync(oldLog);
        }
        fs.renameSync(logFile, oldLog);
      }
    }

    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('Failed writing rolling log file:', err.message);
  }
}

// Global Exception Handling
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception in Electron Main Process:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('CRITICAL: Unhandled Rejection in Electron Main Process:', reason);
});

// Single Instance Lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  let mainWindow;
  let serverProcess;
  let isStopping = false;
  let backendRestartCount = 0;
  const MAX_BACKEND_RESTARTS = 5;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function checkPort(port, host, callback) {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        callback(true);
      } else {
        callback(false);
      }
    });
    server.once('listening', () => {
      server.close();
      callback(false);
    });
    server.listen(port, host);
  }

  function startBackendServer() {
    if (isStopping) return;

    const serverPath = path.join(__dirname, 'server', 'server.js');

    serverProcess = fork(serverPath, [], {
      silent: true,
      env: {
        ...process.env,
        PORT: 5000,
        NODE_ENV: 'production',
        SQLITE_DB_PATH: path.join(app.getPath('userData'), 'database.sqlite')
      }
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      console.log(`[Backend]: ${msg}`);
      writeLog(`[Backend]: ${msg}`);
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      console.error(`[Backend ERROR]: ${msg}`);
      writeLog(`[Backend ERROR]: ${msg}`);
    });

    serverProcess.on('close', (code) => {
      const msg = `Backend server exited with code ${code}`;
      console.log(msg);
      writeLog(msg);
      
      // Auto-Healing with threshold to prevent infinite loop process spawns
      if (code !== 0 && !isStopping) {
        backendRestartCount++;
        if (backendRestartCount <= MAX_BACKEND_RESTARTS) {
          console.log(`Backend crashed unexpectedly. Restarting server (Attempt ${backendRestartCount}/${MAX_BACKEND_RESTARTS}) in 2 seconds...`);
          setTimeout(startBackendServer, 2000);
        } else {
          console.error(`CRITICAL: Backend crashed ${backendRestartCount} times. Disabling auto-heal.`);
          dialog.showErrorBox(
            "Database Connection Error",
            "The backend server crashed repeatedly. Please ensure MongoDB is running locally on port 27017 and restart the application."
          );
          app.quit();
        }
      }
    });
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 600,
      title: "SuperMart POS",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    mainWindow.loadURL('http://localhost:5000');

    // Renderer Crash Recovery
    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error(`Renderer process gone! Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'POS Terminal Alert',
        message: 'The rendering process experienced an unexpected issue. The terminal interface will reload automatically.',
        buttons: ['OK']
      }).then(() => {
        if (mainWindow) {
          mainWindow.reload();
        }
      });
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.on('ready', () => {
    checkPort(5000, '127.0.0.1', (inUse) => {
      if (inUse) {
        console.error('CRITICAL: Port 5000 is occupied. POS startup blocked.');
        dialog.showErrorBox(
          "Port Conflict Error",
          "Port 5000 is already in use by another program. Please close any other running instances of SuperMart POS and try again."
        );
        app.quit();
        return;
      }
      startBackendServer();
      setTimeout(createWindow, 1500);
    });
  });

  app.on('window-all-closed', () => {
    isStopping = true;
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    isStopping = true;
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
  });
}
