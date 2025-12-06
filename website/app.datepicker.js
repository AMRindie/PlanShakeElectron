// ============================================
// Custom Date Picker Component
// ============================================

const DatePicker = {
    overlay: null,
    currentInput: null,
    currentCallback: null,
    selectedDate: null,
    viewDate: null, // The month/year being displayed

    months: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'],
    daysShort: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],

    init() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.id = 'customDatePickerOverlay';
        this.overlay.className = 'date-picker-overlay hidden';
        this.overlay.innerHTML = `
            <div class="date-picker-popup">
                <div class="date-picker-header">
                    <button class="date-nav-btn prev-year" title="Previous Year">«</button>
                    <button class="date-nav-btn prev-month" title="Previous Month">‹</button>
                    <span class="date-picker-title"></span>
                    <button class="date-nav-btn next-month" title="Next Month">›</button>
                    <button class="date-nav-btn next-year" title="Next Year">»</button>
                </div>
                <div class="date-picker-weekdays"></div>
                <div class="date-picker-days"></div>
                <div class="date-picker-footer">
                    <button class="date-picker-btn today">Today</button>
                    <button class="date-picker-btn clear">Clear</button>
                    <button class="date-picker-btn cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.setupEvents();
        this.renderWeekdays();
    },

    setupEvents() {
        // Navigation
        this.overlay.querySelector('.prev-year').onclick = () => this.navigate(-12);
        this.overlay.querySelector('.prev-month').onclick = () => this.navigate(-1);
        this.overlay.querySelector('.next-month').onclick = () => this.navigate(1);
        this.overlay.querySelector('.next-year').onclick = () => this.navigate(12);

        // Footer buttons
        this.overlay.querySelector('.date-picker-btn.today').onclick = () => {
            this.selectDate(new Date());
            this.confirm();
        };

        this.overlay.querySelector('.date-picker-btn.clear').onclick = () => {
            this.selectedDate = null;
            if (this.currentInput) {
                this.currentInput.value = '';
                this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (this.currentCallback) {
                this.currentCallback(null);
            }
            this.hide();
        };

        this.overlay.querySelector('.date-picker-btn.cancel').onclick = () => this.hide();

        // Backdrop click
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) this.hide();
        };
    },

    renderWeekdays() {
        const container = this.overlay.querySelector('.date-picker-weekdays');
        container.innerHTML = this.daysShort.map(d =>
            `<div class="date-weekday">${d}</div>`
        ).join('');
    },

    renderCalendar() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();

        // Update title
        this.overlay.querySelector('.date-picker-title').textContent =
            `${this.months[month]} ${year}`;

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Today's date for comparison
        const today = new Date();
        const todayStr = this.formatDate(today);
        const selectedStr = this.selectedDate ? this.formatDate(this.selectedDate) : null;

        let html = '';

        // Previous month's trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="date-day other-month" data-date="${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
        }

        // Current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;
            let classes = 'date-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
        }

        // Next month's leading days
        const totalCells = firstDay + daysInMonth;
        const remainingCells = totalCells > 35 ? 42 - totalCells : 35 - totalCells;
        for (let day = 1; day <= remainingCells; day++) {
            html += `<div class="date-day other-month" data-date="${year}-${String(month + 2).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
        }

        const container = this.overlay.querySelector('.date-picker-days');
        container.innerHTML = html;

        // Add click handlers to days
        container.querySelectorAll('.date-day').forEach(dayEl => {
            dayEl.onclick = () => {
                const dateStr = dayEl.dataset.date;
                const [y, m, d] = dateStr.split('-').map(Number);
                this.selectDate(new Date(y, m - 1, d));
                this.confirm();
            };
        });
    },

    navigate(months) {
        this.viewDate.setMonth(this.viewDate.getMonth() + months);
        this.renderCalendar();
    },

    selectDate(date) {
        this.selectedDate = date;
        this.viewDate = new Date(date);
        this.renderCalendar();
    },

    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    confirm() {
        if (this.selectedDate && this.currentInput) {
            this.currentInput.value = this.formatDate(this.selectedDate);
            this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.currentInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (this.selectedDate && this.currentCallback) {
            this.currentCallback(this.formatDate(this.selectedDate));
        }
        this.hide();
    },

    show(inputEl, initialValue, callback) {
        this.init();
        this.currentInput = inputEl;
        this.currentCallback = callback;

        // Parse initial value or use today
        if (initialValue) {
            const [y, m, d] = initialValue.split('-').map(Number);
            this.selectedDate = new Date(y, m - 1, d);
        } else {
            this.selectedDate = null;
        }

        this.viewDate = this.selectedDate ? new Date(this.selectedDate) : new Date();

        this.renderCalendar();
        this.overlay.classList.remove('hidden');
    },

    hide() {
        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }
        this.currentInput = null;
        this.currentCallback = null;
    }
};

// Auto-attach to date inputs
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.type === 'date') {
            e.preventDefault();
            DatePicker.show(e.target, e.target.value);
        }
    }, true);
});

// Make globally accessible
window.DatePicker = DatePicker;
