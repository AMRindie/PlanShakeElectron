if (window.electronAPI?.isElectron) {

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
      const versionEl = document.querySelector('.version');
      if (versionEl) versionEl.textContent = `v${version}`;
    });

    // Create update notification UI
    function createUpdateNotification() {
      const notification = document.createElement('div');
      notification.id = 'update-notification';
      
      // VisionOS / Liquid Glass Styling
      notification.style.cssText = `
        position: fixed;
        bottom: 30px; /* Moved to bottom right for better OS integration feel */
        right: 30px;
        
        /* Glass Material */
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(40px) saturate(180%);
        -webkit-backdrop-filter: blur(40px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.5);
        
        /* Shadows & Depth */
        box-shadow: 
            0 20px 50px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
            
        color: #1D1D1F; /* var(--text-primary) */
        padding: 24px;
        border-radius: 24px; /* var(--radius-panel) */
        z-index: 10000;
        min-width: 340px;
        max-width: 400px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        display: none;
        animation: floatUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-origin: bottom right;
      `;
      document.body.appendChild(notification);
      return notification;
    }

    // Add animation styles and internal component styling
    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatUp {
        from {
          transform: translateY(20px) scale(0.95);
          opacity: 0;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }
      
      #update-notification .update-title {
        font-size: 1.05rem;
        font-weight: 700;
        margin-bottom: 6px;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      #update-notification .update-message {
        font-size: 0.9rem;
        color: #6e6e73; /* var(--text-secondary) */
        margin-bottom: 20px;
        line-height: 1.4;
      }
      
      #update-notification .update-buttons {
        display: flex;
        gap: 12px;
      }
      
      #update-notification button {
        flex: 1;
        padding: 10px 18px;
        border: none;
        border-radius: 999px; /* var(--radius-button) */
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Primary Button (Blue Pill) */
      #update-notification .btn-primary {
        background: #007AFF; /* var(--accent-blue) */
        color: white;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
      }
      
      #update-notification .btn-primary:hover {
        background: #0062cc;
        transform: scale(1.02);
        box-shadow: 0 6px 16px rgba(0, 122, 255, 0.3);
      }
      
      /* Secondary Button (Glass/Recessed) */
      #update-notification .btn-secondary {
        background: rgba(0, 0, 0, 0.05);
        color: #1D1D1F;
        box-shadow: none;
      }
      
      #update-notification .btn-secondary:hover {
        background: rgba(0, 0, 0, 0.1);
      }
      
      /* VisionOS Style Progress Bar */
      #update-notification .progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 99px;
        overflow: hidden;
        margin-top: 12px;
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
      }
      
      #update-notification .progress-fill {
        height: 100%;
        background: #007AFF; /* var(--accent-blue) */
        transition: width 0.3s ease;
        width: 0%;
        border-radius: 99px;
        box-shadow: 0 0 10px rgba(0, 122, 255, 0.3);
      }
    `;
    document.head.appendChild(style);

    const notification = createUpdateNotification();

    // Update available
    window.electronAPI.onUpdateAvailable((info) => {
      notification.innerHTML = `
        <div class="update-title">🎉 Update Available</div>
        <div class="update-message">Version <strong>${info.version}</strong> is ready to download.</div>
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
        <div class="update-title">⬇️ Downloading...</div>
        <div class="update-message">Optimizing workspace (${percent}%)</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
      `;
      notification.style.display = 'block';
    });

    // Update downloaded
    window.electronAPI.onUpdateDownloaded((info) => {
      notification.innerHTML = `
        <div class="update-title">✅ Update Ready</div>
        <div class="update-message">Version ${info.version} has been downloaded. Restart to apply changes.</div>
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
        <div class="update-title">🔍 Checking Updates</div>
        <div class="update-message">Connecting to server...</div>
      `;
      notification.style.display = 'block';

      // Hide after 3 seconds if no update found
      setTimeout(() => {
        if (notification.querySelector('.update-title')?.textContent.includes('Checking')) {
          notification.style.display = 'none';
        }
      }, 3000);
    };
  })();
}