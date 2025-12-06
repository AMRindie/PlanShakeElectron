// ======================
// Custom Dialog System (replaces browser confirm/alert)
// ======================

const CustomDialog = {
    overlay: null,

    init() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'customDialogOverlay';
        this.overlay.className = 'custom-dialog-overlay hidden';
        document.body.appendChild(this.overlay);
    },

    show(options) {
        this.init();
        const { title, message, type = 'confirm', confirmText = t('confirm'), cancelText = t('cancel'), danger = false } = options;

        return new Promise((resolve) => {
            this.overlay.innerHTML = `
                <div class="custom-dialog">
                    <div class="custom-dialog-header">
                        <h3>${title || (type === 'alert' ? t('warning') : t('confirm'))}</h3>
                    </div>
                    <div class="custom-dialog-body">
                        <p>${message}</p>
                    </div>
                    <div class="custom-dialog-footer">
                        ${type === 'confirm' ? `<button class="custom-dialog-btn cancel-btn">${cancelText}</button>` : ''}
                        <button class="custom-dialog-btn confirm-btn ${danger ? 'danger' : ''}">${type === 'alert' ? 'OK' : confirmText}</button>
                    </div>
                </div>
            `;

            this.overlay.classList.remove('hidden');

            const confirmBtn = this.overlay.querySelector('.confirm-btn');
            const cancelBtn = this.overlay.querySelector('.cancel-btn');

            const close = (result) => {
                this.overlay.classList.add('hidden');
                resolve(result);
            };

            confirmBtn.onclick = () => close(true);
            if (cancelBtn) cancelBtn.onclick = () => close(false);

            // Close on backdrop click for alerts
            if (type === 'alert') {
                this.overlay.onclick = (e) => {
                    if (e.target === this.overlay) close(true);
                };
            }

            // Focus confirm button
            confirmBtn.focus();
        });
    },

    confirm(message, options = {}) {
        return this.show({ message, type: 'confirm', ...options });
    },

    alert(message, options = {}) {
        return this.show({ message, type: 'alert', ...options });
    }
};

// Make globally accessible
window.customConfirm = (message, options) => CustomDialog.confirm(message, options);
window.customAlert = (message, options) => CustomDialog.alert(message, options);

const PLANNER_STATUSES = ["Backlog", "Next", "Done"];

// ======================
// IDB Helper (Mini IndexedDB Wrapper)
// ======================
const DB_NAME = "TrelloLiteDB";
const DB_STORE = "data";
const DB_KEY = "mainData";

const idb = {
    open: () => {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(DB_STORE)) {
                    db.createObjectStore(DB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    get: async (key) => {
        const db = await idb.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, "readonly");
            const store = tx.objectStore(DB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    put: async (key, value) => {
        const db = await idb.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, "readwrite");
            const store = tx.objectStore(DB_STORE);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};

// ======================
// Persistent Storage API
// ======================

async function requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
        const isPersistent = await navigator.storage.persisted();
        if (isPersistent) {
            console.log("Storage is already persistent.");
            return;
        }

        const granted = await navigator.storage.persist();

        if (granted) {
            console.log("Storage persistence granted! Data should be safe.");
        } else {
            console.warn("Storage persistence denied. Data is still at risk.");
        }
    } else {
        console.warn("Storage API not supported.");
    }
}

// ======================
// Global state
// ======================

window.currentData = null;
window.currentProject = null;
window.PROJECT_ICONS = ["★", "📋", "🚀", "💼", "📝", "🎨", "💻", "📅", "📎", "📊", "🔒", "❤️"];

let draggedProjectId = null;
let projectPlaceholder = null;
let draggedListId = null;
let draggedCardInfo = null;
let cardPlaceholder = null;
let openCard = null;
let lastSaveTimestamp = null;
let lastSavedEventHandler = null;

// ======================
// TOUCH DRAG SUPPORT
// ======================
// This enables Drag & Drop on Touch Devices for Kanban Board
(function () {
    let touchDragSrc = null;
    let touchGhost = null;
    let touchOffsetX = 0;
    let touchOffsetY = 0;
    let touchStartTime = 0;
    let touchMoved = false;
    let dragInitiated = false;

    // Helper to detect stylus
    function isStylus(touch) {
        // Some browsers support touch.touchType
        if (touch.touchType === 'stylus') return true;
        // Styluses often have very small radiusX/radiusY
        if (touch.radiusX !== undefined && touch.radiusX < 2) return true;
        return false;
    }

    document.addEventListener("touchstart", function (e) {
        // Exclude buttons, inputs, and other interactive elements
        if (e.target.closest('button') ||
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.tagName === 'A' ||
            e.target.closest('.project-card-actions')) {
            return;
        }

        const target = e.target.closest('[draggable="true"]');
        if (!target) return;

        const touch = e.touches[0];
        touchDragSrc = target;
        touchOffsetX = touch.clientX;
        touchOffsetY = touch.clientY;
        touchStartTime = Date.now();
        touchMoved = false;
        dragInitiated = false;

        // Don't fire dragstart yet - wait for movement threshold
    }, { passive: false });

    document.addEventListener("touchmove", function (e) {
        if (!touchDragSrc) return;
        const touch = e.touches[0];

        // Calculate movement distance
        const dx = touch.clientX - touchOffsetX;
        const dy = touch.clientY - touchOffsetY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Determine threshold based on input type
        const threshold = isStylus(touch) ? 3 : 5; // 3px for stylus, 5px for finger (improved responsiveness)

        // Only initiate drag if moved > threshold
        if (!dragInitiated && distance > threshold) {
            dragInitiated = true;
            touchMoved = true;

            // Now fire dragstart
            const evt = new Event("dragstart", { bubbles: true });
            evt.dataTransfer = {
                setData: (k, v) => { },
                effectAllowed: "move"
            };
            touchDragSrc.dispatchEvent(evt);
        }

        if (!dragInitiated) return; // Don't create ghost until drag initiated

        // Prevent Page Scroll while dragging
        e.preventDefault();

        // Create Ghost if not exists
        if (!touchGhost) {
            touchGhost = touchDragSrc.cloneNode(true);
            touchGhost.style.position = "fixed";
            touchGhost.style.width = touchDragSrc.offsetWidth + "px";
            touchGhost.style.opacity = "0.9";
            touchGhost.style.pointerEvents = "none";
            touchGhost.style.zIndex = "9999";
            touchGhost.style.transform = "rotate(3deg) scale(1.05)";
            touchGhost.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
            touchGhost.style.transition = "transform 0.1s ease-out";
            document.body.appendChild(touchGhost);
            touchDragSrc.style.opacity = "0.5"; // Dim original
        }

        // Move Ghost
        touchGhost.style.left = (touch.clientX - 20) + "px";
        touchGhost.style.top = (touch.clientY - 20) + "px";

        // Find element below finger
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elementBelow) return;

        // Fire 'dragover' on the element below so app.js logic runs
        const dragOverEvent = new Event("dragover", { bubbles: true });
        dragOverEvent.clientX = touch.clientX;
        dragOverEvent.clientY = touch.clientY;
        // Mock dataTransfer for compatibility
        dragOverEvent.dataTransfer = { dropEffect: "move" };
        elementBelow.dispatchEvent(dragOverEvent);
    }, { passive: false });

    document.addEventListener("touchend", function (e) {
        if (!touchDragSrc) return;

        // If drag was never initiated (tap), let click handlers work
        if (!dragInitiated) {
            touchDragSrc = null;
            return;
        }

        // Clean up Ghost
        if (touchGhost) {
            touchGhost.remove();
            touchGhost = null;
        }
        touchDragSrc.style.opacity = "1";

        // Find drop target based on last known position
        const touch = e.changedTouches[0];
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

        if (elementBelow) {
            // Fire Drop
            const dropEvent = new Event("drop", { bubbles: true });
            dropEvent.dataTransfer = { getData: () => "" };
            elementBelow.dispatchEvent(dropEvent);
        }

        // Fire dragend
        const dragEndEvent = new Event("dragend", { bubbles: true });
        touchDragSrc.dispatchEvent(dragEndEvent);

        touchDragSrc = null;
        dragInitiated = false;
    });
})();

// ======================
// Data Helpers (Async)
// ======================

async function loadData() {
    try {
        // 1. Try IndexedDB
        let data = await idb.get(DB_KEY);

        // 2. Migration: Check LocalStorage if IDB is empty
        if (!data) {
            const raw = localStorage.getItem("trelloLiteData");
            if (raw) {
                try {
                    console.log("Migrating data from LocalStorage to IndexedDB...");
                    data = JSON.parse(raw);
                    await idb.put(DB_KEY, data); // Save to IDB
                    // Optional: localStorage.removeItem("trelloLiteData");
                } catch (e) {
                    console.error("Migration failed", e);
                }
            }
        }

        // 3. Validate data structure - ensure it has projects array
        if (data && !Array.isArray(data.projects)) {
            console.warn("Data structure invalid - fixing...", data);
            // If data looks like a single project, wrap it
            if (data.id && data.lists) {
                data = { projects: [data] };
                await idb.put(DB_KEY, data); // Save corrected structure
            } else {
                // Corrupted data, start fresh
                data = { projects: [] };
            }
        }

        return data || { projects: [] };
    } catch (err) {
        console.error("IDB Load Error", err);
        return { projects: [] };
    }
}

async function saveData(data) {
    try {
        await idb.put(DB_KEY, data);
        lastSaveTimestamp = Date.now();
        if (typeof window !== "undefined") {
            const payload = typeof CustomEvent === "function"
                ? new CustomEvent("trelloLite:dataSaved", { detail: { timestamp: lastSaveTimestamp } })
                : new Event("trelloLite:dataSaved");
            window.dispatchEvent(payload);
        }
    } catch (e) {
        console.error("Failed to save data to DB", e);
        customAlert("Error saving data. Disk space might be full.", { title: "Save Error" });
    }
}

// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Expose save for whiteboard
window.saveData = saveData;
window.saveDataDebounced = debounce(saveData, 1000);

function generateId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

function normalizeProject(project) {
    if (!project.status) project.status = "active";
    if (typeof project.position !== "number") project.position = 0;
    if (!Array.isArray(project.tags)) project.tags = [];
    if (typeof project.description !== "string") project.description = "";
    if (typeof project.notes !== "string") project.notes = "";
    if (!project.archive) project.archive = { cards: [], lists: [] };

    // Whiteboard robustness
    if (!project.whiteboard) project.whiteboard = {};
    if (!Array.isArray(project.whiteboard.items)) project.whiteboard.items = [];
    if (!Array.isArray(project.whiteboard.strokes)) project.whiteboard.strokes = [];
    if (!Array.isArray(project.whiteboard.layers)) project.whiteboard.layers = [];

    if (!project.whiteboard.pen) project.whiteboard.pen = { color: "#000000", size: 5, opacity: 1.0 };
    else {
        if (!project.whiteboard.pen.color) project.whiteboard.pen.color = "#000000";
        if (!project.whiteboard.pen.size) project.whiteboard.pen.size = 5;
        if (project.whiteboard.pen.opacity === undefined) project.whiteboard.pen.opacity = 1.0;
    }

    if (!project.whiteboard.view) project.whiteboard.view = { x: 0, y: 0, scale: 1.0 };
    else {
        if (project.whiteboard.view.x === undefined) project.whiteboard.view.x = 0;
        if (project.whiteboard.view.y === undefined) project.whiteboard.view.y = 0;
        if (project.whiteboard.view.scale === undefined) project.whiteboard.view.scale = 1.0;
    }

    if (!project.planner) project.planner = { entries: [] };
    if (!Array.isArray(project.planner.entries)) project.planner.entries = [];
    if (!project.coverMode) project.coverMode = "color";
}

function downloadJSON(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}



// ======================
// Home page 
// ======================

async function initHomePage() {
    // Request persistent storage early
    requestPersistentStorage();

    window.currentData = await loadData();
    const data = window.currentData;

    const projectsContainer = document.getElementById("projectsContainer");
    const addProjectBtn = document.getElementById("addProjectBtn");
    const exportBtn = document.getElementById("exportBtn");
    const importAllBtn = document.getElementById("importAllBtn");
    const importFile = document.getElementById("importFile");

    // Modals
    const projectEditModal = document.getElementById("projectEditModal");
    const projectEditNameInput = document.getElementById("projectEditName");
    const projectEditDescription = document.getElementById("projectEditDescription");
    const projectEditTagsInput = document.getElementById("projectEditTags");
    const projectEditCloseBtn = document.getElementById("closeProjectEditBtn");
    const projectEditSaveBtn = document.getElementById("saveProjectEditBtn");
    const modalImportBtn = document.getElementById("modalImportBtn");
    const projectEditCoverModeToggle = document.getElementById("projectEditCoverModeToggle");

    let editingProject = null;
    let editingIcon = "★";
    let editingCover = "blue";
    let editingStatus = "active";
    let editingCoverMode = "color";
    let creatingProject = false;

    // ... (Modal logic mostly same, just needs async save) ...

    function updateStatusPills() {
        const statusButtons = projectEditModal.querySelectorAll(".status-pill");
        statusButtons.forEach(btn => {
            const isActive = btn.dataset.status === editingStatus;
            btn.classList.toggle("selected", isActive);
            btn.style.background = isActive ? "var(--primary)" : "var(--bg-inset)";
            btn.style.color = isActive ? "white" : "var(--text-secondary)";
        });
    }

    function highlightSelectedIcon() {
        projectEditModal.querySelectorAll(".icon-picker span").forEach(span => {
            // Remove inline style from previous logic
            span.style.background = "";
            span.classList.toggle("selected", span.dataset.icon === editingIcon);
        });
    }

    function highlightSelectedCover() {
        projectEditModal.querySelectorAll(".cover-swatch").forEach(swatch => {
            swatch.classList.toggle("selected", swatch.dataset.cover === editingCover);
        });
    }

    function updateCoverModeToggle() {
        if (projectEditCoverModeToggle) projectEditCoverModeToggle.checked = editingCoverMode !== "default";
    }

    function hydrateModalFromData(source = {}) {
        projectEditNameInput.value = source.name || source.title || "";
        projectEditDescription.value = source.description || "";
        editingIcon = source.icon || "★";
        editingCover = source.cover || "blue";
        editingStatus = source.status || "active";
        editingCoverMode = source.coverMode === "default" ? "default" : "color";

        const importedTags = Array.isArray(source.tags) ? source.tags : [];
        if (importedTags.length) {
            const tagStrings = importedTags.map(t => (typeof t === "string" ? t : t.text)).filter(Boolean);
            projectEditTagsInput.value = tagStrings.join(", ");
        }
        updateStatusPills(); highlightSelectedIcon(); highlightSelectedCover(); updateCoverModeToggle();
    }

    if (projectEditCoverModeToggle) {
        projectEditCoverModeToggle.onchange = () => editingCoverMode = projectEditCoverModeToggle.checked ? "color" : "default";
    }

    function openProjectEditModal(project, opts = {}) {
        editingProject = project;
        editingIcon = project.icon || "★";
        editingCover = project.cover || "blue";
        editingCoverMode = project.coverMode === "default" ? "default" : "color";
        editingStatus = project.status || "active";
        creatingProject = Boolean(opts.isNew);

        hydrateModalFromData(project);

        projectEditModal.classList.remove("hidden");

        // Populate Icons Dynamically
        const iconContainer = projectEditModal.querySelector(".icon-picker");
        if (iconContainer) {
            iconContainer.innerHTML = "";
            window.PROJECT_ICONS.forEach(icon => {
                const span = document.createElement("span");
                span.textContent = icon;
                span.dataset.icon = icon;
                span.onclick = () => { editingIcon = icon; highlightSelectedIcon(); };
                iconContainer.appendChild(span);
            });
        }
        highlightSelectedIcon();

        projectEditModal.querySelectorAll(".cover-swatch").forEach(swatch => {
            swatch.onclick = () => { editingCover = swatch.dataset.cover; highlightSelectedCover(); }
        });
        projectEditModal.querySelectorAll(".status-pill").forEach(btn => {
            btn.onclick = () => { editingStatus = btn.dataset.status; updateStatusPills(); }
        });
    }

    async function saveProjectEdit() {
        if (!editingProject) return;
        editingProject.name = projectEditNameInput.value.trim() || t('untitled') + " " + t('newProject').replace('+ ', '');
        editingProject.description = projectEditDescription.value.trim();
        editingProject.icon = editingIcon;
        editingProject.cover = editingCover;
        editingProject.coverMode = editingCoverMode;
        editingProject.status = editingStatus;

        const rawTags = projectEditTagsInput.value.split(",").map(t => t.trim()).filter(t => t);
        editingProject.tags = rawTags.map(text => ({ text, color: "var(--text-secondary)" }));

        if (creatingProject) {
            editingProject.position = data.projects.length;
            data.projects.push(editingProject);
        }
        await saveData(data);
        renderProjectsByStatus();
        projectEditModal.classList.add("hidden");
    }

    function createProjectStub() {
        return {
            id: generateId("proj"),
            name: "",
            createdAt: new Date().toISOString(),
            icon: "★", cover: "blue", coverMode: "color", status: "active",
            lists: [
                { id: generateId("list"), title: t('toDo'), cards: [] },
                { id: generateId("list"), title: t('active'), cards: [] },
                { id: generateId("list"), title: t('done'), cards: [] }
            ],
            archive: { cards: [], lists: [] }, planner: { entries: [] },
            whiteboard: { items: [], strokes: [], layers: [], pen: { color: "#000000", size: 5, opacity: 1.0 }, view: { x: 0, y: 0, scale: 1.0 } },
            tags: []
        };
    }

    function moveProject(projectId, toStatus, toIndex = null) {
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;
        project.status = toStatus;
        const targetGroup = data.projects.filter(p => p.id !== projectId && (p.status || "active") === toStatus).sort((a, b) => (a.position || 0) - (b.position || 0));
        if (toIndex === null || toIndex >= targetGroup.length) targetGroup.push(project);
        else targetGroup.splice(toIndex, 0, project);
        targetGroup.forEach((p, idx) => { p.position = idx; });
    }

    function renderProjectsByStatus() {
        projectsContainer.innerHTML = "";

        // Defensive check - ensure data exists
        if (!data || !data.projects) {
            console.error("Data not loaded properly:", data);
            projectsContainer.innerHTML = '<div style="padding: 40px; text-align: center;"><h3>Error loading data</h3><p>Please refresh the page or check browser console for errors.</p></div>';
            return;
        }

        const columns = [{ key: "active", title: t('active') }, { key: "todo", title: t('toDo') }, { key: "finished", title: t('finished') }];

        columns.forEach(col => {
            const section = document.createElement("section"); section.className = "project-section";
            const header = document.createElement("div"); header.className = "project-section-header"; header.textContent = col.title;
            const body = document.createElement("div"); body.className = "project-section-body";
            const listContainer = document.createElement("div"); listContainer.className = "project-section-list"; listContainer.dataset.status = col.key;

            const projectsInCol = data.projects.filter(p => (p.status || "active") === col.key).sort((a, b) => (a.position || 0) - (b.position || 0));

            if (projectsInCol.length === 0) {
                const empty = document.createElement("div"); empty.className = "project-empty";
                empty.innerHTML = `<strong>${t('noProjectsIn')} ${col.title} ${t('projects')}</strong><p>${t('dragProjectsHere')}</p><button class="secondary-btn small">${t('createNew')}</button>`;
                empty.querySelector("button").onclick = () => openProjectEditModal(createProjectStub(), { isNew: true });
                body.appendChild(empty);
            }

            projectsInCol.forEach(proj => {
                const card = document.createElement("div"); card.className = "project-card";
                card.dataset.cover = proj.cover; card.draggable = true;
                card.innerHTML = `
                <div class="project-card-header"><span class="project-card-icon">${proj.icon || '★'}</span><div class="project-card-title">${proj.name || t('untitled')}</div></div>
                <div class="project-card-meta">${proj.lists.length} ${t('listsCount')}</div>
                <div class="project-tags">${(proj.tags || []).slice(0, 3).map(tag => `<span class="project-tag">${tag.text}</span>`).join('')}</div>
                <div class="project-card-actions">
                    <button class="text-btn btn-settings">${t('settings')}</button>
                    <button class="text-btn btn-export">${t('export')}</button>
                    <button class="text-btn danger btn-delete">${t('delete')}</button>
                </div>
            `;
                card.onclick = (e) => { if (e.target.closest("button")) return; window.location.href = `project.html?id=${proj.id}`; };
                card.querySelector(".btn-settings").onclick = (e) => { e.stopPropagation(); openProjectEditModal(proj); };
                card.querySelector(".btn-export").onclick = (e) => {
                    e.stopPropagation();
                    downloadJSON({ project: proj }, `${proj.name || 'project'}_export.json`);
                };
                card.querySelector(".btn-delete").onclick = async (e) => {
                    e.stopPropagation();
                    if (await customConfirm(t('deleteProjectConfirm'), { title: t('deleteProject'), confirmText: t('delete'), danger: true })) {
                        data.projects = data.projects.filter(p => p.id !== proj.id);
                        await saveData(data);
                        renderProjectsByStatus();
                    }
                };
                card.addEventListener("dragstart", (e) => { draggedProjectId = proj.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", proj.id); setTimeout(() => card.style.opacity = "0.5", 0); });
                card.addEventListener("dragend", () => { draggedProjectId = null; card.style.opacity = "1"; if (projectPlaceholder?.parentNode) projectPlaceholder.remove(); projectPlaceholder = null; });
                listContainer.appendChild(card);
            });
            body.appendChild(listContainer); section.appendChild(header); section.appendChild(body);

            // Make the whole column a drop target, but always place
            // the placeholder inside this listContainer.
            section.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (!draggedProjectId) return;

                if (!projectPlaceholder) {
                    projectPlaceholder = document.createElement("div");
                    projectPlaceholder.className = "project-placeholder";
                }

                const cards = Array.from(listContainer.querySelectorAll(".project-card"));
                const mouseY = e.clientY;

                // No cards yet: placeholder just sits at end
                if (cards.length === 0) {
                    if (listContainer.lastElementChild !== projectPlaceholder) {
                        listContainer.appendChild(projectPlaceholder);
                    }
                    return;
                }

                let inserted = false;
                for (const card of cards) {
                    const rect = card.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (mouseY < midY) {
                        if (card !== projectPlaceholder.nextSibling) {
                            listContainer.insertBefore(projectPlaceholder, card);
                        }
                        inserted = true;
                        break;
                    }
                }

                if (!inserted) {
                    if (listContainer.lastElementChild !== projectPlaceholder) {
                        listContainer.appendChild(projectPlaceholder);
                    }
                }
            });

            section.addEventListener("drop", async (e) => {
                e.preventDefault();
                if (!draggedProjectId || !projectPlaceholder) return;

                // Compute index of placeholder among project cards (including its slot)
                const sequence = Array.from(listContainer.children).filter(el =>
                    el.classList.contains("project-card") || el === projectPlaceholder
                );
                const dataIndex = sequence.indexOf(projectPlaceholder);

                moveProject(draggedProjectId, col.key, dataIndex);
                await saveData(data);
                renderProjectsByStatus();
            });
            projectsContainer.appendChild(section);
        });
    }

    addProjectBtn.onclick = () => openProjectEditModal(createProjectStub(), { isNew: true });
    projectEditCloseBtn.onclick = () => projectEditModal.classList.add("hidden");
    projectEditSaveBtn.onclick = saveProjectEdit;
    exportBtn.onclick = () => downloadJSON(data, "project_hub_backup.json");

    if (importAllBtn) {
        importAllBtn.onclick = () => importFile.click();
        importFile.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const json = JSON.parse(reader.result);
                    if (json.projects && Array.isArray(json.projects)) {
                        const action = await customConfirm(
                            `Import ${json.projects.length} project(s).\n\nConfirm = Replace entire workspace\nCancel = Merge with existing projects`,
                            { title: "Import Workspace", confirmText: "Replace", cancelText: "Merge" }
                        );

                        if (action) {
                            // Replace entire workspace
                            data.projects = json.projects;
                        } else {
                            // Merge: add imported projects
                            json.projects.forEach(proj => {
                                // Generate new ID to avoid conflicts
                                proj.id = generateId("proj");
                                proj.position = data.projects.length;
                                data.projects.push(proj);
                            });
                        }

                        await saveData(data);
                        renderProjectsByStatus();
                    } else {
                        await customAlert("Invalid workspace file. Expected {projects: [...]}", { title: "Import Error" });
                    }
                } catch (err) {
                    await customAlert("Invalid JSON file", { title: "Import Error" });
                    console.error(err);
                }
            }
            reader.readAsText(file);
            // Reset file input
            e.target.value = '';
        }
    }

    if (modalImportBtn) {
        modalImportBtn.onclick = () => {
            const picker = document.createElement("input");
            picker.type = "file";
            picker.accept = ".json";
            picker.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = () => {
                    try {
                        const raw = JSON.parse(r.result);
                        // Handle both {project: {...}} and direct project object
                        const p = raw.project || raw;

                        // Hydrate modal with imported data
                        hydrateModalFromData(p);

                        // If creating new project, merge imported data
                        if (creatingProject && editingProject) {
                            // Preserve the ID we generated, but take everything else
                            const preservedId = editingProject.id;
                            Object.assign(editingProject, p, { id: preservedId });
                        }
                    } catch (err) {
                        customAlert("Invalid JSON file", { title: "Import Error" });
                        console.error(err);
                    }
                };
                r.readAsText(file);
            };
            picker.click();
        };
    }

    renderProjectsByStatus();

    // Re-render when language changes
    window.addEventListener('languageChanged', () => {
        renderProjectsByStatus();
    });
}

// ======================
// Project Page
// ======================

async function initProjectPage() {
    // Show Loading Overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'projectLoadingOverlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Loading project...</span>
    `;
    document.body.appendChild(loadingOverlay);

    // Request persistent storage early
    requestPersistentStorage();

    window.currentData = await loadData();
    const projectId = new URLSearchParams(window.location.search).get("id");
    window.currentProject = window.currentData.projects.find(p => p.id === projectId);

    if (!window.currentProject) { window.location.href = "index.html"; return; }

    normalizeProject(window.currentProject);
    window.currentProject.coverMode = window.currentProject.coverMode === "default" ? "default" : "color";
    const currentProject = window.currentProject; // alias

    // UI Elements
    const titleInput = document.getElementById("projectTitleInput");
    const iconDisplay = document.getElementById("projectIconDisplay");
    const iconDropdown = document.getElementById("projectIconDropdown");

    if (iconDisplay && iconDropdown) {
        const renderIconDropdown = () => {
            iconDisplay.textContent = currentProject.icon;
            iconDropdown.innerHTML = "";
            window.PROJECT_ICONS.forEach(icon => {
                if (icon === currentProject.icon) return; // Skip selected

                const span = document.createElement("span");
                span.textContent = icon;
                span.dataset.icon = icon;
                span.onclick = (e) => {
                    e.stopPropagation();
                    currentProject.icon = icon;
                    saveDataDebounced(window.currentData);
                    renderIconDropdown(); // Re-render to update list
                    iconDropdown.classList.add("hidden");
                };
                iconDropdown.appendChild(span);
            });
        };

        renderIconDropdown();

        // Toggle Dropdown
        iconDisplay.onclick = (e) => {
            e.stopPropagation();
            iconDropdown.classList.toggle("hidden");
        };

        // Close on outside click
        document.addEventListener("click", (e) => {
            if (!iconDisplay.contains(e.target) && !iconDropdown.contains(e.target)) {
                iconDropdown.classList.add("hidden");
            }
        });
    } else if (iconDisplay) {
        iconDisplay.textContent = currentProject.icon;
    }

    const coverPickers = document.querySelectorAll(".cover-swatch");
    const board = document.getElementById("board");
    const addListBtn = document.getElementById("addListBtn");
    const newListInput = document.getElementById("newListTitle");
    const bottomNav = document.querySelector(".bottom-nav");
    const coverModeToggle = document.getElementById("projectCoverColorToggle");

    function applyProjectHeaderColor(cover, mode = "color") {
        const header = document.querySelector('.app-header');
        if (!header) return;
        header.classList.remove('cover-blue', 'cover-purple', 'cover-green', 'cover-orange', 'cover-dark');
        header.classList.toggle('cover-default-mode', mode === "default");
        if (mode === "color" && cover) header.classList.add(`cover-${cover}`);
    }

    if (coverModeToggle) {
        coverModeToggle.checked = currentProject.coverMode !== "default";
        coverModeToggle.onchange = () => {
            currentProject.coverMode = coverModeToggle.checked ? "color" : "default";
            saveData(window.currentData);
            applyProjectHeaderColor(currentProject.cover, currentProject.coverMode);
        };
    }
    applyProjectHeaderColor(currentProject.cover, currentProject.coverMode);

    if (titleInput) {
        titleInput.value = currentProject.name;
        titleInput.value = currentProject.name;
        titleInput.oninput = () => { currentProject.name = titleInput.value; saveDataDebounced(window.currentData); };
    }
    if (iconDisplay) iconDisplay.textContent = currentProject.icon;

    coverPickers.forEach(swatch => {
        swatch.classList.toggle("selected", swatch.dataset.cover === currentProject.cover);
        swatch.onclick = () => {
            currentProject.cover = swatch.dataset.cover;
            coverPickers.forEach(s => s.classList.toggle("selected", s === swatch));
            saveData(window.currentData);
            applyProjectHeaderColor(currentProject.cover, currentProject.coverMode);
        }
    });

    // Menu
    const toggleMenuBtn = document.getElementById("toggleMenuBtn");
    const boardMenu = document.getElementById("boardMenu");
    const overlay = document.getElementById("boardMenuOverlay");
    const closeMenuBtnMobile = document.getElementById("closeMenuBtnMobile");

    function openBoardMenu() {
        boardMenu.classList.add("open");
        overlay.classList.remove("hidden");
        updateMenuStats();
    }
    function closeBoardMenu() {
        boardMenu.classList.remove("open");
        overlay.classList.add("hidden");
    }

    if (toggleMenuBtn) {
        toggleMenuBtn.onclick = () => {
            if (boardMenu.classList.contains("open")) {
                closeBoardMenu();
            } else {
                openBoardMenu();
            }
        };
    }
    if (overlay) {
        overlay.onclick = () => closeBoardMenu();
    }
    if (closeMenuBtnMobile) {
        closeMenuBtnMobile.onclick = () => closeBoardMenu();
    }

    // Archive buttons + panel
    const archiveDoneBtn = document.getElementById("archiveDoneCardsBtn");
    const showArchiveBtn = document.getElementById("showArchiveBtn");
    const archivePanel = document.getElementById("archivePanel");
    const closeArchiveBtn = document.getElementById("closeArchiveBtn");
    const archivedCardsContainer = document.getElementById("archivedCardsContainer");

    function renderArchive() {
        if (!archivePanel || !archivedCardsContainer) return;
        archivedCardsContainer.innerHTML = "";
        const archived = currentProject.archive?.cards || [];
        if (archived.length === 0) {
            archivedCardsContainer.innerHTML = `<p>${t('noArchivedCards')}</p>`;
            return;
        }
        archived.forEach((c, index) => {
            const div = document.createElement("div");
            div.className = "archived-card-row";
            div.innerHTML = `
              <div class="archived-card-row-main">
                  <span class="archived-card-title">${c.title || "(untitled card)"}</span>
              </div>
              <div class="archived-card-row-actions">
                  <button class="text-btn small" data-action="restore" data-index="${index}">${t('restore')}</button>
                  <button class="text-btn small danger-text" data-action="delete" data-index="${index}">${t('delete')}</button>
              </div>
          `;
            archivedCardsContainer.appendChild(div);
        });

        // Wire restore/delete per item
        archivedCardsContainer.querySelectorAll("button[data-action]").forEach(btn => {
            btn.onclick = async () => {
                const idx = parseInt(btn.dataset.index, 10);
                const action = btn.dataset.action;
                const archivedCards = currentProject.archive.cards || [];
                const card = archivedCards[idx];
                if (!card) return;

                if (action === "restore") {
                    const targetList = currentProject.lists.find(l => l.id === card.listId) || currentProject.lists[0];
                    if (targetList) {
                        targetList.cards.push(card);
                    }
                    archivedCards.splice(idx, 1);
                    saveData(window.currentData);
                    renderBoard();
                    renderArchive();
                    updateMenuStats();
                } else if (action === "delete") {
                    if (!await customConfirm(t('deleteArchivedCardConfirm'), { title: t('delete'), confirmText: t('delete'), danger: true })) return;
                    archivedCards.splice(idx, 1);
                    saveData(window.currentData);
                    renderArchive();
                }
            };
        });
    }

    if (archiveDoneBtn) {
        archiveDoneBtn.onclick = () => {
            if (!currentProject.archive) currentProject.archive = { cards: [], lists: [] };
            currentProject.lists.forEach(list => {
                const remaining = [];
                list.cards.forEach(card => {
                    const allDone = (card.checklist || []).length > 0 &&
                        (card.checklist || []).every(i => i.completed);
                    if (allDone) {
                        currentProject.archive.cards.push({
                            ...card,
                            listId: list.id
                        });
                    } else {
                        remaining.push(card);
                    }
                });
                list.cards = remaining;
            });
            saveData(window.currentData);
            renderBoard();
            renderArchive();
            updateMenuStats();
        };
    }

    if (showArchiveBtn && archivePanel) {
        showArchiveBtn.onclick = () => {
            const isHidden = archivePanel.classList.contains("hidden");
            if (isHidden) {
                renderArchive();
                archivePanel.classList.remove("hidden");
                showArchiveBtn.textContent = t('hideArchive');
            } else {
                archivePanel.classList.add("hidden");
                showArchiveBtn.textContent = t('viewArchive');
            }
        };
    }

    // Menu Stats logic
    function updateMenuStats() {
        const title = document.getElementById("menuInfoTitle");
        if (title) title.textContent = currentProject.name;

        // Update icon
        const menuIcon = document.getElementById("menuProjectIcon");
        if (menuIcon) {
            menuIcon.textContent = currentProject.icon || "📋";
            // Apply project cover color to icon background
            menuIcon.style.background = `var(--cover-${currentProject.cover || 'blue'})`;
        }

        // Update tags
        const tagsContainer = document.getElementById("menuInfoTags");
        if (tagsContainer) {
            tagsContainer.innerHTML = "";
            (currentProject.tags || []).forEach(tag => {
                const span = document.createElement("span");
                span.className = "project-tag";
                span.textContent = tag.text || tag;
                tagsContainer.appendChild(span);
            });
        }

        const desc = document.getElementById("projectDescriptionInput");
        if (desc) {
            desc.value = currentProject.description;
            desc.oninput = () => {
                currentProject.description = desc.value;
                saveDataDebounced(window.currentData);
            };
        }

        // Simple counts for lists and cards
        const listCountEl = document.getElementById("menuListCount");
        const cardCountEl = document.getElementById("menuCardCount");
        const statusEl = document.getElementById("menuStatus");
        const createdEl = document.getElementById("menuCreated");

        if (listCountEl) listCountEl.textContent = currentProject.lists.length;
        if (cardCountEl) {
            let totalCards = 0;
            currentProject.lists.forEach(l => { totalCards += (l.cards || []).length; });
            cardCountEl.textContent = totalCards;
        }

        if (statusEl) {
            statusEl.textContent = (currentProject.status || "Active").charAt(0).toUpperCase() + (currentProject.status || "active").slice(1);
        }

        if (createdEl && currentProject.createdAt) {
            const date = new Date(currentProject.createdAt);
            createdEl.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }

    // Danger Actions
    const deleteAllCardsBtn = document.getElementById("deleteAllCardsBtn");
    const deleteAllListsBtn = document.getElementById("deleteAllListsBtn");

    if (deleteAllCardsBtn) {
        deleteAllCardsBtn.onclick = async () => {
            if (!await customConfirm(t('deleteAllCardsConfirm'), { title: t('deleteAllCards'), confirmText: t('deleteAll'), danger: true })) return;
            currentProject.lists.forEach(list => {
                list.cards = [];
            });
            saveData(window.currentData);
            renderBoard();
            updateMenuStats();
        };
    }

    if (deleteAllListsBtn) {
        deleteAllListsBtn.onclick = async () => {
            if (!await customConfirm(t('deleteAllListsConfirm'), { title: t('deleteAllLists'), confirmText: t('deleteAll'), danger: true })) return;
            currentProject.lists = [];
            saveData(window.currentData);
            renderBoard();
            updateMenuStats();
        };
    }

    // Board Render
    function renderBoard() {
        if (!board) return;
        const currentProject = window.currentProject;

        // Remove all existing lists except the 'add-list' element
        const existing = document.querySelectorAll(".list:not(.add-list)");
        existing.forEach(e => e.remove());

        // Ensure all lists have the correct initial structure (for new projects)
        if (!Array.isArray(currentProject.lists)) currentProject.lists = [];
        currentProject.lists.forEach(list => {
            if (!Array.isArray(list.cards)) list.cards = [];

            // 1. Create List Element
            const el = document.createElement("div");
            el.className = "list";
            el.dataset.listId = list.id;
            el.draggable = true; // Make lists draggable for future implementation

            el.innerHTML = `
            <div class="list-header"><input class="list-title-input" value="${list.title}" /><button class="icon-btn delete-list-btn">×</button></div>
            <div class="list-cards" data-list-id="${list.id}"></div>
            <div class="add-card"><button class="text-btn">${t('addACard')}</button></div>
          `;

            // 2. Wire List Header Actions
            const titleInput = el.querySelector(".list-title-input");
            titleInput.oninput = (e) => {
                list.title = e.target.value;
                saveDataDebounced(window.currentData);
            };
            // Prevent drag-drop into title
            titleInput.addEventListener("dragover", e => e.preventDefault());
            titleInput.addEventListener("drop", e => e.preventDefault());

            // List Drag Events
            el.addEventListener("dragstart", (e) => {
                if (e.target !== el) return; // Ignore if dragging card inside
                window.draggedListId = list.id;
                e.dataTransfer.effectAllowed = "move";
                setTimeout(() => el.style.opacity = "0.5", 0);
            });
            el.addEventListener("dragend", () => {
                window.draggedListId = null;
                el.style.opacity = "1";
            });
            el.querySelector(".delete-list-btn").onclick = async () => {
                if (await customConfirm(`${t('deleteListConfirm')} "${list.title}"?`, { title: t('deleteList'), confirmText: t('delete'), danger: true })) {
                    currentProject.lists = currentProject.lists.filter(l => l.id !== list.id);
                    saveData(window.currentData);
                    renderBoard();
                }
            };

            // 3. Wire 'Add Card' Button
            const addCardBtn = el.querySelector(".add-card button");
            const cardCont = el.querySelector(".list-cards");

            addCardBtn.onclick = () => {
                const input = document.createElement("input");
                input.placeholder = "Enter card title...";
                input.className = "new-card-input"; // Add class for styling
                addCardBtn.replaceWith(input);
                input.focus();

                let isSaving = false;
                const save = () => {
                    if (isSaving) return;
                    isSaving = true;

                    if (input.value.trim()) {
                        currentProject.lists.find(l => l.id === list.id).cards.push({
                            id: generateId("card"),
                            title: input.value.trim(),
                            labels: [],
                            checklist: [],
                            description: "",
                            dueDate: null,
                            cover: null
                        });
                        saveData(window.currentData);
                        renderBoard();
                        updateMenuStats();
                    } else {
                        input.replaceWith(addCardBtn);
                    }
                    // Note: renderBoard() replaces the input, so we don't need to reset isSaving 
                    // because this closure and the input element are effectively destroyed.
                };
                input.onkeydown = e => {
                    if (e.key === "Enter") {
                        e.preventDefault(); // Prevent default to avoid any other side effects
                        save();
                    }
                };
                input.onblur = () => {
                    // Small timeout to allow Enter key handler to fire first if that was the cause
                    setTimeout(save, 50);
                };
            };

            // If menu is open, keep stats in sync when structure changes
            updateMenuStats();

            // 4. Wire Card Container (Ghost Placement and Drop Target)

            cardCont.addEventListener("dragover", (e) => {
                e.preventDefault();
                // console.log("Drag Over"); // Commented out to avoid spam, uncomment if needed
                if (!window.draggedCardInfo) return;

                if (!window.cardPlaceholder) {
                    // Placeholder might not be created yet if dragstart setTimeout hasn't fired
                    return;
                }

                const targetCard = e.target.closest(".card");

                // Case 1: Dragging over an existing card
                if (targetCard) {
                    const rect = targetCard.getBoundingClientRect();
                    // Check if cursor is in the upper half of the card
                    if (e.clientY < rect.top + rect.height / 2) {
                        cardCont.insertBefore(window.cardPlaceholder, targetCard);
                    } else {
                        cardCont.insertBefore(window.cardPlaceholder, targetCard.nextSibling);
                    }
                    // Case 2: Dragging over an empty area of the list or below the last card
                } else if (!cardCont.querySelector(".card-placeholder")) {
                    cardCont.appendChild(window.cardPlaceholder);
                }

                el.classList.add("drag-over");
            });

            cardCont.addEventListener("dragleave", (e) => {
                if (!cardCont.contains(e.relatedTarget)) el.classList.remove("drag-over");
            });

            cardCont.addEventListener("drop", async (e) => {
                e.preventDefault();
                console.log("Drop Event Fired");
                el.classList.remove("drag-over");

                if (!window.draggedCardInfo || !window.cardPlaceholder || !window.cardPlaceholder.parentNode) {
                    console.warn("Drop aborted: Missing info", { info: window.draggedCardInfo, placeholder: window.cardPlaceholder });
                    return;
                }

                const targetListId = cardCont.dataset.listId;
                const sourceList = currentProject.lists.find(l => l.id === window.draggedCardInfo.fromListId);
                const targetList = currentProject.lists.find(l => l.id === targetListId);

                if (!sourceList || !targetList) {
                    console.error("Drop failed: Source or Target list not found");
                    return;
                }

                // 1. Find the Card to Move
                const cardIdx = sourceList.cards.findIndex(c => c.id === window.draggedCardInfo.cardId);
                if (cardIdx === -1) {
                    console.error("Drop failed: Card not found in source list");
                    return;
                }
                const [card] = sourceList.cards.splice(cardIdx, 1);

                // 2. Determine the Insertion Index based on the placeholder position
                const children = Array.from(cardCont.children);
                let newIndex = children.indexOf(window.cardPlaceholder);

                // Fix: If dropping into the same list and dropping 'after' the original card,
                // the index needs adjustment because the card was removed from the source array.
                if (sourceList.id === targetList.id && newIndex > cardIdx) {
                    newIndex--;
                }

                // 3. Insert the Card into the target list array
                targetList.cards.splice(newIndex, 0, card);

                // 4. Clean up placeholder and re-render
                window.cardPlaceholder.remove();
                window.cardPlaceholder = null;

                await saveData(window.currentData);
                renderBoard();
            });


            // 5. Render Cards in the List
            list.cards.forEach(card => {
                const cEl = document.createElement("div");
                cEl.className = "card" + (card.completed ? " card-completed" : "");
                cEl.draggable = true;

                // Count checklist items from description (notes-style)
                let metaHtml = '';
                if (card.description) {
                    const descDoc = new DOMParser().parseFromString(card.description, 'text/html');
                    const checklistItems = descDoc.querySelectorAll('.wb-checklist li');
                    if (checklistItems.length > 0) {
                        const checkedCount = Array.from(checklistItems).filter(li => li.classList.contains('checked')).length;
                        metaHtml += `<span class="card-meta-icon">☑ ${checkedCount}/${checklistItems.length}</span>`;
                    } else {
                        metaHtml += '<span class="card-meta-icon">🗒️</span>';
                    }
                }

                // Cover preview
                let coverHtml = "";
                if (card.cover && card.cover.type) {
                    const text = card.cover.text || "";
                    const pos = card.cover.position || "center";
                    if (card.cover.type === "color" && card.cover.color) {
                        coverHtml = `<div class="card-cover card-cover--color card-cover-pos-${pos}" style="background:${card.cover.color}"><span class="card-cover-text">${text}</span></div>`;
                    } else if (card.cover.type === "image" && card.cover.image) {
                        coverHtml = `<div class="card-cover card-cover--image card-cover-pos-${pos}" style="background-image:url('${card.cover.image}')"><span class="card-cover-text">${text}</span></div>`;
                    }
                }

                // Build label chips if present (limited on board)
                let labelsHtml = "";
                if (card.labels && card.labels.length > 0) {
                    const maxVisible = 10;
                    const visible = card.labels.slice(0, maxVisible);
                    const hiddenCount = card.labels.length - visible.length;
                    labelsHtml = `<div class="card-labels">` + visible.map(l => {
                        const color = l.color || "#e5e7eb";
                        const name = l.name || "";
                        return `<span class="card-label" style="background:${color}33;border-color:${color}">${name}</span>`;
                    }).join("");
                    if (hiddenCount > 0) {
                        labelsHtml += `<span class="card-label label-overflow">+${hiddenCount}</span>`;
                    }
                    labelsHtml += `</div>`;
                }

                // Card completion checkbox
                const completionCheckbox = `<input type="checkbox" class="card-completion-checkbox" ${card.completed ? 'checked' : ''} title="Mark as complete" />`;

                cEl.innerHTML = `
                  ${coverHtml}
                  <div class="card-content-row">
                    ${completionCheckbox}
                    <div class="card-title">${card.title}</div>
                  </div>
                  ${labelsHtml}
                  <div class="card-meta">${metaHtml}</div>
              `;

                // Handle completion checkbox click
                cEl.querySelector('.card-completion-checkbox').onclick = (e) => {
                    e.stopPropagation();
                    card.completed = e.target.checked;

                    // Two-way sync: if card is checked, check all internal checkboxes
                    if (card.description) {
                        const descDoc = new DOMParser().parseFromString(card.description, 'text/html');
                        // Sync all checklist items with card completion state
                        descDoc.querySelectorAll('.wb-checklist li').forEach(li => {
                            if (e.target.checked) {
                                li.classList.add('checked');
                            } else {
                                li.classList.remove('checked');
                            }
                        });
                        card.description = descDoc.body.innerHTML;
                    }

                    saveData(window.currentData);
                    renderBoard();
                };

                cEl.onclick = (e) => {
                    if (e.target.type !== 'checkbox') {
                        window.openCardModal(list.id, card.id);
                    }
                };

                // Card Drag Start (Initial Setup)
                cEl.addEventListener("dragstart", e => {
                    console.log("Drag Start:", card.id);
                    window.draggedCardInfo = { cardId: card.id, fromListId: list.id };
                    e.dataTransfer.setData("text/plain", card.id);
                    e.dataTransfer.effectAllowed = "move";

                    // Defer DOM manipulation to avoid breaking drag initialization
                    setTimeout(() => {
                        cEl.style.opacity = "0.5";

                        // Create and insert the placeholder ghost where the card currently sits
                        if (!window.cardPlaceholder) {
                            window.cardPlaceholder = document.createElement("div");
                            window.cardPlaceholder.className = "card-placeholder";
                            window.cardPlaceholder.style.height = cEl.offsetHeight + "px";
                        }
                        if (cEl.parentNode) {
                            cEl.parentNode.insertBefore(window.cardPlaceholder, cEl);
                        }
                    }, 0);
                });

                // Card Drag End (Cleanup)
                cEl.addEventListener("dragend", () => {
                    console.log("Drag End");
                    cEl.style.opacity = "1";
                    window.draggedCardInfo = null;
                    if (window.cardPlaceholder?.parentNode) window.cardPlaceholder.remove();
                    window.cardPlaceholder = null;
                });

                cardCont.appendChild(cEl);
            });

            // 6. Insert List into Board
            board.insertBefore(el, board.lastElementChild);
        });
    }

    // Board Drag Over (for List Reordering)
    board.ondragover = (e) => {
        e.preventDefault();
        if (!window.draggedListId) return;

        const lists = Array.from(board.querySelectorAll(".list"));
        const afterElement = lists.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientX - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        const draggedList = document.querySelector(`[data-list-id="${window.draggedListId}"]`);
        if (afterElement == null) {
            board.insertBefore(draggedList, board.querySelector(".add-list"));
        } else {
            board.insertBefore(draggedList, afterElement);
        }
    };

    // Board Drop (Save List Order)
    board.ondrop = (e) => {
        e.preventDefault();
        if (!window.draggedListId) return;

        const newOrderIds = Array.from(board.querySelectorAll(".list")).map(el => el.dataset.listId).filter(id => id);
        const newLists = [];
        newOrderIds.forEach(id => {
            const l = currentProject.lists.find(x => x.id === id);
            if (l) newLists.push(l);
        });
        currentProject.lists = newLists;
        saveData(window.currentData);
    };

    if (addListBtn) {
        addListBtn.onclick = () => {
            document.querySelector(".add-list-input-wrapper").classList.remove("hidden");
            newListInput.focus(); addListBtn.classList.add("hidden");
        };
        newListInput.onkeydown = (e) => {
            if (e.key === "Enter" && newListInput.value.trim()) {
                currentProject.lists.push({ id: generateId("list"), title: newListInput.value.trim(), cards: [] });
                saveData(window.currentData); renderBoard();
                newListInput.value = "";
            }
        };
    }

    if (bottomNav) {
        bottomNav.addEventListener("click", event => {
            const button = event.target.closest("[data-view-target]"); if (!button) return;
            document.querySelectorAll(".bottom-nav__link").forEach(b => b.classList.remove("bottom-nav__link--active"));
            button.classList.add("bottom-nav__link--active");
            document.querySelectorAll("main > section").forEach(s => s.classList.add("hidden"));

            const targetId = button.dataset.viewTarget;
            document.getElementById(targetId).classList.remove("hidden");

            // Hide whiteboard context menu when switching views
            const wbContextMenu = document.getElementById('wbContextMenu');
            if (wbContextMenu) wbContextMenu.classList.add('hidden');

            // Toggle layout padding for whiteboard
            const layoutContainer = document.querySelector(".layout-container");
            if (targetId === "whiteboardView") {
                layoutContainer.classList.add("no-padding");
            } else {
                layoutContainer.classList.remove("no-padding");
            }

            // [FIX] Render Calendar when switching to it
            if (targetId === "calendarView" && window.setupCalendarView) {
                window.setupCalendarView();
            }
        });
    }

    renderBoard();
    setupPlannerPanel();

    // Notes
    const notes = document.getElementById("notesEditor");
    if (notes) {
        notes.innerHTML = currentProject.notes;
        notes.oninput = () => { currentProject.notes = notes.innerHTML; saveDataDebounced(window.currentData); };
    }

    // Card Modal (simplified stub)
    window.openCardModal = (listId, cardId) => {
        const modal = document.getElementById("cardModal");
        modal.classList.remove("hidden");
        const list = window.currentProject.lists.find(l => l.id === listId);
        const card = list.cards.find(c => c.id === cardId);
        window.openCard = card; // Set global reference for easier access

        // UI Elements
        const titleIn = document.getElementById("cardTitleInput");
        const descEditor = document.getElementById("cardDescriptionEditor");
        const startDateIn = document.getElementById("cardStartDateInput");
        const endDateIn = document.getElementById("cardEndDateInput");
        const coverColorModeBtn = document.getElementById("cardCoverColorModeBtn");
        const coverImageModeBtn = document.getElementById("cardCoverImageModeBtn");
        const coverClearBtn = document.getElementById("cardCoverClearBtn");
        const coverColorEls = document.querySelectorAll(".card-cover-color");
        const coverImageInput = document.getElementById("cardCoverImageInput");
        const coverTextInput = document.getElementById("cardCoverTextInput");
        const coverPositionSelect = document.getElementById("cardCoverPositionSelect");
        const coverHeaderBtn = document.getElementById("cardCoverHeaderBtn");
        const coverPopover = document.getElementById("cardCoverPopover");
        const labelNameInput = document.getElementById("cardLabelsInput");
        const addLabelBtn = document.getElementById("addLabelBtn");
        const labelListContainer = document.getElementById("labelListContainer");

        // Ensure card structure is robust
        if (!card.labels) card.labels = [];
        if (!card.description) card.description = "";
        if (!card.cover) card.cover = { type: null, color: null, image: null, text: "", position: "center" };
        if (!card.cover.position) card.cover.position = "center";
        if (card.completed === undefined) card.completed = false;

        // Migration: Use dueDate as endDate if missing
        if (!card.startDate && card.dueDate) card.startDate = card.dueDate;
        if (!card.endDate && card.dueDate) card.endDate = card.dueDate;

        // 1. Hydrate UI
        titleIn.value = card.title;
        descEditor.innerHTML = card.description || '';
        startDateIn.value = card.startDate || '';
        endDateIn.value = card.endDate || card.dueDate || '';

        const modalBanner = document.getElementById("modalCoverBanner");
        const coverTextOptions = document.getElementById("coverTextOptions");

        // --- Helper: Render the Top Banner ---
        const updateModalBanner = () => {
            // Reset
            modalBanner.style.backgroundColor = "";
            modalBanner.style.backgroundImage = "";
            modalBanner.setAttribute("data-text", "");
            modalBanner.className = "modal-cover-banner"; // Reset classes

            if (!card.cover || !card.cover.type) {
                modalBanner.classList.add("hidden");
                coverTextOptions.classList.add("hidden");
            } else {
                modalBanner.classList.remove("hidden");
                coverTextOptions.classList.remove("hidden");

                if (card.cover.type === "color") {
                    modalBanner.style.backgroundColor = card.cover.color || "#cbd5e1";
                } else if (card.cover.type === "image" && card.cover.image) {
                    modalBanner.style.backgroundImage = `url('${card.cover.image}')`;
                }

                // Optional: Show text overlay on banner if wanted
                if (card.cover.text) {
                    modalBanner.setAttribute("data-text", card.cover.text);
                    modalBanner.setAttribute("data-position", card.cover.position || "center");
                }
            }
        };

        // Call immediately to set initial state
        updateModalBanner();

        // --- Cover Logic Handlers ---

        const saveCoverAndRefresh = () => {
            updateModalBanner(); // Update Visuals immediately
            saveData(window.currentData); // Save DB
            // Note: We don't call renderBoard() here to prevent heavy re-renders, 
            // we only do that on modal close.
        };

        const syncCoverControls = () => {
            if (coverColorModeBtn && coverImageModeBtn) {
                coverColorModeBtn.classList.toggle("active", card.cover.type === "color");
                coverImageModeBtn.classList.toggle("active", card.cover.type === "image");
            }
            if (coverColorEls) {
                coverColorEls.forEach(el => {
                    el.classList.toggle("selected", card.cover.type === "color" && card.cover.color === el.dataset.color);
                });
            }
            if (coverTextInput) coverTextInput.value = card.cover.text || "";
            if (coverPositionSelect) coverPositionSelect.value = card.cover.position || "center";
        };

        // Call immediately to set initial cover controls state
        syncCoverControls();

        if (coverColorModeBtn) {
            coverColorModeBtn.onclick = () => {
                card.cover.type = "color";
                if (!card.cover.color && coverColorEls[0]) {
                    card.cover.color = coverColorEls[0].dataset.color;
                }
                saveCoverAndRefresh();
                syncCoverControls();
            };
        }

        if (coverImageModeBtn && coverImageInput) {
            coverImageModeBtn.onclick = () => {
                card.cover.type = "image";
                saveCoverAndRefresh();
                syncCoverControls();
                coverImageInput.click(); // Open file dialog
            };
        }

        if (coverClearBtn) {
            coverClearBtn.onclick = () => {
                card.cover = { type: null, color: null, image: null, text: "", position: "center" };
                saveCoverAndRefresh();
                syncCoverControls();
            };
        }

        if (coverColorEls) {
            coverColorEls.forEach(el => {
                el.onclick = () => {
                    card.cover.type = "color";
                    card.cover.color = el.dataset.color;
                    saveCoverAndRefresh();
                    syncCoverControls();
                };
            });
        }

        if (coverImageInput) {
            coverImageInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    card.cover.type = "image";
                    card.cover.image = evt.target.result;
                    saveCoverAndRefresh();
                    syncCoverControls();
                };
                reader.readAsDataURL(file);
                e.target.value = "";
            };
        }

        if (coverTextInput) {
            coverTextInput.oninput = () => {
                card.cover.text = coverTextInput.value;
                updateModalBanner(); // Update text overlay in real time
                saveDataDebounced(window.currentData);
            };
        }

        if (coverPositionSelect) {
            coverPositionSelect.onchange = () => {
                card.cover.position = coverPositionSelect.value || "center";
                saveCoverAndRefresh();
                syncCoverControls();
            };
        }
        let selectedColor = (card.labels[0] && card.labels[0].color) || "#3b82f6";

        // --- Labels Logic ---
        const renderLabels = () => {
            if (!labelListContainer) return;
            labelListContainer.innerHTML = "";
            card.labels.forEach((l, idx) => {
                const row = document.createElement("div");
                row.className = "label-row";
                row.innerHTML = `
                  <span class="card-label" style="background:${l.color || "#e5e7eb"}33;border-color:${l.color || "#e5e7eb"}">${l.name || ""}<button class="label-remove-btn" data-idx="${idx}">✕</button></span>
              `;
                row.querySelector(".label-remove-btn").onclick = (e) => {
                    e.stopPropagation();
                    card.labels.splice(idx, 1);
                    saveCardData();
                    renderLabels();
                    renderBoard();
                };
                labelListContainer.appendChild(row);
            });
        };

        // Random colors for labels
        const labelColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];

        if (addLabelBtn && labelNameInput) {
            const addLabel = () => {
                const name = labelNameInput.value.trim();
                if (!name) return;
                // Use cover color if available, otherwise random
                let labelColor;
                if (card.cover && card.cover.color) {
                    labelColor = card.cover.color;
                } else {
                    labelColor = labelColors[Math.floor(Math.random() * labelColors.length)];
                }
                card.labels.push({ name, color: labelColor });
                labelNameInput.value = "";
                saveCardData();
                renderLabels();
                renderBoard();
            };
            addLabelBtn.onclick = addLabel;
            labelNameInput.onkeydown = (e) => { if (e.key === "Enter") addLabel(); };
        }

        // --- Rich Text Toolbar Logic ---
        const toolbar = document.querySelector('.rich-text-toolbar');
        if (toolbar) {
            toolbar.querySelectorAll('.rt-btn[data-cmd]').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const cmd = btn.dataset.cmd;
                    document.execCommand(cmd, false, null);
                    descEditor.focus();
                };
            });

            // Insert checklist button (notes-style)
            const insertCheckboxBtn = document.getElementById('insertCheckboxBtn');
            if (insertCheckboxBtn) {
                insertCheckboxBtn.onclick = (e) => {
                    e.preventDefault();
                    // Use the same approach as notes: insertUnorderedList then add wb-checklist class
                    document.execCommand("insertUnorderedList", false, null);
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        let node = selection.anchorNode;
                        while (node && node !== descEditor) {
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
                    descEditor.focus();
                };
            }
        }

        // Handle checklist item clicks in description (like notes)
        // Use mousedown to catch before contenteditable steals focus
        descEditor.addEventListener('mousedown', (e) => {
            // Check if clicking on an LI inside wb-checklist
            let target = e.target;
            while (target && target !== descEditor) {
                if (target.tagName === 'LI') {
                    const ul = target.closest('.wb-checklist');
                    if (ul) {
                        const rect = target.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        // Click on checkbox area (left side - expanded to 50px for easier clicking)
                        // Or if clicking on the ::before pseudo-element area
                        if (x < 50) {
                            e.preventDefault();
                            e.stopPropagation();
                            target.classList.toggle('checked');
                            updateCardCompletion();
                            return;
                        }
                    }
                    break;
                }
                target = target.parentElement;
            }
        });

        // --- Update Card Completion Based on Checkboxes ---
        const updateCardCompletion = () => {
            const checklistItems = descEditor.querySelectorAll('.wb-checklist li');
            if (checklistItems.length === 0) return;

            const allChecked = Array.from(checklistItems).every(li => li.classList.contains('checked'));
            card.completed = allChecked;

            // Save the current state of the description with checked states
            card.description = descEditor.innerHTML;
            saveData(window.currentData);
        };

        // Handle checkbox changes in description
        descEditor.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                e.target.closest('.rt-checkbox')?.classList.toggle('checked', e.target.checked);
                updateCardCompletion();
            }
        });

        // --- Save & Close Function ---
        const saveCardData = () => {
            card.title = titleIn.value.trim();
            card.description = descEditor.innerHTML;

            // Start Date & End Date
            card.startDate = startDateIn.value;
            card.endDate = endDateIn.value;
            card.dueDate = card.endDate; // Keep dueDate for backwards compatibility

            // labels already mutated live
            saveData(window.currentData);
            // We only call renderBoard() on final close to avoid flickering
        };

        document.getElementById("saveCardBtn").onclick = () => {
            saveCardData();
            modal.classList.add("hidden");
            renderBoard(); // Refresh board to reflect title/label changes
        };
        document.getElementById("closeModalBtn").onclick = () => modal.classList.add("hidden");

        const archiveCardBtn = document.getElementById("archiveCardBtn");
        const permanentDeleteCardBtn = document.getElementById("permanentDeleteCardBtn");

        // Archive button handler
        if (archiveCardBtn) {
            archiveCardBtn.onclick = async () => {
                if (!window.currentProject.archive) window.currentProject.archive = { cards: [], lists: [] };
                if (await customConfirm(t('archiveCardConfirm'), { title: t('archive'), confirmText: t('archive') })) {
                    // Remove from its list
                    list.cards = list.cards.filter(c => c.id !== card.id);
                    // Push into archive with list reference
                    window.currentProject.archive.cards.push({
                        ...card,
                        listId: list.id
                    });
                    saveData(window.currentData);
                    modal.classList.add("hidden");
                    renderBoard();
                }
            };
        }

        // Permanent Delete button handler
        if (permanentDeleteCardBtn) {
            permanentDeleteCardBtn.onclick = async () => {
                if (await customConfirm(t('deleteCardConfirm'), { title: t('delete'), confirmText: t('delete'), danger: true })) {
                    // Remove from its list
                    list.cards = list.cards.filter(c => c.id !== card.id);
                    saveData(window.currentData);
                    modal.classList.add("hidden");
                    renderBoard();
                }
            };
        }

        // Call initial renders
        renderLabels();
    };

    // INIT WHITEBOARD
    if (window.initWhiteboard) {
        window.initWhiteboard();
    }

    // Wait for all resources (images, fonts, etc.) and ensure DOM is fully ready
    const hideLoadingOverlay = () => {
        const loadingOverlayEl = document.getElementById('projectLoadingOverlay');
        if (loadingOverlayEl) {
            loadingOverlayEl.classList.add('fade-out');
            setTimeout(() => loadingOverlayEl.remove(), 300);
        }
    };

    // Wait for all images to load
    const images = document.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve; // Still resolve on error to not block
        });
    });

    // Wait for document to be fully loaded (including stylesheets)
    if (document.readyState === 'complete') {
        Promise.all(imagePromises).then(() => {
            // Use requestAnimationFrame to ensure DOM is painted
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    hideLoadingOverlay();
                });
            });
        });
    } else {
        window.addEventListener('load', () => {
            Promise.all(imagePromises).then(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        hideLoadingOverlay();
                    });
                });
            });
        });
    }
}



// Create the Toast Element dynamically
const toast = document.createElement("div");
toast.style.cssText = `
  position: fixed; bottom: 30px; right: 30px;
  background: rgba(15, 23, 42, 0.9); color: white;
  padding: 10px 20px; border-radius: 8px;
  font-size: 0.85rem; font-weight: 500;
  transform: translateY(100px); opacity: 0;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  z-index: 9999; pointer-events: none;
  display: flex; align-items: center; gap: 8px;
`;
toast.innerHTML = `<span>💾</span> ${t('allChangesSaved')}`;
document.body.appendChild(toast);

// Listen for your existing custom event
window.addEventListener("trelloLite:dataSaved", () => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";

    // Hide after 2 seconds
    clearTimeout(window.saveToastTimer);
    window.saveToastTimer = setTimeout(() => {
        toast.style.transform = "translateY(100px)";
        toast.style.opacity = "0";
    }, 2000);
});

document.addEventListener("DOMContentLoaded", () => {
    const page = document.documentElement.dataset.page;
    if (page === "home") initHomePage();
    if (page === "project") initProjectPage();

    // Global Drag Protection for Inputs
    document.addEventListener("dragover", e => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
            e.preventDefault(); // Allow drop to happen so we can catch it
        }
    });
    document.addEventListener("drop", e => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
            e.preventDefault(); // Prevent default browser paste
        }
    });
});

// Initialize Rich Text Notes Editor when notes view is shown
document.addEventListener('DOMContentLoaded', () => {
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) {
        // Wait for initProjectPage to set window.currentProject
        const initEditor = () => {
            if (window.currentProject && typeof window.initNotesEditor === 'function') {
                window.initNotesEditor(notesContainer, window.currentProject, () => {
                    if (window.saveDataDebounced && window.currentData) {
                        window.saveDataDebounced(window.currentData);
                    }
                });
            } else {
                // Retry after a short delay if currentProject isn't ready yet
                setTimeout(initEditor, 100);
            }
        };
        // Start trying to initialize after a brief delay to let initProjectPage run
        setTimeout(initEditor, 200);
    }
});
