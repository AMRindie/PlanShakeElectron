// app.calendar.js - Complete Timeline/Calendar Module
// Dual-view: Gantt View (horizontal timeline) + Apple-style Calendar View

// ============================================
// STATE MANAGEMENT
// ============================================

const CalendarState = {
    currentView: 'gantt', // 'gantt' | 'calendar'
    gantt: {
        dayWidth: 60,
        minDayWidth: 25,
        maxDayWidth: 200,
        zoomStep: 15
    },
    calendar: {
        currentDate: new Date(),
        viewMode: 'month'
    },
    minDate: null,
    maxDate: null
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function safeDate(input) {
    if (!input) return null;
    const d = new Date(input);
    return isValidDate(d) ? d : null;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function isSameDay(d1, d2) {
    if (!isValidDate(d1) || !isValidDate(d2)) return false;
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
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

// ============================================
// DATA GATHERING
// ============================================

function gatherCalendarData() {
    if (!window.currentProject) return { milestones: [], cards: [], minDate: null, maxDate: null };

    const milestones = window.currentProject.planner?.entries || [];
    const lists = window.currentProject.lists || [];
    const cards = [];

    lists.forEach(l => {
        l.cards.forEach(c => {
            if (c.dueDate || c.startDate) {
                cards.push({ ...c, listName: l.title, listId: l.id });
            }
        });
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let minDate = new Date(today);
    minDate.setFullYear(today.getFullYear() - 5);

    let maxDate = new Date(today);
    maxDate.setFullYear(today.getFullYear() + 5);

    const allDates = [];
    const collectDate = (val) => {
        const d = safeDate(val);
        if (d) allDates.push(d);
    };

    milestones.forEach(m => { collectDate(m.startDate); collectDate(m.dueDate); });
    cards.forEach(c => { collectDate(c.startDate); collectDate(c.dueDate); });

    if (allDates.length > 0) {
        const sorted = allDates.sort((a, b) => a - b);
        if (sorted[0] < minDate) minDate = new Date(sorted[0]);
        if (sorted[sorted.length - 1] > maxDate) maxDate = new Date(sorted[sorted.length - 1]);
    }

    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    CalendarState.minDate = minDate;
    CalendarState.maxDate = maxDate;

    return { milestones, cards, minDate, maxDate };
}

// ============================================
// MAIN SETUP FUNCTION
// ============================================

function setupCalendarView(options = {}) {
    const container = document.getElementById("calendarContainer");
    if (!container) return;

    if (!window.currentProject) {
        console.warn("setupCalendarView: No current project loaded.");
        return;
    }

    initMilestoneModal();

    if (CalendarState.currentView === 'gantt') {
        renderGanttView(container);
    } else {
        renderMonthCalendarView(container);
    }

    renderViewSwitcher(container);
}

// ============================================
// VIEW SWITCHER
// ============================================

function renderViewSwitcher(container) {
    const existing = document.querySelector('.timeline-view-switcher');
    if (existing) existing.remove();

    const switcher = document.createElement('div');
    switcher.className = 'timeline-view-switcher';
    switcher.innerHTML = `
        <button class="view-switch-btn ${CalendarState.currentView === 'gantt' ? 'active' : ''}" data-view="gantt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M3 12h12M3 18h6"/>
            </svg>
            <span>${t('gantt')}</span>
        </button>
        <button class="view-switch-btn ${CalendarState.currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <span>${t('timeline')}</span>
        </button>
    `;

    switcher.querySelectorAll('.view-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newView = btn.dataset.view;
            if (newView !== CalendarState.currentView) {
                CalendarState.currentView = newView;
                setupCalendarView();
            }
        });
    });

    const panelHeader = document.querySelector('#calendarView .panel-header');
    if (panelHeader) {
        panelHeader.appendChild(switcher);
    }
}

// ============================================
// GANTT VIEW
// ============================================

function renderGanttView(container) {
    const { milestones, cards, minDate, maxDate } = gatherCalendarData();
    const dayWidth = CalendarState.gantt.dayWidth;

    const oneDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((maxDate - minDate) / oneDay) + 1;
    const safeTotalDays = isNaN(totalDays) || totalDays < 1 ? 3650 : totalDays;
    const totalWidth = safeTotalDays * dayWidth;

    container.innerHTML = "";
    container.className = "calendar-container gantt-mode";

    // Scroll container
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "gantt-scroll-container";
    scrollContainer.id = "ganttScrollContainer";

    // Timeline wrapper
    const timelineWrapper = document.createElement("div");
    timelineWrapper.className = "timeline-wrapper";
    timelineWrapper.style.width = `${totalWidth}px`;

    // Background grid
    const bgLayer = document.createElement("div");
    bgLayer.className = "timeline-bg-layer";

    // Header
    const header = document.createElement("div");
    header.className = "timeline-header";
    const monthRow = document.createElement("div");
    monthRow.className = "header-month-row";
    const dayRow = document.createElement("div");
    dayRow.className = "header-day-row";

    let loopDate = new Date(minDate);
    let dayIndex = 0;
    const maxIterations = 5500;
    let iterations = 0;

    while (loopDate <= maxDate && iterations < maxIterations) {
        iterations++;
        const isWeekend = loopDate.getDay() === 0 || loopDate.getDay() === 6;
        const isFirstOfMonth = loopDate.getDate() === 1;

        const bgCell = document.createElement("div");
        bgCell.className = `timeline-bg-cell ${isWeekend ? 'weekend' : ''}`;
        bgCell.style.width = `${dayWidth}px`;
        bgCell.style.left = `${dayIndex * dayWidth}px`;
        bgLayer.appendChild(bgCell);

        const dayLabel = document.createElement("div");
        dayLabel.className = `header-day-cell ${isWeekend ? 'weekend-text' : ''}`;
        dayLabel.textContent = loopDate.getDate();
        dayLabel.style.width = `${dayWidth}px`;
        dayLabel.style.left = `${dayIndex * dayWidth}px`;
        dayRow.appendChild(dayLabel);

        if (isFirstOfMonth || dayIndex === 0) {
            const monthLabel = document.createElement("div");
            monthLabel.className = "header-month-label";
            monthLabel.textContent = loopDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
            monthLabel.style.left = `${dayIndex * dayWidth}px`;
            monthRow.appendChild(monthLabel);
        }

        loopDate.setDate(loopDate.getDate() + 1);
        dayIndex++;
    }

    header.appendChild(monthRow);
    header.appendChild(dayRow);
    timelineWrapper.appendChild(bgLayer);
    timelineWrapper.appendChild(header);

    // Today marker
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (now >= minDate && now <= maxDate) {
        const todayPos = getPixelPosition(now, minDate, dayWidth);
        const marker = document.createElement("div");
        marker.className = "today-marker";
        marker.style.left = `${todayPos + (dayWidth / 2)}px`;
        marker.innerHTML = `<div class="today-marker-label">${t('today')}</div>`;
        timelineWrapper.appendChild(marker);
    }

    // Content layer
    const contentLayer = document.createElement("div");
    contentLayer.className = "timeline-content-layer";

    const msTrack = renderMilestoneTrack(milestones, minDate, dayWidth);
    contentLayer.appendChild(msTrack);

    const cardsTrack = renderCardsTrack(cards, minDate, dayWidth);
    contentLayer.appendChild(cardsTrack);

    timelineWrapper.appendChild(contentLayer);
    scrollContainer.appendChild(timelineWrapper);
    container.appendChild(scrollContainer);

    // Render controls
    renderGanttControls(container);

    // Setup interactions
    setupGanttInteractions(scrollContainer);

    // Scroll to today on first render
    setTimeout(() => {
        const todayPos = getPixelPosition(new Date(), minDate, dayWidth);
        if (!isNaN(todayPos)) {
            scrollContainer.scrollTo({
                left: todayPos - (scrollContainer.clientWidth / 2),
                behavior: 'smooth'
            });
        }
    }, 100);
}

function renderGanttControls(container) {
    const existingControls = container.querySelector('.calendar-controls');
    if (existingControls) existingControls.remove();

    const controls = document.createElement("div");
    controls.className = "calendar-controls";

    const zoomPercent = Math.round((CalendarState.gantt.dayWidth / 60) * 100);

    controls.innerHTML = `
        <button class="cal-control-btn" id="ganttTodayBtn">📍 ${t('today')}</button>
        <button class="cal-control-btn icon-only" id="ganttZoomOutBtn" aria-label="Zoom out">−</button>
        <span id="ganttZoomLevel" class="zoom-level">${zoomPercent}%</span>
        <button class="cal-control-btn icon-only" id="ganttZoomInBtn" aria-label="Zoom in">+</button>
    `;

    container.appendChild(controls);

    // Event listeners
    document.getElementById('ganttTodayBtn').onclick = () => {
        const scrollContainer = document.getElementById('ganttScrollContainer');
        scrollToToday(scrollContainer);
    };

    document.getElementById('ganttZoomOutBtn').onclick = () => {
        zoomGantt(-CalendarState.gantt.zoomStep);
    };

    document.getElementById('ganttZoomInBtn').onclick = () => {
        zoomGantt(CalendarState.gantt.zoomStep);
    };
}

function setupGanttInteractions(scrollContainer) {
    // Keyboard shortcuts
    const handleKeydown = (e) => {
        if (!isGanttVisible()) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case '+':
            case '=':
                e.preventDefault();
                zoomGantt(CalendarState.gantt.zoomStep);
                break;
            case '-':
            case '_':
                e.preventDefault();
                zoomGantt(-CalendarState.gantt.zoomStep);
                break;
            case 't':
            case 'T':
                e.preventDefault();
                scrollToToday(scrollContainer);
                break;
            case 'ArrowLeft':
                scrollContainer.scrollLeft -= 100;
                break;
            case 'ArrowRight':
                scrollContainer.scrollLeft += 100;
                break;
        }
    };

    document.removeEventListener('keydown', window._ganttKeyHandler);
    window._ganttKeyHandler = handleKeydown;
    document.addEventListener('keydown', handleKeydown);

    // Mouse wheel zoom (Ctrl+Scroll)
    const handleWheel = (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? CalendarState.gantt.zoomStep : -CalendarState.gantt.zoomStep;

        // Get mouse position for zoom focus
        const rect = scrollContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        zoomGanttAtPoint(delta, mouseX);
    };

    scrollContainer.removeEventListener('wheel', window._ganttWheelHandler);
    window._ganttWheelHandler = handleWheel;
    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });

    // Touch pinch-to-zoom
    setupTouchZoom(scrollContainer);
}

// ============================================
// ZOOM FUNCTIONS - CORE LOGIC
// ============================================

function zoomGantt(delta) {
    // Zoom centered on the middle of the viewport
    const scrollContainer = document.getElementById('ganttScrollContainer');
    if (!scrollContainer) return;

    const centerX = scrollContainer.clientWidth / 2;
    zoomGanttAtPoint(delta, centerX);
}

function zoomGanttAtPoint(delta, pointX) {
    const scrollContainer = document.getElementById('ganttScrollContainer');
    if (!scrollContainer) return;

    const oldDayWidth = CalendarState.gantt.dayWidth;
    const newDayWidth = clamp(
        oldDayWidth + delta,
        CalendarState.gantt.minDayWidth,
        CalendarState.gantt.maxDayWidth
    );

    if (newDayWidth === oldDayWidth) return;

    // Calculate the "day index" (fractional) at the point
    // This is the key: we track position in days, not pixels
    const pointPixelInContent = scrollContainer.scrollLeft + pointX;
    const dayAtPoint = pointPixelInContent / oldDayWidth;

    // Update day width
    CalendarState.gantt.dayWidth = newDayWidth;

    // Re-render the gantt
    const container = document.getElementById("calendarContainer");
    renderGanttView(container);

    // Restore scroll so that the same day is at pointX
    const newScrollContainer = document.getElementById('ganttScrollContainer');
    if (newScrollContainer) {
        const newPixelForDay = dayAtPoint * newDayWidth;
        newScrollContainer.scrollLeft = newPixelForDay - pointX;
    }

    // Re-render controls with new zoom level
    renderGanttControls(container);
    setupGanttInteractions(newScrollContainer);

    // Re-add view switcher
    renderViewSwitcher(container);
}

function setupTouchZoom(scrollContainer) {
    let initialDistance = 0;
    let initialDayWidth = CalendarState.gantt.dayWidth;
    let centerX = 0;

    const getDistance = (touches) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    scrollContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches);
            initialDayWidth = CalendarState.gantt.dayWidth;
            const rect = scrollContainer.getBoundingClientRect();
            centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        }
    }, { passive: true });

    scrollContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches);
            const scale = currentDistance / initialDistance;
            const newDayWidth = clamp(
                initialDayWidth * scale,
                CalendarState.gantt.minDayWidth,
                CalendarState.gantt.maxDayWidth
            );

            if (Math.abs(newDayWidth - CalendarState.gantt.dayWidth) > 2) {
                const delta = newDayWidth - CalendarState.gantt.dayWidth;
                zoomGanttAtPoint(delta, centerX);
                initialDayWidth = CalendarState.gantt.dayWidth;
                initialDistance = currentDistance;
            }
        }
    }, { passive: false });
}

function scrollToToday(scrollContainer) {
    const minDate = CalendarState.minDate;
    const dayWidth = CalendarState.gantt.dayWidth;
    const todayPos = getPixelPosition(new Date(), minDate, dayWidth);
    scrollContainer.scrollTo({
        left: todayPos - (scrollContainer.clientWidth / 2),
        behavior: 'smooth'
    });
}

function isGanttVisible() {
    const view = document.getElementById('calendarView');
    return view && !view.classList.contains('hidden') && CalendarState.currentView === 'gantt';
}

// ============================================
// MILESTONE & CARD TRACKS
// ============================================

function renderMilestoneTrack(milestones, minDate, dayWidth) {
    const mappedItems = milestones.map((m, idx) => {
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
            start,
            end,
            left: getPixelPosition(start, minDate, dayWidth),
            width: Math.max(getPixelPosition(end, minDate, dayWidth) - getPixelPosition(start, minDate, dayWidth) - 4, 20)
        };
    });

    const layout = computeLayout(mappedItems);
    const ROW_HEIGHT = 50;

    const track = document.createElement("div");
    track.className = "timeline-track milestones-track";
    track.style.height = `${Math.max((layout.rowCount * ROW_HEIGHT) + 40, 80)}px`;

    layout.items.forEach(item => {
        const m = item.original;
        const bar = document.createElement("div");
        bar.className = "timeline-bar milestone-bar";
        if (m.priority) bar.classList.add(`bar-${m.priority.toLowerCase()}`);

        bar.style.left = `${item.left}px`;
        bar.style.width = `${item.width}px`;
        bar.style.top = `${item.row * ROW_HEIGHT}px`;

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

        track.appendChild(bar);
    });

    return track;
}

function renderCardsTrack(cards, minDate, dayWidth) {
    const mappedItems = cards.map(c => {
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

        return {
            original: c,
            start,
            end,
            left: getPixelPosition(start, minDate, dayWidth),
            width: Math.max(getPixelPosition(end, minDate, dayWidth) - getPixelPosition(start, minDate, dayWidth) - 4, 20)
        };
    });

    const layout = computeLayout(mappedItems);
    const ROW_HEIGHT = 46;

    const track = document.createElement("div");
    track.className = "timeline-track cards-track";
    track.style.height = `${Math.max((layout.rowCount * ROW_HEIGHT) + 40, 100)}px`;

    layout.items.forEach(item => {
        const c = item.original;
        const bar = document.createElement("div");
        bar.className = "timeline-bar card-bar";

        bar.style.left = `${item.left}px`;
        bar.style.width = `${item.width}px`;
        bar.style.top = `${item.row * ROW_HEIGHT}px`;

        let themeColor = null;
        if (c.cover?.type === 'color' && c.cover.color) {
            themeColor = c.cover.color;
        } else if (c.labels?.length > 0 && c.labels[0].color) {
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
        track.appendChild(bar);
    });

    return track;
}

// ============================================
// APPLE-STYLE CALENDAR VIEW
// ============================================

function renderMonthCalendarView(container) {
    const { milestones, cards } = gatherCalendarData();

    container.innerHTML = "";
    container.className = "calendar-container month-calendar-mode";

    const calendarWrapper = document.createElement("div");
    calendarWrapper.className = "month-calendar-wrapper";

    const header = document.createElement("div");
    header.className = "month-calendar-header";

    const currentDate = CalendarState.calendar.currentDate;
    const monthName = currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

    header.innerHTML = `
        <button class="month-nav-btn" data-dir="prev" aria-label="Previous month">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
            </svg>
        </button>
        <div class="month-calendar-title">
            <h3>${monthName}</h3>
            <button class="today-pill-btn">Today</button>
        </div>
        <button class="month-nav-btn" data-dir="next" aria-label="Next month">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </button>
    `;

    header.querySelector('[data-dir="prev"]').onclick = () => navigateMonth(-1);
    header.querySelector('[data-dir="next"]').onclick = () => navigateMonth(1);
    header.querySelector('.today-pill-btn').onclick = () => {
        CalendarState.calendar.currentDate = new Date();
        renderMonthCalendarView(container);
    };

    // Touch swipe
    let touchStartX = 0;
    calendarWrapper.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    calendarWrapper.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 50) {
            navigateMonth(diff > 0 ? -1 : 1);
        }
    }, { passive: true });

    // Weekday headers
    const weekdayHeader = document.createElement("div");
    weekdayHeader.className = "weekday-header";
    [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')].forEach(day => {
        const cell = document.createElement("div");
        cell.className = "weekday-cell";
        cell.textContent = day;
        weekdayHeader.appendChild(cell);
    });

    // Calendar grid
    const grid = document.createElement("div");
    grid.className = "month-calendar-grid";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();

    const eventMap = buildEventMap(milestones, cards, year, month);

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    const prevDays = prevMonth.getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = prevDays - i;
        grid.appendChild(createDayCell(day, true, false, [], year, month - 1));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const isToday = isSameDay(cellDate, today);
        const events = eventMap.get(day) || [];
        grid.appendChild(createDayCell(day, false, isToday, events, year, month));
    }

    // Next month padding
    const totalCells = firstDay + daysInMonth;
    const remaining = 42 - totalCells;
    for (let day = 1; day <= remaining; day++) {
        grid.appendChild(createDayCell(day, true, false, [], year, month + 1));
    }

    calendarWrapper.appendChild(header);
    calendarWrapper.appendChild(weekdayHeader);
    calendarWrapper.appendChild(grid);
    container.appendChild(calendarWrapper);
}

function createDayCell(day, isOtherMonth, isToday, events, year, month) {
    const cell = document.createElement("div");
    cell.className = "month-calendar-day";
    if (isOtherMonth) cell.classList.add("other-month");
    if (isToday) cell.classList.add("today");

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);

    if (events.length > 0) {
        const dotsContainer = document.createElement("div");
        dotsContainer.className = "event-dots";

        events.slice(0, 3).forEach(event => {
            const dot = document.createElement("span");
            dot.className = `event-dot ${event.type}`;
            if (event.color) dot.style.backgroundColor = event.color;
            dotsContainer.appendChild(dot);
        });

        if (events.length > 3) {
            const more = document.createElement("span");
            more.className = "event-dot more";
            more.textContent = `+${events.length - 3}`;
            dotsContainer.appendChild(more);
        }

        cell.appendChild(dotsContainer);
        cell.classList.add('has-events');
        cell.onclick = (e) => {
            e.stopPropagation();
            showDayPopover(cell, events, new Date(year, month, day));
        };
    }

    return cell;
}

function buildEventMap(milestones, cards, year, month) {
    const map = new Map();
    const daysInMonth = getDaysInMonth(year, month);

    const addEventToDay = (day, event) => {
        if (day < 1 || day > daysInMonth) return;
        if (!map.has(day)) map.set(day, []);
        const existing = map.get(day);
        if (!existing.some(e => e.title === event.title && e.type === event.type)) {
            existing.push(event);
        }
    };

    const addEventForRange = (startDate, endDate, event) => {
        const start = safeDate(startDate);
        const end = safeDate(endDate) || start;
        if (!start) return;

        const rangeStart = new Date(start);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(end);
        rangeEnd.setHours(0, 0, 0, 0);

        if (rangeEnd <= rangeStart) {
            if (rangeStart.getFullYear() === year && rangeStart.getMonth() === month) {
                addEventToDay(rangeStart.getDate(), event);
            }
            return;
        }

        const currentDay = new Date(rangeStart);
        while (currentDay <= rangeEnd) {
            if (currentDay.getFullYear() === year && currentDay.getMonth() === month) {
                addEventToDay(currentDay.getDate(), { ...event });
            }
            currentDay.setDate(currentDay.getDate() + 1);
        }
    };

    milestones.forEach(m => {
        const color = m.priority === 'High' ? '#ef4444' :
            m.priority === 'Medium' ? '#f97316' : '#3b82f6';
        addEventForRange(m.startDate || m.dueDate, m.dueDate || m.startDate, {
            type: 'milestone',
            title: m.title,
            color,
            data: m
        });
    });

    cards.forEach(c => {
        let color = '#94a3b8';
        if (c.cover?.type === 'color' && c.cover.color) {
            color = c.cover.color;
        } else if (c.labels?.length > 0 && c.labels[0].color) {
            color = c.labels[0].color;
        }

        let startDate = c.startDate || c.dueDate;
        let endDate = c.dueDate;

        if (c.duration && startDate) {
            const start = safeDate(startDate);
            if (start) {
                endDate = new Date(start);
                endDate.setDate(endDate.getDate() + parseInt(c.duration) - 1);
                endDate = endDate.toISOString().split('T')[0];
            }
        }

        addEventForRange(startDate, endDate, {
            type: 'card',
            title: c.title,
            color,
            data: c
        });
    });

    return map;
}

function showDayPopover(cell, events, date) {
    const existing = document.querySelector('.day-popover');
    if (existing) existing.remove();

    const popover = document.createElement("div");
    popover.className = "day-popover";

    const dateStr = date.toLocaleDateString('default', {
        weekday: 'short', month: 'short', day: 'numeric'
    });

    popover.innerHTML = `
        <div class="popover-header">
            <span class="popover-date">${dateStr}</span>
            <button class="popover-close">✕</button>
        </div>
        <div class="popover-events">
            ${events.map(e => `
                <div class="popover-event" data-type="${e.type}">
                    <span class="popover-event-dot" style="background-color: ${e.color}"></span>
                    <span class="popover-event-title">${e.title}</span>
                </div>
            `).join('')}
        </div>
    `;

    popover.querySelector('.popover-close').onclick = () => popover.remove();

    setTimeout(() => {
        document.addEventListener('click', function closePopover(e) {
            if (!popover.contains(e.target) && e.target !== cell) {
                popover.remove();
                document.removeEventListener('click', closePopover);
            }
        });
    }, 10);

    const rect = cell.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 8}px`;

    document.body.appendChild(popover);

    const popoverRect = popover.getBoundingClientRect();
    if (popoverRect.right > window.innerWidth) {
        popover.style.left = `${window.innerWidth - popoverRect.width - 16}px`;
    }
    if (popoverRect.bottom > window.innerHeight) {
        popover.style.top = `${rect.top - popoverRect.height - 8}px`;
    }
}

function navigateMonth(direction) {
    const current = CalendarState.calendar.currentDate;
    current.setMonth(current.getMonth() + direction);
    const container = document.getElementById("calendarContainer");
    renderMonthCalendarView(container);
}

// ============================================
// LAYOUT HELPERS
// ============================================

function computeLayout(items) {
    if (items.length === 0) return { items: [], rowCount: 0 };

    const validItems = items.filter(i => isValidDate(i.start) && isValidDate(i.end));
    validItems.sort((a, b) => a.start - b.start);

    const lanes = [];
    validItems.forEach(item => {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i] <= item.start.getTime()) {
                item.row = i;
                lanes[i] = item.end.getTime();
                placed = true;
                break;
            }
        }
        if (!placed) {
            item.row = lanes.length;
            lanes.push(item.end.getTime());
        }
    });

    return { items: validItems, rowCount: lanes.length };
}

function getPixelPosition(date, minDate, dayWidth) {
    if (!isValidDate(date) || !isValidDate(minDate)) return 0;
    const diffTime = date - minDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays * dayWidth;
}

// ============================================
// MILESTONE MODAL
// ============================================

function initMilestoneModal(forceRecreate = false) {
    const existing = document.getElementById("milestoneEditModal");
    if (existing) {
        if (forceRecreate) {
            existing.remove();
        } else {
            return;
        }
    }

    const modalHTML = `
    <div id="milestoneEditModal" class="modal hidden">
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>${t('editMilestone')}</h3>
                <button id="closeMilestoneModalBtn" class="icon-btn">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <label>${t('title')}</label>
                    <input id="msEditTitle" type="text" class="full-width" />
                </div>
                <div class="modal-section">
                    <label>${t('notes')}</label>
                    <textarea id="msEditNotes" rows="3" class="full-width"></textarea>
                </div>
                <div class="modal-grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="modal-section">
                        <label>${t('startDate')}</label>
                        <input id="msEditStart" type="date" class="full-width" />
                    </div>
                    <div class="modal-section">
                        <label>${t('endDate')}</label>
                        <input id="msEditEnd" type="date" class="full-width" />
                    </div>
                </div>
                <div class="modal-section">
                    <label>${t('status')}</label>
                    <select id="msEditPriority" class="full-width">
                        <option value="Low">${t('low')}</option>
                        <option value="Medium">${t('medium')}</option>
                        <option value="High">${t('high')}</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer" style="justify-content: space-between;">
                <button id="deleteMilestoneBtn" class="danger-btn outline">${t('delete')}</button>
                <div style="display:flex; gap:8px;">
                    <button id="cancelMilestoneBtn" class="secondary-btn">${t('cancel')}</button>
                    <button id="saveMilestoneBtn" class="primary-btn">${t('saveChanges')}</button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById("milestoneEditModal");
    const closeModal = () => modal.classList.add("hidden");
    document.getElementById("closeMilestoneModalBtn").onclick = closeModal;
    document.getElementById("cancelMilestoneBtn").onclick = closeModal;
    modal.querySelector(".modal-backdrop").onclick = closeModal;
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
        setupCalendarView();
    };

    document.getElementById("deleteMilestoneBtn").onclick = async () => {
        if (await customConfirm(t('deleteMilestoneConfirm'), { title: t('deleteMilestone'), confirmText: t('delete'), danger: true })) {
            window.currentProject.planner.entries.splice(index, 1);
            if (window.saveData && window.currentData) window.saveData(window.currentData);
            modal.classList.add("hidden");
            setupCalendarView();
        }
    };

    modal.classList.remove("hidden");
}

// ============================================
// EVENT LISTENERS
// ============================================

window.addEventListener("trelloLite:dataSaved", () => {
    const view = document.getElementById("calendarView");
    if (view && !view.classList.contains("hidden")) {
        setupCalendarView();
    }
});

// Re-init calendar when language changes
window.addEventListener("languageChanged", () => {
    initMilestoneModal(true); // Force recreate modal with new translations
    const view = document.getElementById("calendarView");
    if (view && !view.classList.contains("hidden")) {
        setupCalendarView();
    }
});

window.setupCalendarView = setupCalendarView;
window.initMilestoneModal = initMilestoneModal;
window.editMilestoneModal = openMilestoneModal;
window.editMilestone = openMilestoneModal;

// Initialize modal on page load so it's ready when needed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initMilestoneModal());
} else {
    initMilestoneModal();
}