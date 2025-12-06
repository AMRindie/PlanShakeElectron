/**
 * Interaction Handler - Unified pointer event handling
 */

class InteractionHandler {
    constructor(container, stateManager, callbacks) {
        this.container = container;
        this.stateManager = stateManager;
        this.callbacks = callbacks;

        this.mode = 'cursor';
        this.isDrawing = false;
        this.isPanning = false;
        this.isDraggingItem = false;
        this.hasMovedItem = false; // New flag to track if we actually dragged
        this.isResizing = false;
        this.isSpacePressed = false;
        this.previousMode = null;

        this.lastPointer = { x: 0, y: 0 };
        this.dragItemInfo = null;
        this.resizeInfo = null;

        this.setupEvents();
    }

    setupEvents() {
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.container.addEventListener('mousedown', this.handlePointerDown.bind(this));
        window.addEventListener('mousemove', this.handlePointerMove.bind(this));
        window.addEventListener('mouseup', this.handlePointerUp.bind(this));

        this.container.addEventListener('touchstart', this.handlePointerDown.bind(this), { passive: false });
        window.addEventListener('touchmove', this.handlePointerMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.handlePointerUp.bind(this));

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleWheel(e) {
        e.preventDefault();
        const wb = this.stateManager.getWhiteboard();

        if (e.ctrlKey) {
            const zoomIntensity = 0.001;
            let deltaY = e.deltaY;
            if (e.deltaMode === 1) deltaY *= 40;
            if (e.deltaMode === 2) deltaY *= 800;

            const delta = -deltaY * zoomIntensity;
            const oldScale = wb.view.scale;
            const newScale = Math.max(0.1, Math.min(oldScale + delta, 5.0));

            const rect = this.container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const wx = (mx - wb.view.x) / oldScale;
            const wy = (my - wb.view.y) / oldScale;

            wb.view.x = mx - wx * newScale;
            wb.view.y = my - wy * newScale;
            wb.view.scale = newScale;
        } else {
            wb.view.x -= e.deltaX;
            wb.view.y -= e.deltaY;
        }
        this.callbacks.onViewChange();
        this.stateManager.scheduleSave();
    }

    handlePointerDown(e) {
        if (this.isUIElement(e.target)) return;
        if (e.type === 'touchstart') e.preventDefault();

        // Check if editing a note - if so, don't drag
        if (e.target.closest('.wb-note-content[contenteditable="true"]')) {
            return;
        }

        const { x, y } = this.getPointerPos(e);
        this.lastPointer = { x, y };

        if (e.button === 1 || this.mode === 'hand' || this.isSpacePressed) {
            this.startPan();
            return;
        }

        if (e.target.closest('.wb-resize-handle')) return;

        if (this.mode === 'cursor') {
            const itemEl = e.target.closest('.wb-item');
            if (itemEl) {
                this.callbacks.onItemClick(itemEl, x, y);
                return;
            } else {
                this.callbacks.onCanvasClick();
                this.startPan(); // Pan if clicking empty space
                return;
            }
        }

        if (this.mode === 'pen' || this.mode === 'eraser') {
            const point = this.screenToWorld(x, y);
            this.callbacks.onDrawStart(point, this.mode === 'eraser');
            this.isDrawing = true;
        }
    }

    handlePointerMove(e) {
        const { x, y } = this.getPointerPos(e);
        this.callbacks.onCursorMove(x, y);

        if (this.isDrawing || this.isPanning || this.isDraggingItem || this.isResizing) {
            if (e.cancelable) e.preventDefault();
        }

        const dx = x - this.lastPointer.x;
        const dy = y - this.lastPointer.y;
        this.lastPointer = { x, y };

        if (this.isPanning) {
            const wb = this.stateManager.getWhiteboard();
            wb.view.x += dx;
            wb.view.y += dy;
            this.callbacks.onViewChange();
            return;
        }

        if (this.isDraggingItem && this.dragItemInfo) {
            const wb = this.stateManager.getWhiteboard();
            const scaledDx = dx / wb.view.scale;
            const scaledDy = dy / wb.view.scale;

            // Only trigger drag if moved slightly to prevent jitter
            if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
                if (!this.hasMovedItem) {
                    this.hasMovedItem = true;
                    this.callbacks.onItemDragStart(this.dragItemInfo.itemId);
                }
                this.callbacks.onItemDrag(this.dragItemInfo.itemId, scaledDx, scaledDy);
            }
            return;
        }

        if (this.isResizing && this.resizeInfo) {
            const wb = this.stateManager.getWhiteboard();
            const scaledDx = dx / wb.view.scale;
            const scaledDy = dy / wb.view.scale;
            this.callbacks.onItemResize(this.resizeInfo, scaledDx, scaledDy);
            return;
        }

        if (this.isDrawing) {
            const point = this.screenToWorld(x, y);
            this.callbacks.onDrawMove(point);
        }
    }

    handlePointerUp(e) {
        if (this.isPanning || this.isDraggingItem || this.isResizing) {
            this.isPanning = false;
            this.isDraggingItem = false;
            this.isResizing = false;
            this.dragItemInfo = null;
            this.resizeInfo = null;
            this.hasMovedItem = false;
            this.stateManager.scheduleSave();
            this.callbacks.onCursorUpdate();
        }

        if (this.isDrawing) {
            this.isDrawing = false;
            this.callbacks.onDrawEnd();
        }
    }

    // ... (rest of helper methods like screenToWorld, setMode stay the same)

    screenToWorld(screenX, screenY) {
        const wb = this.stateManager.getWhiteboard();
        const rect = this.container.getBoundingClientRect();
        return {
            x: (screenX - rect.left - wb.view.x) / wb.view.scale,
            y: (screenY - rect.top - wb.view.y) / wb.view.scale
        };
    }

    getPointerPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    isUIElement(element) {
        return element.closest('button') ||
            element.closest('input') ||
            element.closest('.wb-toolbar') ||
            element.closest('.wb-context-menu') ||
            element.closest('.wb-resize-handle') ||
            element.classList.contains('wb-note-content');
    }

    // ... handleKeyDown/Up and setMode same as before ...
    handleKeyDown(e) {
        if (e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
        if (e.code === 'Space' && !this.isSpacePressed) {
            this.isSpacePressed = true;
            this.previousMode = this.mode;
            this.setMode('hand');
        }
        if (e.key.toLowerCase() === 'v') this.setMode('cursor');
        if (e.key.toLowerCase() === 'b') this.setMode('pen');
        if (e.key.toLowerCase() === 'e') this.setMode('eraser');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            e.shiftKey ? this.callbacks.onRedo() : this.callbacks.onUndo();
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            if (this.previousMode) this.setMode(this.previousMode);
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.callbacks.onModeChange(mode);
        this.callbacks.onCursorUpdate();
    }

    startPan() {
        this.isPanning = true;
        this.callbacks.onCursorUpdate();
    }

    startItemDrag(itemId) {
        this.isDraggingItem = true;
        this.hasMovedItem = false;
        this.dragItemInfo = { itemId };
    }

    startResize(resizeInfo) {
        this.isResizing = true;
        this.resizeInfo = resizeInfo;
    }

    getMode() { return this.mode; }

    destroy() {
        // cleanup listeners
    }
}

export default InteractionHandler;