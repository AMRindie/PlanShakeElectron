// ============================================
// ViewAwareUndoManager - Per-View Undo/Redo System
// ============================================
// Provides separate undo/redo stacks per view
// with unified header controls and keyboard shortcuts
// All undo/redo is handled via header buttons (Ctrl+Z / Ctrl+Y)
// ============================================

(function () {
    'use strict';

    // ================================
    // CONSTANTS
    // ================================

    const MAX_STACK_SIZE = 50;

    // View types matching data-project-view attributes
    const VIEW = {
        BOARD: 'board',
        NOTES: 'notesView',
        WHITEBOARD: 'whiteboardView',
        PLANNER: 'plannerView',
        CALENDAR: 'calendarView'
    };

    // Action types for tracking
    const ACTION_TYPE = {
        // Board actions
        CARD_MOVE: 'cardMove',
        CARD_ADD: 'cardAdd',
        CARD_DELETE: 'cardDelete',
        CARD_ARCHIVE: 'cardArchive',
        CARD_EDIT: 'cardEdit',
        LIST_ADD: 'listAdd',
        LIST_DELETE: 'listDelete',
        LIST_MOVE: 'listMove',
        MILESTONE_ADD: 'milestoneAdd',
        MILESTONE_DELETE: 'milestoneDelete',

        // Notes actions
        NOTES_EDIT: 'notesEdit',

        // Generic
        UNKNOWN: 'unknown'
    };

    // ================================
    // STATE
    // ================================

    // Per-view undo stacks (stores state objects with action info)
    const undoStacks = {};
    const redoStacks = {};

    // Initialize stacks for all views
    Object.values(VIEW).forEach(view => {
        undoStacks[view] = [];
        redoStacks[view] = [];
    });

    // Current active view
    let currentView = VIEW.BOARD;

    // ================================
    // VIEW MANAGEMENT
    // ================================

    /**
     * Set the current active view
     * @param {string} view - View identifier
     */
    function setCurrentView(view) {
        if (Object.values(VIEW).includes(view)) {
            currentView = view;
            updateButtonStates();
        }
    }

    /**
     * Get the current active view
     * @returns {string} Current view identifier
     */
    function getCurrentView() {
        return currentView;
    }

    // ================================
    // STACK OPERATIONS
    // ================================

    /**
     * Push a state to the undo stack with action info
     * @param {Object} state - State object to push
     * @param {string} actionType - Type of action (from ACTION_TYPE)
     * @param {string} description - Human-readable description
     * @param {string} view - View to push to (defaults to current view)
     */
    function pushState(state, actionType = ACTION_TYPE.UNKNOWN, description = '', view = currentView) {
        if (!undoStacks[view]) {
            undoStacks[view] = [];
            redoStacks[view] = [];
        }

        const entry = {
            state: state,
            actionType: actionType,
            description: description,
            timestamp: Date.now()
        };

        undoStacks[view].push(entry);

        // Limit stack size
        if (undoStacks[view].length > MAX_STACK_SIZE) {
            undoStacks[view].shift();
        }

        // Clear redo stack on new action
        redoStacks[view] = [];

        updateButtonStates();

        // Mark data as dirty for SaveManager
        if (window.SaveManager) {
            window.SaveManager.markDirty();
        }
    }

    /**
     * Pop state from undo stack and push to redo stack
     * @param {string} view - View to operate on (defaults to current view)
     * @returns {Object|null} The popped entry or null if stack empty
     */
    function undo(view = currentView) {
        const stack = undoStacks[view];
        if (!stack || stack.length === 0) return null;

        const entry = stack.pop();

        if (!redoStacks[view]) redoStacks[view] = [];
        redoStacks[view].push(entry);

        updateButtonStates();
        return entry;
    }

    /**
     * Pop state from redo stack and push to undo stack
     * @param {string} view - View to operate on (defaults to current view)
     * @returns {Object|null} The popped entry or null if stack empty
     */
    function redo(view = currentView) {
        const stack = redoStacks[view];
        if (!stack || stack.length === 0) return null;

        const entry = stack.pop();

        if (!undoStacks[view]) undoStacks[view] = [];
        undoStacks[view].push(entry);

        updateButtonStates();
        return entry;
    }

    /**
     * Check if undo is available for current view
     * @returns {boolean}
     */
    function canUndo() {
        return undoStacks[currentView] && undoStacks[currentView].length > 0;
    }

    /**
     * Check if redo is available for current view
     * @returns {boolean}
     */
    function canRedo() {
        return redoStacks[currentView] && redoStacks[currentView].length > 0;
    }

    /**
     * Get next undo action description
     * @returns {string|null}
     */
    function getNextUndoDescription() {
        const stack = undoStacks[currentView];
        if (stack && stack.length > 0) {
            return stack[stack.length - 1].description;
        }
        return null;
    }

    /**
     * Get next redo action description
     * @returns {string|null}
     */
    function getNextRedoDescription() {
        const stack = redoStacks[currentView];
        if (stack && stack.length > 0) {
            return stack[stack.length - 1].description;
        }
        return null;
    }

    /**
     * Clear stacks for a specific view
     * @param {string} view - View to clear (defaults to current view)
     */
    function clearView(view = currentView) {
        undoStacks[view] = [];
        redoStacks[view] = [];
        updateButtonStates();
    }

    /**
     * Clear all stacks for all views
     */
    function clearAll() {
        Object.values(VIEW).forEach(view => {
            undoStacks[view] = [];
            redoStacks[view] = [];
        });
        updateButtonStates();
    }

    // ================================
    // UI UPDATES
    // ================================

    /**
     * Update header button states based on available history
     * Buttons are never disabled - each view handles its own undo capability
     * Visual feedback is provided via 'has-history' class
     */
    function updateButtonStates() {
        const undoBtn = document.getElementById('headerUndoBtn');
        const redoBtn = document.getElementById('headerRedoBtn');

        // Check for any available undo (generic stacks + board-specific stacks)
        let hasUndo = canUndo();
        let hasRedo = canRedo();

        // For board view, also check board-specific stacks
        if (currentView === VIEW.BOARD) {
            hasUndo = hasUndo || canUndoBoard();
            hasRedo = hasRedo || canRedoBoard();
        }

        if (undoBtn) {
            undoBtn.classList.toggle('has-history', hasUndo);
            // Don't disable buttons - views handle their own undo capability
            undoBtn.disabled = false;
        }
        if (redoBtn) {
            redoBtn.classList.toggle('has-history', hasRedo);
            // Don't disable buttons - views handle their own undo capability
            redoBtn.disabled = false;
        }
    }

    // ================================
    // KEYBOARD SHORTCUTS
    // ================================
    // NOTE: Keyboard shortcuts are handled by app.shortcuts.js

    function setupKeyboardShortcuts() {
        // Handled by ShortcutsManager in app.shortcuts.js
    }

    // ================================
    // TRIGGER HANDLERS
    // ================================

    /**
     * Trigger undo for current view
     * Dispatches custom event for view-specific handling
     */
    function triggerUndo() {
        const event = new CustomEvent('viewUndo', {
            detail: { view: currentView },
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    /**
     * Trigger redo for current view
     * Dispatches custom event for view-specific handling
     */
    function triggerRedo() {
        const event = new CustomEvent('viewRedo', {
            detail: { view: currentView },
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    // ================================
    // BUTTON CLICK HANDLERS
    // ================================

    function setupButtonHandlers() {
        const undoBtn = document.getElementById('headerUndoBtn');
        const redoBtn = document.getElementById('headerRedoBtn');

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                triggerUndo();
            });
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                triggerRedo();
            });
        }
    }

    // ================================
    // INITIALIZATION
    // ================================

    function init() {
        setupKeyboardShortcuts();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupButtonHandlers();
                updateButtonStates();
            });
        } else {
            setupButtonHandlers();
            updateButtonStates();
        }

        console.log('✅ UndoManager initialized');
    }

    // ================================
    // BOARD UNDO/REDO - Card Move
    // ================================

    const cardMoveStack = [];
    const cardMoveRedoStack = [];

    function pushCardMove(moveInfo) {
        const entry = {
            ...moveInfo,
            actionType: ACTION_TYPE.CARD_MOVE
        };
        cardMoveStack.push(entry);
        if (cardMoveStack.length > MAX_STACK_SIZE) {
            cardMoveStack.shift();
        }
        cardMoveRedoStack.length = 0;
        updateButtonStates();

        if (window.SaveManager) {
            window.SaveManager.markDirty();
        }
    }

    function undoCardMove(project) {
        if (cardMoveStack.length === 0) return null;

        const move = cardMoveStack.pop();
        const fromList = project.lists.find(l => l.id === move.toListId);
        const toList = project.lists.find(l => l.id === move.fromListId);

        if (!fromList || !toList) return null;

        const cardIndex = fromList.cards.findIndex(c => c.id === move.cardId);
        if (cardIndex === -1) return null;

        const [card] = fromList.cards.splice(cardIndex, 1);
        toList.cards.splice(move.fromIndex, 0, card);

        cardMoveRedoStack.push(move);
        updateButtonStates();
        return move;
    }

    function redoCardMove(project) {
        if (cardMoveRedoStack.length === 0) return null;

        const move = cardMoveRedoStack.pop();
        const fromList = project.lists.find(l => l.id === move.fromListId);
        const toList = project.lists.find(l => l.id === move.toListId);

        if (!fromList || !toList) return null;

        const cardIndex = fromList.cards.findIndex(c => c.id === move.cardId);
        if (cardIndex === -1) return null;

        const [card] = fromList.cards.splice(cardIndex, 1);
        toList.cards.splice(move.toIndex, 0, card);

        cardMoveStack.push(move);
        updateButtonStates();
        return move;
    }

    function canUndoCardMove() {
        return cardMoveStack.length > 0;
    }

    function canRedoCardMove() {
        return cardMoveRedoStack.length > 0;
    }

    // ================================
    // BOARD UNDO/REDO - Card Actions (Archive/Delete)
    // ================================

    const cardActionStack = [];
    const cardActionRedoStack = [];

    function pushCardAction(actionInfo) {
        const entry = {
            ...actionInfo,
            actionType: actionInfo.type === 'archive' ? ACTION_TYPE.CARD_ARCHIVE : ACTION_TYPE.CARD_DELETE
        };
        cardActionStack.push(entry);
        if (cardActionStack.length > MAX_STACK_SIZE) {
            cardActionStack.shift();
        }
        cardActionRedoStack.length = 0;
        updateButtonStates();
    }

    function undoCardAction(project) {
        if (cardActionStack.length === 0) return null;

        const action = cardActionStack.pop();
        const targetList = project.lists.find(l => l.id === action.listId);

        if (!targetList) return null;

        // Restore the card
        targetList.cards.splice(action.index, 0, action.card);

        // Remove from archive if it was archived
        if (action.type === 'archive' && project.archive) {
            project.archive.cards = project.archive.cards.filter(
                c => c.id !== action.card.id
            );
        }

        cardActionRedoStack.push(action);
        updateButtonStates();
        return action;
    }

    function redoCardAction(project) {
        if (cardActionRedoStack.length === 0) return null;

        const action = cardActionRedoStack.pop();
        const targetList = project.lists.find(l => l.id === action.listId);

        if (!targetList) return null;

        // Find and remove the card
        const cardIndex = targetList.cards.findIndex(c => c.id === action.card.id);
        if (cardIndex === -1) return null;

        targetList.cards.splice(cardIndex, 1);

        // Re-archive if it was an archive action
        if (action.type === 'archive') {
            if (!project.archive) {
                project.archive = { cards: [] };
            }
            project.archive.cards.push(action.card);
        }

        cardActionStack.push(action);
        updateButtonStates();
        return action;
    }

    function canUndoCardAction() {
        return cardActionStack.length > 0;
    }

    function canRedoCardAction() {
        return cardActionRedoStack.length > 0;
    }

    // ================================
    // COMBINED BOARD UNDO/REDO
    // ================================

    /**
     * Perform board undo - handles card moves and card actions
     */
    function performBoardUndo(project) {
        // Check which action is most recent
        const moveStackLen = cardMoveStack.length;
        const actionStackLen = cardActionStack.length;

        if (moveStackLen === 0 && actionStackLen === 0) return false;

        // Get the most recent timestamps
        const moveTime = moveStackLen > 0 ? (cardMoveStack[moveStackLen - 1].timestamp || 0) : 0;
        const actionTime = actionStackLen > 0 ? (cardActionStack[actionStackLen - 1].timestamp || 0) : 0;

        if (moveTime >= actionTime && moveStackLen > 0) {
            return undoCardMove(project);
        } else if (actionStackLen > 0) {
            return undoCardAction(project);
        }
        return false;
    }

    /**
     * Perform board redo - handles card moves and card actions
     */
    function performBoardRedo(project) {
        // Check which redo action is most recent
        const moveRedoLen = cardMoveRedoStack.length;
        const actionRedoLen = cardActionRedoStack.length;

        if (moveRedoLen === 0 && actionRedoLen === 0) return false;

        // Get the most recent timestamps
        const moveTime = moveRedoLen > 0 ? (cardMoveRedoStack[moveRedoLen - 1].timestamp || 0) : 0;
        const actionTime = actionRedoLen > 0 ? (cardActionRedoStack[actionRedoLen - 1].timestamp || 0) : 0;

        if (moveTime >= actionTime && moveRedoLen > 0) {
            return redoCardMove(project);
        } else if (actionRedoLen > 0) {
            return redoCardAction(project);
        }
        return false;
    }

    /**
     * Check if any board undo is available
     */
    function canUndoBoard() {
        return canUndoCardMove() || canUndoCardAction();
    }

    /**
     * Check if any board redo is available
     */
    function canRedoBoard() {
        return canRedoCardMove() || canRedoCardAction();
    }

    // ================================
    // EXPORT
    // ================================

    window.UndoManager = {
        // Constants
        VIEW,
        ACTION_TYPE,

        // Core API
        init,
        setCurrentView,
        getCurrentView,
        pushState,
        undo,
        redo,
        canUndo,
        canRedo,
        getNextUndoDescription,
        getNextRedoDescription,
        clearView,
        clearAll,
        updateButtonStates,
        triggerUndo,
        triggerRedo,

        // Board - Card Move
        pushCardMove,
        undoCardMove,
        redoCardMove,
        canUndoCardMove,
        canRedoCardMove,

        // Board - Card Actions
        pushCardAction,
        undoCardAction,
        redoCardAction,
        canUndoCardAction,
        canRedoCardAction,

        // Board - Combined
        performBoardUndo,
        performBoardRedo,
        canUndoBoard,
        canRedoBoard
    };

    // Auto-initialize
    init();

})();
