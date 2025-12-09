/**
 * State Manager - Centralized state management with optimized history
 * Handles state updates, undo/redo, and change tracking
 * 
 * Enhanced with:
 * - Action-based tracking with descriptive messages
 * - Debounced action grouping for continuous operations
 * - Better visual feedback for undo/redo
 */

class StateManager {
    constructor(projectData) {
        this.projectData = projectData;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.changeListeners = new Set();
        this.saveCallback = null;
        this.saveDebounceTimer = null;
        this.saveDebounceDelay = 300; // ms

        // Action grouping for continuous operations
        this.actionGroupTimer = null;
        this.actionGroupDelay = 500; // ms - group actions within this window
        this.pendingAction = null;

        // Action types for better feedback
        this.ACTION_TYPES = {
            ADD_ITEM: 'addItem',
            DELETE_ITEM: 'deleteItem',
            MOVE_ITEM: 'moveItem',
            RESIZE_ITEM: 'resizeItem',
            EDIT_ITEM: 'editItem',
            ADD_STROKE: 'addStroke',
            ERASE_STROKE: 'eraseStroke',
            CLEAR_LAYER: 'clearLayer',
            ADD_LAYER: 'addLayer',
            DELETE_LAYER: 'deleteLayer',
            BULK_ACTION: 'bulkAction',
            UNKNOWN: 'unknown'
        };

        // Record initial state so first undo has something to revert to
        this.recordInitialState();
    }

    /**
     * Record the initial state (called once on construction)
     */
    recordInitialState() {
        const wb = this.getWhiteboard();
        const snapshot = {
            items: structuredClone(wb.items || []),
            strokes: structuredClone(wb.strokes || []),
            actionType: null,
            actionDescription: 'Initial state'
        };
        this.history.push(snapshot);
        this.historyIndex = 0;
    }

    /**
     * Get the whiteboard data
     */
    getWhiteboard() {
        if (!this.projectData.whiteboard) {
            this.projectData.whiteboard = {
                items: [],
                strokes: [],
                layers: [],
                pen: { color: '#000000', size: 5, opacity: 1.0 },
                view: { x: 0, y: 0, scale: 1.0 }
            };
        }
        return this.projectData.whiteboard;
    }

    /**
     * Initialize default layer if none exist
     */
    initializeLayers() {
        const wb = this.getWhiteboard();
        if (!wb.layers || wb.layers.length === 0) {
            const id = 'L' + Date.now();
            wb.layers = [{ id, name: 'Layer 1', visible: true }];
            return id;
        }
        return wb.layers[0].id;
    }

    /**
     * Record current state to history with action info
     * @param {string} actionType - Type of action (from ACTION_TYPES)
     * @param {string} description - Human-readable description
     * @param {boolean} groupable - Whether this action can be grouped with similar actions
     */
    recordHistory(actionType = this.ACTION_TYPES.UNKNOWN, description = '', groupable = false) {
        const wb = this.getWhiteboard();

        // For groupable actions (like continuous movement), debounce
        if (groupable && this.pendingAction && this.pendingAction.type === actionType) {
            // Update the pending action's end state
            this.pendingAction.snapshot = {
                items: structuredClone(wb.items),
                strokes: structuredClone(wb.strokes),
                actionType: actionType,
                actionDescription: description
            };

            // Reset the group timer
            if (this.actionGroupTimer) {
                clearTimeout(this.actionGroupTimer);
            }
            this.actionGroupTimer = setTimeout(() => {
                this.commitPendingAction();
            }, this.actionGroupDelay);
            return;
        }

        // Commit any pending action first
        this.commitPendingAction();

        // For groupable actions, start a new pending action
        if (groupable) {
            this.pendingAction = {
                type: actionType,
                snapshot: {
                    items: structuredClone(wb.items),
                    strokes: structuredClone(wb.strokes),
                    actionType: actionType,
                    actionDescription: description
                }
            };
            this.actionGroupTimer = setTimeout(() => {
                this.commitPendingAction();
            }, this.actionGroupDelay);
            return;
        }

        // Non-groupable action: commit immediately
        this.commitSnapshot({
            items: structuredClone(wb.items),
            strokes: structuredClone(wb.strokes),
            actionType: actionType,
            actionDescription: description
        });
    }

    /**
     * Commit pending action to history
     */
    commitPendingAction() {
        if (this.actionGroupTimer) {
            clearTimeout(this.actionGroupTimer);
            this.actionGroupTimer = null;
        }

        if (this.pendingAction) {
            this.commitSnapshot(this.pendingAction.snapshot);
            this.pendingAction = null;
        }
    }

    /**
     * Commit a snapshot to history
     */
    commitSnapshot(snapshot) {
        // Remove any future history if we're in the middle of the stack
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(snapshot);
        this.historyIndex++;

        // Limit history size to prevent memory bloat
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo last action
     * @returns {object|false} Action info if successful, false otherwise
     */
    undo() {
        // Commit any pending action before undoing
        this.commitPendingAction();

        if (this.historyIndex > 0) {
            // Get info about what we're undoing
            const undoneAction = this.history[this.historyIndex];

            this.historyIndex--;
            this.restoreHistory(this.history[this.historyIndex]);

            return {
                actionType: undoneAction.actionType,
                description: undoneAction.actionDescription
            };
        }
        return false;
    }

    /**
     * Redo previously undone action
     * @returns {object|false} Action info if successful, false otherwise
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistory(this.history[this.historyIndex]);

            const redoneAction = this.history[this.historyIndex];
            return {
                actionType: redoneAction.actionType,
                description: redoneAction.actionDescription
            };
        }
        return false;
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyIndex > 0 || this.pendingAction !== null;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Get the description of the next undo action
     */
    getNextUndoDescription() {
        if (this.pendingAction) {
            return this.pendingAction.snapshot.actionDescription;
        }
        if (this.historyIndex > 0) {
            return this.history[this.historyIndex].actionDescription;
        }
        return null;
    }

    /**
     * Get the description of the next redo action
     */
    getNextRedoDescription() {
        if (this.historyIndex < this.history.length - 1) {
            return this.history[this.historyIndex + 1].actionDescription;
        }
        return null;
    }

    /**
     * Restore state from history snapshot
     */
    restoreHistory(snapshot) {
        const wb = this.getWhiteboard();
        wb.items = structuredClone(snapshot.items);
        wb.strokes = structuredClone(snapshot.strokes);
        this.notifyChanges();
        this.scheduleSave();
    }

    /**
     * Update pen settings
     */
    updatePen(settings) {
        const wb = this.getWhiteboard();
        Object.assign(wb.pen, settings);
        this.scheduleSave();
    }

    /**
     * Update view transform
     */
    updateView(transform) {
        const wb = this.getWhiteboard();
        Object.assign(wb.view, transform);
        // Don't save immediately on every pan/zoom - debounced
    }

    /**
     * Add stroke to canvas
     */
    addStroke(stroke, isEraser = false) {
        const wb = this.getWhiteboard();
        wb.strokes.push(stroke);
        this.notifyChanges();

        // Strokes are groupable - continuous drawing becomes one undo step
        const actionType = isEraser ? this.ACTION_TYPES.ERASE_STROKE : this.ACTION_TYPES.ADD_STROKE;
        const description = isEraser ? 'Erase' : 'Draw stroke';
        this.recordHistory(actionType, description, true);
    }

    /**
     * Add item (note or image)
     */
    addItem(item) {
        const wb = this.getWhiteboard();
        wb.items.push(item);
        this.notifyChanges();
        this.scheduleSave();

        const itemType = item.type === 'image' ? 'image' : 'note';
        this.recordHistory(this.ACTION_TYPES.ADD_ITEM, `Add ${itemType}`, false);
    }

    /**
     * Update item properties
     */
    updateItem(itemId, updates, actionType = null) {
        const wb = this.getWhiteboard();
        const item = wb.items.find(i => i.id === itemId);
        if (item) {
            Object.assign(item, updates);
            this.notifyChanges();
            this.scheduleSave();

            // Determine action type if not provided
            if (!actionType) {
                if ('x' in updates || 'y' in updates) {
                    actionType = this.ACTION_TYPES.MOVE_ITEM;
                } else if ('width' in updates || 'height' in updates) {
                    actionType = this.ACTION_TYPES.RESIZE_ITEM;
                } else {
                    actionType = this.ACTION_TYPES.EDIT_ITEM;
                }
            }

            const itemType = item.type === 'image' ? 'image' : 'note';
            let description = '';

            switch (actionType) {
                case this.ACTION_TYPES.MOVE_ITEM:
                    description = `Move ${itemType}`;
                    break;
                case this.ACTION_TYPES.RESIZE_ITEM:
                    description = `Resize ${itemType}`;
                    break;
                case this.ACTION_TYPES.EDIT_ITEM:
                    description = `Edit ${itemType}`;
                    break;
                default:
                    description = `Update ${itemType}`;
            }

            // Move and resize are groupable for continuous dragging
            const groupable = actionType === this.ACTION_TYPES.MOVE_ITEM ||
                actionType === this.ACTION_TYPES.RESIZE_ITEM;
            this.recordHistory(actionType, description, groupable);
        }
    }

    /**
     * Delete item
     */
    deleteItem(itemId) {
        const wb = this.getWhiteboard();
        const item = wb.items.find(i => i.id === itemId);
        const index = wb.items.findIndex(i => i.id === itemId);

        if (index > -1) {
            const itemType = item?.type === 'image' ? 'image' : 'note';
            wb.items.splice(index, 1);
            this.notifyChanges();
            this.scheduleSave();
            this.recordHistory(this.ACTION_TYPES.DELETE_ITEM, `Delete ${itemType}`, false);
            return true;
        }
        return false;
    }

    /**
     * Add layer
     */
    addLayer(name) {
        const wb = this.getWhiteboard();
        const id = 'L' + Date.now();
        const layer = { id, name, visible: true };
        wb.layers.push(layer);
        this.notifyChanges();
        this.scheduleSave();
        this.recordHistory(this.ACTION_TYPES.ADD_LAYER, `Add layer "${name}"`, false);
        return id;
    }

    /**
     * Delete layer and all its content
     */
    deleteLayer(layerId) {
        const wb = this.getWhiteboard();
        const layer = wb.layers.find(l => l.id === layerId);
        const index = wb.layers.findIndex(l => l.id === layerId);

        if (index > -1) {
            const layerName = layer?.name || 'Layer';
            // Remove all items and strokes from this layer
            wb.items = wb.items.filter(i => i.layerId !== layerId);
            wb.strokes = wb.strokes.filter(s => s.layerId !== layerId);
            wb.layers.splice(index, 1);
            this.notifyChanges();
            this.scheduleSave();
            this.recordHistory(this.ACTION_TYPES.DELETE_LAYER, `Delete layer "${layerName}"`, false);
            return true;
        }
        return false;
    }

    /**
     * Toggle layer visibility
     */
    toggleLayerVisibility(layerId) {
        const wb = this.getWhiteboard();
        const layer = wb.layers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = !layer.visible;
            this.notifyChanges();
            this.scheduleSave();
            // No history for visibility toggle - it's a view setting
        }
    }

    /**
     * Reorder layers
     */
    reorderLayers(fromIndex, toIndex) {
        const wb = this.getWhiteboard();
        const [layer] = wb.layers.splice(fromIndex, 1);
        wb.layers.splice(toIndex, 0, layer);
        this.notifyChanges();
        this.scheduleSave();
        // No history for reorder - it's organization
    }

    /**
     * Clear active layer
     */
    clearLayer(layerId) {
        const wb = this.getWhiteboard();
        const layer = wb.layers.find(l => l.id === layerId);
        const layerName = layer?.name || 'Layer';

        wb.strokes = wb.strokes.filter(s => s.layerId !== layerId);
        wb.items = wb.items.filter(i => i.layerId !== layerId);
        this.notifyChanges();
        this.scheduleSave();
        this.recordHistory(this.ACTION_TYPES.CLEAR_LAYER, `Clear layer "${layerName}"`, false);
    }

    /**
     * Register change listener
     */
    onChange(callback) {
        this.changeListeners.add(callback);
    }

    /**
     * Unregister change listener
     */
    offChange(callback) {
        this.changeListeners.delete(callback);
    }

    /**
     * Notify all listeners of changes
     */
    notifyChanges() {
        this.changeListeners.forEach(callback => callback());
    }

    /**
     * Set save callback
     */
    onSave(callback) {
        this.saveCallback = callback;
    }

    /**
     * Schedule debounced save
     */
    scheduleSave() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => {
            if (this.saveCallback) {
                this.saveCallback(this.projectData);
            }
        }, this.saveDebounceDelay);
    }

    /**
     * Force immediate save
     */
    saveNow() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        if (this.saveCallback) {
            this.saveCallback(this.projectData);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        if (this.actionGroupTimer) {
            clearTimeout(this.actionGroupTimer);
        }
        this.changeListeners.clear();
        this.history = [];
        this.pendingAction = null;
    }
}

export default StateManager;
