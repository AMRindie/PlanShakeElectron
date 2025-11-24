/**
 * Render Engine - Optimized canvas rendering with RAF and dirty rectangles
 * Handles smooth drawing, layer composition, and performance optimization
 */

class RenderEngine {
    constructor(canvas, stateManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.stateManager = stateManager;

        // Offscreen buffer for layer composition
        this.layerBuffer = document.createElement('canvas');
        this.layerBufferCtx = this.layerBuffer.getContext('2d');

        // Animation frame
        this.rafId = null;
        this.needsRedraw = false;
        this.isDrawing = false;

        // Current stroke buffer (for live drawing)
        this.currentStroke = null;

        // Performance monitoring
        this.lastFrameTime = 0;
        this.fps = 60;

        this.setupCanvas();
    }

    /**
     * Setup canvas size
     */
    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.resize(rect.width, rect.height);
    }

    /**
     * Resize canvas
     */
    resize(width, height) {
        if (width > 0 && height > 0) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.layerBuffer.width = width;
            this.layerBuffer.height = height;
            this.requestRedraw();
        }
    }

    /**
     * Request redraw on next animation frame
     */
    requestRedraw() {
        this.needsRedraw = true;
        if (!this.rafId) {
            this.rafId = requestAnimationFrame((time) => this.render(time));
        }
    }

    /**
     * Main render loop
     */
    render(timestamp) {
        this.rafId = null;

        // Calculate FPS
        if (this.lastFrameTime) {
            const delta = timestamp - this.lastFrameTime;
            this.fps = 1000 / delta;
        }
        this.lastFrameTime = timestamp;

        if (this.needsRedraw) {
            this.draw();
            this.needsRedraw = false;
        }

        // Continue loop if drawing
        if (this.isDrawing || this.needsRedraw) {
            this.rafId = requestAnimationFrame((time) => this.render(time));
        }
    }

    /**
     * Main draw function
     */
    draw() {
        const wb = this.stateManager.getWhiteboard();
        const { width, height } = this.canvas;

        // Clear canvas
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, width, height);

        // Setup view transform
        const transform = wb.view;

        // Render each visible layer
        wb.layers.forEach(layer => {
            if (!layer.visible) return;

            // Filter strokes and current stroke for this layer
            const layerStrokes = wb.strokes.filter(s => s.layerId === layer.id);
            const hasCurrentStroke = this.currentStroke && this.currentStroke.layerId === layer.id;

            if (layerStrokes.length === 0 && !hasCurrentStroke) return;

            // Use buffer for layer composition
            this.layerBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.layerBufferCtx.clearRect(0, 0, width, height);

            // Apply view transform
            this.layerBufferCtx.setTransform(
                transform.scale, 0,
                0, transform.scale,
                transform.x, transform.y
            );

            // Render all strokes in order
            layerStrokes.forEach(stroke => {
                this.layerBufferCtx.globalCompositeOperation =
                    stroke.isEraser ? 'destination-out' : 'source-over';
                this.drawStroke(this.layerBufferCtx, stroke);
            });

            // Draw current stroke
            if (hasCurrentStroke) {
                this.layerBufferCtx.globalCompositeOperation =
                    this.currentStroke.isEraser ? 'destination-out' : 'source-over';
                this.drawStroke(this.layerBufferCtx, this.currentStroke);
            }

            // Composite buffer to main canvas
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.globalAlpha = 1.0;
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.drawImage(this.layerBuffer, 0, 0);
        });
    }

    /**
     * Draw a single stroke with optimization
     */
    drawStroke(ctx, stroke) {
        if (!stroke.points || stroke.points.length < 2) return;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.globalAlpha = stroke.opacity || 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const points = stroke.points;

        // Use quadratic curves for smoother strokes
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 2) {
            // Simple line for 2 points
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            // Smooth curves for more points
            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            // Last point
            const last = points[points.length - 1];
            const prev = points[points.length - 2];
            ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        }

        ctx.stroke();
    }

    /**
     * Start drawing stroke
     */
    startStroke(layerId, point, penSettings, isEraser = false) {
        this.currentStroke = {
            points: [{ x: point.x, y: point.y }],
            color: penSettings.color,
            size: penSettings.size,
            opacity: penSettings.opacity,
            layerId: layerId,
            isEraser: isEraser
        };
        this.isDrawing = true;
        this.requestRedraw();
    }

    /**
     * Add point to current stroke
     */
    addStrokePoint(point) {
        if (this.currentStroke) {
            this.currentStroke.points.push({ x: point.x, y: point.y });
            this.requestRedraw();
        }
    }

    /**
     * Finish current stroke
     */
    finishStroke() {
        const stroke = this.currentStroke;
        this.currentStroke = null;
        this.isDrawing = false;
        return stroke;
    }

    /**
     * Cancel current stroke
     */
    cancelStroke() {
        this.currentStroke = null;
        this.isDrawing = false;
        this.requestRedraw();
    }

    /**
     * Get current FPS
     */
    getFPS() {
        return Math.round(this.fps);
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}

export default RenderEngine;
