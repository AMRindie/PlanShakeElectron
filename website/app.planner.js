
function setupPlannerPanel() {
    const listEl = document.getElementById("plannerEntryList");
    if (!listEl || !window.currentProject) return;

    const entries = window.currentProject.planner.entries;
    listEl.innerHTML = "";

    // Sort entries by start date if available
    entries.sort((a, b) => {
        const dateA = a.startDate || a.dueDate || "9999-99-99";
        const dateB = b.startDate || b.dueDate || "9999-99-99";
        return dateA.localeCompare(dateB);
    });

    entries.forEach((e, index) => {
        const div = document.createElement("div");
        div.className = "planner-entry";
        div.dataset.priority = (e.priority || "Medium").toLowerCase();

        // Normalize: if old "status" field exists, convert to priority
        if (e.status && !e.priority) {
            e.priority = e.status === "Done" ? "Low" : e.status === "Next" ? "High" : "Medium";
            delete e.status;
        }
        if (!e.priority) e.priority = "Medium";

        let dateDisplay = "";
        if (e.startDate && e.dueDate) {
            dateDisplay = `${e.startDate} ➝ ${e.dueDate}`;
        } else if (e.dueDate) {
            dateDisplay = `Due: ${e.dueDate}`;
        } else if (e.startDate) {
            dateDisplay = `Starts: ${e.startDate}`;
        }

        const priorityClass = `priority-${e.priority.toLowerCase()}`;

        div.innerHTML = `
            <div class="planner-entry-header">
                <h4>${e.title}</h4>
                <div class="planner-entry-actions">
                    <span class="planner-entry__priority ${priorityClass}">${e.priority}</span>
                    <button class="icon-btn small edit-milestone-btn" data-index="${index}" title="Edit">✏️</button>
                    <button class="icon-btn small delete-milestone-btn" data-index="${index}" title="Delete">🗑️</button>
                </div>
            </div>
            ${e.notes ? `<p class="planner-entry-notes">${e.notes}</p>` : ''}
            ${dateDisplay ? `<div class="planner-entry-date">${dateDisplay}</div>` : ''}
        `;
        listEl.appendChild(div);
    });

    // Edit/Delete handlers
    listEl.querySelectorAll(".edit-milestone-btn").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            editMilestone(index);
        };
    });

    listEl.querySelectorAll(".delete-milestone-btn").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            if (confirm("Delete this milestone?")) {
                window.currentProject.planner.entries.splice(index, 1);
                saveData(window.currentData);
                setupPlannerPanel();
            }
        };
    });

    // Form Logic
    const form = document.getElementById("plannerEntryForm");
    if (form) {
        // Remove old listener to prevent duplicates if re-initialized
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.onsubmit = (e) => {
            e.preventDefault();
            const titleInput = document.getElementById("plannerEntryTitle");
            const notesInput = document.getElementById("plannerEntryNotes");
            const startInput = document.getElementById("plannerEntryStart");
            const dueInput = document.getElementById("plannerEntryDue");
            const priorityInput = document.getElementById("plannerEntryPriority");

            const title = titleInput.value.trim();
            if (!title) return;

            // Check if we're editing (via data attribute)
            const editIndex = newForm.dataset.editIndex;
            if (editIndex !== undefined && editIndex !== "") {
                // Update existing
                const idx = parseInt(editIndex);
                const entry = window.currentProject.planner.entries[idx];
                if (entry) {
                    entry.title = title;
                    entry.notes = notesInput.value.trim();
                    entry.startDate = startInput.value;
                    entry.dueDate = dueInput.value;
                    entry.priority = priorityInput.value || "Medium";
                }
                delete newForm.dataset.editIndex;
                newForm.querySelector("h3").textContent = "New Milestone";
                newForm.querySelector("button[type='submit']").textContent = "Add Milestone";
                document.getElementById("plannerClearLowBtn").textContent = "Clear Low Priority";
            } else {
                // Create new
                const newEntry = {
                    id: generateId("plan"),
                    title: title,
                    notes: notesInput.value.trim(),
                    startDate: startInput.value,
                    dueDate: dueInput.value,
                    priority: priorityInput.value || "Medium"
                };
                window.currentProject.planner.entries.push(newEntry);
            }

            // Clear form fields before re-rendering (for both cases)
            titleInput.value = "";
            notesInput.value = "";
            startInput.value = "";
            dueInput.value = "";
            priorityInput.value = "Medium";

            saveData(window.currentData);
            setupPlannerPanel();
        };
    }

    // Clear/Cancel Button
    const clearBtn = document.getElementById("plannerClearLowBtn");
    if (clearBtn) {
        const newBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newBtn, clearBtn);

        newBtn.onclick = () => {
            const form = document.getElementById("plannerEntryForm");

            // Check if we're in edit mode
            if (form && form.dataset.editIndex !== undefined && form.dataset.editIndex !== "") {
                // Cancel edit mode
                delete form.dataset.editIndex;
                form.reset();
                form.querySelector("h3").textContent = "New Milestone";
                form.querySelector("button[type='submit']").textContent = "Add Milestone";
                newBtn.textContent = "Clear Low Priority";
            } else {
                // Clear low priority items
                if (confirm("Remove all 'Low Priority' items?")) {
                    window.currentProject.planner.entries = window.currentProject.planner.entries.filter(e => e.priority !== "Low");
                    saveData(window.currentData);
                    setupPlannerPanel();
                }
            }
        };
    }
}

function editMilestone(index) {
    const entry = window.currentProject.planner.entries[index];
    if (!entry) return;

    // Ensure the milestone modal exists (in case we haven't visited Timeline yet)
    if (window.initMilestoneModal && !document.getElementById("milestoneEditModal")) {
        window.initMilestoneModal();
    }

    // If we have the calendar's editMilestone function, use it (opens the modal)
    if (window.editMilestoneModal) {
        window.editMilestoneModal(index);
        return;
    }

    // Fallback: use the form-based editing (old behavior)
    const form = document.getElementById("plannerEntryForm");
    const titleInput = document.getElementById("plannerEntryTitle");
    const notesInput = document.getElementById("plannerEntryNotes");
    const startInput = document.getElementById("plannerEntryStart");
    const dueInput = document.getElementById("plannerEntryDue");
    const priorityInput = document.getElementById("plannerEntryPriority");

    titleInput.value = entry.title || "";
    notesInput.value = entry.notes || "";
    startInput.value = entry.startDate || "";
    dueInput.value = entry.dueDate || "";
    priorityInput.value = entry.priority || "Medium";

    form.dataset.editIndex = index;
    form.querySelector("h3").textContent = "Edit Milestone";
    form.querySelector("button[type='submit']").textContent = "Save Changes";
    document.getElementById("plannerClearLowBtn").textContent = "Cancel Edit";

    // Scroll form into view
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Expose to window
window.setupPlannerPanel = setupPlannerPanel;
window.editMilestone = editMilestone;
