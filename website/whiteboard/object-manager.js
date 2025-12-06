/**
 * Object Manager - Manages whiteboard objects (notes and images)
 */

class ObjectManager {
    constructor(container, stateManager, callbacks) {
        this.container = container;
        this.stateManager = stateManager;
        this.callbacks = callbacks;
        this.elementPool = new Map();
        this.lastTapTime = 0;
        this.lastTapElement = null;
    }

    renderAll() {
        const wb = this.stateManager.getWhiteboard();
        this.container.innerHTML = '';
        this.elementPool.clear();
        wb.items.forEach(item => {
            const el = this.createItemElement(item);
            this.container.appendChild(el);
            this.elementPool.set(item.id, el);
        });
    }

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
        this.addResizeHandles(el);
        return el;
    }

    setupImageElement(el, item) {
        const img = document.createElement('img');
        img.src = item.content;
        img.draggable = false;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.pointerEvents = 'none';
        if (item.border) {
            img.style.border = `${item.border.width}px solid ${item.border.color}`;
            img.style.boxSizing = 'border-box';
        }
        el.appendChild(img);
    }

    setupNoteElement(el, item) {
        if (item.backgroundColor) {
            el.style.backgroundColor = item.backgroundColor;
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'wb-note-content';
        contentDiv.innerHTML = item.content || '';
        contentDiv.contentEditable = 'false';
        contentDiv.style.pointerEvents = 'none';

        contentDiv.oninput = () => {
            item.content = contentDiv.innerHTML;
            this.stateManager.scheduleSave();

            // Auto-resize: grow note height if content overflows
            this.autoResizeNote(el, item, contentDiv);
        };

        contentDiv.onblur = (e) => {
            // Prevent blur if clicking inside context menu
            if (e.relatedTarget && e.relatedTarget.closest('#wbContextMenu')) {
                return;
            }

            contentDiv.contentEditable = 'false';
            contentDiv.style.pointerEvents = 'none';
            el.draggable = false;
            el.classList.remove('editing');
            this.stateManager.scheduleSave();
        };

        // === CHECKLIST HANDLER ===
        contentDiv.addEventListener('mousedown', (e) => {
            if (contentDiv.contentEditable === 'true') {
                if (e.target.tagName === 'LI') {
                    const ul = e.target.parentElement;
                    if (ul && ul.classList.contains('wb-checklist')) {
                        // Check if click is in the "checkbox zone" (left 30px)
                        const rect = e.target.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        if (x < 30) {
                            e.preventDefault(); // Stop caret movement
                            e.stopPropagation();
                            e.target.classList.toggle('checked');
                            item.content = contentDiv.innerHTML;
                            this.stateManager.scheduleSave();
                        }
                    }
                }
            }
        });

        el.appendChild(contentDiv);

        el.ondblclick = (e) => this.enableNoteEditing(e, contentDiv, el);
        el.ontouchend = (e) => {
            const currentTime = Date.now();
            const tapLength = currentTime - this.lastTapTime;
            if (tapLength < 300 && tapLength > 0 && this.lastTapElement === el) {
                this.enableNoteEditing(e, contentDiv, el);
            }
            this.lastTapTime = currentTime;
            this.lastTapElement = el;
        };
    }

    enableNoteEditing(e, contentDiv, containerEl) {
        e.stopPropagation();

        containerEl.classList.add('editing');
        contentDiv.style.pointerEvents = 'auto';
        contentDiv.contentEditable = 'true';
        contentDiv.focus();

        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(contentDiv);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        if (this.callbacks.onNoteEditStart) {
            this.callbacks.onNoteEditStart(containerEl);
        }
    }

    autoResizeNote(el, item, contentDiv) {
        // Get the actual content height
        const contentHeight = contentDiv.scrollHeight;
        const padding = 24; // 12px top + 12px bottom padding
        const minHeight = 160;

        // If content is taller than the current note height, grow the note
        const requiredHeight = contentHeight + padding;

        if (requiredHeight > item.h) {
            item.h = Math.max(requiredHeight, minHeight);
            this.updateItemTransform(el, item);
            this.stateManager.scheduleSave();
        }
    }

    addResizeHandles(el) {
        const handles = [
            { pos: 'nw', cursor: 'nwse-resize' },
            { pos: 'n', cursor: 'ns-resize' },
            { pos: 'ne', cursor: 'nesw-resize' },
            { pos: 'e', cursor: 'ew-resize' },
            { pos: 'se', cursor: 'nwse-resize' },
            { pos: 's', cursor: 'ns-resize' },
            { pos: 'sw', cursor: 'nesw-resize' },
            { pos: 'w', cursor: 'ew-resize' }
        ];

        handles.forEach(hData => {
            const h = document.createElement('div');
            h.className = `wb-resize-handle handle-${hData.pos}`;
            h.style.cursor = hData.cursor;
            this.setHandleStyle(h, hData.pos);

            const startResize = (e) => {
                e.stopPropagation();
                if (e.type === 'mousedown') e.preventDefault();
                const itemId = el.dataset.id;
                const wb = this.stateManager.getWhiteboard();
                const item = wb.items.find(i => i.id === itemId);
                if (item) {
                    this.stateManager.recordHistory();
                    const resizeInfo = {
                        itemId: itemId,
                        startX: item.x, startY: item.y,
                        startW: item.w, startH: item.h,
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

    setHandleStyle(h, pos) {
        const size = '-12px';
        const css = { position: 'absolute', width: '20px', height: '20px' };
        if (pos.includes('n')) css.top = size;
        if (pos.includes('s')) css.bottom = size;
        if (pos.includes('w')) css.left = size;
        if (pos.includes('e')) css.right = size;
        if (pos === 'n' || pos === 's') { css.left = '50%'; css.marginLeft = '-10px'; }
        if (pos === 'e' || pos === 'w') { css.top = '50%'; css.marginTop = '-10px'; }
        Object.assign(h.style, css);
    }

    updateItemTransform(el, item) {
        if (!el) el = this.elementPool.get(item.id);
        if (!el) return;
        const wb = this.stateManager.getWhiteboard();

        el.style.transform = `translate(${Math.round(item.x)}px, ${Math.round(item.y)}px)`;
        el.style.width = `${Math.round(item.w)}px`;
        el.style.height = `${Math.round(item.h)}px`;

        const layerIndex = wb.layers.findIndex(l => l.id === item.layerId);
        const layer = wb.layers[layerIndex];
        if (layer && layer.visible) {
            el.style.display = 'block';
            el.style.zIndex = 10 + (layerIndex * 10);
        } else {
            el.style.display = 'none';
        }

        if (item.type === 'image') {
            const img = el.querySelector('img');
            if (img && item.border) {
                img.style.border = `${item.border.width}px solid ${item.border.color}`;
            } else if (img) {
                img.style.border = 'none';
            }
        } else if (item.type === 'note' && item.backgroundColor) {
            el.style.backgroundColor = item.backgroundColor;
        }
    }

    performResize(resizeInfo, dx, dy) {
        const wb = this.stateManager.getWhiteboard();
        const item = wb.items.find(i => i.id === resizeInfo.itemId);
        if (!item) return;

        let MIN_W = 100;
        let MIN_H = 60;

        // For notes, calculate minimum size based on text content
        if (item.type === 'note') {
            const el = this.elementPool.get(item.id);
            if (el) {
                const contentDiv = el.querySelector('.wb-note-content');
                if (contentDiv) {
                    // Temporarily set width to calculate minimum height
                    const testWidth = Math.max(resizeInfo.startW + (resizeInfo.pos.includes('e') ? dx : (resizeInfo.pos.includes('w') ? -dx : 0)), MIN_W);
                    const originalWidth = el.style.width;
                    el.style.width = `${testWidth}px`;
                    MIN_H = Math.max(contentDiv.scrollHeight + 24, 60); // 24px padding
                    el.style.width = originalWidth;
                }
            }
        }

        let newW = resizeInfo.startW;
        let newH = resizeInfo.startH;
        let newX = resizeInfo.startX;
        let newY = resizeInfo.startY;
        const pos = resizeInfo.pos;

        if (pos.includes('e')) newW += dx;
        if (pos.includes('w')) { newW -= dx; newX += dx; }
        if (pos.includes('s')) newH += dy;
        if (pos.includes('n')) { newH -= dy; newY += dy; }

        if (newW < MIN_W) {
            newW = MIN_W;
            if (pos.includes('w')) newX = resizeInfo.startX + (resizeInfo.startW - MIN_W);
        }
        if (newH < MIN_H) {
            newH = MIN_H;
            if (pos.includes('n')) newY = resizeInfo.startY + (resizeInfo.startH - MIN_H);
        }

        if (item.type === 'image' && pos.length === 2) {
            newH = newW / resizeInfo.ratio;
            if (pos.includes('n')) {
                newY = (resizeInfo.startY + resizeInfo.startH) - newH;
            }
        }

        item.w = newW;
        item.h = newH;
        item.x = newX;
        item.y = newY;

        resizeInfo.startW = newW;
        resizeInfo.startH = newH;
        resizeInfo.startX = newX;
        resizeInfo.startY = newY;

        this.updateItemTransform(null, item);
    }

    addItem(type, content = '', w = 200, h = 200) {
        const wb = this.stateManager.getWhiteboard();
        const centerX = -wb.view.x + (this.container.parentElement.clientWidth / 2);
        const centerY = -wb.view.y + (this.container.parentElement.clientHeight / 2);
        const worldX = centerX / wb.view.scale;
        const worldY = centerY / wb.view.scale;

        const item = {
            id: (type === 'note' ? 'N' : 'I') + Date.now(),
            type: type,
            layerId: this.callbacks.getActiveLayerId(),
            x: worldX - (w / 2),
            y: worldY - (h / 2),
            w: w, h: h,
            content: content
        };
        if (type === 'note') item.backgroundColor = '#fff740';
        this.stateManager.recordHistory();
        this.stateManager.addItem(item);
        const el = this.createItemElement(item);
        this.container.appendChild(el);
        this.elementPool.set(item.id, el);
    }

    deleteItem(itemId) {
        const el = this.elementPool.get(itemId);
        if (el) {
            el.remove();
            this.elementPool.delete(itemId);
        }
        this.stateManager.recordHistory();
        this.stateManager.deleteItem(itemId);
    }

    deselectAll() {
        this.container.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    }

    selectItem(itemEl) {
        this.deselectAll();
        itemEl.classList.add('selected');
    }

    dragItem(itemId, dx, dy) {
        const wb = this.stateManager.getWhiteboard();
        const item = wb.items.find(i => i.id === itemId);
        if (item) {
            item.x += dx;
            item.y += dy;
            this.updateItemTransform(null, item);
        }
    }

    destroy() {
        this.elementPool.clear();
    }
}

export default ObjectManager;