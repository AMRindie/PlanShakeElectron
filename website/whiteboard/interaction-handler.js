/**
 * Interaction Handler - Unified pointer event handling
 * Handles mouse, touch, and pen input with gesture recognition
 */

class InteractionHandler {
    constructor(container, stateManager, callbacks) {
        this.container = container;
        this.stateManager = stateManager;
        this.callbacks = callbacks;

        // Current mode
        this.mode = 'cursor'; // cursor, hand, pen, eraser

        // Interaction state
        this.isDrawing = false;
        this.isPanning = false;
        this.isDraggingItem = false;
        this.isResizing = false;
        this.isSpacePressed = false;
        this.previousMode = null;

        // Last pointer position
        this.lastPointer = { x: 0, y: 0 };

        // Two-finger gesture state
        this.lastTouchDistance = null;
        this.lastTouchCenter = null;

        // Drag/resize info
        this.dragItemInfo = null;
        this.resizeInfo = null;

        this.setupEvents();
    }

    /**
     * Setup all event listeners
     */
    setupEvents() {
        // Mouse events
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.container.addEventListener('mousedown', this.handlePointerDown.bind(this));
        window.addEventListener('mousemove', this.handlePointerMove.bind(this));
        window.addEventListener('mouseup', this.handlePointerUp.bind(this));

        // Touch events
        this.container.addEventListener('touchstart', this.handlePointerDown.bind(this), { passive: false });
        window.addEventListener('touchmove', this.handlePointerMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.handlePointerUp.bind(this));

        // Keyboard events
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    /**
     * Handle wheel (zoom/pan)
     */
    handleWheel(e) {
        e.preventDefault();

        const wb = this.stateManager.getWhiteboard();

        if (e.ctrlKey) {
            // Zoom
            const zoomIntensity = 0.001;
            let deltaY = e.deltaY;

            // Normalize for different browsers
            if (e.deltaMode === 1) deltaY *= 40;
            if (e.deltaMode === 2) deltaY *= 800;

            const delta = -deltaY * zoomIntensity;
            const oldScale = wb.view.scale;
            const newScale = Math.max(0.1, Math.min(oldScale + delta, 5.0));

            // Zoom to cursor position
            const rect = this.container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const wx = (mx - wb.view.x) / oldScale;
            const wy = (my - wb.view.y) / oldScale;

            wb.view.x = mx - wx * newScale;
            wb.view.y = my - wy * newScale;
            wb.view.scale = newScale;
        } else {
            // Pan
            wb.view.x -= e.deltaX;
            wb.view.y -= e.deltaY;
        }

        this.callbacks.onViewChange();
        this.stateManager.scheduleSave();
    }

    /**
     * Handle pointer down
     */
    handlePointerDown(e) {
        // Skip if clicking on UI elements
        if (this.isUIElement(e.target)) return;

        // Prevent default for touch
        if (e.type === 'touchstart') e.preventDefault();

        // Handle two-finger gestures
        if (e.touches && e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.lastTouchDistance = this.getDistance(touch1, touch2);
            this.lastTouchCenter = this.getCenter(touch1, touch2);
            return;
        }

        const { x, y } = this.getPointerPos(e);
        this.lastPointer = { x, y };

        // Middle mouse button or hand tool = pan
        if (e.button === 1 || this.mode === 'hand') {
            this.startPan();
            return;
        }

        // Resize handle check
        if (e.target.closest('.wb-resize-handle')) {
            return; // Handled by object manager
        }

        // Cursor mode - check for item interaction
        if (this.mode === 'cursor') {
            const itemEl = e.target.closest('.wb-item');
            if (itemEl) {
                this.callbacks.onItemClick(itemEl, x, y);
                return;
            } else {
                this.callbacks.onCanvasClick();
                this.startPan();
                return;
            }
        }

        // Drawing modes (pen/eraser)
        if (this.mode === 'pen' || this.mode === 'eraser') {
            const point = this.screenToWorld(x, y);
            this.callbacks.onDrawStart(point, this.mode === 'eraser');
            this.isDrawing = true;
        }
    }

    /**
     * Handle pointer move
     */
    handlePointerMove(e) {
        const { x, y } = this.getPointerPos(e);

        // Update brush cursor
        this.callbacks.onCursorMove(x, y);

        // Two-finger gestures
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();
            this.handleTwoFingerGesture(e.touches[0], e.touches[1]);
            return;
        }

        // Reset two-finger state
        if (!e.touches || e.touches.length !== 2) {
            this.lastTouchDistance = null;
            this.lastTouchCenter = null;
        }

        // Prevent scrolling during interactions
        if (this.isDrawing || this.isPanning || this.isDraggingItem) {
            if (e.cancelable) e.preventDefault();
        }

        const dx = x - this.lastPointer.x;
        const dy = y - this.lastPointer.y;
        this.lastPointer = { x, y };

        // Panning
        if (this.isPanning) {
            const wb = this.stateManager.getWhiteboard();
            wb.view.x += dx;
            wb.view.y += dy;
            this.callbacks.onViewChange();
            return;
        }

        // Item dragging
        if (this.isDraggingItem && this.dragItemInfo) {
            const wb = this.stateManager.getWhiteboard();
            const scaledDx = dx / wb.view.scale;
            const scaledDy = dy / wb.view.scale;
            this.callbacks.onItemDrag(this.dragItemInfo.itemId, scaledDx, scaledDy);
            return;
        }

        // Resizing
        if (this.isResizing && this.resizeInfo) {
            const wb = this.stateManager.getWhiteboard();
            const scaledDx = dx / wb.view.scale;
            const scaledDy = dy / wb.view.scale;
            this.callbacks.onItemResize(this.resizeInfo, scaledDx, scaledDy);
            return;
        }

        // Drawing
        if (this.isDrawing) {
            const point = this.screenToWorld(x, y);
            this.callbacks.onDrawMove(point);
        }
    }

    /**
     * Handle pointer up
     */
    handlePointerUp(e) {
        // Reset touch state
        this.lastTouchDistance = null;
        this.lastTouchCenter = null;

        if (this.isPanning || this.isDraggingItem || this.isResizing) {
            this.isPanning = false;
            this.isDraggingItem = false;
            this.isResizing = false;
            this.dragItemInfo = null;
            this.resizeInfo = null;
            this.stateManager.scheduleSave();
            this.callbacks.onCursorUpdate();
        }

        if (this.isDrawing) {
            this.isDrawing = false;
            this.callbacks.onDrawEnd();
        }
    }

    /**
     * Handle two-finger gestures (pinch/pan)
     */
    handleTwoFingerGesture(touch1, touch2) {
        const currentDistance = this.getDistance(touch1, touch2);
        const currentCenter = this.getCenter(touch1, touch2);

        if (this.lastTouchDistance && this.lastTouchCenter) {
            const wb = this.stateManager.getWhiteboard();
            const distanceChange = Math.abs(currentDistance - this.lastTouchDistance);
            const ZOOM_THRESHOLD = 5;

            if (distanceChange > ZOOM_THRESHOLD) {
                // Zoom
                const scale = currentDistance / this.lastTouchDistance;
                const oldScale = wb.view.scale;
                const newScale = Math.max(0.1, Math.min(oldScale * scale, 5.0));

                const rect = this.container.getBoundingClientRect();
                const mx = currentCenter.x - rect.left;
                const my = currentCenter.y - rect.top;
                const wx = (mx - wb.view.x) / oldScale;
                const wy = (my - wb.view.y) / oldScale;

                wb.view.x = mx - wx * newScale;
                wb.view.y = my - wy * newScale;
                wb.view.scale = newScale;
            } else {
                // Pan
                const dx = currentCenter.x - this.lastTouchCenter.x;
                const dy = currentCenter.y - this.lastTouchCenter.y;
                wb.view.x += dx;
                wb.view.y += dy;
            }

            this.callbacks.onViewChange();
        }

        this.lastTouchDistance = currentDistance;
        this.lastTouchCenter = currentCenter;
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyDown(e) {
        // Ignore if typing in textarea
        if (document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.contentEditable === 'true') {
            return;
        }

        // Space = temporary hand tool
        if (e.code === 'Space' && !this.isSpacePressed) {
            this.isSpacePressed = true;
            this.previousMode = this.mode;
            this.setMode('hand');
        }

        // Tool shortcuts
        if (e.key === 'v' || e.key === 'V') this.setMode('cursor');
        if (e.key === 'b' || e.key === 'B') this.setMode('pen');
        if (e.key === 'e' || e.key === 'E') this.setMode('eraser');

        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (e.shiftKey) {
                this.callbacks.onRedo();
            } else {
                this.callbacks.onUndo();
            }
        }
    }

    /**
     * Handle key up
     */
    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            if (this.previousMode) {
                this.setMode(this.previousMode);
                this.previousMode = null;
            }
        }
    }

    /**
     * Set interaction mode
     */
    setMode(mode) {
        this.mode = mode;
        this.callbacks.onModeChange(mode);
        this.callbacks.onCursorUpdate();
    }

    /**
     * Start panning
     */
    startPan() {
        this.isPanning = true;
        this.callbacks.onCursorUpdate();
    }

    /**
     * Start item drag
     */
    startItemDrag(itemId) {
        this.isDraggingItem = true;
        this.dragItemInfo = { itemId };
    }

    /**
     * Start resize
     */
    startResize(resizeInfo) {
        this.isResizing = true;
        this.resizeInfo = resizeInfo;
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        const wb = this.stateManager.getWhiteboard();
        const rect = this.container.getBoundingClientRect();
        return {
            x: (screenX - rect.left - wb.view.x) / wb.view.scale,
            y: (screenY - rect.top - wb.view.y) / wb.view.scale
        };
    }

    /**
     * Get pointer position from event
     */
    getPointerPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    /**
     * Get distance between two touches
     */
    getDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get center point between two touches
     */
    getCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }

    /**
     * Check if element is a UI element
     */
    isUIElement(element) {
        return element.closest('button') ||
            element.closest('input') ||
            element.closest('textarea') ||
            element.closest('.wb-toolbar') ||
            element.closest('.wb-context-menu') ||
            element.contentEditable === 'true' ||
            element.closest('[contenteditable="true"]');
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        // Note: other listeners are removed when container is destroyed
    }
}

export default InteractionHandler;
