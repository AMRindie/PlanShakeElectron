// app.calendar.js

// State for Zoom level
let currentDayWidth = 60; // Default zoom

// Helper to validate dates (fixes Chrome/NaN issues)
function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function safeDate(input) {
    if (!input) return null;
    const d = new Date(input);
    return isValidDate(d) ? d : null;
}

function setupCalendarView(preserveScrollDate = null) {
    const container = document.getElementById("calendarContainer");
    if (!container) return;

    if (!window.currentProject) {
        console.warn("setupCalendarView: No current project loaded.");
        return;
    }

    // Initialize the Milestone Modal (only runs once)
    initMilestoneModal();

    // 1. Gather Data & Preserve IDs for Editing
    const milestones = window.currentProject.planner.entries || [];
    const lists = window.currentProject.lists || [];
    let cards = [];

    lists.forEach(l => {
        l.cards.forEach(c => {
            if (c.dueDate || c.startDate) {
                cards.push({ ...c, listName: l.title, listId: l.id });
            }
        });
    });

    // --- CHANGE 1: REMOVED "EMPTY STATE" CHECK ---
    // The calendar will now always render the grid.

    // 2. Determine Date Range (5 Years Past / 5 Years Future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Default: 5 years back, 5 years forward
    let minDate = new Date(today);
    minDate.setFullYear(today.getFullYear() - 5);

    let maxDate = new Date(today);
    maxDate.setFullYear(today.getFullYear() + 5);

    // Collect Item Dates to ensure we don't cut off items outside the 5-year window
    const allItemDates = [];
    const collectDate = (val) => {
        const d = safeDate(val);
        if (d) allItemDates.push(d);
    };

    milestones.forEach(m => { collectDate(m.startDate); collectDate(m.dueDate); });
    cards.forEach(c => { collectDate(c.startDate); collectDate(c.dueDate); });

    // Expand range if items exist outside the 5-year default
    if (allItemDates.length > 0) {
        const sorted = allItemDates.sort((a, b) => a - b);
        const earliestItem = sorted[0];
        const latestItem = sorted[sorted.length - 1];

        if (earliestItem < minDate) minDate = new Date(earliestItem);
        if (latestItem > maxDate) maxDate = new Date(latestItem);
    }

    // Final padding just in case
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    // 3. Layout Constants
    const oneDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((maxDate - minDate) / oneDay) + 1;

    // Safety fallback
    const safeTotalDays = isNaN(totalDays) || totalDays < 1 ? 3650 : totalDays;
    const totalWidth = safeTotalDays * currentDayWidth;

    // Clear Container
    container.innerHTML = "";

    const timelineWrapper = document.createElement("div");
    timelineWrapper.className = "timeline-wrapper";
    timelineWrapper.style.width = `${totalWidth}px`;

    // --- RENDER GRID & HEADER ---
    const bgLayer = document.createElement("div");
    bgLayer.className = "timeline-bg-layer";
    const header = document.createElement("div");
    header.className = "timeline-header";
    const monthRow = document.createElement("div");
    monthRow.className = "header-month-row";
    const dayRow = document.createElement("div");
    dayRow.className = "header-day-row";

    let loopDate = new Date(minDate);
    let dayIndex = 0;

    // Safety Loop limit (approx 15 years max to prevent browser crash)
    const maxIterations = 5500;
    let iterations = 0;

    while (loopDate <= maxDate && iterations < maxIterations) {
        iterations++;
        const isWeekend = loopDate.getDay() === 0 || loopDate.getDay() === 6;
        const isFirstOfMonth = loopDate.getDate() === 1;

        // BG Cell
        const bgCell = document.createElement("div");
        bgCell.className = `timeline-bg-cell ${isWeekend ? 'weekend' : ''}`;
        bgCell.style.width = `${currentDayWidth}px`;
        bgCell.style.left = `${dayIndex * currentDayWidth}px`;
        bgLayer.appendChild(bgCell);

        // Day Header
        const dayLabel = document.createElement("div");
        dayLabel.className = `header-day-cell ${isWeekend ? 'weekend-text' : ''}`;
        dayLabel.textContent = loopDate.getDate();
        dayLabel.style.width = `${currentDayWidth}px`;
        dayLabel.style.left = `${dayIndex * currentDayWidth}px`;
        dayRow.appendChild(dayLabel);

        // Month Header
        if (isFirstOfMonth || dayIndex === 0) {
            const monthLabel = document.createElement("div");
            monthLabel.className = "header-month-label";
            monthLabel.textContent = loopDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
            monthLabel.style.left = `${dayIndex * currentDayWidth}px`;
            monthRow.appendChild(monthLabel);
        }

        loopDate.setDate(loopDate.getDate() + 1);
        dayIndex++;
    }

    header.appendChild(monthRow);
    header.appendChild(dayRow);
    timelineWrapper.appendChild(bgLayer);
    timelineWrapper.appendChild(header);

    // Today Marker
    const nowMarker = new Date();
    nowMarker.setHours(0, 0, 0, 0);
    if (nowMarker >= minDate && nowMarker <= maxDate) {
        const todayPos = getPosition(nowMarker, minDate, currentDayWidth);
        const marker = document.createElement("div");
        marker.className = "today-marker";
        marker.style.left = `${todayPos + (currentDayWidth / 2)}px`;
        marker.innerHTML = `<div class="today-marker-label">Today</div>`;
        timelineWrapper.appendChild(marker);
    }

    const contentLayer = document.createElement("div");
    contentLayer.className = "timeline-content-layer";

    // --- MILESTONES ---
    const mappedMilestones = milestones.map((m, idx) => {
        let start = safeDate(m.startDate) || safeDate(m.dueDate) || new Date();
        let end = safeDate(m.dueDate) || safeDate(m.startDate) || new Date();

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (end <= start) {
            end = new Date(start);
            end.setDate(end.getDate() + 1);
        } else {
            end.setDate(end.getDate() + 1);
        }

        return {
            original: m,
            originalIndex: idx,
            start: start,
            end: end,
            left: getPosition(start, minDate, currentDayWidth),
            width: Math.max(getPosition(end, minDate, currentDayWidth) - getPosition(start, minDate, currentDayWidth) - 4, 20)
        };
    });

    const msLayout = computeLayout(mappedMilestones);
    const MS_ROW_HEIGHT = 50;

    const milestoneTrack = document.createElement("div");
    milestoneTrack.className = "timeline-track milestones-track";
    // Ensure minimum height even if empty so it looks good
    milestoneTrack.style.height = `${Math.max((msLayout.rowCount * MS_ROW_HEIGHT) + 40, 80)}px`;

    msLayout.items.forEach(item => {
        const m = item.original;
        const bar = document.createElement("div");
        bar.className = "timeline-bar milestone-bar";
        if (m.priority) bar.classList.add(`bar-${m.priority.toLowerCase()}`);

        bar.style.left = `${item.left}px`;
        bar.style.width = `${item.width}px`;
        bar.style.top = `${item.row * MS_ROW_HEIGHT}px`;

        bar.onclick = (e) => {
            e.stopPropagation();
            openMilestoneModal(item.originalIndex);
        };

        const dateText = formatDateRange(item.start, item.end);

        bar.innerHTML = `
            <div class="bar-content">
                <span class="bar-title">${m.title}</span>
                <span class="bar-dates">${dateText}</span>
            </div>
            <div class="bar-tooltip">
                <strong>${m.title}</strong><br>
                ${dateText}
                ${m.notes ? `<br><span style="opacity:0.7; font-style:italic">${m.notes.substring(0, 60)}${m.notes.length > 60 ? '...' : ''}</span>` : ''}
            </div>
        `;

        milestoneTrack.appendChild(bar);
    });

    // --- CARDS ---
    const mappedCards = cards.map(c => {
        let start = safeDate(c.startDate) || safeDate(c.dueDate) || new Date();
        let end;

        if (c.duration) {
            end = new Date(start);
            end.setDate(end.getDate() + parseInt(c.duration));
        } else if (safeDate(c.dueDate)) {
            end = safeDate(c.dueDate);
            end.setDate(end.getDate() + 1);
        } else {
            end = new Date(start);
            end.setDate(end.getDate() + 1);
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (end <= start) {
            end = new Date(start);
            end.setDate(end.getDate() + 1);
        }

        const leftPos = getPosition(start, minDate, currentDayWidth);
        const endPos = getPosition(end, minDate, currentDayWidth);
        const width = Math.max(endPos - leftPos - 4, 20);

        return {
            original: c,
            start: start,
            end: end,
            left: leftPos,
            width: width
        };
    });

    const cardLayout = computeLayout(mappedCards);
    const CARD_ROW_HEIGHT = 46;

    const cardsTrack = document.createElement("div");
    cardsTrack.className = "timeline-track cards-track";
    // Ensure minimum height
    cardsTrack.style.height = `${Math.max((cardLayout.rowCount * CARD_ROW_HEIGHT) + 40, 100)}px`;

    cardLayout.items.forEach(item => {
        const c = item.original;
        const bar = document.createElement("div");
        bar.className = "timeline-bar card-bar";

        bar.style.left = `${item.left}px`;
        bar.style.width = `${item.width}px`;
        bar.style.top = `${item.row * CARD_ROW_HEIGHT}px`;

        let themeColor = null;
        if (c.cover && c.cover.type === 'color' && c.cover.color) {
            themeColor = c.cover.color;
        } else if (c.labels && c.labels.length > 0 && c.labels[0].color) {
            themeColor = c.labels[0].color;
        }

        if (themeColor) {
            bar.style.setProperty('--bar-color', themeColor);
            bar.style.setProperty('--bar-color-faint', `${themeColor}15`);
        }

        bar.onclick = (e) => {
            e.stopPropagation();
            if (window.openCardModal) {
                window.openCardModal(c.listId, c.id);
            }
        };

        const dateStr = item.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        bar.innerHTML = `
            <div class="bar-content">
                <div style="display:flex; align-items:center; gap:4px;">
                     <span class="card-bar-icon">📄</span>
                     <span class="bar-title">${c.title}</span>
                </div>
                <span class="bar-dates">${dateStr}</span>
            </div>
            <div class="bar-tooltip">
                <strong>${c.title}</strong><br>
                ${dateStr}<br>
                <span style="opacity:0.7">${c.listName}</span>
            </div>
        `;
        cardsTrack.appendChild(bar);
    });

    contentLayer.appendChild(milestoneTrack);
    contentLayer.appendChild(cardsTrack);
    timelineWrapper.appendChild(contentLayer);
    container.appendChild(timelineWrapper);

    renderControls(container, minDate);

    // RESTORE SCROLL POSITION (Center on Today)
    if (preserveScrollDate && isValidDate(preserveScrollDate)) {
        const pos = getPosition(preserveScrollDate, minDate, currentDayWidth);
        container.scrollLeft = pos - (container.clientWidth / 2);
    } else {
        setTimeout(() => {
            const todayPos = getPosition(new Date(), minDate, currentDayWidth);
            if (!isNaN(todayPos)) {
                container.scrollTo({
                    left: todayPos - (container.clientWidth / 2),
                    behavior: 'smooth'
                });
            }
        }, 100);
    }
}

// === CONTROLS & UTILS ===

function renderControls(container, minDate) {
    const controls = document.createElement("div");
    controls.className = "calendar-controls";

    const todayBtn = document.createElement("button");
    todayBtn.className = "cal-control-btn";
    todayBtn.innerHTML = "📍 Today";
    todayBtn.onclick = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pos = getPosition(today, minDate, currentDayWidth);
        container.scrollTo({ left: pos - (container.clientWidth / 2), behavior: 'smooth' });
    };

    const getCenterDate = () => {
        const centerPixel = container.scrollLeft + (container.clientWidth / 2);
        const daysFromStart = centerPixel / currentDayWidth;
        const centerTime = minDate.getTime() + (daysFromStart * 24 * 60 * 60 * 1000);
        return new Date(centerTime);
    };

    const zoomOut = document.createElement("button");
    zoomOut.className = "cal-control-btn icon-only";
    zoomOut.innerHTML = "−";
    zoomOut.onclick = () => {
        if (currentDayWidth > 30) {
            const centerDate = getCenterDate();
            currentDayWidth -= 15;
            setupCalendarView(centerDate);
        }
    };

    const zoomIn = document.createElement("button");
    zoomIn.className = "cal-control-btn icon-only";
    zoomIn.innerHTML = "+";
    zoomIn.onclick = () => {
        if (currentDayWidth < 200) {
            const centerDate = getCenterDate();
            currentDayWidth += 15;
            setupCalendarView(centerDate);
        }
    };

    controls.appendChild(todayBtn);
    controls.appendChild(zoomOut);
    controls.appendChild(zoomIn);
    container.appendChild(controls);
}

function initMilestoneModal() {
    if (document.getElementById("milestoneEditModal")) return;
    const modalHTML = `
    <div id="milestoneEditModal" class="modal hidden">
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header"><h3>Edit Milestone</h3><button id="closeMilestoneModalBtn" class="icon-btn">✕</button></div>
            <div class="modal-body">
                <div class="modal-section"><label>Title</label><input id="msEditTitle" type="text" class="full-width" /></div>
                <div class="modal-section"><label>Notes</label><textarea id="msEditNotes" rows="3" class="full-width"></textarea></div>
                <div class="modal-grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="modal-section"><label>Start Date</label><input id="msEditStart" type="date" class="full-width" /></div>
                    <div class="modal-section"><label>End Date</label><input id="msEditEnd" type="date" class="full-width" /></div>
                </div>
                <div class="modal-section"><label>Priority</label><select id="msEditPriority" class="full-width"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
            </div>
            <div class="modal-footer" style="justify-content: space-between;">
                <button id="deleteMilestoneBtn" class="danger-btn outline">Delete</button>
                <div style="display:flex; gap:8px;"><button id="cancelMilestoneBtn" class="secondary-btn">Cancel</button><button id="saveMilestoneBtn" class="primary-btn">Save Changes</button></div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById("milestoneEditModal");
    const closeBtn = document.getElementById("closeMilestoneModalBtn");
    const cancelBtn = document.getElementById("cancelMilestoneBtn");
    const backdrop = modal.querySelector(".modal-backdrop");
    const closeModal = () => modal.classList.add("hidden");
    closeBtn.onclick = closeModal; cancelBtn.onclick = closeModal; backdrop.onclick = closeModal;
}

function openMilestoneModal(index) {
    const modal = document.getElementById("milestoneEditModal");
    const entry = window.currentProject.planner.entries[index];
    if (!entry || !modal) return;
    document.getElementById("msEditTitle").value = entry.title || "";
    document.getElementById("msEditNotes").value = entry.notes || "";
    document.getElementById("msEditStart").value = entry.startDate || "";
    document.getElementById("msEditEnd").value = entry.dueDate || "";
    document.getElementById("msEditPriority").value = entry.priority || "Medium";

    document.getElementById("saveMilestoneBtn").onclick = () => {
        entry.title = document.getElementById("msEditTitle").value;
        entry.notes = document.getElementById("msEditNotes").value;
        entry.startDate = document.getElementById("msEditStart").value;
        entry.dueDate = document.getElementById("msEditEnd").value;
        entry.priority = document.getElementById("msEditPriority").value;
        if (window.saveData && window.currentData) window.saveData(window.currentData);
        modal.classList.add("hidden");
    };
    document.getElementById("deleteMilestoneBtn").onclick = () => {
        if (confirm("Delete this milestone?")) {
            window.currentProject.planner.entries.splice(index, 1);
            if (window.saveData && window.currentData) window.saveData(window.currentData);
            modal.classList.add("hidden");
        }
    };
    modal.classList.remove("hidden");
}

function computeLayout(items) {
    if (items.length === 0) return { items: [], rowCount: 0 };
    const validItems = items.filter(i => isValidDate(i.start) && isValidDate(i.end));

    validItems.sort((a, b) => a.start - b.start);
    const lanes = [];
    validItems.forEach(item => {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i] <= item.start.getTime()) {
                item.row = i; lanes[i] = item.end.getTime(); placed = true; break;
            }
        }
        if (!placed) { item.row = lanes.length; lanes.push(item.end.getTime()); }
    });
    return { items: validItems, rowCount: lanes.length };
}

function getPosition(date, minDate, dayWidth) {
    if (!isValidDate(date) || !isValidDate(minDate)) return 0;
    const diffTime = date - minDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays * dayWidth;
}

function formatDateRange(d1, d2) {
    if (!isValidDate(d1)) return "Unscheduled";
    const opts = { month: 'short', day: 'numeric' };
    const diff = d2.getTime() - d1.getTime();
    const oneDay = 1000 * 60 * 60 * 24;

    if (diff <= oneDay + 1000) return d1.toLocaleDateString(undefined, opts);

    const displayEnd = new Date(d2);
    displayEnd.setDate(displayEnd.getDate() - 1);

    if (displayEnd < d1) return d1.toLocaleDateString(undefined, opts);
    return `${d1.toLocaleDateString(undefined, opts)} - ${displayEnd.toLocaleDateString(undefined, opts)}`;
}

window.addEventListener("trelloLite:dataSaved", () => {
    const view = document.getElementById("calendarView");
    if (view && !view.classList.contains("hidden")) setupCalendarView();
});

window.setupCalendarView = setupCalendarView;
window.editMilestone = openMilestoneModal;