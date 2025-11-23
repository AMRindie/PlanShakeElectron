const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.info('App starting...');

// Import auto-updater only in production
let autoUpdater;
// Check if running in development mode  
const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

if (!isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    // Configure auto-updater
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    log.info('Auto-updater loaded successfully');
  } catch (error) {
    log.error('Failed to load electron-updater:', error.message);
    console.log('Auto-update functionality will be disabled');
    autoUpdater = null;
  }
} else {
  console.log('Running in development mode - auto-updater disabled');
}

// Keep global references of the window objects
let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'website', 'PlanShake512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile('website/splash.html');
  splashWindow.center();
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'website', 'PlanShake512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Disable web security features that make it feel like a browser
      webSecurity: true,
      // Enable native window features
      enableRemoteModule: false,
      // Better performance
      backgroundThrottling: false
    },
    backgroundColor: '#1a1a2e',
    show: false, // Keep hidden until ready
    // Native window features
    frame: false, // Frameless window for custom title bar
    titleBarStyle: 'hidden', // Hide default title bar
    titleBarOverlay: false, // We are building our own
    // Windows-specific
    autoHideMenuBar: true,
    // Better window behavior
    center: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true
  });

  // Load the index.html of the app
  mainWindow.loadFile('website/index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    // Wait a small moment to ensure splash screen is seen (optional, but nice)
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }, 1500); // 1.5 seconds splash screen
  });

  // Open external links in default browser (not in app)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation away from app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = mainWindow.webContents.getURL();
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    // You can add confirmation dialog here if needed
  });

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Remove default menu on right-click (optional - makes it feel less like browser)
  mainWindow.webContents.on('context-menu', (event, params) => {
    // You can create a custom context menu here if needed
  });

  // Disable zoom with Ctrl+Scroll (browser behavior)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.type === 'mouseWheel') {
      event.preventDefault();
    }
  });

  // Register global shortcut for DevTools
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// Auto-updater event handlers (only in production)
if (!isDev && autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    sendStatusToWindow('Update available!');

    // Show dialog to user
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
    sendStatusToWindow('You are running the latest version.');
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    sendStatusToWindow('Error checking for updates: ' + err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);

    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    sendStatusToWindow('Update downloaded. Will install on quit.');

    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });
}

function sendStatusToWindow(text) {
  log.info(text);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', text);
  }
}

// IPC handlers for update actions
if (ipcMain) {
  ipcMain.on('download-update', () => {
    log.info('User requested download update');
    if (!isDev && autoUpdater) {
      autoUpdater.downloadUpdate();
    }
  });

  ipcMain.on('install-update', () => {
    if (!isDev && autoUpdater) {
      autoUpdater.quitAndInstall();
    }
  });

  ipcMain.handle('check-for-updates', async () => {
    if (!isDev && autoUpdater) {
      try {
        const result = await autoUpdater.checkForUpdates();
        return result;
      } catch (error) {
        log.error('Error checking for updates:', error);
        return { error: error.message };
      }
    } else {
      log.info('Auto-updater not available in development mode');
      return { error: 'Auto-updater disabled in dev mode' };
    }
  });

  // Handle external link clicks
  ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
  });

  // Handle file dialogs (native feel)
  ipcMain.handle('show-open-dialog', async (event, options) => {
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle('show-save-dialog', async (event, options) => {
    return dialog.showSaveDialog(mainWindow, options);
  });

  // Get App Version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Custom Window Controls
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });
}

// App lifecycle events
if (app) {
  // Single instance lock (prevent multiple instances)
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      createSplashWindow();
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

    app.on('will-quit', () => {
      // Unregister all shortcuts
      const { globalShortcut } = require('electron');
      globalShortcut.unregisterAll();
    });

    // Check for updates every hour - only in production
    if (!isDev && autoUpdater) {
      setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 60 * 60 * 1000);
    }
  }
}
