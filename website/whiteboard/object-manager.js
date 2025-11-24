/**
 * Object Manager - Manages whiteboard objects (notes and images)
 * Handles DOM creation, updates, and interactions
 */

class ObjectManager {
    constructor(container, stateManager, callbacks) {
        this.container = container;
        this.stateManager = stateManager;
        this.callbacks = callbacks;

        // DOM element pool for performance
        this.elementPool = new Map();

        // Double-tap detection
        this.lastTapTime = 0;
        this.lastTapElement = null;
    }

    /**
     * Render all objects
     */
    renderAll() {
        const wb = this.stateManager.getWhiteboard();

        // Clear container
        this.container.innerHTML = '';
        this.elementPool.clear();

        // Create DOM elements for each object
        wb.items.forEach(item => {
            const el = this.createItemElement(item);
            this.container.appendChild(el);
            this.elementPool.set(item.id, el);
        });
    }

    /**
     * Create DOM element for an item
     */
    createItemElement(item) {
        const el = document.createElement('div');
        el.className = `wb-item wb-${item.type}`;
        el.dataset.id = item.id;

        this.updateItemTransform(el, item);

        if (item.type === 'note') {
            this.setupNoteElement(el, item);
        } else if (item.type === 'image') {
            this.setupImageElement(el, item);
        }

        // Add resize handles
        this.addResizeHandles(el);

        return el;
    }

    /**
     * Setup note element
     */
    setupNoteElement(el, item) {
        // Apply background color
        if (item.backgroundColor) {
            el.style.backgroundColor = item.backgroundColor;
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'wb-note-content';
        contentDiv.contentEditable = false;
        contentDiv.innerHTML = item.content || '';
        contentDiv.style.pointerEvents = 'none';

        // Content change handler
        contentDiv.oninput = () => {
            item.content = contentDiv.innerHTML;
            this.stateManager.scheduleSave();
        };

        // Blur handler
        contentDiv.onblur = () => {
            contentDiv.contentEditable = false;
            contentDiv.style.pointerEvents = 'none';
            this.stateManager.scheduleSave();
        };

        el.appendChild(contentDiv);

        // Double-click handler
        el.ondblclick = (e) => {
            this.enableNoteEditing(e, contentDiv);
        };

        // Touch double-tap handler
        el.ontouchend = (e) => {
            const currentTime = Date.now();
            const tapLength = currentTime - this.lastTapTime;

            if (tapLength < 300 && tapLength > 0 && this.lastTapElement === el) {
                this.enableNoteEditing(e, contentDiv);
            }

            this.lastTapTime = currentTime;
            this.lastTapElement = el;
        };
        const img = document.createElement('img');
        img.src = item.content;
        img.draggable = false;

        // Apply border if exists
        if (item.border) {
            img.style.border = `${item.border.width}px solid ${item.border.color}`;
        }

        el.appendChild(img);
    }

    /**
     * Add resize handles
     */
    addResizeHandles(el) {
        const handles = [
            { pos: 'nw', style: 'top:-16px; left:-16px; cursor:nwse-resize' },
            { pos: 'n', style: 'top:-16px; left:50%; margin-left:-16px; cursor:ns-resize' },
            { pos: 'ne', style: 'top:-16px; right:-16px; cursor:nesw-resize' },
            { pos: 'e', style: 'top:50%; right:-16px; margin-top:-16px; cursor:ew-resize' },
            { pos: 'se', style: 'bottom:-16px; right:-16px; cursor:nwse-resize' },
            { pos: 's', style: 'bottom:-16px; left:50%; margin-left:-16px; cursor:ns-resize' },
            { pos: 'sw', style: 'bottom:-16px; left:-16px; cursor:nesw-resize' },
            { pos: 'w', style: 'top:50%; left:-16px; margin-top:-16px; cursor:ew-resize' }
        ];

        handles.forEach(hData => {
            const h = document.createElement('div');
            h.className = `wb-resize-handle handle-${hData.pos}`;
            h.style.cssText = hData.style;

            const startResize = (e) => {
                e.stopPropagation();
                e.preventDefault();

                const itemId = el.dataset.id;
                const wb = this.stateManager.getWhiteboard();
                const item = wb.items.find(i => i.id === itemId);

                if (item) {
                    this.stateManager.recordHistory();

                    const resizeInfo = {
                        itemId: itemId,
                        startX: item.x,
                        startY: item.y,
                        startW: item.w,
                        startH: item.h,
                        pos: hData.pos,
                        ratio: item.w / item.h
                    };

                    this.callbacks.onResizeStart(resizeInfo);
                }
            };

            h.onmousedown = startResize;
            h.ontouchstart = startResize;

            el.appendChild(h);
        });
    }

    /**
     * Update item transform
     */
    updateItemTransform(el, item) {
        if (!el) {
            el = this.elementPool.get(item.id);
        }

        if (!el) return;

        const wb = this.stateManager.getWhiteboard();

        el.style.transform = `translate(${item.x}px, ${item.y}px)`;
        el.style.width = item.w + 'px';
        el.style.height = item.h + 'px';

        // Update visibility and z-index based on layer
        const layerIndex = wb.layers.findIndex(l => l.id === item.layerId);
        const layer = wb.layers[layerIndex];

        if (layer && layer.visible) {
            el.style.display = 'block';
            el.style.zIndex = 10 + (layerIndex * 10);
        } else {
            el.style.display = 'none';
        }

        // Update item-specific properties
        if (item.type === 'image') {
            const img = el.querySelector('img');
            if (img && item.border) {
                img.style.border = `${item.border.width}px solid ${item.border.color}`;
            } else if (img) {
                img.style.border = 'none';
            }
        } else if (item.type === 'note') {
            if (item.backgroundColor) {
                el.style.backgroundColor = item.backgroundColor;
            }
        }
    }

    /**
     * Perform resize
     */
    performResize(resizeInfo, dx, dy) {
        const wb = this.stateManager.getWhiteboard();
        const item = wb.items.find(i => i.id === resizeInfo.itemId);

        if (!item) return;

        const MIN = 20;
        let newW = resizeInfo.startW;
        let newH = resizeInfo.startH;
        let newX = resizeInfo.startX;
        let newY = resizeInfo.startY;

        const pos = resizeInfo.pos;

        // Calculate new dimensions based on handle position
        if (pos.includes('e')) newW = resizeInfo.startW + dx;
        if (pos.includes('w')) {
            newW = resizeInfo.startW - dx;
            newX = resizeInfo.startX + dx;
        }
        if (pos.includes('s')) newH = resizeInfo.startH + dy;
        if (pos.includes('n')) {
            newH = resizeInfo.startH - dy;
            newY = resizeInfo.startY + dy;
        }

        // Enforce minimum size
        if (newW < MIN) {
            if (pos.includes('w')) newX = resizeInfo.startX + (resizeInfo.startW - MIN);
            newW = MIN;
        }
        if (newH < MIN) {
            if (pos.includes('n')) newY = resizeInfo.startY + (resizeInfo.startH - MIN);
            newH = MIN;
        }

        // Maintain aspect ratio for images on corner handles
        const isCorner = pos.length === 2;
        if (item.type === 'image' && isCorner) {
            newH = newW / resizeInfo.ratio;
            if (pos.includes('n')) {
                const bottomY = resizeInfo.startY + resizeInfo.startH;
                newY = bottomY - newH;
            }
        }

        // Update item
        item.w = newW;
        item.h = newH;
        item.x = newX;
        item.y = newY;

        // Accumulate deltas to resizeInfo for continued resizing
        resizeInfo.startW = newW;
        resizeInfo.startH = newH;
        resizeInfo.startX = newX;
        resizeInfo.startY = newY;

        this.updateItemTransform(null, item);
    }

    /**
     * Add new item
     */
    addItem(type, content = '', w = 200, h = 200) {
        const wb = this.stateManager.getWhiteboard();
        const rect = this.container.getBoundingClientRect();

        // Calculate center position in world coords
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const worldX = (centerX - wb.view.x) / wb.view.scale;
        const worldY = (centerY - wb.view.y) / wb.view.scale;

        const item = {
            id: (type === 'note' ? 'N' : 'I') + Date.now(),
            type: type,
            layerId: this.callbacks.getActiveLayerId(),
            x: worldX - w / 2,
            y: worldY - h / 2,
            w: w,
            h: h,
            content: content
        };

        this.stateManager.recordHistory();
        this.stateManager.addItem(item);

        const el = this.createItemElement(item);
        this.container.appendChild(el);
        this.elementPool.set(item.id, el);
    }

    /**
     * Delete item
     */
    deleteItem(itemId) {
        const el = this.elementPool.get(itemId);
        if (el) {
            el.remove();
            this.elementPool.delete(itemId);
        }
        this.stateManager.recordHistory();
        this.stateManager.deleteItem(itemId);
    }

    /**
     * Deselect all items
     */
    deselectAll() {
        this.container.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }

    /**
     * Select item
     */
    selectItem(itemEl) {
        this.deselectAll();
        itemEl.classList.add('selected');
    }

    /**
     * Drag item
     */
    dragItem(itemId, dx, dy) {
        const wb = this.stateManager.getWhiteboard();
        const item = wb.items.find(i => i.id === itemId);

        if (item) {
            item.x += dx;
            item.y += dy;
            this.updateItemTransform(null, item);
        }
    }

    /**
     * Get item element
     */
    getItemElement(itemId) {
        return this.elementPool.get(itemId);
    }

    /**
     * Cleanup
     */
    destroy() {
        this.elementPool.clear();
    }
}

export default ObjectManager;
