// ============================================
// SaveManager - Unified Save System for PlanShake
// ============================================
// Provides auto-save with intervals, smart auto-save,
// and manual save functionality
// ============================================

(function () {
    'use strict';

    // ================================
    // CONSTANTS
    // ================================

    const SAVE_MODE = {
        MANUAL: 'manual',
        AUTO: 'auto',
        SMART: 'smart'
    };

    // Settings keys
    const SETTINGS = {
        AUTO_SAVE_ENABLED: 'planshake_autosave_enabled',
        SMART_SAVE_ENABLED: 'planshake_smartsave_enabled',
        AUTO_SAVE_INTERVAL: 'planshake_autosave_interval'
    };

    // Auto-save intervals (milliseconds)
    const INTERVALS = {
        '30s': 30000,
        '1m': 60000,
        '2m': 120000,
        '5m': 300000,
        '10m': 600000
    };

    // Smart save configuration
    const SMART_SAVE = {
        MIN_DELAY: 1000,      // Minimum 1 second after last change
        MAX_DELAY: 10000,     // Maximum 10 seconds
        INACTIVITY_CHECK: 500 // Check for inactivity every 500ms
    };

    // ================================
    // STATE
    // ================================

    let autoSaveEnabled = false;
    let smartSaveEnabled = false;
    let autoSaveIntervalKey = '1m';
    let autoSaveTimer = null;
    let smartSaveTimer = null;
    let lastChangeTime = 0;
    let lastSaveTime = 0;
    let isDirty = false;
    let changeCount = 0;  // Track number of changes for smart save
    let initialized = false;

    // ================================
    // INITIALIZATION
    // ================================

    function init() {
        if (initialized) return;

        // Load saved settings
        loadSettings();

        // Start auto-save if enabled
        if (autoSaveEnabled && !smartSaveEnabled) {
            startAutoSaveTimer();
        }

        // Setup UI bindings
        setupUIBindings();

        initialized = true;
        console.log('✅ SaveManager initialized');
    }

    function loadSettings() {
        try {
            autoSaveEnabled = localStorage.getItem(SETTINGS.AUTO_SAVE_ENABLED) === 'true';
            smartSaveEnabled = localStorage.getItem(SETTINGS.SMART_SAVE_ENABLED) === 'true';
            autoSaveIntervalKey = localStorage.getItem(SETTINGS.AUTO_SAVE_INTERVAL) || '1m';
        } catch (e) {
            console.warn('SaveManager: Failed to load settings', e);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS.AUTO_SAVE_ENABLED, autoSaveEnabled);
            localStorage.setItem(SETTINGS.SMART_SAVE_ENABLED, smartSaveEnabled);
            localStorage.setItem(SETTINGS.AUTO_SAVE_INTERVAL, autoSaveIntervalKey);
        } catch (e) {
            console.warn('SaveManager: Failed to save settings', e);
        }
    }

    // ================================
    // UI BINDINGS
    // ================================

    function setupUIBindings() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindUI);
        } else {
            bindUI();
        }
    }

    function bindUI() {
        // Auto-save toggle
        const autoSaveToggle = document.getElementById('autoSaveToggle');
        const autoSaveOptions = document.getElementById('autoSaveOptions');
        const smartSaveToggle = document.getElementById('smartSaveToggle');
        const autoSaveIntervalContainer = document.getElementById('autoSaveIntervalContainer');
        const autoSaveIntervalSelect = document.getElementById('autoSaveInterval');
        const headerSaveBtn = document.getElementById('headerSaveBtn');

        // Initialize UI state
        if (autoSaveToggle) {
            autoSaveToggle.checked = autoSaveEnabled;
        }
        if (autoSaveOptions) {
            autoSaveOptions.classList.toggle('hidden', !autoSaveEnabled);
        }
        if (smartSaveToggle) {
            smartSaveToggle.checked = smartSaveEnabled;
        }
        if (autoSaveIntervalContainer) {
            autoSaveIntervalContainer.classList.toggle('hidden', smartSaveEnabled);
        }
        if (autoSaveIntervalSelect) {
            autoSaveIntervalSelect.value = autoSaveIntervalKey;
        }

        // Auto-save toggle handler
        if (autoSaveToggle) {
            autoSaveToggle.addEventListener('change', (e) => {
                setAutoSaveEnabled(e.target.checked);
                if (autoSaveOptions) {
                    autoSaveOptions.classList.toggle('hidden', !e.target.checked);
                }
            });
        }

        // Smart save toggle handler
        if (smartSaveToggle) {
            smartSaveToggle.addEventListener('change', (e) => {
                setSmartSaveEnabled(e.target.checked);
                if (autoSaveIntervalContainer) {
                    autoSaveIntervalContainer.classList.toggle('hidden', e.target.checked);
                }
            });
        }

        // Interval select handler
        if (autoSaveIntervalSelect) {
            autoSaveIntervalSelect.addEventListener('change', (e) => {
                setAutoSaveInterval(e.target.value);
            });
        }

        // Manual save button handler
        if (headerSaveBtn) {
            headerSaveBtn.addEventListener('click', () => {
                saveNow();
            });
        }

        // Keyboard shortcut for manual save (Ctrl+S)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveNow();
            }
        });

        // Update status indicator
        updateStatusIndicator();
    }

    // ================================
    // AUTO-SAVE TIMER
    // ================================

    function startAutoSaveTimer() {
        stopAutoSaveTimer();

        if (!autoSaveEnabled || smartSaveEnabled) return;

        const interval = INTERVALS[autoSaveIntervalKey] || INTERVALS['1m'];
        autoSaveTimer = setInterval(() => {
            if (isDirty) {
                saveNow();
            }
        }, interval);
    }

    function stopAutoSaveTimer() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
        }
    }

    // ================================
    // SMART SAVE
    // ================================

    function scheduleSmartSave() {
        if (!autoSaveEnabled || !smartSaveEnabled || !isDirty) return;

        // Clear existing timer
        if (smartSaveTimer) {
            clearTimeout(smartSaveTimer);
        }

        // Calculate delay based on activity
        // More changes = shorter delay (user is active)
        // Fewer changes = longer delay (user might be thinking)
        const timeSinceLastChange = Date.now() - lastChangeTime;

        // If user has been inactive for at least MIN_DELAY, save now
        if (timeSinceLastChange >= SMART_SAVE.MIN_DELAY) {
            saveNow();
            return;
        }

        // Otherwise, schedule a check
        const delay = Math.min(
            SMART_SAVE.MIN_DELAY,
            SMART_SAVE.MAX_DELAY - timeSinceLastChange
        );

        smartSaveTimer = setTimeout(() => {
            const currentInactivity = Date.now() - lastChangeTime;

            // Save if user has been inactive for at least 1 second
            if (currentInactivity >= SMART_SAVE.MIN_DELAY && isDirty) {
                saveNow();
            } else if (isDirty) {
                // Schedule another check
                scheduleSmartSave();
            }
        }, delay);
    }

    // ================================
    // DIRTY TRACKING
    // ================================

    function markDirty() {
        isDirty = true;
        lastChangeTime = Date.now();
        changeCount++;
        updateStatusIndicator();

        // Trigger smart save if enabled
        if (autoSaveEnabled && smartSaveEnabled) {
            scheduleSmartSave();
        }
    }

    function markClean() {
        isDirty = false;
        lastSaveTime = Date.now();
        changeCount = 0;
        updateStatusIndicator();
    }

    // ================================
    // SAVE OPERATIONS
    // ================================

    function saveNow() {
        if (!window.currentData) {
            console.warn('SaveManager: No data to save');
            return false;
        }

        // Update status to "Saving..."
        updateStatusIndicator('saving');

        try {
            // Use the global saveData function
            if (window.saveData) {
                window.saveData(window.currentData);
            }

            markClean();
            console.log('✅ Data saved');

            // Show brief "Saved" confirmation
            updateStatusIndicator('saved');

            return true;
        } catch (e) {
            console.error('SaveManager: Save failed', e);
            updateStatusIndicator('error');
            return false;
        }
    }

    // ================================
    // STATUS INDICATOR
    // ================================

    function updateStatusIndicator(status) {
        const indicator = document.getElementById('saveStatusIndicator');
        if (!indicator) return;

        const t = window.t || ((key) => null);

        // Remove all status classes
        indicator.classList.remove('status-saved', 'status-saving', 'status-unsaved', 'status-error');

        if (status === 'saving') {
            indicator.textContent = t('saving') || 'Saving...';
            indicator.classList.add('status-saving');
        } else if (status === 'saved') {
            indicator.textContent = t('saved') || 'Saved';
            indicator.classList.add('status-saved');
        } else if (status === 'error') {
            indicator.textContent = t('saveError') || 'Error';
            indicator.classList.add('status-error');
        } else if (isDirty) {
            indicator.textContent = t('unsavedChanges') || 'Unsaved';
            indicator.classList.add('status-unsaved');
        } else {
            indicator.textContent = t('saved') || 'Saved';
            indicator.classList.add('status-saved');
        }
    }

    // ================================
    // SETTINGS SETTERS
    // ================================

    function setAutoSaveEnabled(enabled) {
        autoSaveEnabled = enabled;
        saveSettings();

        if (enabled && !smartSaveEnabled) {
            startAutoSaveTimer();
        } else {
            stopAutoSaveTimer();
        }
    }

    function setSmartSaveEnabled(enabled) {
        smartSaveEnabled = enabled;
        saveSettings();

        if (autoSaveEnabled) {
            if (enabled) {
                stopAutoSaveTimer();
            } else {
                startAutoSaveTimer();
            }
        }
    }

    function setAutoSaveInterval(intervalKey) {
        if (INTERVALS[intervalKey]) {
            autoSaveIntervalKey = intervalKey;
            saveSettings();

            // Restart timer with new interval
            if (autoSaveEnabled && !smartSaveEnabled) {
                startAutoSaveTimer();
            }
        }
    }

    // ================================
    // GETTERS
    // ================================

    function getSettings() {
        return {
            autoSaveEnabled,
            smartSaveEnabled,
            autoSaveIntervalKey,
            isDirty
        };
    }

    function isDirtyData() {
        return isDirty;
    }

    // ================================
    // EXPORT
    // ================================

    window.SaveManager = {
        init,
        markDirty,
        markClean,
        saveNow,
        isDirty: isDirtyData,
        setAutoSaveEnabled,
        setSmartSaveEnabled,
        setAutoSaveInterval,
        getSettings,
        SAVE_MODE,
        INTERVALS
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to ensure other scripts are loaded
        setTimeout(init, 100);
    }

})();
