// ============================================
// PlanShake Native Integration
// ============================================

(function initNativeIntegration() {
  const isElectron = window.electronAPI?.isElectron;

  console.log(isElectron ? '✅ Native app mode active' : '🌐 Running in browser mode');

  // --- Common UI Setup ---
  document.addEventListener('DOMContentLoaded', () => {
    // Add no-select to interactive elements
    const header = document.querySelector('.app-header');
    if (header) header.classList.add('no-select');
    document.querySelectorAll('button, .btn, .card, .project-card').forEach(el => el.classList.add('no-select'));

    // Initialize settings
    initSettings();
  });

  // --- Native Helpers (only in Electron) ---
  if (isElectron) {
    // Disable image dragging
    document.addEventListener('dragstart', (e) => {
      if (e.target.tagName === 'IMG') e.preventDefault();
    });

    // Disable zoom with Ctrl+Scroll
    document.addEventListener('wheel', (e) => {
      if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // Disable browser shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['+', '-', '0', '=', 'r'].includes(e.key) || e.key === 'F5') e.preventDefault();
      if (e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    });
  }

  // --- Settings System ---
  function initSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const clearProjectsBtn = document.getElementById('clearProjectsBtn');
    const languageSelect = document.getElementById('languageSelect');
    const appThemeSelect = document.getElementById('appThemeSelect');

    if (!settingsModal) return;

    // Load saved settings
    const savedLang = localStorage.getItem('planshake_language') || 'en';
    const savedTheme = localStorage.getItem('planshake_theme') || 'light';

    if (languageSelect) languageSelect.value = savedLang;
    if (appThemeSelect) appThemeSelect.value = savedTheme;

    // Apply theme on load
    applyTheme(savedTheme);

    // Open settings modal
    if (settingsBtn) {
      settingsBtn.addEventListener('click', async () => {
        settingsModal.classList.remove('hidden');
        // Update version display
        const versionDisplay = document.getElementById('settingsVersionDisplay');
        if (versionDisplay) {
          if (window.electronAPI?.isElectron && window.electronAPI?.getVersion) {
            try {
              const version = await window.electronAPI.getVersion();
              versionDisplay.textContent = 'v' + version;
            } catch (e) {
              versionDisplay.textContent = t ? t('webVersion') : 'Web Version';
            }
          } else {
            versionDisplay.textContent = t ? t('webVersion') : 'Web Version';
          }
        }
      });
    }

    // Close settings modal
    const closeSettings = () => settingsModal.classList.add('hidden');
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

    const settingsBackdrop = settingsModal.querySelector('.modal-backdrop');
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);

    // Language change
    if (languageSelect) {
      languageSelect.addEventListener('change', (e) => {
        localStorage.setItem('planshake_language', e.target.value);
        // Language logic can be expanded later for i18n
        console.log(`Language set to: ${e.target.value}`);
      });
    }

    // Theme change
    if (appThemeSelect) {
      appThemeSelect.addEventListener('change', (e) => {
        localStorage.setItem('planshake_theme', e.target.value);
        applyTheme(e.target.value);
      });
    }

    // Clear Projects button - use custom confirm dialog
    if (clearProjectsBtn) {
      clearProjectsBtn.addEventListener('click', async () => {
        const confirmed = await window.customConfirm(
          t('clearAllProjectsConfirm'),
          { title: "⚠️ " + t('clearAllProjects'), confirmText: t('deleteAll'), danger: true }
        );

        if (confirmed) {
          // Clear all project data
          localStorage.removeItem('trelloLiteData');
          settingsModal.classList.add('hidden');
          // Reload the page to reflect changes
          window.location.reload();
        }
      });
    }

    // Cache Management
    const cacheEnabledToggle = document.getElementById('cacheEnabledToggle');
    const cacheSizeDisplay = document.getElementById('cacheSizeDisplay');
    const clearCacheBtn = document.getElementById('clearCacheBtn');

    // Load cache preference
    const cacheEnabled = localStorage.getItem('planshake_cache_enabled') !== 'false';
    if (cacheEnabledToggle) cacheEnabledToggle.checked = cacheEnabled;

    // Update cache size display
    async function updateCacheSize() {
      if (cacheSizeDisplay && window.electronAPI?.getCacheSize) {
        try {
          const bytes = await window.electronAPI.getCacheSize();
          const mb = (bytes / (1024 * 1024)).toFixed(2);
          cacheSizeDisplay.textContent = bytes > 0 ? `${mb} MB` : '0 MB';
        } catch (e) {
          cacheSizeDisplay.textContent = 'N/A';
        }
      }
    }

    // Update cache size when settings modal opens
    if (settingsBtn) {
      const originalClick = settingsBtn.onclick;
      settingsBtn.addEventListener('click', updateCacheSize);
    }

    // Toggle cache enabled
    if (cacheEnabledToggle) {
      cacheEnabledToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('planshake_cache_enabled', enabled.toString());
        if (window.electronAPI?.setCacheEnabled) {
          window.electronAPI.setCacheEnabled(enabled);
        }
        console.log(`Caching ${enabled ? 'enabled' : 'disabled'}`);
      });
    }

    // Clear cache button
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        if (window.electronAPI?.clearCache) {
          clearCacheBtn.disabled = true;
          clearCacheBtn.textContent = '⏳ ' + (t ? t('clearing') || 'Clearing...' : 'Clearing...');
          try {
            await window.electronAPI.clearCache();
            await updateCacheSize();
            clearCacheBtn.innerHTML = '✅ ' + (t ? t('cacheCleared') || 'Cache Cleared!' : 'Cache Cleared!');
            setTimeout(() => {
              clearCacheBtn.innerHTML = '🧹 <span data-i18n="clearCache">' + (t ? t('clearCache') || 'Clear Cache' : 'Clear Cache') + '</span>';
              clearCacheBtn.disabled = false;
            }, 2000);
          } catch (e) {
            clearCacheBtn.textContent = '❌ Error';
            clearCacheBtn.disabled = false;
          }
        } else {
          console.log('Clear cache not available in browser mode');
        }
      });
    }
  }

  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }



  // Expose for external use
  window.updateWindowTitle = (title) => {
    document.title = title || 'PlanShake';
  };

})();