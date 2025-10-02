const allCourseDataText = document.getElementById('all-course-data').textContent;
window.ALL_COURSE_DATA = JSON.parse(allCourseDataText);

let currentView = "courses";
let selectedPath = { course: null, section: null, unit: null, task: null };
let questionDetail = null;

function getAllCourses() {
    return window.ALL_COURSE_DATA?.courses || [];
}

function getAllSections() {
    let out = [];
    for (const course of getAllCourses()) {
        for (const section of (course.sections || [])) {
            out.push({ ...section, parentCourse: course });
        }
    }
    return out;
}

function getAllUnits() {
    let out = [];
    for (const section of getAllSections()) {
        for (const unit of (section.units || [])) {
            out.push({ ...unit, parentSection: section, parentCourse: section.parentCourse });
        }
    }
    return out;
}

function getAllTasks() {
    let out = [];
    for (const unit of getAllUnits()) {
        for (const task of (unit.tasks || [])) {
            out.push({ ...task, parentUnit: unit, parentSection: unit.parentSection, parentCourse: unit.parentCourse });
        }
    }
    return out;
}

function getAllQuestions() {
    let out = [];
    for (const task of getAllTasks()) {
        for (const q of (task.questions || [])) {
            out.push({ ...q, parentTask: task, parentUnit: task.parentUnit, parentSection: task.parentSection, parentCourse: task.parentCourse });
        }
    }
    return out;
}

// Returns a filtered list based on current path
function getScoped(view) {
    switch (view) {
        case "courses":
            return getAllCourses();
        case "sections":
            if (selectedPath.course) {
                return (selectedPath.course.sections || []).map(s => ({ ...s, parentCourse: selectedPath.course }));
            }
            return getAllSections();
        case "units":
            if (selectedPath.section) {
                return (selectedPath.section.units || []).map(u => ({ ...u, parentSection: selectedPath.section, parentCourse: selectedPath.course }));
            }
            if (selectedPath.course) {
                let out = [];
                for (const section of (selectedPath.course.sections || [])) {
                    for (const unit of (section.units || [])) {
                        out.push({ ...unit, parentSection: section, parentCourse: selectedPath.course });
                    }
                }
                return out;
            }
            return getAllUnits();
        case "tasks":
            if (selectedPath.unit) {
                return (selectedPath.unit.tasks || []).map(t => ({
                    ...t, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course
                }));
            }
            if (selectedPath.section) {
                let out = [];
                for (const unit of (selectedPath.section.units || [])) {
                    for (const task of (unit.tasks || [])) {
                        out.push({ ...task, parentUnit: unit, parentSection: selectedPath.section, parentCourse: selectedPath.course });
                    }
                }
                return out;
            }
            if (selectedPath.course) {
                let out = [];
                for (const section of (selectedPath.course.sections || [])) {
                    for (const unit of (section.units || [])) {
                        for (const task of (unit.tasks || [])) {
                            out.push({ ...task, parentUnit: unit, parentSection: section, parentCourse: selectedPath.course });
                        }
                    }
                }
                return out;
            }
            return getAllTasks();
        case "questions":
            if (selectedPath.task) {
                return (selectedPath.task.questions || []).map(q => ({
                    ...q, parentTask: selectedPath.task, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course
                }));
            }
            if (selectedPath.unit) {
                let out = [];
                for (const task of (selectedPath.unit.tasks || [])) {
                    for (const q of (task.questions || [])) {
                        out.push({ ...q, parentTask: task, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course });
                    }
                }
                return out;
            }
            if (selectedPath.section) {
                let out = [];
                for (const unit of (selectedPath.section.units || [])) {
                    for (const task of (unit.tasks || [])) {
                        for (const q of (task.questions || [])) {
                            out.push({ ...q, parentTask: task, parentUnit: unit, parentSection: selectedPath.section, parentCourse: selectedPath.course });
                        }
                    }
                }
                return out;
            }
            if (selectedPath.course) {
                let out = [];
                for (const section of (selectedPath.course.sections || [])) {
                    for (const unit of (section.units || [])) {
                        for (const task of (unit.tasks || [])) {
                            for (const q of (task.questions || [])) {
                                out.push({ ...q, parentTask: task, parentUnit: unit, parentSection: section, parentCourse: selectedPath.course });
                            }
                        }
                    }
                }
                return out;
            }
            return getAllQuestions();
        default:
            return [];
    }
}

function autofillParents(item, view) {
    switch (view) {
        case "courses":
            selectedPath = { course: item, section: null, unit: null, task: null };
            break;
        case "sections":
            let parentCourse = null;
            for (const course of getAllCourses()) {
                if ((course.sections || []).some(sec => sec.uid === item.uid)) {
                    parentCourse = course; break;
                }
            }
            selectedPath = { course: parentCourse, section: item, unit: null, task: null };
            break;
        case "units":
            let foundSection = null;
            for (const section of getAllSections()) {
                if ((section.units || []).some(u => u.uid === item.uid)) {
                    foundSection = section; break;
                }
            }
            selectedPath = { course: foundSection.parentCourse, section: foundSection, unit: item, task: null };
            break;
        case "tasks":
            let foundUnit = null;
            for (const unit of getAllUnits()) {
                if ((unit.tasks || []).some(t => t.uid === item.uid)) {
                    foundUnit = unit; break;
                }
            }
            selectedPath = { course: foundUnit.parentCourse, section: foundUnit.parentSection, unit: foundUnit, task: item };
            break;
        case "questions":
            let foundTask = null;
            for (const task of getAllTasks()) {
                if ((task.questions || []).some(q => q.uid === item.uid)) {
                    foundTask = task; break;
                }
            }
            selectedPath = {
                course: foundTask.parentCourse,
                section: foundTask.parentSection,
                unit: foundTask.parentUnit,
                task: foundTask
            };
            break;
    }
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
    if (view === "questionDetail" && questionDetail) {
        renderQuestionDetail(questionDetail);
        return;
    }
    document.querySelectorAll('.browser-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        let v = btn.getAttribute('data-view');
        switch (v) {
            case "courses":
                if (selectedPath.course) {
                    btn.innerHTML = `<span>${selectedPath.course.name}</span> <button class="unselect-btn" data-unselect="course" title="Unselect">×</button>`;
                } else {
                    btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1)}</span>`;
                }
                break;
            case "sections":
                if (selectedPath.section) {
                    btn.innerHTML = `<span>${selectedPath.section.name}</span> <button class="unselect-btn" data-unselect="section" title="Unselect">×</button>`;
                } else {
                    btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1)}</span>`;
                }
                break;
            case "units":
                if (selectedPath.unit) {
                    btn.innerHTML = `<span>${selectedPath.unit.name}</span> <button class="unselect-btn" data-unselect="unit" title="Unselect">×</button>`;
                } else {
                    btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1)}</span>`;
                }
                break;
            case "tasks":
                if (selectedPath.task) {
                    btn.innerHTML = `<span>${selectedPath.task.name}</span> <button class="unselect-btn" data-unselect="task" title="Unselect">×</button>`;
                } else {
                    btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1)}</span>`;
                }
                break;
            default:
                btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1)}</span>`;
                break;
        }
    });
    attachUnselectListeners();
    updateSelectedPathDisplay();
    const area = document.getElementById('browserListArea');
    area.innerHTML = `<div class="browser-no-results">Loading...</div>`;
    let items = getScoped(view);
    if (filter) {
        items = items.filter(item => {
            const field = (item.name || item.prompt || item.text || "");
            return field.toLowerCase().includes(filter.toLowerCase());
        });
    }
    if (!items || items.length === 0) {
        area.innerHTML = `<div class="browser-no-results">No results found.</div>`;
        return;
    }
    let html = `<ul class="browser-list">`;
    items.forEach(item => {
        let display = view === "questions" ? (item.prompt || item.text) : item.name;
        html += `<li>
        <button class="browser-list-item" data-view="${view}" data-id="${item.uid ?? item.id}" tabindex="0">
          <span>${display}</span>
          <span class="item-number">${item.number || item.index || ""}</span>
        </button>
      </li>`;
    });
    html += `</ul>`;
    area.innerHTML = html;
    attachDropDownListeners(view, items);
}

function renderQuestionDetail(question) {
    const area = document.getElementById('browserListArea');
    let answers = [];
    try {
        answers = typeof question.answers === "string" ? JSON.parse(question.answers) : question.answers;
    } catch {
        answers = question.answers || [];
    }
    let correctIdx = (typeof question.correct_index !== "undefined" ? question.correct_index : question.correctIndex);
    let correctAns = question.correctAnswer || question.correct_answer;
    let html = `
    <div class="question-detail">
      <h3>Question Detail</h3>
      <div class="question-prompt">${question.prompt || question.text}</div>
      <div class="question-meta">
        <strong>AI Generated:</strong> ${question.ai ? "Yes" : "No"}
      </div>
      <div class="answer-list">
        <strong>Choices:</strong>
        <ul>
        ${answers.map((ans, idx) =>
        `<li style="${(correctIdx === idx || ans === correctAns) ? 'font-weight:bold; color:green;' : ''}">
                ${ans}${(correctIdx === idx || ans === correctAns) ? " <b>(Correct)</b>" : ""}
            </li>`
    ).join("")}
        </ul>
      </div>
      <button id="questionDetailBackBtn">Back</button>
    </div>
    `;
    area.innerHTML = html;
    document.getElementById('questionDetailBackBtn').onclick = () => {
        questionDetail = null;
        currentView = "questions";
        renderView(currentView);
    };
}

function attachDropDownListeners(view, items) {
    document.querySelectorAll('.browser-list-item').forEach(btn => {
        btn.addEventListener('click', function () {
            let id = this.getAttribute("data-id");
            let item = items.find(i => String(i.uid ?? i.id) === String(id));
            autofillParents(item, view);
            if (view === "courses") currentView = "sections";
            else if (view === "sections") currentView = "units";
            else if (view === "units") currentView = "tasks";
            else if (view === "tasks") currentView = "questions";
            else if (view === "questions") { questionDetail = item; currentView = "questionDetail"; }
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
            switch (which) {
                case "course":
                    selectedPath.course = selectedPath.section = selectedPath.unit = selectedPath.task = null;
                    currentView = "courses";
                    break;
                case "section":
                    selectedPath.section = selectedPath.unit = selectedPath.task = null;
                    currentView = "sections";
                    break;
                case "unit":
                    selectedPath.unit = selectedPath.task = null;
                    currentView = "units";
                    break;
                case "task":
                    selectedPath.task = null;
                    currentView = "tasks";
                    break;
            }
            renderView(currentView, document.getElementById('searchInput').value);
        });
    });
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