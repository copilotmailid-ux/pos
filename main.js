const { app, BrowserWindow, dialog } = require('electron');
// Disable hardware acceleration to save memory and make launch instant on POS machines
app.disableHardwareAcceleration();
const path = require('path');
const { fork, exec } = require('child_process');
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

  function killProcessOnPort(port) {
    return new Promise((resolve) => {
      writeLog(`Checking port ${port} to kill any conflicting processes...`);
      if (process.platform !== 'win32') {
        // macOS/Linux
        exec(`lsof -t -i:${port}`, (err, stdout) => {
          if (!err && stdout.trim()) {
            const pid = stdout.trim();
            writeLog(`[macOS/Linux] Found PID ${pid} on port ${port}. Terminating...`);
            exec(`kill -9 ${pid}`, (killErr) => {
              if (killErr) {
                writeLog(`[macOS/Linux] Failed to kill PID ${pid}: ${killErr.message}`);
              } else {
                writeLog(`[macOS/Linux] Successfully killed PID ${pid}`);
              }
              resolve(true);
            });
          } else {
            resolve(false);
          }
        });
        return;
      }

      // Windows
      exec(`netstat -ano`, (err, stdout) => {
        if (err || !stdout) {
          writeLog(`[Windows] netstat -ano failed or returned empty: ${err ? err.message : 'no stdout'}`);
          return resolve(false);
        }

        const lines = stdout.replace(/\r/g, '').split('\n');
        const pidsToKill = new Set();

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const localAddress = parts[1];
            const pidStr = parts[parts.length - 1];
            const pid = parseInt(pidStr, 10);
            if ((localAddress.endsWith(`:${port}`) || localAddress.endsWith(`]:${port}`)) && !isNaN(pid) && pid > 4 && pid !== process.pid) {
              writeLog(`[Windows] Found PID ${pid} occupying port ${port} (LocalAddress: ${localAddress})`);
              pidsToKill.add(pid);
            }
          }
        }

        if (pidsToKill.size === 0) {
          writeLog(`[Windows] No other processes are occupying port ${port}.`);
          return resolve(false);
        }

        const killPromises = Array.from(pidsToKill).map((pid) => {
          return new Promise((res) => {
            writeLog(`[Windows] Terminating process PID ${pid}...`);
            exec(`taskkill /F /PID ${pid}`, (killErr, killStdout, killStderr) => {
              if (killErr) {
                writeLog(`[Windows] Failed to kill PID ${pid}: ${killErr.message}. Stderr: ${killStderr.trim()}`);
              } else {
                writeLog(`[Windows] Successfully killed PID ${pid}. Stdout: ${killStdout.trim()}`);
              }
              res();
            });
          });
        });

        Promise.all(killPromises).then(() => {
          writeLog(`[Windows] Finished attempting to kill all processes on port ${port}.`);
          resolve(true);
        });
      });
    });
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
            "Backend Connection Error",
            "The backend server crashed repeatedly. Please ensure no other process is occupying port 5000 and restart the application."
          );
          app.quit();
        }
      }
    });
  }

  function waitForServerAndLoad() {
    const http = require('http');
    const pollInterval = setInterval(() => {
      const req = http.request({
        method: 'GET',
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/health',
        timeout: 200
      }, (res) => {
        if (res.statusCode === 200) {
          clearInterval(pollInterval);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('http://127.0.0.1:5000').catch(() => {});
          }
        }
      });
      
      req.on('error', () => {
        // Backend not ready yet, retry on next interval tick
      });
      
      req.on('timeout', () => {
        req.destroy();
      });
      
      req.end();
    }, 100);

    // Hard fallback: clear interval and attempt load after 8 seconds anyway
    setTimeout(() => {
      clearInterval(pollInterval);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL('http://127.0.0.1:5000').catch(() => {});
      }
    }, 8000);
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

  app.on('ready', async () => {
    writeLog('App ready. Cleaning up port 5000 if occupied...');
    try {
      await killProcessOnPort(5000);
      // Wait a moment for OS to release the port socket fully
      await new Promise((res) => setTimeout(res, 500));
    } catch (e) {
      writeLog(`Error during initial port cleanup: ${e.message}`);
    }

    // Double check if the port is STILL occupied
    checkPort(5000, '127.0.0.1', (stillInUse) => {
      if (stillInUse) {
        writeLog('CRITICAL: Port 5000 is still occupied after termination attempt. Exiting...');
        dialog.showErrorBox(
          "Port Conflict Error",
          "Port 5000 is already in use by another program and could not be freed. Please close any conflicting applications and try again."
        );
        app.quit();
        return;
      }
      startBackendServer();
      createWindow(); // Open window immediately
      waitForServerAndLoad(); // Active poll backend health check and load the URL instantly
    });
  });

  function shutdownServer() {
    return new Promise((resolve) => {
      const http = require('http');
      const req = http.request({
        method: 'POST',
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/internal/shutdown',
        timeout: 1000
      }, (res) => {
        resolve();
      });
      
      req.on('error', (err) => {
        console.error('Graceful database shutdown request error:', err.message);
        resolve();
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });
      
      req.end();
    });
  }

  app.on('window-all-closed', async () => {
    isStopping = true;
    if (serverProcess) {
      // Trigger the HTTP database shutdown endpoint first for Windows signals safety
      await shutdownServer();

      // Force terminate fallback if the database takes too long to close
      const safetyForceKill = setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill('SIGKILL');
        }
        if (process.platform !== 'darwin') {
          app.quit();
        }
      }, 1500);

      serverProcess.on('exit', () => {
        clearTimeout(safetyForceKill);
        if (process.platform !== 'darwin') {
          app.quit();
        }
      });
    } else {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    }
  });

  app.on('will-quit', () => {
    isStopping = true;
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }
  });
}
