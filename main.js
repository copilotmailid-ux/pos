const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;
let isStopping = false; // Prevents loops when closing the app

function startBackendServer() {
  if (isStopping) return;
  
  const serverPath = path.join(__dirname, 'server', 'server.js');
  
  serverProcess = fork(serverPath, [], {
    silent: true,
    env: { 
      ...process.env, 
      PORT: 5000, 
      NODE_ENV: 'production'
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Backend]: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Backend ERROR]: ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Backend server exited with code ${code}`);
    // Auto-Healing: If the server crashed (exit code not 0), restart it automatically!
    if (code !== 0 && !isStopping) {
      console.log('Backend crashed unexpectedly. Restarting server in 2 seconds...');
      setTimeout(startBackendServer, 2000);
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackendServer();
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  isStopping = true;
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});
