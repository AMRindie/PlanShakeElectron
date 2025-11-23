// Auto-updater UI handler
// Add this to your existing app initialization

(function initAutoUpdater() {
  // Check if running in Electron
  if (!window.electronAPI) {
    console.log('Not running in Electron - auto-update disabled');
    return;
  }

  console.log('Auto-updater initialized');

  // Check and log the real version
  window.electronAPI.getVersion().then(version => {
    console.log('Current App Version:', version);
    // Update the version display in the splash screen or UI if needed
    const versionEl = document.querySelector('.version');
    if (versionEl) versionEl.textContent = `v${version}`;
  });

  // Create update notification UI
  function createUpdateNotification() {
    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      min-width: 300px;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: none;
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    return notification;
  }

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    #update-notification .update-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    #update-notification .update-message {
      font-size: 14px;
      margin-bottom: 15px;
      opacity: 0.9;
    }
    
    #update-notification .update-buttons {
      display: flex;
      gap: 10px;
    }
    
    #update-notification button {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    #update-notification .btn-primary {
      background: white;
      color: #667eea;
    }
    
    #update-notification .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255,255,255,0.3);
    }
    
    #update-notification .btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    
    #update-notification .btn-secondary:hover {
      background: rgba(255,255,255,0.3);
    }
    
    #update-notification .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.3);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 10px;
    }
    
    #update-notification .progress-fill {
      height: 100%;
      background: white;
      transition: width 0.3s ease;
      width: 0%;
    }
  `;
  document.head.appendChild(style);

  const notification = createUpdateNotification();

  // Update available
  window.electronAPI.onUpdateAvailable((info) => {
    notification.innerHTML = `
      <div class="update-title">🎉 Update Available!</div>
      <div class="update-message">Version ${info.version} is ready to download.</div>
      <div class="update-buttons">
        <button class="btn-primary" onclick="window.electronAPI.downloadUpdate()">Download</button>
        <button class="btn-secondary" onclick="document.getElementById('update-notification').style.display='none'">Later</button>
      </div>
    `;
    notification.style.display = 'block';
  });

  // Download progress
  window.electronAPI.onDownloadProgress((progress) => {
    const percent = Math.round(progress.percent);
    notification.innerHTML = `
      <div class="update-title">⬇️ Downloading Update...</div>
      <div class="update-message">${percent}% complete</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percent}%"></div>
      </div>
    `;
    notification.style.display = 'block';
  });

  // Update downloaded
  window.electronAPI.onUpdateDownloaded((info) => {
    notification.innerHTML = `
      <div class="update-title">✅ Update Ready!</div>
      <div class="update-message">Version ${info.version} has been downloaded. Restart to install.</div>
      <div class="update-buttons">
        <button class="btn-primary" onclick="window.electronAPI.installUpdate()">Restart Now</button>
        <button class="btn-secondary" onclick="document.getElementById('update-notification').style.display='none'">Later</button>
      </div>
    `;
    notification.style.display = 'block';
  });

  // Status messages (optional - for debugging)
  window.electronAPI.onUpdateStatus((text) => {
    console.log('Update status:', text);
  });

  // Add manual check button (optional)
  window.checkForUpdates = () => {
    window.electronAPI.checkForUpdates();
    notification.innerHTML = `
      <div class="update-title">🔍 Checking for Updates...</div>
      <div class="update-message">Please wait...</div>
    `;
    notification.style.display = 'block';

    // Hide after 3 seconds if no update found
    setTimeout(() => {
      if (notification.querySelector('.update-title').textContent.includes('Checking')) {
        notification.style.display = 'none';
      }
    }, 3000);
  };
})();
