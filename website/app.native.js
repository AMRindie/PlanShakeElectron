// Native app integration
// This script adds native app behaviors, custom title bar, and integrates with Electron

(function initNativeIntegration() {
  // Check if running in Electron
  if (!window.electronAPI) {
    console.log('Not running in Electron - native features disabled');
    return;
  }

  console.log('Native app integration initialized');

  // --- Custom Title Bar Logic ---
  const minBtn = document.getElementById('min-btn');
  const maxBtn = document.getElementById('max-btn');
  const closeBtn = document.getElementById('close-btn');

  if (minBtn) minBtn.addEventListener('click', () => window.electronAPI.minimize());
  if (maxBtn) maxBtn.addEventListener('click', () => window.electronAPI.maximize());
  if (closeBtn) closeBtn.addEventListener('click', () => window.electronAPI.close());

  // --- Keyboard Shortcuts ---
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

  // --- Native Selection Behavior ---
  document.addEventListener('selectstart', (e) => {
    // Allow text selection in inputs and textareas
    if (e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.isContentEditable) {
      return;
    }
    // Prevent selection on UI elements (more native feel)
    if (e.target.classList.contains('no-select') ||
      e.target.closest('.no-select') ||
      e.target.closest('.titlebar')) { // Also prevent selection on titlebar
      e.preventDefault();
    }
  });

  // --- CSS Injection for Native Look & Title Bar ---
  const style = document.createElement('style');
  style.textContent = `
    /* Title Bar Styling */
    .titlebar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 32px;
      background: #1a1a2e; /* Match app background */
      color: #fff;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 9999;
      user-select: none;
      -webkit-user-select: none;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .titlebar-drag-region {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      -webkit-app-region: drag;
      z-index: -1;
    }

    .titlebar-title {
      padding-left: 12px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      opacity: 0.8;
      pointer-events: none;
    }

    .titlebar-controls {
      display: flex;
      height: 100%;
      -webkit-app-region: no-drag;
    }

    .titlebar-button {
      width: 46px;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: default;
      transition: background 0.1s;
      color: #ccc;
    }

    .titlebar-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .titlebar-button.close-btn:hover {
      background: #e81123;
      color: #fff;
    }
    
    /* Adjust app header to sit below titlebar */
    .app-header {
      margin-top: 32px;
    }
    
    .modal {
      z-index: 10000; /* Above titlebar if needed, or adjust titlebar z-index */
    }

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

  // Block browser keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Zoom: Ctrl + / Ctrl - / Ctrl 0
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0' || e.key === '=')) {
      e.preventDefault();
    }

    // Reload: Ctrl + R / F5
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
      e.preventDefault();
    }

    // History Navigation: Alt + Left / Alt + Right
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
    }
  });

  // Prevent default drag behavior on images
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });

  // Add native-like window title updates
  function updateWindowTitle(title) {
    document.title = title || 'PlanShake';
    const titleEl = document.querySelector('.titlebar-title');
    if (titleEl) titleEl.textContent = title || 'PlanShake';
  }

  // Export for use in other scripts
  window.updateWindowTitle = updateWindowTitle;

  // Show that we're in native app mode
  console.log('✅ Native app mode active');
  console.log('📋 Keyboard shortcuts:', shortcuts);

})();
