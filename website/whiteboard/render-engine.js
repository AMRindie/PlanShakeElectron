/**
 * Render Engine - Optimized canvas rendering with RAF and dirty rectangles
 */

class RenderEngine {
    constructor(canvas, stateManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.stateManager = stateManager;

        this.layerBuffer = document.createElement('canvas');
        this.layerBufferCtx = this.layerBuffer.getContext('2d');

        this.rafId = null;
        this.needsRedraw = false;
        this.isDrawing = false;
        this.currentStroke = null;

        // Handle High DPI
        this.dpr = window.devicePixelRatio || 1;

        this.setupCanvas();
    }

    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.resize(rect.width, rect.height);
    }

    resize(width, height) {
        if (width > 0 && height > 0) {
            // Scale canvas for DPI
            this.canvas.width = width * this.dpr;
            this.canvas.height = height * this.dpr;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;

            this.layerBuffer.width = width * this.dpr;
            this.layerBuffer.height = height * this.dpr;

            // Normalize coordinate system
            this.ctx.scale(this.dpr, this.dpr);
            this.layerBufferCtx.scale(this.dpr, this.dpr);

            this.requestRedraw();
        }
    }

    requestRedraw() {
        this.needsRedraw = true;
        if (!this.rafId) {
            this.rafId = requestAnimationFrame((time) => this.render(time));
        }
    }

    render(timestamp) {
        this.rafId = null;
        if (this.needsRedraw) {
            this.draw();
            this.needsRedraw = false;
        }
        if (this.isDrawing || this.needsRedraw) {
            this.rafId = requestAnimationFrame((time) => this.render(time));
        }
    }

    draw() {
        const wb = this.stateManager.getWhiteboard();
        // Use logical width/height for clearing (not physical)
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;

        // Reset Main Canvas
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // Scale everything by DPR
        this.ctx.save();
        this.ctx.scale(this.dpr, this.dpr);

        const transform = wb.view;

        wb.layers.forEach(layer => {
            if (!layer.visible) return;

            const layerStrokes = wb.strokes.filter(s => s.layerId === layer.id);
            const hasCurrentStroke = this.currentStroke && this.currentStroke.layerId === layer.id;

            if (layerStrokes.length === 0 && !hasCurrentStroke) return;

            // Clear buffer
            this.layerBufferCtx.save();
            this.layerBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.layerBufferCtx.clearRect(0, 0, this.layerBuffer.width, this.layerBuffer.height);
            this.layerBufferCtx.restore();

            // Set Buffer Transform
            this.layerBufferCtx.save();
            this.layerBufferCtx.scale(this.dpr, this.dpr); // Apply DPR
            this.layerBufferCtx.translate(transform.x, transform.y);
            this.layerBufferCtx.scale(transform.scale, transform.scale);

            // Draw strokes
            layerStrokes.forEach(stroke => {
                this.layerBufferCtx.globalCompositeOperation =
                    stroke.isEraser ? 'destination-out' : 'source-over';
                this.drawStroke(this.layerBufferCtx, stroke);
            });

            if (hasCurrentStroke) {
                this.layerBufferCtx.globalCompositeOperation =
                    this.currentStroke.isEraser ? 'destination-out' : 'source-over';
                this.drawStroke(this.layerBufferCtx, this.currentStroke);
            }

            this.layerBufferCtx.restore();

            // Composite
            this.ctx.drawImage(this.layerBuffer, 0, 0, width, height);
        });

        this.ctx.restore();
    }

    drawStroke(ctx, stroke) {
        if (!stroke.points || stroke.points.length < 2) return;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size; // No need to scale size, the transform handles it
        ctx.globalAlpha = stroke.opacity || 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const points = stroke.points;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 2) {
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            const last = points[points.length - 1];
            const prev = points[points.length - 2];
            ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        }
        ctx.stroke();
    }

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

    addStrokePoint(point) {
        if (this.currentStroke) {
            this.currentStroke.points.push({ x: point.x, y: point.y });
            this.requestRedraw();
        }
    }

    finishStroke() {
        const stroke = this.currentStroke;
        this.currentStroke = null;
        this.isDrawing = false;
        return stroke;
    }

    cancelStroke() {
        this.currentStroke = null;
        this.isDrawing = false;
        this.requestRedraw();
    }

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
    }
}

export default RenderEngine;