/**
 * Layer Manager - Manages whiteboard layers
 * Handles layer UI, visibility, and reordering
 */

class LayerManager {
    constructor(layerPanelEl, layerListEl, stateManager, callbacks) {
        this.layerPanel = layerPanelEl;
        this.layerList = layerListEl;
        this.stateManager = stateManager;
        this.callbacks = callbacks;

        this.activeLayerId = null;
    }

    /**
     * Initialize with default layer
     */
    initialize() {
        this.activeLayerId = this.stateManager.initializeLayers();
        this.render();
    }

    /**
     * Render layer UI
     */
    render() {
        if (!this.layerList) return;

        const wb = this.stateManager.getWhiteboard();
        this.layerList.innerHTML = '';

        // Render in reverse order (top to bottom)
        [...wb.layers].reverse().forEach((layer, reversedIdx) => {
            const actualIndex = wb.layers.length - 1 - reversedIdx;
            const layerEl = this.createLayerElement(layer, actualIndex);
            this.layerList.appendChild(layerEl);
        });
    }

    /**
     * Create layer element
     */
    createLayerElement(layer, actualIndex) {
        const wb = this.stateManager.getWhiteboard();

        const div = document.createElement('div');
        div.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
        div.onclick = () => {
            this.setActiveLayer(layer.id);
        };

        // Visibility toggle
        const visBtn = document.createElement('button');
        visBtn.className = 'icon-btn small';
        visBtn.textContent = layer.visible ? '👁️' : '○';
        visBtn.onclick = (e) => {
            e.stopPropagation();
            this.stateManager.toggleLayerVisibility(layer.id);
            this.render();
            this.callbacks.onLayerChange();
        };

        // Layer name
        const nameSpan = document.createTextNode(layer.name);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; gap: 4px; margin-left: auto;';

        // Move up button
        if (actualIndex < wb.layers.length - 1) {
            const moveUpBtn = document.createElement('button');
            moveUpBtn.className = 'icon-btn small';
            moveUpBtn.textContent = '▲';
            moveUpBtn.title = 'Move Layer Up';
            moveUpBtn.onclick = (e) => {
                e.stopPropagation();
                this.stateManager.reorderLayers(actualIndex, actualIndex + 1);
                this.render();
                this.callbacks.onLayerChange();
            };
            btnContainer.appendChild(moveUpBtn);
        }

        // Move down button
        if (actualIndex > 0) {
            const moveDownBtn = document.createElement('button');
            moveDownBtn.className = 'icon-btn small';
            moveDownBtn.textContent = '▼';
            moveDownBtn.title = 'Move Layer Down';
            moveDownBtn.onclick = (e) => {
                e.stopPropagation();
                this.stateManager.reorderLayers(actualIndex, actualIndex - 1);
                this.render();
                this.callbacks.onLayerChange();
            };
            btnContainer.appendChild(moveDownBtn);
        }

        // Delete button (only if more than one layer)
        if (wb.layers.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-btn small';
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Delete Layer';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (await customConfirm(t('deleteLayerConfirm'), { title: t('deleteLayer'), confirmText: t('delete'), danger: true })) {
                    this.stateManager.deleteLayer(layer.id);

                    // If we deleted the active layer, switch to first layer
                    if (this.activeLayerId === layer.id) {
                        const newWb = this.stateManager.getWhiteboard();
                        this.activeLayerId = newWb.layers[0].id;
                    }

                    this.render();
                    this.callbacks.onLayerChange();
                }
            };
            btnContainer.appendChild(deleteBtn);
        }

        div.append(visBtn, nameSpan, btnContainer);
        return div;
    }

    /**
     * Add new layer
     */
    addLayer() {
        const wb = this.stateManager.getWhiteboard();
        const layerId = this.stateManager.addLayer(`Layer ${wb.layers.length + 1}`);
        this.setActiveLayer(layerId);
        this.render();
    }

    /**
     * Set active layer
     */
    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        this.render();
    }

    /**
     * Get active layer ID
     */
    getActiveLayerId() {
        return this.activeLayerId;
    }

    /**
     * Toggle panel visibility
     */
    togglePanel() {
        if (this.layerPanel) {
            this.layerPanel.classList.toggle('hidden');
        }
    }

    /**
     * Clear active layer
     */
    async clearActiveLayer() {
        if (await customConfirm(t('clearLayerConfirm'), { title: t('clearLayer'), confirmText: t('clear'), danger: true })) {
            // Note: recordHistory is now called internally by clearLayer with proper action tracking
            this.stateManager.clearLayer(this.activeLayerId);
            this.callbacks.onLayerChange();
        }
    }
}

export default LayerManager;
