const exampleData = {
    courses: [
        {
            name: "Algebra 1", number: "101", id: "course1", sections: [
                {
                    name: "Section A", number: "1", id: "sectionA", units: [
                        {
                            name: "Unit 1: Equations", number: "1", id: "unit1", tasks: [
                                {
                                    name: "Task: Solve X", number: "A1", id: "taskX", questions: [
                                        { text: "What is 2+2?", number: "Q1", id: "q1", answer: "4" }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "Biology", number: "102", id: "course2", sections: [
                {
                    name: "Section B", number: "2", id: "sectionB", units: [
                        {
                            name: "Unit 2: Functions", number: "2", id: "unit2", tasks: [
                                {
                                    name: "Task: Graph Y", number: "B2", id: "taskY", questions: [
                                        { text: "Define mitosis.", number: "Q2", id: "q2", answer: "Mitosis is the process of cell division resulting in two identical daughter cells." }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

let currentView = "courses";
let selectedPath = { course: null, section: null, unit: null, task: null };
let searchMode = "name"; // For extensibility, only "name" for now

function getItems(view, filter = "") {
    let items = [];
    if (view === "courses") {
        items = exampleData.courses;
    } else if (view === "sections") {
        if (selectedPath.course) {
            items = selectedPath.course.sections || [];
        } else {
            items = [];
            exampleData.courses.forEach(course =>
                (course.sections || []).forEach(section => items.push({ ...section, parentCourse: course }))
            );
        }
    } else if (view === "units") {
        if (selectedPath.section) {
            items = selectedPath.section.units || [];
        } else if (selectedPath.course) {
            items = [];
            (selectedPath.course.sections || []).forEach(section =>
                (section.units || []).forEach(unit => items.push({ ...unit, parentSection: section, parentCourse: selectedPath.course }))
            );
        } else {
            items = [];
            exampleData.courses.forEach(course =>
                (course.sections || []).forEach(section =>
                    (section.units || []).forEach(unit => items.push({ ...unit, parentSection: section, parentCourse: course }))
                )
            );
        }
    } else if (view === "tasks") {
        if (selectedPath.unit) {
            items = selectedPath.unit.tasks || [];
        } else if (selectedPath.section) {
            items = [];
            (selectedPath.section.units || []).forEach(unit =>
                (unit.tasks || []).forEach(task => items.push({ ...task, parentUnit: unit, parentSection: selectedPath.section, parentCourse: selectedPath.course }))
            );
        } else if (selectedPath.course) {
            items = [];
            (selectedPath.course.sections || []).forEach(section =>
                (section.units || []).forEach(unit =>
                    (unit.tasks || []).forEach(task => items.push({ ...task, parentUnit: unit, parentSection: section, parentCourse: selectedPath.course }))
                )
            );
        } else {
            items = [];
            exampleData.courses.forEach(course =>
                (course.sections || []).forEach(section =>
                    (section.units || []).forEach(unit =>
                        (unit.tasks || []).forEach(task => items.push({ ...task, parentUnit: unit, parentSection: section, parentCourse: course }))
                    )
                )
            );
        }
    } else if (view === "questions") {
        if (selectedPath.task) {
            items = selectedPath.task.questions || [];
        } else if (selectedPath.unit) {
            items = [];
            (selectedPath.unit.tasks || []).forEach(task =>
                (task.questions || []).forEach(q => items.push({ ...q, parentTask: task, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course }))
            );
        } else if (selectedPath.section) {
            items = [];
            (selectedPath.section.units || []).forEach(unit =>
                (unit.tasks || []).forEach(task =>
                    (task.questions || []).forEach(q => items.push({ ...q, parentTask: task, parentUnit: unit, parentSection: selectedPath.section, parentCourse: selectedPath.course }))
                )
            );
        } else if (selectedPath.course) {
            items = [];
            (selectedPath.course.sections || []).forEach(section =>
                (section.units || []).forEach(unit =>
                    (unit.tasks || []).forEach(task =>
                        (task.questions || []).forEach(q => items.push({ ...q, parentTask: task, parentUnit: unit, parentSection: section, parentCourse: selectedPath.course }))
                    )
                )
            );
        } else {
            items = [];
            exampleData.courses.forEach(course =>
                (course.sections || []).forEach(section =>
                    (section.units || []).forEach(unit =>
                        (unit.tasks || []).forEach(task =>
                            (task.questions || []).forEach(q => items.push({ ...q, parentTask: task, parentUnit: unit, parentSection: section, parentCourse: course }))
                        )
                    )
                )
            );
        }
    }
    if (filter) {
        items = items.filter(item => {
            const field = (item.name || item.text || item.number || "");
            return field.toLowerCase().includes(filter.toLowerCase());
        });
    }
    return items;
}

function updateSelectedPathDisplay() {
    const pathEl = document.getElementById('browserSelectedPath');
    let arr = [];
    if (selectedPath.course) arr.push(selectedPath.course.name);
    if (selectedPath.section) arr.push(selectedPath.section.name);
    if (selectedPath.unit) arr.push(selectedPath.unit.name);
    if (selectedPath.task) arr.push(selectedPath.task.name);
    pathEl.innerHTML = arr.length ? arr.join(' &rsaquo; ') : "<span>No selection</span>";
}

function renderView(view, filter = "") {
    // Tabs
    document.querySelectorAll('.browser-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        // Minimalist: show name + unselect if selected
        let v = btn.getAttribute('data-view');
        if (v === "courses" && selectedPath.course)
            btn.innerHTML = `<span>${selectedPath.course.name}</span> <button class="unselect-btn" data-unselect="course" title="Unselect">×</button>`;
        else if (v === "sections" && selectedPath.section)
            btn.innerHTML = `<span>${selectedPath.section.name}</span> <button class="unselect-btn" data-unselect="section" title="Unselect">×</button>`;
        else if (v === "units" && selectedPath.unit)
            btn.innerHTML = `<span>${selectedPath.unit.name}</span> <button class="unselect-btn" data-unselect="unit" title="Unselect">×</button>`;
        else if (v === "tasks" && selectedPath.task)
            btn.innerHTML = `<span>${selectedPath.task.name}</span> <button class="unselect-btn" data-unselect="task" title="Unselect">×</button>`;
        else
            btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1)}</span>`;
    });
    attachUnselectListeners();

    // Selected path
    updateSelectedPathDisplay();

    // List
    const area = document.getElementById('browserListArea');
    let items = getItems(view, filter);

    if (items.length === 0) {
        area.innerHTML = `<div class="browser-no-results">No results found.</div>`;
        return;
    }
    let html = `<ul class="browser-list">`;
    items.forEach(item => {
        let display = view === "questions" ? item.text : item.name;
        html += `<li>
        <button class="browser-list-item" data-view="${view}" data-id="${item.id}" tabindex="0">
          <span>${display}</span>
          <span class="item-number">${item.number || ""}</span>
        </button>
        ${view === "questions" && item.answer ? `<div class="browser-answer"><strong>Answer:</strong> ${item.answer}</div>` : ""}
      </li>`;
    });
    html += `</ul>`;
    area.innerHTML = html;
    attachDropDownListeners(view);
}

function attachDropDownListeners(view) {
    document.querySelectorAll('.browser-list-item').forEach(btn => {
        btn.addEventListener('click', function () {
            let id = this.getAttribute("data-id");
            let item = getItems(view).find(i => i.id === id);

            // Select parent chain for any item
            if (view === "courses") {
                selectedPath.course = item;
                selectedPath.section = selectedPath.unit = selectedPath.task = null;
                currentView = "sections";
            } else if (view === "sections") {
                selectedPath.course = item.parentCourse || findCourseForSection(item);
                selectedPath.section = item;
                selectedPath.unit = selectedPath.task = null;
                currentView = "units";
            } else if (view === "units") {
                selectedPath.course = item.parentCourse || findCourseForSection(item.parentSection) || findCourseForUnit(item);
                selectedPath.section = item.parentSection || findSectionForUnit(item);
                selectedPath.unit = item;
                selectedPath.task = null;
                currentView = "tasks";
            } else if (view === "tasks") {
                selectedPath.course = item.parentCourse || findCourseForSection(item.parentSection) || findCourseForUnit(item.parentUnit) || findCourseForTask(item);
                selectedPath.section = item.parentSection || findSectionForUnit(item.parentUnit) || findSectionForTask(item);
                selectedPath.unit = item.parentUnit || findUnitForTask(item);
                selectedPath.task = item;
                currentView = "questions";
            } else if (view === "questions") {
                selectedPath.course = item.parentCourse || findCourseForSection(item.parentSection) || findCourseForUnit(item.parentUnit) || findCourseForTask(item.parentTask) || findCourseForQuestion(item);
                selectedPath.section = item.parentSection || findSectionForUnit(item.parentUnit) || findSectionForTask(item.parentTask) || findSectionForQuestion(item);
                selectedPath.unit = item.parentUnit || findUnitForTask(item.parentTask) || findUnitForQuestion(item);
                selectedPath.task = item.parentTask || findTaskForQuestion(item);
                currentView = "questions";
            }
            renderView(currentView, document.getElementById('searchInput').value);
        });
        btn.addEventListener('keydown', function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.click();
            }
        });
    });
}

function attachUnselectListeners() {
    document.querySelectorAll('.unselect-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            let which = btn.getAttribute('data-unselect');
            if (which === "course") {
                selectedPath.course = selectedPath.section = selectedPath.unit = selectedPath.task = null;
                currentView = "courses";
            } else if (which === "section") {
                selectedPath.section = selectedPath.unit = selectedPath.task = null;
                currentView = "sections";
            } else if (which === "unit") {
                selectedPath.unit = selectedPath.task = null;
                currentView = "units";
            } else if (which === "task") {
                selectedPath.task = null;
                currentView = "tasks";
            }
            renderView(currentView, document.getElementById('searchInput').value);
        });
    });
}

// Helpers for parent finding (same as before)
function findCourseForSection(section) {
    for (const c of exampleData.courses) if ((c.sections || []).some(s => s.id === section?.id)) return c; return null;
}
function findCourseForUnit(unit) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) if ((s.units || []).some(u => u.id === unit?.id)) return c; return null;
}
function findCourseForTask(task) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) if ((u.tasks || []).some(t => t.id === task?.id)) return c; return null;
}
function findCourseForQuestion(q) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) for (const t of (u.tasks || [])) if ((t.questions || []).some(qq => qq.id === q?.id)) return c; return null;
}
function findSectionForUnit(unit) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) if ((s.units || []).some(u => u.id === unit?.id)) return s; return null;
}
function findSectionForTask(task) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) if ((u.tasks || []).some(t => t.id === task?.id)) return s; return null;
}
function findSectionForQuestion(q) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) for (const t of (u.tasks || [])) if ((t.questions || []).some(qq => qq.id === q?.id)) return s; return null;
}
function findUnitForTask(task) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) if ((u.tasks || []).some(t => t.id === task?.id)) return u; return null;
}
function findUnitForQuestion(q) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) for (const t of (u.tasks || [])) if ((t.questions || []).some(qq => qq.id === q?.id)) return u; return null;
}
function findTaskForQuestion(q) {
    for (const c of exampleData.courses) for (const s of (c.sections || [])) for (const u of (s.units || [])) for (const t of (u.tasks || [])) if ((t.questions || []).some(qq => qq.id === q?.id)) return t; return null;
}

window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.browser-tab').forEach(btn => {
        btn.addEventListener('click', function () {
            let view = this.getAttribute('data-view');
            currentView = view;
            renderView(currentView, document.getElementById('searchInput').value);
        });
    });
    document.getElementById('searchBtn').addEventListener('click', function () {
        const filter = document.getElementById('searchInput').value;
        renderView(currentView, filter);
    });
    document.getElementById('searchInput').addEventListener('input', function () {
        renderView(currentView, this.value);
    });
    document.getElementById('searchInput').addEventListener('keydown', function (e) {
        if (e.key === "Escape") {
            this.value = "";
            renderView(currentView, "");
        }
    });
    renderView(currentView);
});