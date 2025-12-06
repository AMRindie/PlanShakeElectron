// ============================================
// Custom Color Picker Component
// ============================================

const ColorPicker = {
    overlay: null,
    currentInput: null,
    currentCallback: null,

    // Preset color swatches
    presets: [
        // Row 1 - Grays
        '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
        // Row 2 - Reds/Pinks
        '#FF0000', '#FF4444', '#FF6B6B', '#E91E63', '#FF69B4', '#FFC0CB',
        // Row 3 - Oranges/Yellows
        '#FF6600', '#FF9500', '#FFCC00', '#FFD700', '#FFEB3B', '#FFF59D',
        // Row 4 - Greens
        '#00FF00', '#4CAF50', '#8BC34A', '#66BB6A', '#81C784', '#C8E6C9',
        // Row 5 - Blues/Cyans
        '#00FFFF', '#00BCD4', '#03A9F4', '#2196F3', '#3F51B5', '#1976D2',
        // Row 6 - Purples
        '#9C27B0', '#7B1FA2', '#673AB7', '#9575CD', '#CE93D8', '#E1BEE7'
    ],

    init() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.id = 'customColorPickerOverlay';
        this.overlay.className = 'color-picker-overlay hidden';
        this.overlay.innerHTML = `
            <div class="color-picker-popup">
                <div class="color-picker-header">
                    <span class="color-picker-title">Choose Color</span>
                    <button class="color-picker-close">×</button>
                </div>
                
                <div class="color-picker-preview">
                    <div class="color-preview-box"></div>
                    <input type="text" class="color-hex-input" maxlength="7" placeholder="#000000">
                </div>
                
                <div class="color-picker-tabs">
                    <button class="color-tab active" data-tab="swatches">Swatches</button>
                    <button class="color-tab" data-tab="picker">Custom</button>
                </div>
                
                <div class="color-picker-content">
                    <div class="color-swatches-panel active"></div>
                    <div class="color-custom-panel">
                        <div class="color-gradient-box">
                            <div class="color-gradient-saturation"></div>
                            <div class="color-gradient-cursor"></div>
                        </div>
                        <div class="color-hue-slider">
                            <div class="color-hue-cursor"></div>
                        </div>
                    </div>
                </div>
                
                <div class="color-picker-footer">
                    <button class="color-picker-btn cancel">Cancel</button>
                    <button class="color-picker-btn confirm">Apply</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.setupSwatches();
        this.setupEvents();
    },

    setupSwatches() {
        const swatchPanel = this.overlay.querySelector('.color-swatches-panel');
        this.presets.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.onclick = () => this.selectColor(color);
            swatchPanel.appendChild(swatch);
        });
    },

    setupEvents() {
        // Close button
        this.overlay.querySelector('.color-picker-close').onclick = () => this.hide();
        this.overlay.querySelector('.color-picker-btn.cancel').onclick = () => this.hide();

        // Confirm button
        this.overlay.querySelector('.color-picker-btn.confirm').onclick = () => {
            if (this.currentInput) {
                this.currentInput.value = this.currentColor;
                this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (this.currentCallback) {
                this.currentCallback(this.currentColor);
            }
            this.hide();
        };

        // Tab switching
        this.overlay.querySelectorAll('.color-tab').forEach(tab => {
            tab.onclick = () => {
                this.overlay.querySelectorAll('.color-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const panels = this.overlay.querySelectorAll('.color-picker-content > div');
                panels.forEach(p => p.classList.remove('active'));

                if (tab.dataset.tab === 'swatches') {
                    this.overlay.querySelector('.color-swatches-panel').classList.add('active');
                } else {
                    this.overlay.querySelector('.color-custom-panel').classList.add('active');
                    // Update cursor positions when switching to Custom tab
                    this.updateCursorPositions();
                }
            };
        });

        // Hex input
        const hexInput = this.overlay.querySelector('.color-hex-input');
        hexInput.oninput = () => {
            let val = hexInput.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                this.selectColor(val, false);
            }
        };

        // Gradient picker
        this.setupGradientPicker();

        // Backdrop click
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) this.hide();
        };
    },

    setupGradientPicker() {
        const gradientBox = this.overlay.querySelector('.color-gradient-box');
        const gradientCursor = this.overlay.querySelector('.color-gradient-cursor');
        const hueSlider = this.overlay.querySelector('.color-hue-slider');
        const hueCursor = this.overlay.querySelector('.color-hue-cursor');

        this.hue = 0;
        this.saturation = 100;
        this.lightness = 50;

        // Helper to get coordinates from mouse or touch event
        const getCoords = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        };

        // Hue slider update
        const updateHue = (e) => {
            const coords = getCoords(e);
            const rect = hueSlider.getBoundingClientRect();
            let x = coords.x - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            this.hue = Math.round((x / rect.width) * 360);
            hueCursor.style.left = x + 'px';
            this.updateGradient();
            this.updateColorFromHSL();
        };

        // Gradient box update
        const updateGradientPos = (e) => {
            const coords = getCoords(e);
            const rect = gradientBox.getBoundingClientRect();
            let x = coords.x - rect.left;
            let y = coords.y - rect.top;
            x = Math.max(0, Math.min(x, rect.width));
            y = Math.max(0, Math.min(y, rect.height));

            this.saturation = Math.round((x / rect.width) * 100);
            this.lightness = Math.round(100 - (y / rect.height) * 100);

            gradientCursor.style.left = x + 'px';
            gradientCursor.style.top = y + 'px';
            this.updateColorFromHSL();
        };

        // Dragging state
        let draggingHue = false;
        let draggingGradient = false;

        // Hue slider - mouse events
        hueSlider.addEventListener('mousedown', (e) => {
            draggingHue = true;
            updateHue(e);
        });

        // Hue slider - touch events
        hueSlider.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            draggingHue = true;
            updateHue(e);
        }, { passive: false });

        hueSlider.addEventListener('touchmove', (e) => {
            if (draggingHue) {
                e.preventDefault();
                updateHue(e);
            }
        }, { passive: false });

        hueSlider.addEventListener('touchend', () => {
            draggingHue = false;
        });

        // Gradient box - mouse events
        gradientBox.addEventListener('mousedown', (e) => {
            draggingGradient = true;
            updateGradientPos(e);
        });

        // Gradient box - touch events
        gradientBox.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            draggingGradient = true;
            updateGradientPos(e);
        }, { passive: false });

        gradientBox.addEventListener('touchmove', (e) => {
            if (draggingGradient) {
                e.preventDefault();
                updateGradientPos(e);
            }
        }, { passive: false });

        gradientBox.addEventListener('touchend', () => {
            draggingGradient = false;
        });

        // Document-level mouse events for dragging outside elements
        document.addEventListener('mousemove', (e) => {
            if (draggingHue) updateHue(e);
            if (draggingGradient) updateGradientPos(e);
        });

        document.addEventListener('mouseup', () => {
            draggingHue = false;
            draggingGradient = false;
        });
    },

    updateGradient() {
        const gradientBox = this.overlay.querySelector('.color-gradient-box');
        gradientBox.style.background = `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, hsl(${this.hue}, 100%, 50%))
        `;
    },

    updateCursorPositions() {
        requestAnimationFrame(() => {
            const hueSlider = this.overlay.querySelector('.color-hue-slider');
            const hueCursor = this.overlay.querySelector('.color-hue-cursor');
            const gradientBox = this.overlay.querySelector('.color-gradient-box');
            const gradientCursor = this.overlay.querySelector('.color-gradient-cursor');

            if (hueSlider && hueCursor) {
                hueCursor.style.left = (this.hue / 360) * hueSlider.offsetWidth + 'px';
            }
            if (gradientBox && gradientCursor) {
                gradientCursor.style.left = (this.saturation / 100) * gradientBox.offsetWidth + 'px';
                gradientCursor.style.top = ((100 - this.lightness) / 100) * gradientBox.offsetHeight + 'px';
            }

            this.updateGradient();
        });
    },

    updateColorFromHSL() {
        const color = this.hslToHex(this.hue, this.saturation, this.lightness);
        this.selectColor(color, false);
    },

    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    },

    hexToHSL(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    selectColor(color, updateInputs = true) {
        this.currentColor = color.toUpperCase();

        // Update preview
        this.overlay.querySelector('.color-preview-box').style.backgroundColor = color;

        if (updateInputs) {
            this.overlay.querySelector('.color-hex-input').value = color.toUpperCase();
        }

        // Update swatch selection
        this.overlay.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.color.toUpperCase() === color.toUpperCase());
        });
    },

    show(inputEl, initialColor, callback) {
        this.init();
        this.currentInput = inputEl;
        this.currentCallback = callback;

        const color = initialColor || (inputEl ? inputEl.value : '#000000');
        this.selectColor(color);

        // Update HSL values
        const hsl = this.hexToHSL(color);
        this.hue = hsl.h;
        this.saturation = hsl.s;
        this.lightness = hsl.l;

        // Show the overlay first
        this.overlay.classList.remove('hidden');

        // Position cursors after DOM is rendered
        this.updateCursorPositions();
    },

    hide() {
        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }
        this.currentInput = null;
        this.currentCallback = null;
    }
};

// Auto-attach to color inputs
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.type === 'color') {
            e.preventDefault();
            ColorPicker.show(e.target, e.target.value);
        }
    }, true);
});

// Make globally accessible
window.ColorPicker = ColorPicker;
