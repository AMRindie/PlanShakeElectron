const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Auto-updater methods
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.send('download-update'),
    installUpdate: () => ipcRenderer.send('install-update'),

    // Auto-updater event listeners
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, text) => callback(text)),

    // Menu event listeners - DISABLED (user doesn't want native menu)
    // onMenuNewProject: (callback) => ipcRenderer.on('menu-new-project', callback),
    // onMenuExport: (callback) => ipcRenderer.on('menu-export', callback),
    // onMenuImport: (callback) => ipcRenderer.on('menu-import', callback),

    // External links (open in default browser, not in app)
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // Native dialogs
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

    // Platform info
    platform: process.platform,
    version: '0.0.0', // Placeholder, use getVersion() for real version

    // Async version check (most reliable)
    getVersion: () => ipcRenderer.invoke('get-app-version'),

    // Window Controls (for custom title bar)
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Check if running in Electron (useful for conditional features)
    isElectron: true
});

// Disable default browser behaviors
window.addEventListener('DOMContentLoaded', () => {
    // Disable text selection on drag (more native feel)
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            // Allow dragging for your app's drag-drop features
            // but prevent accidental text selection dragging
        }
    });

    // Prevent default context menu (you can add custom one in your app)
    // Uncomment if you want to completely disable right-click menu
    // document.addEventListener('contextmenu', (e) => {
    //   e.preventDefault();
    // });

    // Disable F5 refresh in production (use Ctrl+R instead via menu)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F5' && !e.ctrlKey) {
            e.preventDefault();
        }
    });

    // Handle external links - open in browser, not in app
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (target && target.href && (target.href.startsWith('http://') || target.href.startsWith('https://'))) {
            e.preventDefault();
            ipcRenderer.send('open-external', target.href);
        }
    });
});
