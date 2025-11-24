(function () {
    // === STATE ===
    let state = {
        mode: "cursor",
        isDrawing: false,
        isPanning: false,
        isDraggingItem: false,
        isResizing: false,
        isSpacePressed: false,
        activeLayerId: null,
        // History for Undo/Redo
        history: [],
        historyStep: -1
    };

    // DOM Cache
    let els = {};
    let lastMouse = { x: 0, y: 0 };
    let strokeBuffer = null;
    let resizeInfo = null;
    let dragItemInfo = null;

    // Offscreen buffer for layer composition
    let layerBufferCanvas = null;
    let layerBufferCtx = null;

    // === INITIALIZATION ===
    function init() {
        const ids = [
            "whiteboardView", "wbContainer", "wbGridLayer", "wbDrawingCanvas", "wbObjectLayer",
            "wbToolCursor", "wbToolHand", "wbToolPen", "wbToolEraser",
            "wbPenColor", "wbPenSize", "wbPenOpacity",
            "wbAddNoteBtn", "wbAddImageInput", "wbLayerBtn", "wbAddLayerBtn",
            "wbLayerPanel", "wbLayerList", "wbResetViewBtn", "wbZoomLevel", "wbClearBtn",
            "wbCursor" // Custom cursor
        ];
        ids.forEach(id => els[id] = document.getElementById(id));

        if (!els.whiteboardView || !els.wbDrawingCanvas || !window.currentProject) return;

        els.ctx = els.wbDrawingCanvas.getContext("2d");

        // Initialize Layer Buffer
        layerBufferCanvas = document.createElement('canvas');
        layerBufferCtx = layerBufferCanvas.getContext('2d');

        // Ensure Data Structure
        const proj = window.currentProject;
        if (!proj.whiteboard) proj.whiteboard = { items: [], strokes: [], layers: [], pen: {}, view: {} };
        if (!proj.whiteboard.layers || proj.whiteboard.layers.length === 0) {
            const id = "L" + Date.now();
            proj.whiteboard.layers = [{ id, name: "Layer 1", visible: true }];
            state.activeLayerId = id;
        } else {
            state.activeLayerId = proj.whiteboard.layers[0].id;
        }

        // Safe defaults
        const wb = proj.whiteboard;
        if (!wb.pen) wb.pen = { color: "#000000", size: 5, opacity: 1.0 };
        if (!wb.view) wb.view = { x: 0, y: 0, scale: 1.0 };

        setupInputs();
        setupEngine();

        new ResizeObserver(() => resizeCanvas()).observe(els.wbContainer);

        syncUI();
        renderDOM();
        redraw();
        renderLayersUI();
        updateView();
    }

    function syncUI() {
        const wb = window.currentProject.whiteboard;
        if (els.wbPenColor) els.wbPenColor.value = wb.pen.color || "#000000";
        if (els.wbPenSize) els.wbPenSize.value = wb.pen.size || 5;
        if (els.wbPenOpacity) els.wbPenOpacity.value = Math.floor((wb.pen.opacity || 1) * 100);
        updateCursor();
    }

    function save() {
        if (window.saveData && window.currentData) {
            window.saveData(window.currentData);
        }
    }

    function resizeCanvas() {
        if (!els.wbContainer) return;
        const rect = els.wbContainer.getBoundingClientRect();
        if (rect.width > 0) {
            els.wbDrawingCanvas.width = rect.width;
            els.wbDrawingCanvas.height = rect.height;

            // Resize buffer as well
            layerBufferCanvas.width = rect.width;
            layerBufferCanvas.height = rect.height;

            redraw();
        }
    }

    // === HISTORY SYSTEM (UNDO/REDO) ===

    function recordHistory() {
        const wb = window.currentProject.whiteboard;

        // Remove any "future" history if we are in the middle of the stack
        if (state.historyStep < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyStep + 1);
        }

        // Deep clone the relevant data (Items and Strokes)
        const snapshot = JSON.stringify({
            items: wb.items,
            strokes: wb.strokes
        });

        state.history.push(snapshot);
        state.historyStep++;

        // Limit history size to prevent memory bloat (e.g. 50 steps)
        if (state.history.length > 50) {
            state.history.shift();
            state.historyStep--;
        }
    }

    function undo() {
        if (state.historyStep > 0) {
            state.historyStep--;
            restoreHistory(state.history[state.historyStep]);
        }
    }

    function redo() {
        if (state.historyStep < state.history.length - 1) {
            state.historyStep++;
            restoreHistory(state.history[state.historyStep]);
        }
    }

    function restoreHistory(snapshotJson) {
        if (!snapshotJson) return;
        const data = JSON.parse(snapshotJson);
        const wb = window.currentProject.whiteboard;

        wb.items = data.items;
        wb.strokes = data.strokes;

        redraw();
        renderDOM();
        save();
    }

    // === ENGINE ===

    function setupEngine() {
        const c = els.wbContainer;

        // Mouse Events
        c.addEventListener("wheel", handleWheel, { passive: false });
        c.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", handlePointerUp);

        // Touch Events (Passive: false is required to prevent scrolling)
        c.addEventListener("touchstart", handlePointerDown, { passive: false });
        window.addEventListener("touchmove", handlePointerMove, { passive: false });
        window.addEventListener("touchend", handlePointerUp);

        // Keyboard Shortcuts
        window.addEventListener("keydown", (e) => {
            if (e.code === "Space" && !state.isSpacePressed && document.activeElement.tagName !== 'TEXTAREA') {
                state.isSpacePressed = true;
                state.prevMode = state.mode;
                setMode("hand");
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                e.shiftKey ? redo() : undo();
            }
        });

        window.addEventListener("keyup", (e) => {
            if (e.code === "Space") {
                state.isSpacePressed = false;
                setMode(state.prevMode);
            }
        });
    }

    function handleWheel(e) {
        e.preventDefault();
        const wb = window.currentProject.whiteboard;
        if (e.ctrlKey) {
            const zoomIntensity = 0.001;

            // Normalize deltaY for Firefox (lines) vs Chrome (pixels)
            let deltaY = e.deltaY;
            if (e.deltaMode === 1) deltaY *= 40; // Lines to pixels
            if (e.deltaMode === 2) deltaY *= 800; // Pages to pixels

            const delta = -deltaY * zoomIntensity;
            const oldScale = wb.view.scale;
            let newScale = Math.max(0.1, Math.min(oldScale + delta, 5.0));

            const rect = els.wbContainer.getBoundingClientRect();
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
        updateView();
        save();
    }

    // Helper to get X/Y from either Mouse or Touch
    function getPointerPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    // Two-finger gesture state
    let lastTouchDistance = null;
    let lastTouchCenter = null;

    function handlePointerDown(e) {
        // If touching a UI element (buttons, inputs), let it pass
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea") || e.target.closest(".wb-toolbar")) return;

        // Prevent scrolling on touch
        if (e.type === 'touchstart') e.preventDefault();

        // NEW: Handle two-finger pinch zoom
        if (e.touches && e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = getDistance(touch1, touch2);
            lastTouchCenter = getCenter(touch1, touch2);
            return;
        }

        const { x, y } = getPointerPos(e);

        // 1. Handle Pan
        if ((e.button === 1) || state.mode === "hand") { // Middle click or Hand
            startPan(x, y);
            return;
        }

        // 2. Handle Resize
        if (e.target.closest(".wb-resize-handle")) {
            return; // Handled in createDOMItem
        }

        // 3. Cursor Mode
        if (state.mode === "cursor") {
            const itemEl = e.target.closest(".wb-item");
            if (itemEl) {
                const id = itemEl.dataset.id;
                const wb = window.currentProject.whiteboard;
                const item = wb.items.find(i => i.id === id);
                const layer = wb.layers.find(l => l.id === item.layerId);
                if (layer && layer.visible) {
                    startItemDrag(x, y, itemEl);
                }
            } else {
                deselectAll();
                startPan(x, y);
            }
            return;
        }

        // 4. Pen/Eraser
        const wb = window.currentProject.whiteboard;
        const layer = wb.layers.find(l => l.id === state.activeLayerId);
        if (!layer || !layer.visible) { alert("Active layer is hidden"); return; }

        const pt = screenToWorld(x, y);

        if (state.mode === "pen") {
            recordHistory();
            state.isDrawing = true;
            strokeBuffer = {
                points: [{ x: pt.x, y: pt.y }],
                color: wb.pen.color,
                size: wb.pen.size,
                opacity: wb.pen.opacity,
                layerId: state.activeLayerId,
                isEraser: false
            };
            redraw();
        } else if (state.mode === "eraser") {
            recordHistory();
            state.isDrawing = true;
            console.log("Eraser Start");
            // Erasing still uses a stroke to define the area, but the color is irrelevant.
            strokeBuffer = {
                points: [{ x: pt.x, y: pt.y }],
                // Ensure no conflicting color is set, although destination-out should override.
                color: "#000000",
                size: wb.pen.size,
                opacity: 1.0,
                layerId: state.activeLayerId,
                isEraser: true
            };
            redraw();
        }
    }

    function handlePointerMove(e) {
        // Update Custom Cursor Position
        const { x: clientX, y: clientY } = getPointerPos(e);
        updateBrushCursor(clientX, clientY);

        // NEW: Handle two-finger gestures (pan + zoom)
        if (e.touches && e.touches.length === 2) {
            e.preventDefault();

            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = getDistance(touch1, touch2);
            const currentCenter = getCenter(touch1, touch2);

            if (lastTouchDistance && lastTouchCenter) {
                const wb = window.currentProject.whiteboard;

                // Calculate distance change for zoom detection
                const distanceChange = Math.abs(currentDistance - lastTouchDistance);
                const ZOOM_THRESHOLD = 5; // pixels

                // If distance is changing significantly = ZOOM
                if (distanceChange > ZOOM_THRESHOLD) {
                    const scale = currentDistance / lastTouchDistance;
                    const oldScale = wb.view.scale;
                    const newScale = Math.max(0.1, Math.min(oldScale * scale, 5.0));

                    // Zoom centered between fingers
                    const rect = els.wbContainer.getBoundingClientRect();
                    const mx = currentCenter.x - rect.left;
                    const my = currentCenter.y - rect.top;
                    const wx = (mx - wb.view.x) / oldScale;
                    const wy = (my - wb.view.y) / oldScale;

                    wb.view.x = mx - wx * newScale;
                    wb.view.y = my - wy * newScale;
                    wb.view.scale = newScale;
                }
                // If distance is stable but fingers moving = PAN
                else {
                    const dx = currentCenter.x - lastTouchCenter.x;
                    const dy = currentCenter.y - lastTouchCenter.y;
                    wb.view.x += dx;
                    wb.view.y += dy;
                }

                updateView();
            }

            lastTouchDistance = currentDistance;
            lastTouchCenter = currentCenter;
            return;
        }

        // Reset two-finger tracking when not using two fingers
        if (!e.touches || e.touches.length !== 2) {
            lastTouchDistance = null;
            lastTouchCenter = null;
        }

        const { x, y } = getPointerPos(e);

        // Prevent pull-to-refresh on mobile
        if (state.isDrawing || state.isPanning || state.isDraggingItem) {
            if (e.cancelable) e.preventDefault();
        }

        const wb = window.currentProject.whiteboard;
        const dx = x - lastMouse.x;
        const dy = y - lastMouse.y;
        lastMouse = { x, y };

        if (state.isPanning) {
            wb.view.x += dx;
            wb.view.y += dy;
            updateView();
            return;
        }

        if (state.isDraggingItem && dragItemInfo) {
            dragItemInfo.item.x += dx / wb.view.scale;
            dragItemInfo.item.y += dy / wb.view.scale;
            updateItemDOM(dragItemInfo.el, dragItemInfo.item);
            return;
        }

        if (state.isResizing && resizeInfo) {
            const dScaled = { dx: dx / wb.view.scale, dy: dy / wb.view.scale };
            performResize(dScaled);
            return;
        }

        if (state.isDrawing) {
            const pt = screenToWorld(x, y);
            if (strokeBuffer) {
                strokeBuffer.points.push({ x: pt.x, y: pt.y });
                redraw();
            }
        }
    }

    function handlePointerUp(e) {
        // Reset pinch zoom tracking
        lastTouchDistance = null;
        lastTouchCenter = null;

        const wb = window.currentProject.whiteboard;

        if (state.isPanning || state.isDraggingItem || state.isResizing) {
            state.isPanning = false;
            state.isDraggingItem = false;
            state.isResizing = false;
            save();
        }

        dragItemInfo = null;
        resizeInfo = null;
        if (els.wbContainer) updateCursor();

        if (state.isDrawing) {
            state.isDrawing = false;
            if (strokeBuffer) {
                wb.strokes.push(strokeBuffer);
                strokeBuffer = null;
                save();
            }
            redraw();
        }
    }

    function getDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }


    // === RENDERING ===

    function redraw() {
        const ctx = els.ctx;
        const wb = window.currentProject.whiteboard;
        if (!ctx || !wb) return;

        const { width, height } = els.wbDrawingCanvas;

        // 1. Clear Main Canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);

        // 2. Setup Transform
        const transform = {
            scale: wb.view.scale,
            x: wb.view.x,
            y: wb.view.y
        };

        // 3. Render Layers
        wb.layers.forEach(layer => {
            if (!layer.visible) return;

            // Filter strokes for this layer
            const layerStrokes = wb.strokes.filter(s => s.layerId === layer.id);
            const activeStroke = (strokeBuffer && strokeBuffer.layerId === layer.id) ? strokeBuffer : null;

            if (layerStrokes.length === 0 && !activeStroke) return;

            // Use Buffer for Layer Composition
            // Clear buffer
            layerBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
            layerBufferCtx.clearRect(0, 0, width, height);

            // Apply View Transform to Buffer
            layerBufferCtx.setTransform(transform.scale, 0, 0, transform.scale, transform.x, transform.y);

            // FIX: Combine all strokes into one chronological list
            const strokesToRender = [...layerStrokes];
            if (activeStroke) strokesToRender.push(activeStroke);

            // FIX: Render strokes strictly in order.
            // This ensures new ink draws ON TOP of old eraser marks.
            strokesToRender.forEach(s => {
                // Switch mode dynamically per stroke
                layerBufferCtx.globalCompositeOperation = s.isEraser ? 'destination-out' : 'source-over';
                drawStroke(layerBufferCtx, s);
            });

            // Draw Buffer to Main Canvas
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw full buffer
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(layerBufferCanvas, 0, 0);
        });
    }

    function drawStroke(ctx, s) {
        if (s.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.globalAlpha = s.opacity || 1.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
    }

    function renderDOM() {
        const wb = window.currentProject.whiteboard;
        els.wbObjectLayer.innerHTML = "";
        wb.items.forEach(item => {
            const el = createDOMItem(item);
            els.wbObjectLayer.appendChild(el);
        });
    }

    function createDOMItem(item) {
        const el = document.createElement("div");
        el.className = `wb-item wb-${item.type}`;
        el.dataset.id = item.id;
        updateItemDOM(el, item);

        if (item.type === "note") {
            const t = document.createElement("textarea");
            t.value = item.content;

            // Default: pointer-events none so clicks pass through to container (for dragging)
            t.style.pointerEvents = "none";

            t.oninput = () => { item.content = t.value; save(); };
            t.onblur = () => {
                t.style.pointerEvents = "none"; // Lock again on blur
                save();
            };

            el.appendChild(t);

            // Double click to edit (Desktop)
            el.ondblclick = (e) => {
                e.stopPropagation();
                t.style.pointerEvents = "auto";
                t.focus();
            };

            // Double tap to edit (Touch)
            let lastTap = 0;
            el.ontouchend = (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    e.stopPropagation();
                    e.preventDefault();
                    t.style.pointerEvents = "auto";
                    t.focus();
                }
                lastTap = currentTime;
            };
        } else {
            const img = document.createElement("img");
            img.src = item.content;
            img.draggable = false;
            el.appendChild(img);
        }

        // === POSITIONED HANDLES ===
        const handles = [
            { pos: "nw", style: "top:-6px; left:-6px; cursor:nwse-resize" },
            { pos: "n", style: "top:-6px; left:50%; margin-left:-6px; cursor:ns-resize" },
            { pos: "ne", style: "top:-6px; right:-6px; cursor:nesw-resize" },
            { pos: "e", style: "top:50%; right:-6px; margin-top:-6px; cursor:ew-resize" },
            { pos: "se", style: "bottom:-6px; right:-6px; cursor:nwse-resize" },
            { pos: "s", style: "bottom:-6px; left:50%; margin-left:-6px; cursor:ns-resize" },
            { pos: "sw", style: "bottom:-6px; left:-6px; cursor:nesw-resize" },
            { pos: "w", style: "top:50%; left:-6px; margin-top:-6px; cursor:ew-resize" }
        ];

        handles.forEach(hData => {
            const h = document.createElement("div");
            h.className = `wb-resize-handle handle-${hData.pos}`;
            h.style.cssText = hData.style;

            // NEW: Unified handler for both mouse and touch
            const startResize = (e) => {
                e.stopPropagation();
                e.preventDefault();

                recordHistory(); // Record before resize starts

                state.isResizing = true;

                // Extract coordinates from mouse or touch
                const { x, y } = getPointerPos(e);
                lastMouse = { x, y };

                resizeInfo = {
                    item,
                    startX: item.x, startY: item.y,
                    startW: item.w, startH: item.h,
                    pos: hData.pos,
                    ratio: item.w / item.h
                };
            };

            h.onmousedown = startResize;
            h.ontouchstart = startResize; // NEW: Add touch support

            el.appendChild(h);
        });

        return el;
    }

    function updateItemDOM(el, item) {
        const wb = window.currentProject.whiteboard;
        el.style.transform = `translate(${item.x}px, ${item.y}px)`;
        el.style.width = item.w + "px";
        el.style.height = item.h + "px";

        const index = wb.layers.findIndex(l => l.id === item.layerId);
        const layer = wb.layers[index];
        if (layer && layer.visible) {
            el.style.display = "block";
            el.style.zIndex = 10 + (index * 10);
        } else {
            el.style.display = "none";
        }
    }

    // === UI HELPERS ===

    function renderLayersUI() {
        if (!els.wbLayerList) return;
        const wb = window.currentProject.whiteboard;
        els.wbLayerList.innerHTML = "";
        [...wb.layers].reverse().forEach((l, reversedIdx) => {
            // Calculate actual index in the layers array
            const actualIndex = wb.layers.length - 1 - reversedIdx;

            const div = document.createElement("div");
            div.className = `layer-item ${l.id === state.activeLayerId ? 'active' : ''}`;
            div.onclick = () => { state.activeLayerId = l.id; renderLayersUI(); };

            // Visibility toggle button
            const vis = document.createElement("button");
            vis.className = "icon-btn small";
            vis.textContent = l.visible ? "👁️" : "○";
            vis.onclick = (e) => {
                e.stopPropagation(); l.visible = !l.visible;
                redraw();
                wb.items.forEach(i => {
                    const el = els.wbObjectLayer.querySelector(`[data-id="${i.id}"]`);
                    if (el) updateItemDOM(el, i);
                });
                renderLayersUI(); save();
            };

            // Layer name text
            const nameSpan = document.createTextNode(l.name);

            // Button container for layer actions
            const btnContainer = document.createElement("div");
            btnContainer.style.cssText = "display: flex; gap: 4px; margin-left: auto;";

            // Move Up button (only if not at top)
            if (actualIndex < wb.layers.length - 1) {
                const moveUpBtn = document.createElement("button");
                moveUpBtn.className = "icon-btn small";
                moveUpBtn.textContent = "▲";
                moveUpBtn.title = "Move Layer Up";
                moveUpBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Swap with layer above
                    [wb.layers[actualIndex], wb.layers[actualIndex + 1]] = [wb.layers[actualIndex + 1], wb.layers[actualIndex]];
                    renderLayersUI();
                    redraw();
                    renderDOM();
                    save();
                };
                btnContainer.appendChild(moveUpBtn);
            }

            // Move Down button (only if not at bottom)
            if (actualIndex > 0) {
                const moveDownBtn = document.createElement("button");
                moveDownBtn.className = "icon-btn small";
                moveDownBtn.textContent = "▼";
                moveDownBtn.title = "Move Layer Down";
                moveDownBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Swap with layer below
                    [wb.layers[actualIndex], wb.layers[actualIndex - 1]] = [wb.layers[actualIndex - 1], wb.layers[actualIndex]];
                    renderLayersUI();
                    redraw();
                    renderDOM();
                    save();
                };
                btnContainer.appendChild(moveDownBtn);
            }

            // Delete button (only if more than one layer)
            if (wb.layers.length > 1) {
                const deleteBtn = document.createElement("button");
                deleteBtn.className = "icon-btn small";
                deleteBtn.textContent = "🗑️";
                deleteBtn.title = "Delete Layer";
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete layer "${l.name}"?\n\nAll items and strokes on this layer will be permanently removed.`)) {
                        // Remove all items and strokes from this layer
                        wb.items = wb.items.filter(i => i.layerId !== l.id);
                        wb.strokes = wb.strokes.filter(s => s.layerId !== l.id);

                        // Remove the layer
                        wb.layers.splice(actualIndex, 1);

                        // If we deleted the active layer, switch to first layer
                        if (state.activeLayerId === l.id) {
                            state.activeLayerId = wb.layers[0].id;
                        }

                        renderLayersUI();
                        redraw();
                        renderDOM();
                        save();
                    }
                };
                btnContainer.appendChild(deleteBtn);
            }

            div.append(vis, nameSpan, btnContainer);
            els.wbLayerList.appendChild(div);
        });
    }

    function setupInputs() {
        const wb = window.currentProject.whiteboard;
        const tools = { cursor: els.wbToolCursor, hand: els.wbToolHand, pen: els.wbToolPen, eraser: els.wbToolEraser };
        Object.entries(tools).forEach(([m, btn]) => { if (btn) btn.onclick = () => setMode(m); });

        els.wbResetViewBtn.onclick = () => { wb.view = { x: 0, y: 0, scale: 1.0 }; updateView(); save(); };
        els.wbPenColor.oninput = (e) => { wb.pen.color = e.target.value; save(); };
        els.wbPenSize.oninput = (e) => {
            wb.pen.size = parseInt(e.target.value);
            save();
            // Update cursor size immediately
            if (state.mode === 'pen' || state.mode === 'eraser') {
                updateBrushCursor(lastMouse.x, lastMouse.y); // Might be slightly off if mouse hasn't moved, but ok
            }
        };
        els.wbPenOpacity.oninput = (e) => { wb.pen.opacity = parseInt(e.target.value) / 100; save(); };

        els.wbLayerBtn.onclick = () => els.wbLayerPanel.classList.toggle("hidden");
        els.wbAddLayerBtn.onclick = () => {
            const id = "L" + Date.now();
            wb.layers.push({ id, name: "Layer " + (wb.layers.length + 1), visible: true });
            state.activeLayerId = id; renderLayersUI(); save();
        };

        els.wbAddNoteBtn.onclick = () => addObj('note');
        els.wbAddImageInput.onchange = (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                const r = new FileReader();
                r.onload = (evt) => {
                    const img = new Image();
                    img.onload = () => {
                        let w = img.width;
                        let h = img.height;
                        const MAX = 400;
                        if (w > MAX || h > MAX) {
                            const ratio = w / h;
                            if (w > h) { w = MAX; h = MAX / ratio; }
                            else { h = MAX; w = MAX * ratio; }
                        }
                        addObj('image', evt.target.result, w, h);
                    };
                    img.src = evt.target.result;
                };
                r.readAsDataURL(file);
                e.target.value = "";
            }
        };

        if (els.wbClearBtn) {
            els.wbClearBtn.onclick = () => {
                if (confirm("Clear active layer?")) {
                    recordHistory();
                    wb.strokes = wb.strokes.filter(s => s.layerId !== state.activeLayerId);
                    wb.items = wb.items.filter(i => i.layerId !== state.activeLayerId);
                    redraw(); renderDOM(); save();
                }
            }
        }
    }

    function startPan(x, y) {
        state.isPanning = true;
        lastMouse = { x, y };
        els.wbContainer.dataset.cursor = "grabbing";
    }

    function startItemDrag(x, y, el) {
        if (el.tagName === 'TEXTAREA') return; // Don't drag if editing text
        deselectAll();
        el.classList.add("selected");
        recordHistory();
        state.isDraggingItem = true;
        const wb = window.currentProject.whiteboard;
        dragItemInfo = { el, item: wb.items.find(i => i.id === el.dataset.id) };
        lastMouse = { x, y };
    }

    function performResize(d) {
        const { item, pos, ratio } = resizeInfo;
        const MIN = 20;

        let newW = item.w;
        let newH = item.h;
        let newX = item.x;
        let newY = item.y;

        if (pos.includes('e')) newW += d.dx;
        if (pos.includes('w')) { newW -= d.dx; newX += d.dx; }
        if (pos.includes('s')) newH += d.dy;
        if (pos.includes('n')) { newH -= d.dy; newY += d.dy; }

        if (newW < MIN) {
            if (pos.includes('w')) newX = item.x + (item.w - MIN);
            newW = MIN;
        }
        if (newH < MIN) {
            if (pos.includes('n')) newY = item.y + (item.h - MIN);
            newH = MIN;
        }

        const isCorner = pos.length === 2;
        if (item.type === 'image' && isCorner) {
            newH = newW / ratio;
            if (pos.includes('n')) {
                const bottomY = item.y + item.h;
                newY = bottomY - newH;
            }
        }

        item.w = newW;
        item.h = newH;
        item.x = newX;
        item.y = newY;

        const el = els.wbObjectLayer.querySelector(`[data-id="${item.id}"]`);
        if (el) updateItemDOM(el, item);
    }

    function addObj(type, content = "", w = 200, h = 200) {
        recordHistory(); // Record before adding

        const wb = window.currentProject.whiteboard;
        const layer = wb.layers.find(l => l.id === state.activeLayerId);
        if (!layer || !layer.visible) { alert("Layer hidden"); return; }

        const rect = els.wbContainer.getBoundingClientRect();
        const pt = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);

        const item = {
            id: (type === "note" ? "N" : "I") + Date.now(),
            type,
            layerId: state.activeLayerId,
            x: pt.x - w / 2,
            y: pt.y - h / 2,
            w: w,
            h: h,
            content
        };
        wb.items.push(item);
        const el = createDOMItem(item);
        els.wbObjectLayer.appendChild(el);
        save();
    }

    function screenToWorld(sx, sy) {
        const wb = window.currentProject.whiteboard;
        const rect = els.wbContainer.getBoundingClientRect();
        return {
            x: (sx - rect.left - wb.view.x) / wb.view.scale,
            y: (sy - rect.top - wb.view.y) / wb.view.scale
        };
    }

    function updateView() {
        const wb = window.currentProject.whiteboard;
        const transform = `translate(${wb.view.x}px, ${wb.view.y}px) scale(${wb.view.scale})`;
        if (els.wbGridLayer) els.wbGridLayer.style.transform = transform;
        if (els.wbObjectLayer) els.wbObjectLayer.style.transform = transform;
        if (els.wbZoomLevel) els.wbZoomLevel.textContent = Math.round(wb.view.scale * 100) + "%";
        redraw();
    }

    function setMode(m) {
        state.mode = m;
        els.wbToolCursor.classList.toggle("active", m === "cursor");
        if (els.wbToolHand) els.wbToolHand.classList.toggle("active", m === "hand");
        els.wbToolPen.classList.toggle("active", m === "pen");
        els.wbToolEraser.classList.toggle("active", m === "eraser");
        updateCursor();
    }

    function updateCursor() {
        const isBrush = state.mode === 'pen' || state.mode === 'eraser';

        // Toggle CSS cursor
        if (isBrush) {
            els.wbContainer.dataset.cursor = "none";
            if (els.wbCursor) els.wbCursor.classList.add("active");
        } else {
            els.wbContainer.dataset.cursor = state.mode === 'hand' ? (state.isPanning ? 'grabbing' : 'grab') : 'default';
            if (els.wbCursor) els.wbCursor.classList.remove("active");
        }
    }

    function updateBrushCursor(x, y) {
        if (!els.wbCursor || !els.wbCursor.classList.contains("active")) return;

        const wb = window.currentProject.whiteboard;
        const size = wb.pen.size * wb.view.scale; // Scale cursor with view

        els.wbCursor.style.width = size + "px";
        els.wbCursor.style.height = size + "px";
        els.wbCursor.style.left = x + "px";
        els.wbCursor.style.top = y + "px";
    }

    function deselectAll() { els.wbObjectLayer.querySelectorAll(".selected").forEach(e => e.classList.remove("selected")); }

    window.initWhiteboard = init;

})();
