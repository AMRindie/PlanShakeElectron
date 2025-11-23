// Native app integration
// This script adds native app behaviors and integrates with Electron menus

(function initNativeIntegration() {
  // Check if running in Electron
  if (!window.electronAPI) {
    console.log('Not running in Electron - native features disabled');
    return;
  }

  console.log('Native app integration initialized');

  // Integrate with native menu - DISABLED (user doesn't want native menu)
  /*
  window.electronAPI.onMenuNewProject(() => {
      console.log('Menu: New Project clicked');
      const addBtn = document.getElementById('addProjectBtn');
      if (addBtn) {
          addBtn.click();
      }
  });

  window.electronAPI.onMenuExport(() => {
      console.log('Menu: Export clicked');
      const exportBtn = document.getElementById('exportBtn');
      if (exportBtn) {
          exportBtn.click();
      }
  });

  window.electronAPI.onMenuImport(() => {
      console.log('Menu: Import clicked');
      const importBtn = document.getElementById('importAllBtn');
      if (importBtn) {
          importBtn.click();
      }
  });
  */

  // Add keyboard shortcuts info (standard shortcuts still work)
  const shortcuts = {
    'Ctrl+Z': 'Undo',
    'Ctrl+Y': 'Redo',
    'Ctrl+C': 'Copy',
    'Ctrl+V': 'Paste',
    'Ctrl+X': 'Cut',
    'F11': 'Toggle Fullscreen',
    'Alt+F4': 'Exit'
  };

  // Make shortcuts available globally
  window.appShortcuts = shortcuts;

  // Add native-like selection behavior
  document.addEventListener('selectstart', (e) => {
    // Allow text selection in inputs and textareas
    if (e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.isContentEditable) {
      return;
    }
    // Prevent selection on UI elements (more native feel)
    if (e.target.classList.contains('no-select') ||
      e.target.closest('.no-select')) {
      e.preventDefault();
    }
  });

  // Add CSS class for non-selectable UI elements
  const style = document.createElement('style');
  style.textContent = `
    /* Native app styling */
    .no-select {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    /* Remove browser-like text cursor on non-text elements */
    button, .button, .btn, .card, .project-card {
      cursor: default !important;
      -webkit-user-select: none;
      user-select: none;
    }

    /* Proper cursor for clickable items */
    button:hover, .button:hover, .btn:hover, 
    a, [onclick], [role="button"] {
      cursor: pointer !important;
    }

    /* Remove browser-like focus outlines, add native-style ones */
    *:focus {
      outline: none;
    }

    button:focus, input:focus, textarea:focus, select:focus {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    /* Native-like scrollbars (Windows style) */
    ::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }

    ::-webkit-scrollbar-track {
      background: #2a2a3e;
    }

    ::-webkit-scrollbar-thumb {
      background: #4a4a5e;
      border-radius: 6px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #5a5a6e;
    }

    /* Remove browser-like link styling */
    a {
      color: inherit;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Native window drag region (if you want custom titlebar later) */
    .titlebar {
      -webkit-app-region: drag;
    }

    .titlebar button {
      -webkit-app-region: no-drag;
    }
  `;
  document.head.appendChild(style);

  // Add no-select class to common UI elements
  document.addEventListener('DOMContentLoaded', () => {
    // Add to header
    const header = document.querySelector('.app-header');
    if (header) {
      header.classList.add('no-select');
    }

    // Add to buttons
    document.querySelectorAll('button, .btn').forEach(btn => {
      btn.classList.add('no-select');
    });

    // Add to cards
    document.querySelectorAll('.card, .project-card').forEach(card => {
      card.classList.add('no-select');
    });
  });

  // Prevent zoom with Ctrl+Mouse Wheel (browser behavior)
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent default drag behavior on images
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });

  // Add native-like window title updates
  function updateWindowTitle(title) {
    document.title = title || 'PlanShake';
  }

  // Export for use in other scripts
  window.updateWindowTitle = updateWindowTitle;

  // Show that we're in native app mode
  console.log('✅ Native app mode active');
  console.log('📋 Keyboard shortcuts:', shortcuts);

})();
