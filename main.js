const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');

// Import auto-updater only in production
let autoUpdater;
// Check if running in development mode  
const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

if (!isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    console.log('Auto-updater loaded successfully');
  } catch (error) {
    console.error('Failed to load electron-updater:', error.message);
    console.log('Auto-update functionality will be disabled');
    autoUpdater = null;
  }
} else {
  console.log('Running in development mode - auto-updater disabled');
}

// Keep a global reference of the window object
let mainWindow;

// Create native application menu - DISABLED per user request
/*
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-export');
          }
        },
        {
          label: 'Import',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.send('menu-import');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (!isDev && autoUpdater) {
              autoUpdater.checkForUpdates();
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Updates',
                message: 'You are running the latest version.',
                buttons: ['OK']
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About PlanShake',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About PlanShake',
              message: 'PlanShake',
              detail: `Version: ${app.getVersion()}\nA beautiful project management application.`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // Add Developer menu in development mode
  if (isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'F5',
          click: () => {
            mainWindow.reload();
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
*/


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
      preload: path.join(__dirname, 'preload.js'),
      // Disable web security features that make it feel like a browser
      webSecurity: true,
      // Enable native window features
      enableRemoteModule: false,
      // Better performance
      backgroundThrottling: false
    },
    backgroundColor: '#1a1a2e',
    show: false,
    // Native window features
    frame: true,
    titleBarStyle: 'default',
    // Windows-specific
    autoHideMenuBar: true, // Hide menu bar (user doesn't want it)
    // Better window behavior
    center: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
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
    // event.preventDefault();
    // dialog.showMessageBox(...)
  });

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Create native menu - DISABLED per user request
  // createMenu();

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
}
