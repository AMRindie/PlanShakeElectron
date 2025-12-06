/**
 * Whiteboard Engine - Main orchestrator
 * Coordinates all subsystems and provides public API
 */

import StateManager from './state-manager.js';
import RenderEngine from './render-engine.js';
import InteractionHandler from './interaction-handler.js';
import ObjectManager from './object-manager.js';
import LayerManager from './layer-manager.js';
import ContextMenu from './context-menu.js';

class WhiteboardEngine {
    constructor(projectData) {
        this.projectData = projectData;

        // DOM elements
        this.elements = {};

        // Subsystems
        this.stateManager = null;
        this.renderEngine = null;
        this.interactionHandler = null;
        this.objectManager = null;
        this.layerManager = null;
        this.contextMenu = null;

        // Custom cursor
        this.cursorEl = null;

        // Resize observer
        this.resizeObserver = null;
    }

    /**
     * Initialize whiteboard
     */
    async initialize() {
        // Cache DOM elements
        this.cacheElements();

        if (!this.validateElements()) {
            console.error('Whiteboard: Required elements not found');
            return false;
        }

        // Initialize state manager
        this.stateManager = new StateManager(this.projectData);
        this.stateManager.onSave((data) => {
            if (window.saveData && window.currentData) {
                window.saveData(data);
            }
        });

        // Initialize Context Menu first so we can reference it
        this.contextMenu = new ContextMenu(
            this.elements.wbContextMenu,
            this.stateManager,
            {
                onItemUpdate: (item) => {
                    this.objectManager.updateItemTransform(null, item);
                    this.stateManager.scheduleSave();
                },
                onItemDelete: (itemId) => {
                    this.objectManager.deleteItem(itemId);
                }
            }
        );

        // Initialize layer manager
        this.layerManager = new LayerManager(
            this.elements.wbLayerPanel,
            this.elements.wbLayerList,
            this.stateManager,
            {
                onLayerChange: () => {
                    this.renderEngine.requestRedraw();
                    this.objectManager.renderAll();
                    this.stateManager.scheduleSave();
                }
            }
        );
        this.layerManager.initialize();

        // Initialize render engine
        this.renderEngine = new RenderEngine(
            this.elements.wbDrawingCanvas,
            this.stateManager
        );

        // Initialize object manager
        this.objectManager = new ObjectManager(
            this.elements.wbObjectLayer,
            this.stateManager,
            {
                getActiveLayerId: () => this.layerManager.getActiveLayerId(),
                onHideContextMenu: () => this.contextMenu.hide(),

                // New callback when note editing starts to update menu
                onNoteEditStart: (itemEl) => {
                    const itemId = itemEl.dataset.id;
                    const wb = this.stateManager.getWhiteboard();
                    const item = wb.items.find(i => i.id === itemId);
                    // Show menu again - it will detect edit mode and show formatting tools
                    if (item) this.contextMenu.show(item, itemEl);
                },

                onResizeStart: (resizeInfo) => {
                    this.interactionHandler.startResize(resizeInfo);
                }
            }
        );
        this.objectManager.renderAll();

        // Initialize interaction handler
        this.interactionHandler = new InteractionHandler(
            this.elements.wbContainer,
            this.stateManager,
            {
                onViewChange: () => {
                    this.updateViewTransform();
                    this.contextMenu.updatePosition();
                },
                onDrawStart: (point, isEraser) => {
                    const wb = this.stateManager.getWhiteboard();
                    const layer = wb.layers.find(l => l.id === this.layerManager.getActiveLayerId());

                    if (!layer || !layer.visible) {
                        customAlert('Active layer is hidden', { title: 'Cannot Draw' });
                        return;
                    }

                    this.stateManager.recordHistory();
                    this.renderEngine.startStroke(
                        this.layerManager.getActiveLayerId(),
                        point,
                        wb.pen,
                        isEraser
                    );
                },
                onDrawMove: (point) => {
                    this.renderEngine.addStrokePoint(point);
                },
                onDrawEnd: () => {
                    const stroke = this.renderEngine.finishStroke();
                    if (stroke) {
                        this.stateManager.addStroke(stroke);
                        this.stateManager.scheduleSave();
                        this.renderEngine.requestRedraw();
                    }
                },
                onItemClick: (itemEl, x, y) => {
                    const itemId = itemEl.dataset.id;
                    const wb = this.stateManager.getWhiteboard();
                    const item = wb.items.find(i => i.id === itemId);
                    const layer = wb.layers.find(l => l.id === item.layerId);

                    if (layer && layer.visible) {
                        this.contextMenu.show(item, itemEl);
                        this.objectManager.selectItem(itemEl);
                        this.interactionHandler.startItemDrag(itemId);
                    }
                },
                onItemDragStart: () => {
                    this.stateManager.recordHistory();
                },
                onItemDrag: (itemId, dx, dy) => {
                    this.objectManager.dragItem(itemId, dx, dy);
                    // Update menu position while dragging
                    this.contextMenu.updatePosition();
                },
                onItemResize: (resizeInfo, dx, dy) => {
                    this.objectManager.performResize(resizeInfo, dx, dy);
                    // Update menu position while resizing
                    this.contextMenu.updatePosition();
                },
                onCanvasClick: () => {
                    this.objectManager.deselectAll();
                    this.contextMenu.hide();
                },
                onCursorMove: (x, y) => {
                    this.updateBrushCursor(x, y);
                },
                onCursorUpdate: () => {
                    this.updateCursor();
                },
                onModeChange: (mode) => {
                    this.updateToolButtons(mode);
                },
                onUndo: () => {
                    if (this.stateManager.undo()) {
                        this.renderEngine.requestRedraw();
                        this.objectManager.renderAll();
                    }
                },
                onRedo: () => {
                    if (this.stateManager.redo()) {
                        this.renderEngine.requestRedraw();
                        this.objectManager.renderAll();
                    }
                }
            }
        );

        // Setup UI controls
        this.setupUI();

        // Setup resize observer
        this.resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        this.resizeObserver.observe(this.elements.wbContainer);

        // Update initial view
        this.updateViewTransform();

        return true;
    }

    /**
     * Cache DOM element references
     */
    cacheElements() {
        const ids = [
            'whiteboardView', 'wbContainer', 'wbGridLayer', 'wbDrawingCanvas', 'wbObjectLayer',
            'wbToolCursor', 'wbToolHand', 'wbToolPen', 'wbToolEraser',
            'wbPenColor', 'wbPenSize', 'wbPenOpacity',
            'wbAddNoteBtn', 'wbAddImageInput', 'wbLayerBtn', 'wbAddLayerBtn',
            'wbLayerPanel', 'wbLayerList', 'wbResetViewBtn', 'wbZoomLevel', 'wbClearBtn',
            'wbCursor', 'wbContextMenu'
        ];

        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });

        // Create custom cursor if missing
        if (!this.elements.wbCursor) {
            this.elements.wbCursor = document.createElement('div');
            this.elements.wbCursor.id = 'wbCursor';
            this.elements.wbCursor.className = 'wb-cursor';
            document.body.appendChild(this.elements.wbCursor);
        }
        this.cursorEl = this.elements.wbCursor;
    }

    /**
     * Validate required elements exist
     */
    validateElements() {
        return !!(this.elements.wbContainer &&
            this.elements.wbDrawingCanvas &&
            this.elements.wbObjectLayer);
    }

    /**
     * Setup UI controls
     */
    setupUI() {
        const wb = this.stateManager.getWhiteboard();

        // Tool buttons
        if (this.elements.wbToolCursor) {
            this.elements.wbToolCursor.onclick = () => this.interactionHandler.setMode('cursor');
        }
        if (this.elements.wbToolHand) {
            this.elements.wbToolHand.onclick = () => this.interactionHandler.setMode('hand');
        }
        if (this.elements.wbToolPen) {
            this.elements.wbToolPen.onclick = () => this.interactionHandler.setMode('pen');
        }
        if (this.elements.wbToolEraser) {
            this.elements.wbToolEraser.onclick = () => this.interactionHandler.setMode('eraser');
        }

        // Pen controls
        if (this.elements.wbPenColor) {
            this.elements.wbPenColor.value = wb.pen.color;
            this.elements.wbPenColor.oninput = (e) => {
                this.stateManager.updatePen({ color: e.target.value });
            };
        }

        if (this.elements.wbPenSize) {
            this.elements.wbPenSize.value = wb.pen.size;
            this.elements.wbPenSize.oninput = (e) => {
                this.stateManager.updatePen({ size: parseInt(e.target.value) });
                this.updateBrushCursor(this.interactionHandler.lastPointer.x, this.interactionHandler.lastPointer.y);
            };
        }

        if (this.elements.wbPenOpacity) {
            this.elements.wbPenOpacity.value = Math.floor(wb.pen.opacity * 100);
            this.elements.wbPenOpacity.oninput = (e) => {
                this.stateManager.updatePen({ opacity: parseInt(e.target.value) / 100 });
            };
        }

        // Object controls
        if (this.elements.wbAddNoteBtn) {
            this.elements.wbAddNoteBtn.onclick = () => {
                this.objectManager.addItem('note');
            };
        }

        if (this.elements.wbAddImageInput) {
            this.elements.wbAddImageInput.onchange = (e) => {
                if (e.target.files[0]) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const img = new Image();
                        img.onload = () => {
                            let w = img.width;
                            let h = img.height;
                            const MAX = 400;
                            if (w > MAX || h > MAX) {
                                const ratio = w / h;
                                if (w > h) {
                                    w = MAX;
                                    h = MAX / ratio;
                                } else {
                                    h = MAX;
                                    w = MAX * ratio;
                                }
                            }
                            this.objectManager.addItem('image', evt.target.result, w, h);
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                }
            };
        }

        // Layer controls
        if (this.elements.wbLayerBtn) {
            this.elements.wbLayerBtn.onclick = () => {
                this.layerManager.togglePanel();
            };
        }

        if (this.elements.wbAddLayerBtn) {
            this.elements.wbAddLayerBtn.onclick = () => {
                this.layerManager.addLayer();
            };
        }

        // View controls
        if (this.elements.wbResetViewBtn) {
            this.elements.wbResetViewBtn.onclick = () => {
                const wb = this.stateManager.getWhiteboard();
                wb.view = { x: 0, y: 0, scale: 1.0 };
                this.updateViewTransform();
                this.stateManager.scheduleSave();
            };
        }

        // Clear button
        if (this.elements.wbClearBtn) {
            this.elements.wbClearBtn.onclick = () => {
                this.layerManager.clearActiveLayer();
            };
        }
    }

    /**
     * Handle container resize
     */
    handleResize() {
        const rect = this.elements.wbContainer.getBoundingClientRect();
        this.renderEngine.resize(rect.width, rect.height);
    }

    /**
     * Update view transform
     */
    updateViewTransform() {
        const wb = this.stateManager.getWhiteboard();
        const transform = `translate(${wb.view.x}px, ${wb.view.y}px) scale(${wb.view.scale})`;

        if (this.elements.wbGridLayer) {
            this.elements.wbGridLayer.style.transform = transform;
        }
        if (this.elements.wbObjectLayer) {
            this.elements.wbObjectLayer.style.transform = transform;
        }
        if (this.elements.wbZoomLevel) {
            this.elements.wbZoomLevel.textContent = Math.round(wb.view.scale * 100) + '%';
        }

        this.renderEngine.requestRedraw();
    }

    /**
     * Update cursor based on mode
     */
    updateCursor() {
        const mode = this.interactionHandler.getMode();
        const isBrush = mode === 'pen' || mode === 'eraser';

        if (isBrush) {
            this.elements.wbContainer.dataset.cursor = 'none';
            this.cursorEl.classList.add('active');
        } else {
            const isPanning = this.interactionHandler.isPanning;
            this.elements.wbContainer.dataset.cursor =
                mode === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'default';
            this.cursorEl.classList.remove('active');
        }
    }

    /**
     * Update brush cursor position and size
     */
    updateBrushCursor(x, y) {
        if (!this.cursorEl.classList.contains('active')) return;

        const wb = this.stateManager.getWhiteboard();
        const size = wb.pen.size * wb.view.scale;

        this.cursorEl.style.width = size + 'px';
        this.cursorEl.style.height = size + 'px';
        this.cursorEl.style.left = x + 'px';
        this.cursorEl.style.top = y + 'px';
    }

    /**
     * Update tool button active states
     */
    updateToolButtons(mode) {
        if (this.elements.wbToolCursor) {
            this.elements.wbToolCursor.classList.toggle('active', mode === 'cursor');
        }
        if (this.elements.wbToolHand) {
            this.elements.wbToolHand.classList.toggle('active', mode === 'hand');
        }
        if (this.elements.wbToolPen) {
            this.elements.wbToolPen.classList.toggle('active', mode === 'pen');
        }
        if (this.elements.wbToolEraser) {
            this.elements.wbToolEraser.classList.toggle('active', mode === 'eraser');
        }
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.interactionHandler) {
            this.interactionHandler.destroy();
        }
        if (this.renderEngine) {
            this.renderEngine.destroy();
        }
        if (this.stateManager) {
            this.stateManager.destroy();
        }
        if (this.contextMenu) {
            this.contextMenu.destroy();
        }
    }
}

export default WhiteboardEngine;