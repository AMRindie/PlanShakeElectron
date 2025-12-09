// app.notes.js

(function () {
    let currentProject = null;
    let saveCallback = null;
    let editorEl = null;
    let tocEl = null;
    let overlayEl = null;
    let activeImage = null;
    let tocDebounceTimer = null;
    let pageWrapper = null;

    // SVG Icons
    const ALIGN_ICONS = {
        justifyLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>`,
        justifyCenter: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>`,
        justifyRight: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>`,
        justifyFull: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
    };

    const FONT_SIZES = ["12px", "14px", "16px", "18px", "24px", "30px", "36px", "48px", "64px"];

    function initNotesEditor(container, project, onSave) {
        currentProject = project;
        saveCallback = onSave;

        const existingHeader = document.querySelector('#notesView .panel-header');
        if (existingHeader) existingHeader.style.display = 'none';

        container.innerHTML = "";
        container.className = "notes-wrapper";

        // 1. Toolbar
        const toolbar = document.createElement("div");
        toolbar.className = "wb-toolbar notes-toolbar-fixed";
        toolbar.innerHTML = `
          <div class="wb-tool-group">
              <select id="ntFormatSelect" class="nt-select-pill" title="Text Style">
                  <option value="p">Normal</option>
                  <option value="h1">Header 1</option>
                  <option value="h2">Header 2</option>
                  <option value="h3">Header 3</option>
              </select>
              <select id="ntFontSelect" class="nt-select-pill" title="Font Size" style="width:70px;">
                  <option value="" disabled selected>Size</option>
                  ${FONT_SIZES.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
          </div>
          <div class="divider-vertical"></div>

          <div class="wb-tool-group">
              <button data-cmd="bold" class="wb-btn circle-btn" title="Bold"><b>B</b></button>
              <button data-cmd="italic" class="wb-btn circle-btn" title="Italic"><i>I</i></button>
              <button data-cmd="underline" class="wb-btn circle-btn" title="Underline"><u>U</u></button>
              <button data-cmd="strikeThrough" class="wb-btn circle-btn" title="Strikethrough"><s>S</s></button>
              
              <div class="color-picker-wrapper circle-btn" title="Text Color">
                  <input type="color" id="ntForeColor" value="#000000">
                  <label for="ntForeColor" style="color:var(--primary); font-weight:900; font-family:serif;">A</label>
              </div>
              
              <div class="color-picker-wrapper circle-btn" title="Highlight Color">
                  <input type="color" id="ntHiliteColor" value="#FFFF00">
                  <label for="ntHiliteColor">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94a3.2 3.2 0 0 0 3.97 3.97L16.8 13.21 12.73 9.14z"/><path d="M4 20h16"/></svg>
                  </label>
              </div>

              <button data-cmd="removeFormat" class="wb-btn circle-btn" title="Clear Formatting">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M6 4h12"/><path d="m4 4 16 16"/></svg>
              </button>
          </div>
          <div class="divider-vertical"></div>

          <div class="wb-tool-group">
              
              <div class="nt-align-dropdown" id="ntAlignDropdown">
                  <button class="nt-align-trigger" title="Text Alignment">
                      <span id="ntAlignIcon">${ALIGN_ICONS.justifyLeft}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                  </button>
                  <div class="nt-align-menu hidden">
                      <button data-align="justifyLeft" title="Left">${ALIGN_ICONS.justifyLeft}</button>
                      <button data-align="justifyCenter" title="Center">${ALIGN_ICONS.justifyCenter}</button>
                      <button data-align="justifyRight" title="Right">${ALIGN_ICONS.justifyRight}</button>
                      <button data-align="justifyFull" title="Justify">${ALIGN_ICONS.justifyFull}</button>
                  </div>
              </div>

              <div class="nt-icon-select-wrapper" title="Line Height">
                   <svg class="nt-select-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/><path d="M6 21V3"/><path d="M9 18l-3 3-3-3"/><path d="M9 6l-3-3-3 3"/></svg>
                   <select id="ntLineHeight" class="nt-icon-select">
                       <option value="" disabled selected></option>
                       <option value="1.0">1.0</option>
                       <option value="1.15">1.15</option>
                       <option value="1.5">1.5</option>
                       <option value="2.0">2.0</option>
                  </select>
              </div>

              <button id="ntDirLtr" class="wb-btn circle-btn" title="Left to Right">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 4h-2v16"/>
                    <path d="M9 4h-2v16"/>
                    <path d="M3 12h8"/>
                    <path d="m3 12 3-3m-3 3 3 3"/>
                </svg>
              </button>
              
              <button id="ntDirRtl" class="wb-btn circle-btn" title="Right to Left">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 4h-2v16"/>
                    <path d="M17 4h-2v16"/>
                    <path d="M21 12h-8"/>
                    <path d="m21 12-3-3m3 3-3 3"/>
                </svg>
              </button>

          </div>
          <div class="divider-vertical"></div>

          <div class="wb-tool-group">
              <button data-cmd="insertUnorderedList" class="wb-btn circle-btn" title="Bullet List">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button data-cmd="insertOrderedList" class="wb-btn circle-btn" title="Numbered List">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
              </button>
              <button id="ntChecklistBtn" class="wb-btn circle-btn" title="Checklist">
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
              </button>
          </div>
          <div class="divider-vertical"></div>

          <div class="wb-tool-group">
               <label class="wb-btn circle-btn" title="Insert Image" style="cursor:pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <input type="file" id="ntImgInput" accept="image/*" hidden>
              </label>
          </div>
      `;

        const tocContainer = document.createElement("div");
        tocContainer.className = "wb-layer-panel notes-toc-panel";
        tocContainer.innerHTML = `
            <div class="layer-header" style="justify-content:center;">${t('jumpTo') || 'Jump To'}</div>
            <div id="notesTocList" class="layer-list notes-toc-list"></div>
        `;
        tocEl = tocContainer.querySelector("#notesTocList");

        pageWrapper = document.createElement("div");
        pageWrapper.className = "notes-page-wrapper";

        editorEl = document.createElement("div");
        editorEl.className = "notes-editor-content print-layout";
        editorEl.contentEditable = true;
        editorEl.spellcheck = false;
        editorEl.innerHTML = project.notes || `<p>${t('startTypingNotes')}</p>`;

        pageWrapper.appendChild(editorEl);

        overlayEl = document.createElement("div");
        overlayEl.className = "nt-img-overlay hidden";
        overlayEl.innerHTML = `
          <div class="nt-handle nw" data-dir="nw"></div>
          <div class="nt-handle ne" data-dir="ne"></div>
          <div class="nt-handle se" data-dir="se"></div>
          <div class="nt-handle sw" data-dir="sw"></div>
      `;
        pageWrapper.appendChild(overlayEl);

        container.appendChild(tocContainer);
        container.appendChild(pageWrapper);
        container.appendChild(toolbar);

        bindEvents(toolbar);
        generateTableOfContents();

        // Listen for global viewUndo/viewRedo events from header buttons
        document.addEventListener('viewUndo', (e) => {
            if (e.detail.view === 'notesView') {
                document.execCommand('undo', false, null);
                triggerSaveAndToc();
            }
        });

        document.addEventListener('viewRedo', (e) => {
            if (e.detail.view === 'notesView') {
                document.execCommand('redo', false, null);
                triggerSaveAndToc();
            }
        });
    }

    function generateTableOfContents() {
        if (!editorEl || !tocEl) return;
        const headers = editorEl.querySelectorAll("h1, h2, h3");
        tocEl.innerHTML = "";
        if (headers.length === 0) {
            tocEl.innerHTML = `<div style="padding:12px; color:var(--text-secondary); font-size:0.85rem; text-align:center;">${t('noHeadersDetected')}</div>`;
            return;
        }
        headers.forEach((header, index) => {
            if (!header.id) header.id = "header-" + index;
            const item = document.createElement("div");
            const tagName = header.tagName.toLowerCase();
            item.className = `layer-item toc-item toc-${tagName}`;
            item.innerHTML = `<span class="layer-name">${header.innerText || t('untitledHeader')}</span>`;
            item.onclick = () => {
                header.scrollIntoView({ behavior: "smooth", block: "center" });
                document.querySelectorAll(".toc-item").forEach(i => i.classList.remove("active"));
                item.classList.add("active");
            };
            tocEl.appendChild(item);
        });
    }

    function syncToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
        commands.forEach(cmd => {
            const btn = document.querySelector(`button[data-cmd="${cmd}"]`);
            if (btn) {
                if (document.queryCommandState(cmd)) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });

        const checklistBtn = document.getElementById('ntChecklistBtn');
        if (checklistBtn) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                while (node && node !== editorEl) {
                    if (node.nodeName === 'UL' && node.classList.contains('wb-checklist')) {
                        checklistBtn.classList.add('active');
                        return;
                    }
                    node = node.parentNode;
                }
                checklistBtn.classList.remove('active');
            }
        }

        const alignIcon = document.getElementById('ntAlignIcon');
        const alignMenu = document.querySelector('.nt-align-menu');
        if (alignIcon && alignMenu) {
            let currentAlign = 'justifyLeft';
            if (document.queryCommandState('justifyCenter')) currentAlign = 'justifyCenter';
            if (document.queryCommandState('justifyRight')) currentAlign = 'justifyRight';
            if (document.queryCommandState('justifyFull')) currentAlign = 'justifyFull';

            alignIcon.innerHTML = ALIGN_ICONS[currentAlign];

            alignMenu.querySelectorAll('button').forEach(b => {
                b.classList.toggle('active', b.dataset.align === currentAlign);
            });
        }

        const formatSelect = document.getElementById("ntFormatSelect");
        if (formatSelect) {
            let block = document.queryCommandValue('formatBlock') || 'p';
            block = block.toLowerCase();
            if (block === 'div') block = 'p';
            if (!['h1', 'h2', 'h3', 'p'].includes(block)) block = 'p';
            formatSelect.value = block;
        }

        const fontSelect = document.getElementById("ntFontSelect");
        if (fontSelect) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const parent = selection.getRangeAt(0).startContainer.parentElement;
                if (parent) {
                    const size = window.getComputedStyle(parent).fontSize;
                    fontSelect.value = size;
                    if (!Array.from(fontSelect.options).some(o => o.value === size)) fontSelect.value = "";
                }
            }
        }
    }

    function bindEvents(toolbar) {
        // Use UndoManager for toast notifications (defined in app.undo.js)

        toolbar.querySelectorAll("button[data-cmd]").forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (btn.dataset.cmd === 'removeFormat') {
                    document.execCommand('removeFormat', false, null);
                    document.execCommand('unlink', false, null);
                } else if (btn.dataset.cmd === 'undo') {
                    document.execCommand('undo', false, null);
                    if (window.UndoManager) {
                        UndoManager.showNotesUndoToast(true, triggerSaveAndToc);
                    }
                } else if (btn.dataset.cmd === 'redo') {
                    document.execCommand('redo', false, null);
                    if (window.UndoManager) {
                        UndoManager.showNotesUndoToast(false, triggerSaveAndToc);
                    }
                } else {
                    document.execCommand(btn.dataset.cmd, false, null);
                }
                editorEl.focus();
                triggerSaveAndToc();
                syncToolbarState();
            };
        });

        // Keyboard shortcuts for undo/redo
        editorEl.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    document.execCommand('redo', false, null);
                    if (window.UndoManager) {
                        UndoManager.showNotesUndoToast(false, triggerSaveAndToc);
                    }
                } else {
                    document.execCommand('undo', false, null);
                    if (window.UndoManager) {
                        UndoManager.showNotesUndoToast(true, triggerSaveAndToc);
                    }
                }
                triggerSaveAndToc();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                document.execCommand('redo', false, null);
                if (window.UndoManager) {
                    UndoManager.showNotesUndoToast(false, triggerSaveAndToc);
                }
                triggerSaveAndToc();
            }
        });

        const alignDrop = document.getElementById('ntAlignDropdown');
        const alignTrigger = alignDrop.querySelector('.nt-align-trigger');
        let alignMenu = alignDrop.querySelector('.nt-align-menu');

        alignTrigger.onclick = (e) => {
            e.stopPropagation();
            if (alignMenu.parentNode !== document.body) {
                document.body.appendChild(alignMenu);
            }
            if (alignMenu.classList.contains('hidden')) {
                document.querySelectorAll('.nt-align-menu').forEach(el => el.classList.add('hidden'));
                alignMenu.classList.remove('hidden');
                const rect = alignTrigger.getBoundingClientRect();
                alignMenu.style.position = 'fixed';
                alignMenu.style.top = `${rect.bottom + 6}px`;
                alignMenu.style.left = `${rect.left}px`;
                alignMenu.style.zIndex = '10001';
            } else {
                alignMenu.classList.add('hidden');
            }
        };

        alignMenu.querySelectorAll('button').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const align = btn.dataset.align;
                document.execCommand(align, false, null);
                alignMenu.classList.add('hidden');
                editorEl.focus();
                triggerSave();
                syncToolbarState();
            };
        });

        document.addEventListener('click', (e) => {
            if (!alignTrigger.contains(e.target) && !alignMenu.contains(e.target)) {
                alignMenu.classList.add('hidden');
            }
        });
        window.addEventListener('scroll', () => alignMenu.classList.add('hidden'), true);

        const lineSelect = document.getElementById("ntLineHeight");
        if (lineSelect) {
            lineSelect.onchange = () => {
                const val = lineSelect.value;
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    let block = selection.getRangeAt(0).startContainer;
                    while (block && block.nodeType !== 1) block = block.parentElement;
                    if (block && block !== editorEl) {
                        block.style.lineHeight = val;
                    } else {
                        document.execCommand("insertHTML", false, `<div style="line-height:${val}">${selection.toString()}</div>`);
                    }
                }
                editorEl.focus();
                triggerSave();
                lineSelect.value = "";
            }
        }

        document.getElementById("ntDirLtr").onclick = () => setDirection("ltr");
        document.getElementById("ntDirRtl").onclick = () => setDirection("rtl");

        function setDirection(dir) {
            const selection = window.getSelection();
            if (selection.rangeCount) {
                let node = selection.anchorNode;
                while (node && node.nodeName !== 'DIV' && node.nodeName !== 'P' && node !== editorEl) {
                    node = node.parentElement;
                }
                if (node && node !== editorEl) {
                    node.style.direction = dir;
                    node.style.textAlign = dir === 'rtl' ? 'right' : 'left';
                } else {
                    document.execCommand("formatBlock", false, "div");
                    setTimeout(() => setDirection(dir), 0);
                }
            }
            triggerSave();
        }

        const foreColor = document.getElementById("ntForeColor");
        foreColor.oninput = (e) => document.execCommand("foreColor", false, e.target.value);

        const hiliteColor = document.getElementById("ntHiliteColor");
        hiliteColor.oninput = (e) => document.execCommand("hiliteColor", false, e.target.value);

        const checklistBtn = document.getElementById("ntChecklistBtn");
        if (checklistBtn) {
            checklistBtn.onclick = () => {
                document.execCommand("insertUnorderedList", false, null);
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    let node = selection.anchorNode;
                    while (node && node !== editorEl) {
                        if (node.nodeName === 'UL') {
                            if (node.classList.contains('wb-checklist')) {
                                node.classList.remove('wb-checklist');
                            } else {
                                node.classList.add('wb-checklist');
                            }
                            break;
                        }
                        node = node.parentNode;
                    }
                }
                editorEl.focus();
                triggerSave();
                syncToolbarState();
            }
        }

        editorEl.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const ul = e.target.parentElement;
                if (ul && ul.classList.contains('wb-checklist')) {
                    const rect = e.target.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    if (x < 30) {
                        e.target.classList.toggle('checked');
                        triggerSave();
                    }
                }
            }
        });

        editorEl.addEventListener('keyup', (e) => {
            triggerSave();
            clearTimeout(tocDebounceTimer);
            tocDebounceTimer = setTimeout(generateTableOfContents, 1000);
        });

        editorEl.addEventListener('mouseup', syncToolbarState);

        const formatSelect = document.getElementById("ntFormatSelect");
        formatSelect.onchange = () => {
            document.execCommand("formatBlock", false, formatSelect.value);
            editorEl.focus();
            triggerSaveAndToc();
        };

        const fontSelect = document.getElementById("ntFontSelect");
        fontSelect.onchange = () => {
            const size = fontSelect.value;
            restoreSelection();
            const selection = window.getSelection();
            if (selection.rangeCount && !selection.isCollapsed) {
                document.execCommand('fontSize', false, "7");
                const fonts = editorEl.querySelectorAll("font[size='7']");
                fonts.forEach(f => {
                    f.removeAttribute("size");
                    f.style.fontSize = size;
                });
            }
            triggerSaveAndToc();
        };

        document.getElementById("ntImgInput").onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const img = `<img src="${evt.target.result}" style="max-width:100%; width: 300px;">`;
                    editorEl.focus();
                    document.execCommand("insertHTML", false, img);
                    triggerSaveAndToc();
                };
                reader.readAsDataURL(file);
            }
            e.target.value = "";
        };

        editorEl.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "IMG") setActiveImage(e.target);
            else clearActiveImage();
        });

        pageWrapper.addEventListener("scroll", () => {
            if (activeImage) updateOverlayPos();
        });
        window.addEventListener("resize", () => {
            if (activeImage) updateOverlayPos();
        });

        setupResizer();
    }

    function triggerSaveAndToc() {
        triggerSave();
        setTimeout(generateTableOfContents, 100);
    }

    function triggerSave() {
        if (currentProject && editorEl) {
            currentProject.notes = editorEl.innerHTML;
            if (saveCallback) saveCallback();
        }
    }

    function setActiveImage(img) {
        activeImage = img;
        updateOverlayPos();
        overlayEl.classList.remove("hidden");
    }

    function clearActiveImage() {
        activeImage = null;
        overlayEl.classList.add("hidden");
    }

    function updateOverlayPos() {
        if (!activeImage || !pageWrapper) return;
        const wrapperRect = pageWrapper.getBoundingClientRect();
        const imgRect = activeImage.getBoundingClientRect();
        const top = (imgRect.top - wrapperRect.top) + pageWrapper.scrollTop;
        const left = (imgRect.left - wrapperRect.left) + pageWrapper.scrollLeft;

        overlayEl.style.top = top + "px";
        overlayEl.style.left = left + "px";
        overlayEl.style.width = imgRect.width + "px";
        overlayEl.style.height = imgRect.height + "px";
    }

    function setupResizer() {
        let startX, startY, startW, startH;
        overlayEl.querySelectorAll(".nt-handle").forEach(handle => {
            handle.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!activeImage) return;
                startX = e.clientX;
                startY = e.clientY;
                startW = activeImage.offsetWidth;
                startH = activeImage.offsetHeight;
                const dir = handle.dataset.dir;

                const onMove = (em) => {
                    const dx = em.clientX - startX;
                    const dy = em.clientY - startY;
                    if (dir.includes("e")) activeImage.style.width = (startW + dx) + "px";
                    if (dir.includes("s")) activeImage.style.height = (startH + dy) + "px";
                    if (dir.includes("w")) activeImage.style.width = (startW - dx) + "px";
                    updateOverlayPos();
                };
                const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                    triggerSave();
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
            };
        });
    }

    function restoreSelection() { editorEl.focus(); }

    window.initNotesEditor = initNotesEditor;
})();