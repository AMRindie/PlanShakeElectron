// ============================================
// PlanShake Keyboard Shortcuts Manager
// ============================================
// Centralized management for all keyboard shortcuts
// Easy to add, remove, edit, and disable shortcuts
// ============================================

(function () {
    'use strict';

    // ================================
    // SHORTCUT DEFINITIONS
    // ================================

    const shortcuts = [];
    let initialized = false;

    // ================================
    // SHORTCUT REGISTRATION
    // ================================

    function register(config) {
        const shortcut = {
            id: config.id,
            key: config.key.toLowerCase(),
            ctrl: config.ctrl || false,
            shift: config.shift || false,
            alt: config.alt || false,
            action: config.action,
            description: config.description || '',
            enabled: config.enabled !== false,
            context: config.context || 'global',
            skipInputs: config.skipInputs !== false
        };

        const existingIndex = shortcuts.findIndex(s => s.id === shortcut.id);
        if (existingIndex > -1) {
            shortcuts.splice(existingIndex, 1);
        }

        shortcuts.push(shortcut);
        return shortcut;
    }

    function unregister(id) {
        const index = shortcuts.findIndex(s => s.id === id);
        if (index > -1) {
            shortcuts.splice(index, 1);
            return true;
        }
        return false;
    }

    function enable(id) {
        const shortcut = shortcuts.find(s => s.id === id);
        if (shortcut) {
            shortcut.enabled = true;
            return true;
        }
        return false;
    }

    function disable(id) {
        const shortcut = shortcuts.find(s => s.id === id);
        if (shortcut) {
            shortcut.enabled = false;
            return true;
        }
        return false;
    }

    function getAll() {
        return [...shortcuts];
    }

    function get(id) {
        return shortcuts.find(s => s.id === id) || null;
    }

    function update(id, updates) {
        const shortcut = shortcuts.find(s => s.id === id);
        if (shortcut) {
            Object.assign(shortcut, updates);
            return true;
        }
        return false;
    }

    // ================================
    // CONTEXT DETECTION
    // ================================

    function getCurrentContext() {
        const boardView = document.getElementById('board');
        const notesView = document.getElementById('notesView');
        const whiteboardView = document.getElementById('whiteboardView');
        const plannerView = document.getElementById('plannerView');
        const calendarView = document.getElementById('calendarView');

        if (boardView && !boardView.classList.contains('hidden')) return 'board';
        if (notesView && !notesView.classList.contains('hidden')) return 'notesView';
        if (whiteboardView && !whiteboardView.classList.contains('hidden')) return 'whiteboardView';
        if (plannerView && !plannerView.classList.contains('hidden')) return 'plannerView';
        if (calendarView && !calendarView.classList.contains('hidden')) return 'calendarView';

        if (document.getElementById('projectHub')) return 'hub';

        return 'global';
    }

    function isInInput() {
        const activeEl = document.activeElement;
        return activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );
    }

    // ================================
    // EVENT HANDLER
    // ================================

    function handleKeyDown(e) {
        const key = e.key.toLowerCase();
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        const isAlt = e.altKey;
        const context = getCurrentContext();
        const inInput = isInInput();

        for (const shortcut of shortcuts) {
            if (!shortcut.enabled) continue;
            if (shortcut.key !== key) continue;
            if (shortcut.ctrl !== isCtrl) continue;
            if (shortcut.shift !== isShift) continue;
            if (shortcut.alt !== isAlt) continue;
            if (shortcut.context !== 'global' && shortcut.context !== context) continue;
            if (shortcut.skipInputs && inInput) continue;

            // Execute action - if it returns 'passthrough', let browser handle it
            try {
                const result = shortcut.action(e, context);
                if (result === 'passthrough') {
                    return; // Don't prevent default
                }
            } catch (err) {
                console.error(`Shortcut ${shortcut.id} error:`, err);
            }

            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }

    // ================================
    // DEFAULT SHORTCUTS
    // ================================

    function registerDefaults() {
        // Undo - Ctrl+Z
        register({
            id: 'undo',
            key: 'z',
            ctrl: true,
            shift: false,
            description: 'Undo last action',
            context: 'global',
            skipInputs: false,
            action: (e, context) => {
                // In notes view when editing, let browser handle it
                if (context === 'notesView' && isInInput()) {
                    return 'passthrough';
                }
                if (window.UndoManager && window.UndoManager.triggerUndo) {
                    window.UndoManager.triggerUndo();
                }
            }
        });

        // Redo - Ctrl+Shift+Z
        register({
            id: 'redo-shift',
            key: 'z',
            ctrl: true,
            shift: true,
            description: 'Redo last action',
            context: 'global',
            skipInputs: false,
            action: (e, context) => {
                if (context === 'notesView' && isInInput()) {
                    return 'passthrough';
                }
                if (window.UndoManager && window.UndoManager.triggerRedo) {
                    window.UndoManager.triggerRedo();
                }
            }
        });

        // Redo - Ctrl+Y
        register({
            id: 'redo-y',
            key: 'y',
            ctrl: true,
            description: 'Redo last action',
            context: 'global',
            skipInputs: false,
            action: (e, context) => {
                if (context === 'notesView' && isInInput()) {
                    return 'passthrough';
                }
                if (window.UndoManager && window.UndoManager.triggerRedo) {
                    window.UndoManager.triggerRedo();
                }
            }
        });

        // Save - Ctrl+S
        register({
            id: 'save',
            key: 's',
            ctrl: true,
            description: 'Save project',
            context: 'global',
            skipInputs: false,
            action: () => {
                if (window.SaveManager && window.SaveManager.saveNow) {
                    window.SaveManager.saveNow();
                }
            }
        });

        // Go to Board - 1
        register({
            id: 'go-board',
            key: '1',
            ctrl: false,
            description: 'Go to Board view',
            context: 'global',
            action: () => {
                const btn = document.querySelector('[data-view-target="board"]');
                if (btn) btn.click();
            }
        });

        // Go to Planner - 2
        register({
            id: 'go-planner',
            key: '2',
            ctrl: false,
            description: 'Go to Planner view',
            context: 'global',
            action: () => {
                const btn = document.querySelector('[data-view-target="plannerView"]');
                if (btn) btn.click();
            }
        });

        // Go to Calendar - 3
        register({
            id: 'go-calendar',
            key: '3',
            ctrl: false,
            description: 'Go to Calendar view',
            context: 'global',
            action: () => {
                const btn = document.querySelector('[data-view-target="calendarView"]');
                if (btn) btn.click();
            }
        });

        // Go to Notes - 4
        register({
            id: 'go-notes',
            key: '4',
            ctrl: false,
            description: 'Go to Notes view',
            context: 'global',
            action: () => {
                const btn = document.querySelector('[data-view-target="notesView"]');
                if (btn) btn.click();
            }
        });

        // Go to Whiteboard - 5
        register({
            id: 'go-whiteboard',
            key: '5',
            ctrl: false,
            description: 'Go to Whiteboard view',
            context: 'global',
            action: () => {
                const btn = document.querySelector('[data-view-target="whiteboardView"]');
                if (btn) btn.click();
            }
        });

        // Toggle Menu - M
        register({
            id: 'toggle-menu',
            key: 'm',
            ctrl: false,
            description: 'Toggle side menu',
            context: 'global',
            action: () => {
                const btn = document.getElementById('toggleMenuBtn');
                if (btn) btn.click();
            }
        });

        // Escape - Close modals
        register({
            id: 'close-modal',
            key: 'escape',
            ctrl: false,
            description: 'Close modal/menu',
            context: 'global',
            skipInputs: false,
            action: () => {
                const cardModal = document.getElementById('cardModal');
                if (cardModal && !cardModal.classList.contains('hidden')) {
                    cardModal.classList.add('hidden');
                    return;
                }

                const sideMenu = document.getElementById('sideMenu');
                if (sideMenu && sideMenu.classList.contains('open')) {
                    sideMenu.classList.remove('open');
                    return;
                }

                const wbMenu = document.getElementById('wbContextMenu');
                if (wbMenu && !wbMenu.classList.contains('hidden')) {
                    wbMenu.classList.add('hidden');
                    return;
                }
            }
        });

        console.log(`✅ Registered ${shortcuts.length} keyboard shortcuts`);
    }

    // ================================
    // INITIALIZATION
    // ================================

    function init() {
        if (initialized) return;

        document.addEventListener('keydown', handleKeyDown, true);
        registerDefaults();
        initialized = true;

        console.log('✅ ShortcutsManager initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ================================
    // PUBLIC API
    // ================================

    window.ShortcutsManager = {
        register,
        unregister,
        enable,
        disable,
        get,
        getAll,
        update,
        getCurrentContext
    };

})();
