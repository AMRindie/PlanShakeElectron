/**
 * Whiteboard Application - New Modular Implementation
 * High-performance whiteboard with optimized rendering and stability
 * 
 * This file provides the public API and backwards compatibility
 * with the existing project structure.
 */

import WhiteboardEngine from './whiteboard/whiteboard-engine.js';

// Global engine instance
let engineInstance = null;

/**
 * Initialize whiteboard (Public API)
 */
async function initWhiteboard() {
    // Clean up any existing instance
    if (engineInstance) {
        engineInstance.destroy();
        engineInstance = null;
    }

    // Check if we have a current project
    if (!window.currentProject) {
        console.error('Whiteboard: No current project found');
        return;
    }

    // Create and initialize engine
    engineInstance = new WhiteboardEngine(window.currentProject);
    const success = await engineInstance.initialize();

    if (success) {
        console.log('Whiteboard initialized successfully');
    } else {
        console.error('Whiteboard initialization failed');
    }
}

/**
 * Cleanup whiteboard
 */
function destroyWhiteboard() {
    if (engineInstance) {
        engineInstance.destroy();
        engineInstance = null;
    }
}

// Export public API
window.initWhiteboard = initWhiteboard;
window.destroyWhiteboard = destroyWhiteboard;

// Auto-initialize if whiteboard view is already active
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const whiteboardView = document.getElementById('whiteboardView');
        if (whiteboardView && !whiteboardView.classList.contains('hidden')) {
            initWhiteboard();
        }
    });
} else {
    const whiteboardView = document.getElementById('whiteboardView');
    if (whiteboardView && !whiteboardView.classList.contains('hidden')) {
        initWhiteboard();
    }
}
