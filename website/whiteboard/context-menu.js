/**
 * Context Menu - Unified context menu system for notes and images
 */

const ALIGN_ICONS = {
    justifyLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>`,
    justifyCenter: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>`,
    justifyRight: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>`,
    justifyFull: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
};

const FONT_SIZES = ["12px", "14px", "16px", "18px", "24px", "30px", "36px", "48px", "64px"];

class ContextMenu {
    constructor(containerEl, stateManager, callbacks) {
        this.container = containerEl;
        this.stateManager = stateManager;
        this.callbacks = callbacks;
        this.activeMenuEl = null;
        this.activeItemEl = null;

        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'wbContextMenu';
            this.container.className = 'hidden';
            document.body.appendChild(this.container);
        }
    }

    show(item, itemEl) {
        this.hide();
        this.activeItem = item;
        this.activeItemEl = itemEl;

        if (item.type === 'image') {
            this.showImageMenu(item, itemEl);
        } else if (item.type === 'note') {
            this.showNoteMenu(item, itemEl);
        }
    }

    showImageMenu(item, itemEl) {
        const menu = document.createElement('div');
        menu.className = 'wb-context-menu';

        // Single Row for Images
        const row = document.createElement('div');
        row.className = 'wb-menu-row';

        // Reset Ratio
        row.appendChild(this.createButton(
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
        ));

        // Border Toggle
        const btnBorder = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',
            'Toggle Border',
            () => {
                if (item.border) delete item.border;
                else item.border = { width: 5, color: '#000000' };
                this.callbacks.onItemUpdate(item);
                this.show(item, itemEl);
            }
        );
        if (item.border) btnBorder.classList.add('active');
        row.appendChild(btnBorder);

        // Border Color & Width (only if border is enabled)
        if (item.border) {
            const colorWrap = this.createColorPicker(item.border.color, (c) => {
                item.border.color = c;
                this.callbacks.onItemUpdate(item);
            });
            row.appendChild(colorWrap);

            // Border Width Slider
            const widthWrapper = document.createElement('div');
            widthWrapper.className = 'wb-border-width-wrapper';

            const widthInput = document.createElement('input');
            widthInput.type = 'range';
            widthInput.min = '1';
            widthInput.max = '20';
            widthInput.value = item.border.width || 5;
            widthInput.className = 'wb-border-width';
            widthInput.title = `Border: ${widthInput.value}px`;

            widthInput.oninput = (e) => {
                item.border.width = parseInt(e.target.value);
                widthInput.title = `Border: ${e.target.value}px`;
                this.callbacks.onItemUpdate(item);
            };
            widthInput.onmousedown = (e) => e.stopPropagation();

            widthWrapper.appendChild(widthInput);
            row.appendChild(widthWrapper);
        }

        row.appendChild(this.createDivider());

        // Delete
        const btnDelete = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            'Delete Image',
            () => { this.callbacks.onItemDelete(item.id); this.hide(); }
        );
        btnDelete.classList.add('delete-btn');
        row.appendChild(btnDelete);

        menu.appendChild(row);
        this.finalizeMenu(menu, itemEl);
    }

    /**
     * RICH TEXT NOTE MENU
     * Replicates the full toolbar from app.notes.js when in edit mode.
     */
    showNoteMenu(item, itemEl) {
        const menu = document.createElement('div');
        menu.className = 'wb-context-menu';
        // Allow menu to be wider for the full toolbar
        menu.style.minWidth = '320px';

        const contentDiv = itemEl.querySelector('.wb-note-content');
        const isEditMode = contentDiv && contentDiv.isContentEditable;

        if (isEditMode) {
            this.buildEditToolbar(menu, item, itemEl, contentDiv);
        } else {
            this.buildViewToolbar(menu, item, itemEl);
        }

        this.finalizeMenu(menu, itemEl);
    }

    buildViewToolbar(menu, item, itemEl) {
        const row = document.createElement('div');
        row.className = 'wb-menu-row';

        // Delete only - no color picker
        const btnDelete = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            'Delete',
            () => { this.callbacks.onItemDelete(item.id); this.hide(); }
        );
        btnDelete.classList.add('delete-btn');
        row.appendChild(btnDelete);

        menu.appendChild(row);
    }

    buildEditToolbar(menu, item, itemEl, contentDiv) {
        const exec = (cmd, val = null) => {
            if (contentDiv) {
                if (document.activeElement !== contentDiv) contentDiv.focus();
                document.execCommand(cmd, false, val);
                item.content = contentDiv.innerHTML;
                this.stateManager.scheduleSave();
                this.syncToolbarState(menu, contentDiv);
            }
        };

        // --- ROW 1: Undo/Redo, Font Size ---
        const row1 = document.createElement('div');
        row1.className = 'wb-menu-row';

        // Undo/Redo
        row1.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
            'Undo', () => exec('undo')
        ));
        row1.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>',
            'Redo', () => exec('redo')
        ));

        row1.appendChild(this.createDivider());

        // Font Size Select only (no format dropdown)
        const fontSelect = document.createElement('select');
        fontSelect.className = 'wb-select';
        fontSelect.innerHTML = `<option value="" disabled selected>Size</option>` +
            FONT_SIZES.map(s => `<option value="${s}">${parseInt(s)}</option>`).join('');
        fontSelect.onchange = () => {
            const size = fontSelect.value;
            contentDiv.focus();
            document.execCommand('fontSize', false, "7");
            const fonts = contentDiv.querySelectorAll("font[size='7']");
            fonts.forEach(f => {
                f.removeAttribute("size");
                f.style.fontSize = size;
            });
            item.content = contentDiv.innerHTML;
            this.stateManager.scheduleSave();
        };
        fontSelect.onmousedown = (e) => e.stopPropagation();
        row1.appendChild(fontSelect);

        menu.appendChild(row1);

        // --- ROW 2: B/I/U/S, Colors, Remove Format ---
        const row2 = document.createElement('div');
        row2.className = 'wb-menu-row';

        row2.appendChild(this.createButton('<b>B</b>', 'Bold', () => exec('bold'), 'bold'));
        row2.appendChild(this.createButton('<i>I</i>', 'Italic', () => exec('italic'), 'italic'));
        row2.appendChild(this.createButton('<u>U</u>', 'Underline', () => exec('underline'), 'underline'));
        row2.appendChild(this.createButton('<s>S</s>', 'Strikethrough', () => exec('strikeThrough'), 'strikeThrough'));

        row2.appendChild(this.createDivider());

        // Colors
        const stack = document.createElement('div');
        stack.className = 'wb-color-stack';
        stack.appendChild(this.createColorPicker('#000000', (c) => exec('foreColor', c), 'A'));
        stack.appendChild(this.createColorPicker('#ffff00', (c) => exec('hiliteColor', c)));
        row2.appendChild(stack);

        // Remove Format
        row2.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M6 4h12"/><path d="m4 4 16 16"/></svg>',
            'Clear Formatting',
            () => {
                exec('removeFormat');
                exec('unlink');
            }
        ));

        menu.appendChild(row2);

        // --- ROW 3: Alignment, Lists, Image ---
        const row3 = document.createElement('div');
        row3.className = 'wb-menu-row';

        // Alignment Dropdown (Simplified to buttons for context menu to save clicks/complexity)
        row3.appendChild(this.createButton(ALIGN_ICONS.justifyLeft, 'Left', () => exec('justifyLeft'), 'justifyLeft'));
        row3.appendChild(this.createButton(ALIGN_ICONS.justifyCenter, 'Center', () => exec('justifyCenter'), 'justifyCenter'));
        row3.appendChild(this.createButton(ALIGN_ICONS.justifyRight, 'Right', () => exec('justifyRight'), 'justifyRight'));

        row3.appendChild(this.createDivider());

        // Lists
        row3.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
            'Bullet List', () => exec('insertUnorderedList'), 'insertUnorderedList'
        ));
        row3.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
            'Ordered List', () => exec('insertOrderedList'), 'insertOrderedList'
        ));

        // Checklist
        row3.appendChild(this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9 12 2 2 4-4"/></svg>',
            'Checklist',
            () => {
                exec('insertUnorderedList');
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    let node = selection.anchorNode;
                    while (node && node !== contentDiv) {
                        if (node.nodeName === 'UL') {
                            node.classList.toggle('wb-checklist');
                            item.content = contentDiv.innerHTML;
                            this.stateManager.scheduleSave();
                            break;
                        }
                        node = node.parentNode;
                    }
                }
            }
        ));

        row3.appendChild(this.createDivider());

        // Insert Image
        const imgLabel = document.createElement('label');
        imgLabel.className = 'wb-menu-btn';
        imgLabel.title = 'Insert Image';
        imgLabel.style.cursor = 'pointer';
        imgLabel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              <input type="file" accept="image/*" hidden>`;
        imgLabel.querySelector('input').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const imgHtml = `<img src="${evt.target.result}" style="max-width:100%; width: 200px;">`;
                    contentDiv.focus();
                    document.execCommand("insertHTML", false, imgHtml);
                    item.content = contentDiv.innerHTML;
                    this.stateManager.scheduleSave();
                };
                reader.readAsDataURL(file);
            }
            e.target.value = "";
        };
        imgLabel.onmousedown = (e) => e.stopPropagation();
        row3.appendChild(imgLabel);

        menu.appendChild(row3);

        // --- ROW 4: Delete only (no background color picker) ---
        const row4 = document.createElement('div');
        row4.className = 'wb-menu-row';

        // Delete
        const btnDelete = this.createButton(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            'Delete Note',
            () => { this.callbacks.onItemDelete(item.id); this.hide(); }
        );
        btnDelete.classList.add('delete-btn');
        row4.appendChild(btnDelete);

        menu.appendChild(row4);

        // Initial sync
        setTimeout(() => this.syncToolbarState(menu, contentDiv), 0);

        // Add listeners to contentDiv to sync toolbar
        const onUpdate = () => this.syncToolbarState(menu, contentDiv);
        contentDiv.addEventListener('mouseup', onUpdate);
        contentDiv.addEventListener('keyup', onUpdate);
        contentDiv.addEventListener('click', onUpdate);
    }

    syncToolbarState(menu, contentDiv) {
        if (!menu || !contentDiv) return;

        // Sync Buttons
        const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'insertUnorderedList', 'insertOrderedList'];
        commands.forEach(cmd => {
            const btn = menu.querySelector(`button[data-cmd="${cmd}"]`);
            if (btn) {
                if (document.queryCommandState(cmd)) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });

        // Sync Format Select
        const formatSelect = menu.querySelector('select:first-of-type'); // Assuming first select is format
        if (formatSelect) {
            let block = document.queryCommandValue('formatBlock') || 'p';
            block = block.toLowerCase();
            if (block === 'div') block = 'p';
            if (!['h1', 'h2', 'h3', 'p'].includes(block)) block = 'p';
            formatSelect.value = block;
        }
    }

    finalizeMenu(menu, itemEl) {
        this.container.appendChild(menu);
        this.container.className = '';
        this.positionMenu(menu, itemEl);
        this.activeMenuEl = menu;
    }

    createButton(html, title, onClick, cmd = null) {
        const btn = document.createElement('button');
        btn.className = 'wb-menu-btn';
        btn.innerHTML = html;
        btn.title = title;
        if (cmd) btn.dataset.cmd = cmd;
        // CRITICAL: Prevent focus loss so execCommand works on the note
        btn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
        btn.onclick = (e) => { e.stopPropagation(); onClick(); };
        return btn;
    }

    createDivider() {
        const div = document.createElement('div');
        div.className = 'wb-menu-divider';
        return div;
    }

    createColorPicker(initialColor, onChange, labelText = null) {
        const wrapper = document.createElement('div');
        wrapper.className = 'wb-color-wrapper';

        if (labelText) {
            const label = document.createElement('span');
            label.className = 'wb-color-label';
            label.textContent = labelText;
            label.style.color = initialColor === '#000000' || initialColor === '#ffffff' ? 'inherit' : initialColor;
            wrapper.appendChild(label);
        }

        const input = document.createElement('input');
        input.type = 'color';
        input.value = initialColor;
        input.oninput = (e) => {
            onChange(e.target.value);
            wrapper.style.setProperty('--picker-color', e.target.value);
        };
        input.onmousedown = (e) => e.stopPropagation();

        wrapper.appendChild(input);
        wrapper.style.setProperty('--picker-color', initialColor);

        return wrapper;
    }

    positionMenu(menu, itemEl) {
        if (!itemEl) return;
        const rect = itemEl.getBoundingClientRect();
        // Position centered above
        menu.style.left = (rect.left + rect.width / 2) + 'px';
        menu.style.top = (rect.top - 10) + 'px';
    }

    updatePosition() {
        if (this.activeMenuEl && this.activeItemEl) {
            this.positionMenu(this.activeMenuEl, this.activeItemEl);
        }
    }

    hide() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.className = 'hidden';
        }
        this.activeMenuEl = null;
        this.activeItem = null;
        this.activeItemEl = null;
    }

    destroy() {
        this.hide();
        if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
    }
}

export default ContextMenu;