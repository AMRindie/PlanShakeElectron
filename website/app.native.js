if (window.electronAPI?.isElectron) {

  (function initNativeIntegration() {
    // Check if running in Electron
    if (!window.electronAPI) {
      console.log('Not running in Electron - native features disabled');
      return;
    }

    console.log('Native app integration initialized');

    // --- References ---
    const titleBar = document.getElementById('custom-titlebar');
    const minBtn = document.getElementById('min-btn');
    const maxBtn = document.getElementById('max-btn');
    const closeBtn = document.getElementById('close-btn');

    // --- Window Controls Logic ---
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
    window.appShortcuts = shortcuts;

    // --- 1. CSS Injection for Styles ---
    const style = document.createElement('style');
    style.textContent = `
      /* Disable text selection globally except for inputs, textarea, and contenteditable */
      html, body, * {
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      textarea, textarea *,
      input, input *,
      [contenteditable], [contenteditable] * {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      :root {
        --header-height: 110px;
        --tb-height: 32px;
      }

      /* Base Titlebar Structure */
      .titlebar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: var(--tb-height);
        z-index: 9999;
        user-select: none;
        -webkit-user-select: none;
        transition: background 0.2s, border-color 0.2s;
        font-family: "Segoe UI", sans-serif; /* Windows Standard Font */
      }

      /* --- Background Styles --- */
      
      /* 1. Transparent (Glass/Overlay) */
      .titlebar.bg-transparent {
        background-color: transparent;
        border-bottom: none;
      }

      /* 2. Solid (Windows+ / Improved) */
      .titlebar.bg-solid {
        background-color: #f1f3f5; 
        border-bottom: 1px solid rgba(0,0,0,0.06);
      }

      /* 3. System Default (Standard White) */
      .titlebar.bg-system {
        background-color: #ffffff;
        color: #000000;
        border-bottom: 1px solid #e5e5e5; /* Standard low-contrast border */
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

      .titlebar-controls {
        display: flex;
        align-items: center;
        height: 100%;
      }

      .titlebar-button {
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: default;
        transition: all 0.1s;
        -webkit-app-region: no-drag;
        z-index: 9999;
      }
      
      .titlebar-button:hover {
        cursor: pointer; 
      }

      /* --- LAYOUT 1: PlanShake (Custom) --- */
      .titlebar.layout-planshake .titlebar-controls {
        grid-column: 1;
        padding-left: 15px;
        align-items: flex-start;
        gap: 8px;
      }
      .titlebar.layout-planshake .titlebar-button {
        width: 17px;
        height: 21px;
        top: -100px;
        border-radius: 0% 0% 100% 100%;
        border: 0.5px solid rgba(0, 0, 0, 0.1);
        color: transparent;
        background-color: #ccc;
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.3);
      }
      .titlebar.layout-planshake .titlebar-button:hover {
        border-radius: 0% 0% 40% 40%;
        transform: scale(1.2);
      }
      .titlebar.layout-planshake .close-btn { background-color: #ff5f57; border-color: #e0443e; order: 1; }
      .titlebar.layout-planshake .titlebar-button:not(.close-btn):nth-child(1) { background-color: #febc2e; border-color: #d89e24; order: 2; }
      .titlebar.layout-planshake .titlebar-button:not(.close-btn):nth-child(2) { background-color: #28c840; border-color: #1aab29; order: 3; }

      /* --- LAYOUT 2: MacOS (Round) --- */
      .titlebar.layout-macos .titlebar-controls {
        grid-column: 1;
        padding-left: 10px;
        gap: 8px;
      }
      .titlebar.layout-macos .titlebar-button {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 0.5px solid rgba(0,0,0,0.1);
        color: transparent;
        margin: 0;
      }
      .titlebar.layout-macos .titlebar-controls:hover .titlebar-button {
        color: rgba(0, 0, 0, 0.5);
        font-size: 8px;
        font-weight: 900;
        line-height: 1;
      }
      .titlebar.layout-macos .close-btn { background-color: #ff5f57; border-color: #e0443e; order: 1; }
      .titlebar.layout-macos .close-btn::before { content: "x"; display: none; }
      .titlebar.layout-macos .titlebar-controls:hover .close-btn::before { display: block; }
      .titlebar.layout-macos .titlebar-button:not(.close-btn):nth-child(1) { background-color: #febc2e; border-color: #d89e24; order: 2; }
      .titlebar.layout-macos .titlebar-button:not(.close-btn):nth-child(1)::before { content: "-"; display: none; position: relative; top: -1px;}
      .titlebar.layout-macos .titlebar-controls:hover .titlebar-button:not(.close-btn):nth-child(1)::before { display: block; }
      .titlebar.layout-macos .titlebar-button:not(.close-btn):nth-child(2) { background-color: #28c840; border-color: #1aab29; order: 3; }
      .titlebar.layout-macos .titlebar-button:not(.close-btn):nth-child(2)::before { content: "+"; display: none; position: relative; top: 0px;}
      .titlebar.layout-macos .titlebar-controls:hover .titlebar-button:not(.close-btn):nth-child(2)::before { display: block; }

      /* --- LAYOUT 3: Windows (Right - Standard) --- */
      .titlebar.layout-windows .titlebar-controls {
        grid-column: 3;
        justify-content: flex-end;
        padding-left: 0;
        gap: 0;
        margin-left: auto;
        height: 100%;
      }
      .titlebar.layout-windows .titlebar-button {
        width: 46px; /* Standard Windows Width */
        height: 100%;
        border-radius: 0;
        border: none;
        background-color: transparent;
        color: #000000; /* Standard Black Icons */
        transition: background-color 0.1s;
      }
      
      /* Icon Masking */
      .titlebar.layout-windows .titlebar-button::after {
        content: ''; width: 10px; height: 10px; 
        background-color: currentColor;
        mask-size: contain; mask-repeat: no-repeat; mask-position: center;
        -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center;
      }

      /* Minimize */
      .titlebar.layout-windows .titlebar-button:not(.close-btn):nth-child(1) { order: 1; }
      .titlebar.layout-windows .titlebar-button:not(.close-btn):nth-child(1)::after {
        -webkit-mask-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="1"/></svg>');
      }

      /* Maximize */
      .titlebar.layout-windows .titlebar-button:not(.close-btn):nth-child(2) { order: 2; }
      .titlebar.layout-windows .titlebar-button:not(.close-btn):nth-child(2)::after {

      }

      /* Close */
      .titlebar.layout-windows .close-btn { order: 3; }
      .titlebar.layout-windows .close-btn:hover { background-color: #e81123; color: white; }
      .titlebar.layout-windows .close-btn::after {
         -webkit-mask-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><polygon points="10,1.0 9,0 5,4 1,0 0,1.0 4,5 0,9.0 1,10 5,6 9,10 10,9.0 6,5"/></svg>');
      }
      
      .titlebar.layout-windows .titlebar-button:not(.close-btn):hover { 
        background-color: #e5e5e5; /* Standard Hover Gray */
      }

      /* Native Helpers */
      .no-select { user-select: none; -webkit-user-select: none; }
      *:focus { outline: none; }
      #nativeSettingsModal { z-index: 10001 !important; }
      #nativeSettingsBtn { display: inline-flex; align-items: center; gap: 6px; }
      .setting-icon { font-size: 1.1em; line-height: 1; }
      .settings-select-wrapper select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); }
    `;
    document.head.appendChild(style);

    // --- 2. Title Bar Manager ---
    const TitleBarManager = {
      apply: (styleName) => {
        if (!titleBar) return;
        
        // Clean up previous classes
        titleBar.classList.remove(
          'layout-planshake', 'layout-macos', 'layout-windows',
          'bg-transparent', 'bg-solid', 'bg-system'
        );

        // Detect OS for 'default' option
        const platform = window.navigator?.userAgent?.toLowerCase() || '';
        const isWin = platform.includes('win');
        
        // If "Default" is selected, match OS exactly
        const defaultLayout = isWin ? 'layout-windows' : 'layout-macos';
        const defaultBg = isWin ? 'bg-system' : 'bg-transparent'; // Windows Standard = White, Mac = Transparent

        // ----------------------------------------------------
        // CONFIGURATION
        // ----------------------------------------------------
        const configMap = {
          'planshake': { layout: 'layout-planshake', background: 'bg-transparent' },
          'macos':     { layout: 'layout-macos',     background: 'bg-transparent' },
          'windows':   { layout: 'layout-windows',   background: 'bg-solid' },  // Windows+ (Improved)
          'default':   { layout: defaultLayout,      background: defaultBg }    // True System Default
        };

        // Get the config, fallback to default if not found
        const config = configMap[styleName] || configMap['default'];

        // Apply classes
        titleBar.classList.add(config.layout, config.background);
        
        // Save preference
        localStorage.setItem('planshake_titlebar_style', styleName);
        console.log(`TitleBar: Applied [${config.layout}] + [${config.background}]`);
      },

      load: () => {
        const saved = localStorage.getItem('planshake_titlebar_style') || 'planshake';
        TitleBarManager.apply(saved);
        return saved;
      }
    };

    // --- 3. UI Injection ---
    document.addEventListener('DOMContentLoaded', () => {
      // Common UI fixes
      const header = document.querySelector('.app-header');
      if (header) header.classList.add('no-select');
      document.querySelectorAll('button, .btn, .card, .project-card').forEach(el => el.classList.add('no-select'));

      injectNativeSettingsUI();
      TitleBarManager.load();
    });

    function injectNativeSettingsUI() {
      const actionContainer = document.querySelector('.home-actions');
      if (!actionContainer) return;

      // Button
      const settingsBtn = document.createElement('button');
      settingsBtn.id = 'nativeSettingsBtn';
      settingsBtn.className = 'secondary-btn';
      settingsBtn.innerHTML = `<span class="setting-icon">⚙️</span>`;
      
      const firstBtn = actionContainer.firstElementChild;
      if (firstBtn) firstBtn.insertAdjacentElement('afterend', settingsBtn);
      else actionContainer.appendChild(settingsBtn);

      // Modal
      const modalHTML = `
        <div id="nativeSettingsModal" class="modal hidden">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h3>App Settings</h3>
            </div>
            
            <div class="modal-body">
              <div class="modal-section">
                <label for="titleBarStyleSelect">Title Bar Style</label>
                <div class="settings-select-wrapper">
                  <select id="titleBarStyleSelect">
                    <option value="default">Default (System Standard)</option>
                    <option value="macos">MacOs+ (Transparent)</option>
                    <option value="windows">Windows+ (Improved/Solid)</option>
                    <option value="planshake">PlanShake Special</option>
                  </select>
                </div>
                <small style="color: var(--text-secondary); margin-top: 8px; display:block; line-height: 1.4;">
                   <strong>Default:</strong> Matches the standard OS look (e.g., standard white bar on Windows).<br>
                   <strong>Windows+:</strong> A slightly improved, modern solid look.
                </small>
              </div>
            </div>

            <div class="modal-footer">
              <div class="spacer"></div>
              <button id="closeNativeSettingsBtn" class="primary-btn">Done</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);

      // Logic
      const modal = document.getElementById('nativeSettingsModal');
      const closeBtn = document.getElementById('closeNativeSettingsBtn');
      const backdrop = modal.querySelector('.modal-backdrop');
      const select = document.getElementById('titleBarStyleSelect');

      // Sync select with current state when opening
      settingsBtn.addEventListener('click', () => {
        select.value = TitleBarManager.load();
        modal.classList.remove('hidden');
      });

      // Change Handler - Instant Update
      select.addEventListener('change', (e) => {
        TitleBarManager.apply(e.target.value);
      });

      const closeModal = () => modal.classList.add('hidden');
      closeBtn.addEventListener('click', closeModal);
      backdrop.addEventListener('click', closeModal);
    }

    // --- Native Helpers ---
    document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['+','-','0','=','r'].includes(e.key) || e.key === 'F5') e.preventDefault();
      if (e.altKey && ['ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    });

    window.updateWindowTitle = (title) => {
      document.title = title || 'PlanShake';
    };

    console.log('✅ Native app mode active');

  })();
}