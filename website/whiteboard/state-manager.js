/**
 * State Manager - Centralized state management with optimized history
 * Handles state updates, undo/redo, and change tracking
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
     * Record current state to history
     */
    recordHistory() {
        const wb = this.getWhiteboard();

        // Remove any future history if we're in the middle of the stack
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Create snapshot using structured clone for better performance
        const snapshot = {
            items: structuredClone(wb.items),
            strokes: structuredClone(wb.strokes)
        };

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
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreHistory(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    /**
     * Redo previously undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistory(this.history[this.historyIndex]);
            return true;
        }
        return false;
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
    addStroke(stroke) {
        const wb = this.getWhiteboard();
        wb.strokes.push(stroke);
        this.notifyChanges();
    }

    /**
     * Add item (note or image)
     */
    addItem(item) {
        const wb = this.getWhiteboard();
        wb.items.push(item);
        this.notifyChanges();
        this.scheduleSave();
    }

    /**
     * Update item properties
     */
    updateItem(itemId, updates) {
        const wb = this.getWhiteboard();
        const item = wb.items.find(i => i.id === itemId);
        if (item) {
            Object.assign(item, updates);
            this.notifyChanges();
            this.scheduleSave();
        }
    }

    /**
     * Delete item
     */
    deleteItem(itemId) {
        const wb = this.getWhiteboard();
        const index = wb.items.findIndex(i => i.id === itemId);
        if (index > -1) {
            wb.items.splice(index, 1);
            this.notifyChanges();
            this.scheduleSave();
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
        return id;
    }

    /**
     * Delete layer and all its content
     */
    deleteLayer(layerId) {
        const wb = this.getWhiteboard();
        const index = wb.layers.findIndex(l => l.id === layerId);
        if (index > -1) {
            // Remove all items and strokes from this layer
            wb.items = wb.items.filter(i => i.layerId !== layerId);
            wb.strokes = wb.strokes.filter(s => s.layerId !== layerId);
            wb.layers.splice(index, 1);
            this.notifyChanges();
            this.scheduleSave();
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
    }

    /**
     * Clear active layer
     */
    clearLayer(layerId) {
        const wb = this.getWhiteboard();
        wb.strokes = wb.strokes.filter(s => s.layerId !== layerId);
        wb.items = wb.items.filter(i => i.layerId !== layerId);
        this.notifyChanges();
        this.scheduleSave();
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
        this.changeListeners.clear();
        this.history = [];
    }
}

export default StateManager;
