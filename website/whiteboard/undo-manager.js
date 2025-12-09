/**
 * WhiteboardUndoManager - History management for whiteboard
 * Handles undo/redo with state snapshots
 */

class WhiteboardUndoManager {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
    }

    /**
     * Record initial state (call once after getting whiteboard data)
     * @param {Object} wb - Whiteboard data object
     */
    recordInitialState(wb) {
        const snapshot = {
            items: structuredClone(wb.items || []),
            strokes: structuredClone(wb.strokes || [])
        };
        this.history.push(snapshot);
        this.historyIndex = 0;
    }

    /**
     * Record current state before an action
     * @param {Object} wb - Whiteboard data object
     */
    recordState(wb) {
        // Remove any future history if we're in the middle of the stack
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const snapshot = {
            items: structuredClone(wb.items),
            strokes: structuredClone(wb.strokes)
        };

        this.history.push(snapshot);
        this.historyIndex++;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo last action
     * @param {Object} wb - Whiteboard data object to restore into
     * @returns {boolean} - Whether undo was successful
     */
    undo(wb) {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this._restoreSnapshot(wb, this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    /**
     * Redo previously undone action
     * @param {Object} wb - Whiteboard data object to restore into
     * @returns {boolean} - Whether redo was successful
     */
    redo(wb) {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this._restoreSnapshot(wb, this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    /**
     * Restore a snapshot to the whiteboard data
     * @private
     */
    _restoreSnapshot(wb, snapshot) {
        wb.items = structuredClone(snapshot.items);
        wb.strokes = structuredClone(snapshot.strokes);
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Clear history (e.g., when switching projects)
     */
    clear() {
        this.history = [];
        this.historyIndex = -1;
    }

    /**
     * Show undo toast using global UndoManager
     * @param {boolean} isUndo - true for undo action, false for redo
     * @param {Function} onRedo - Callback for redo action
     * @param {Function} onUndo - Callback for undo action
     */
    showToast(isUndo, onRedo, onUndo) {
        // Use global hideAllToasts to prevent overlap
        if (window.hideAllToasts) window.hideAllToasts();

        const t = window.t || ((key) => null);
        const message = isUndo
            ? (t('actionUndone') || 'Action undone')
            : (t('actionRestored') || 'Action restored');

        const actionLabel = isUndo
            ? (t('redo') || 'Redo')
            : (t('undo') || 'Undo');

        if (window.UndoManager) {
            window.UndoManager.showToast(message, {
                type: isUndo ? 'undo' : 'redo',
                actionLabel: actionLabel,
                onAction: () => {
                    if (isUndo && onRedo) {
                        onRedo();
                    } else if (!isUndo && onUndo) {
                        onUndo();
                    }
                }
            });
        }
    }
}

export default WhiteboardUndoManager;
