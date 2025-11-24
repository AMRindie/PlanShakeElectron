/**
 * Context Menu - Unified context menu system for notes and images
 * Handles menu creation, positioning, and actions
 */

class ContextMenu {
    constructor(containerEl, stateManager, callbacks) {
        this.container = containerEl;
        this.stateManager = stateManager;
        this.callbacks = callbacks;

        this.activeMenuEl = null;
        this.activeItemEl = null;

        // Create menu container
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'wbContextMenu';
            this.container.className = 'hidden';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Show context menu for item
     */
    show(item, itemEl) {
        this.hide();

        if (item.type === 'image') {
            this.showImageMenu(item, itemEl);
        } else if (item.type === 'note') {
            this.showNoteMenu(item, itemEl);
        }
    }

    /**
     * Show image context menu
     */
    showImageMenu(item, itemEl) {
        const menu = document.createElement('div');
        menu.className = 'wb-context-menu';

        // Reset aspect ratio button
        const btnRatio = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
            'Reset Aspect Ratio',
            () => {
                const img = itemEl.querySelector('img');
                if (img) {
                    const ratio = img.naturalWidth / img.naturalHeight;
                    item.h = item.w / ratio;
                    this.callbacks.onItemUpdate(item);
                }
            }
        );
        menu.appendChild(btnRatio);
        menu.appendChild(this.createDivider());

        // Border toggle
        const btnBorder = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',
            'Toggle Border',
            () => {
                if (item.border) {
                    delete item.border;
                } else {
                    item.border = { width: 5, color: '#000000' };
                }
                this.callbacks.onItemUpdate(item);
                this.showImageMenu(item, itemEl); // Refresh menu
            }
        );
        btnBorder.classList.toggle('active', !!item.border);
        menu.appendChild(btnBorder);

        // Border controls (if border exists)
        if (item.border) {
            // Border thickness slider
            const inputWidth = document.createElement('input');
            inputWidth.type = 'range';
            inputWidth.min = '1';
            inputWidth.max = '20';
            inputWidth.value = item.border.width;
            inputWidth.className = 'wb-range-input';
            inputWidth.title = 'Border Thickness';
            inputWidth.oninput = (e) => {
                item.border.width = parseInt(e.target.value);
                this.callbacks.onItemUpdate(item);
            };
            menu.appendChild(inputWidth);

            // Border color picker
            const colorWrap = this.createColorPicker(
                item.border.color,
                (color) => {
                    item.border.color = color;
                    this.callbacks.onItemUpdate(item);
                }
            );
            menu.appendChild(colorWrap);
        }

        menu.appendChild(this.createDivider());

        // Delete button
        const btnDelete = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            'Delete Image',
            () => {
                this.callbacks.onItemDelete(item.id);
                this.hide();
            },
            'var(--accent-red)'
        );
        menu.appendChild(btnDelete);

        this.container.appendChild(menu);
        this.container.className = '';
        this.positionMenu(menu, itemEl);
        this.activeMenuEl = menu;
        this.activeItemEl = itemEl;
    }

    /**
     * Show note context menu
     */
    showNoteMenu(item, itemEl) {
        const menu = document.createElement('div');
        menu.className = 'wb-context-menu';

        // Check if note is in edit mode
        const contentDiv = itemEl.querySelector('.wb-note-content');
        const isEditMode = contentDiv && contentDiv.isContentEditable;

        // If NOT in edit mode, show simplified menu (just delete)
        if (!isEditMode) {
            const btnDelete = this.createButton(
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
                'Delete Note',
                () => {
                    this.callbacks.onItemDelete(item.id);
                    this.hide();
                },
                'var(--accent-red)'
            );
            menu.appendChild(btnDelete);

            this.container.appendChild(menu);
            this.container.className = '';
            this.positionMenu(menu, itemEl);
            this.activeMenuEl = menu;
            this.activeItemEl = itemEl;
            return;
        }

        // If in edit mode, show full formatting menu
        const exec = (cmd, val = null) => {
            if (contentDiv) {
                contentDiv.focus();
                document.execCommand(cmd, false, val);
                item.content = contentDiv.innerHTML;
                this.stateManager.scheduleSave();
            }
        };

        // Text formatting buttons
        menu.appendChild(this.createButton('<b>B</b>', 'Bold', () => exec('bold')));
        menu.appendChild(this.createButton('<i>I</i>', 'Italic', () => exec('italic')));
        menu.appendChild(this.createButton('<u>U</u>', 'Underline', () => exec('underline')));
        menu.appendChild(this.createDivider());

        // Font size controls
        menu.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><text x="4" y="18" font-size="14" font-weight="bold">A</text></svg>',
            'Decrease Font Size',
            () => exec('fontSize', '1')
        ));
        menu.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><text x="2" y="18" font-size="18" font-weight="bold">A</text></svg>',
            'Increase Font Size',
            () => exec('fontSize', '7')
        ));
        menu.appendChild(this.createDivider());

        // List controls
        menu.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
            'Bullet List',
            () => exec('insertUnorderedList')
        ));
        menu.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9 12 2 2 4-4"/></svg>',
            'Checklist',
            () => {
                exec('insertUnorderedList');
                setTimeout(() => {
                    const lists = contentDiv.querySelectorAll('ul');
                    if (lists.length > 0) {
                        const lastList = lists[lists.length - 1];
                        if (!lastList.classList.contains('wb-checklist')) {
                            lastList.classList.add('wb-checklist');
                            lastList.addEventListener('click', (e) => {
                                if (e.target.tagName === 'LI') {
                                    e.target.classList.toggle('checked');
                                    item.content = contentDiv.innerHTML;
                                    this.stateManager.scheduleSave();
                                }
                            });
                            item.content = contentDiv.innerHTML;
                            this.stateManager.scheduleSave();
                        }
                    }
                }, 10);
            }
        ));
        menu.appendChild(this.createDivider());

        // Color pickers
        const textColorPicker = this.createColorPicker('#000000', (color) => {
            exec('foreColor', color);
        });
        textColorPicker.title = 'Text Color';
        menu.appendChild(textColorPicker);

        const bgColor = itemEl.style.backgroundColor || '#fff740';
        const bgColorPicker = this.createColorPicker(
            this.rgbToHex(bgColor) || '#fff740',
            (color) => {
                itemEl.style.backgroundColor = color;
                item.backgroundColor = color;
                this.stateManager.scheduleSave();
            }
        );
        bgColorPicker.title = 'Note Color';
        menu.appendChild(bgColorPicker);
        menu.appendChild(this.createDivider());

        // Delete button
        const btnDelete = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            'Delete Note',
            () => {
                this.callbacks.onItemDelete(item.id);
                this.hide();
            },
            'var(--accent-red)'
        );
        menu.appendChild(btnDelete);

        this.container.appendChild(menu);
        this.container.className = '';
        this.positionMenu(menu, itemEl);
        this.activeMenuEl = menu;
        this.activeItemEl = itemEl;
    }

    /**
     * Create menu button
     */
    createButton(html, title, onClick, color = null) {
        const btn = document.createElement('button');
        btn.className = 'wb-menu-btn';
        btn.innerHTML = html;
        btn.title = title;
        btn.onclick = onClick;
        if (color) btn.style.color = color;
        return btn;
    }

    /**
     * Create divider
     */
    createDivider() {
        const div = document.createElement('div');
        div.className = 'wb-menu-divider';
        return div;
    }

    /**
     * Create color picker
     */
    createColorPicker(initialColor, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'wb-color-picker';
        wrapper.style.backgroundColor = initialColor;

        const input = document.createElement('input');
        input.type = 'color';
        input.value = initialColor;
        input.oninput = (e) => {
            wrapper.style.backgroundColor = e.target.value;
            onChange(e.target.value);
        };

        wrapper.appendChild(input);
        return wrapper;
    }

    /**
     * Position menu relative to item
     */
    positionMenu(menu, itemEl) {
        const rect = itemEl.getBoundingClientRect();
        menu.style.left = (rect.left + rect.width / 2) + 'px';
        menu.style.top = rect.top + 'px';
    }

    /**
     * Update menu position (for pan/zoom)
     */
    updatePosition() {
        if (this.activeMenuEl && this.activeItemEl) {
            this.positionMenu(this.activeMenuEl, this.activeItemEl);
        }
    }

    /**
     * Hide context menu
     */
    hide() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.className = 'hidden';
        }
        this.activeMenuEl = null;
        this.activeItemEl = null;
    }

    /**
     * Convert RGB to hex
     */
    rgbToHex(rgb) {
        if (!rgb) return null;
        if (rgb.startsWith('#')) return rgb;
        const sep = rgb.indexOf(',') > -1 ? ',' : ' ';
        const rgbArr = rgb.substr(4).split(')')[0].split(sep);
        let r = (+rgbArr[0]).toString(16);
        let g = (+rgbArr[1]).toString(16);
        let b = (+rgbArr[2]).toString(16);
        if (r.length === 1) r = '0' + r;
        if (g.length === 1) g = '0' + g;
        if (b.length === 1) b = '0' + b;
        return '#' + r + g + b;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.hide();
    }
}

export default ContextMenu;
