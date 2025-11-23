const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import auto-updater only in production
let autoUpdater;
// Check if running in development mode  
const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

if (!isDev) {
  autoUpdater = require('electron-updater').autoUpdater;
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
} else {
  console.log('Running in development mode - auto-updater disabled');
}

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'PlanShake512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1a1a2e',
    show: false
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development (optional - comment out for production)
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Auto-updater event handlers (only in production)
if (!isDev && autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
    sendStatusToWindow('Update available!');

    // Show dialog to user
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info);
    sendStatusToWindow('You are running the latest version.');
  });

  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
    sendStatusToWindow('Error checking for updates: ' + err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);

    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
    sendStatusToWindow('Update downloaded. Will install on quit.');

    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });
}

function sendStatusToWindow(text) {
  console.log(text);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', text);
  }
}

// IPC handlers for update actions
if (ipcMain) {
  ipcMain.on('download-update', () => {
    if (!isDev && autoUpdater) {
      autoUpdater.downloadUpdate();
    }
  });

  ipcMain.on('install-update', () => {
    if (!isDev && autoUpdater) {
      autoUpdater.quitAndInstall();
    }
  });

  ipcMain.on('check-for-updates', () => {
    if (!isDev && autoUpdater) {
      autoUpdater.checkForUpdates();
    } else {
      console.log('Auto-updater not available in development mode');
    }
  });
}

// App lifecycle events
if (app) {
  app.whenReady().then(() => {
    createWindow();

    // Check for updates after app is ready (wait 3 seconds) - only in production
    if (!isDev && autoUpdater) {
      setTimeout(() => {
        autoUpdater.checkForUpdates();
      }, 3000);
    }

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Quit when all windows are closed, except on macOS
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });

  // Check for updates every hour - only in production
  if (!isDev && autoUpdater) {
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);
  }
}
