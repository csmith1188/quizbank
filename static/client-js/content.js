let currentView = "courses";
let selectedPath = { course: null, section: null, unit: null, task: null };
let questionDetail = null; // holds currently opened question for detail view

function buildResourcePath(view, obj) {
    if (view === "courses") return "course";
    if (view === "sections") return `course/${obj.course.uid}/section`;
    if (view === "units") return `course/${obj.course.uid}/section/${obj.section.uid}/unit`;
    if (view === "tasks") return `course/${obj.course.uid}/section/${obj.section.uid}/unit/${obj.unit.uid}/task`;
    if (view === "questions") return `course/${obj.course.uid}/section/${obj.section.uid}/unit/${obj.unit.uid}/task/${obj.task.uid}/question`;
    return "course";
}

async function fetchResource(view, obj) {
    const path = buildResourcePath(view, obj);
    const res = await fetch(`/api/resource/${path}`);
    if (!res.ok) throw new Error("Failed to load content");
    return await res.json();
}

async function getAll(view) {
    if (view === "courses") {
        const data = await fetchResource("courses", {});
        return (data.courses || data);
    }
    if (view === "sections") {
        const courses = await getAll("courses");
        let out = [];
        for (const course of courses) {
            const sectionsData = await fetchResource("sections", { course });
            for (const section of (sectionsData.sections || sectionsData)) {
                out.push({ ...section, parentCourse: course });
            }
        }
        return out;
    }
    if (view === "units") {
        const sections = await getAll("sections");
        let out = [];
        for (const section of sections) {
            const unitsData = await fetchResource("units", { course: section.parentCourse, section });
            for (const unit of (unitsData.units || unitsData)) {
                out.push({ ...unit, parentSection: section, parentCourse: section.parentCourse });
            }
        }
        return out;
    }
    if (view === "tasks") {
        const units = await getAll("units");
        let out = [];
        for (const unit of units) {
            const tasksData = await fetchResource("tasks", { course: unit.parentCourse, section: unit.parentSection, unit });
            for (const task of (tasksData.tasks || tasksData)) {
                out.push({ ...task, parentUnit: unit, parentSection: unit.parentSection, parentCourse: unit.parentCourse });
            }
        }
        return out;
    }
    if (view === "questions") {
        const tasks = await getAll("tasks");
        let out = [];
        for (const task of tasks) {
            const questionsData = await fetchResource("questions", { 
                course: task.parentCourse, section: task.parentSection, unit: task.parentUnit, task 
            });
            for (const q of (questionsData.questions || questionsData)) {
                out.push({ ...q, parentTask: task, parentUnit: task.parentUnit, parentSection: task.parentSection, parentCourse: task.parentCourse });
            }
        }
        return out;
    }
    return [];
}

async function getScoped(view) {
    if (view === "courses") {
        const data = await fetchResource("courses", {});
        return (data.courses || data);
    }
    if (view === "sections") {
        if (selectedPath.course) {
            const data = await fetchResource("sections", { course: selectedPath.course });
            return (data.sections || data).map(s => ({ ...s, parentCourse: selectedPath.course }));
        }
        return await getAll("sections");
    }
    if (view === "units") {
        if (selectedPath.section) {
            const data = await fetchResource("units", { course: selectedPath.course, section: selectedPath.section });
            return (data.units || data).map(u => ({ ...u, parentSection: selectedPath.section, parentCourse: selectedPath.course }));
        }
        if (selectedPath.course) {
            let out = [];
            const sectionsData = await fetchResource("sections", { course: selectedPath.course });
            for (const section of (sectionsData.sections || sectionsData)) {
                const unitsData = await fetchResource("units", { course: selectedPath.course, section });
                for (const unit of (unitsData.units || unitsData)) {
                    out.push({ ...unit, parentSection: section, parentCourse: selectedPath.course });
                }
            }
            return out;
        }
        return await getAll("units");
    }
    if (view === "tasks") {
        if (selectedPath.unit) {
            const tasksData = await fetchResource("tasks", { 
                course: selectedPath.course, section: selectedPath.section, unit: selectedPath.unit 
            });
            return (tasksData.tasks || tasksData).map(t => ({ ...t, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course }));
        }
        if (selectedPath.section) {
            let out = [];
            const unitsData = await fetchResource("units", { course: selectedPath.course, section: selectedPath.section });
            for (const unit of (unitsData.units || unitsData)) {
                const tasksData = await fetchResource("tasks", { course: selectedPath.course, section: selectedPath.section, unit });
                for (const task of (tasksData.tasks || tasksData)) {
                    out.push({ ...task, parentUnit: unit, parentSection: selectedPath.section, parentCourse: selectedPath.course });
                }
            }
            return out;
        }
        if (selectedPath.course) {
            let out = [];
            const sectionsData = await fetchResource("sections", { course: selectedPath.course });
            for (const section of (sectionsData.sections || sectionsData)) {
                const unitsData = await fetchResource("units", { course: selectedPath.course, section });
                for (const unit of (unitsData.units || unitsData)) {
                    const tasksData = await fetchResource("tasks", { course: selectedPath.course, section, unit });
                    for (const task of (tasksData.tasks || tasksData)) {
                        out.push({ ...task, parentUnit: unit, parentSection: section, parentCourse: selectedPath.course });
                    }
                }
            }
            return out;
        }
        return await getAll("tasks");
    }
    if (view === "questions") {
        if (selectedPath.task) {
            const questionsData = await fetchResource("questions", { 
                course: selectedPath.course, section: selectedPath.section, unit: selectedPath.unit, task: selectedPath.task 
            });
            return (questionsData.questions || questionsData).map(q => ({ ...q, parentTask: selectedPath.task, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course }));
        }
        if (selectedPath.unit) {
            let out = [];
            const tasksData = await fetchResource("tasks", { course: selectedPath.course, section: selectedPath.section, unit: selectedPath.unit });
            for (const task of (tasksData.tasks || tasksData)) {
                const questionsData = await fetchResource("questions", { 
                    course: selectedPath.course, section: selectedPath.section, unit: selectedPath.unit, task 
                });
                for (const q of (questionsData.questions || questionsData)) {
                    out.push({ ...q, parentTask: task, parentUnit: selectedPath.unit, parentSection: selectedPath.section, parentCourse: selectedPath.course });
                }
            }
            return out;
        }
        if (selectedPath.section) {
            let out = [];
            const unitsData = await fetchResource("units", { course: selectedPath.course, section: selectedPath.section });
            for (const unit of (unitsData.units || unitsData)) {
                const tasksData = await fetchResource("tasks", { course: selectedPath.course, section: selectedPath.section, unit });
                for (const task of (tasksData.tasks || tasksData)) {
                    const questionsData = await fetchResource("questions", { 
                        course: selectedPath.course, section: selectedPath.section, unit, task 
                    });
                    for (const q of (questionsData.questions || questionsData)) {
                        out.push({ ...q, parentTask: task, parentUnit: unit, parentSection: selectedPath.section, parentCourse: selectedPath.course });
                    }
                }
            }
            return out;
        }
        if (selectedPath.course) {
            let out = [];
            const sectionsData = await fetchResource("sections", { course: selectedPath.course });
            for (const section of (sectionsData.sections || sectionsData)) {
                const unitsData = await fetchResource("units", { course: selectedPath.course, section });
                for (const unit of (unitsData.units || unitsData)) {
                    const tasksData = await fetchResource("tasks", { course: selectedPath.course, section, unit });
                    for (const task of (tasksData.tasks || tasksData)) {
                        const questionsData = await fetchResource("questions", { course: selectedPath.course, section, unit, task });
                        for (const q of (questionsData.questions || questionsData)) {
                            out.push({ ...q, parentTask: task, parentUnit: unit, parentSection: section, parentCourse: selectedPath.course });
                        }
                    }
                }
            }
            return out;
        }
        return await getAll("questions");
    }
    return [];
}

// Ensure parent pointers are filled out if user selects a deep item directly
async function autofillParents(item, view) {
    if (view === "courses") {
        selectedPath = { course: item, section: null, unit: null, task: null };
    } else if (view === "sections") {
        const courses = await getAll("courses");
        let foundCourse = null;
        for (const course of courses) {
            const sectionsData = await fetchResource("sections", { course });
            for (const section of (sectionsData.sections || sectionsData)) {
                if (section.uid === item.uid) {
                    foundCourse = course;
                    break;
                }
            }
            if (foundCourse) break;
        }
        selectedPath = { course: foundCourse, section: item, unit: null, task: null };
    } else if (view === "units") {
        const allSections = await getAll("sections");
        let foundSection = null;
        for (const section of allSections) {
            const unitsData = await fetchResource("units", { course: section.parentCourse, section });
            for (const unit of (unitsData.units || unitsData)) {
                if (unit.uid === item.uid) {
                    foundSection = section;
                    break;
                }
            }
            if (foundSection) break;
        }
        selectedPath = { course: foundSection.parentCourse, section: foundSection, unit: item, task: null };
    } else if (view === "tasks") {
        const allUnits = await getAll("units");
        let foundUnit = null;
        for (const unit of allUnits) {
            const tasksData = await fetchResource("tasks", { course: unit.parentCourse, section: unit.parentSection, unit });
            for (const task of (tasksData.tasks || tasksData)) {
                if (task.uid === item.uid) {
                    foundUnit = unit;
                    break;
                }
            }
            if (foundUnit) break;
        }
        selectedPath = { course: foundUnit.parentCourse, section: foundUnit.parentSection, unit: foundUnit, task: item };
    } else if (view === "questions") {
        const allTasks = await getAll("tasks");
        let foundTask = null;
        for (const task of allTasks) {
            const questionsData = await fetchResource("questions", { 
                course: task.parentCourse, section: task.parentSection, unit: task.parentUnit, task 
            });
            for (const q of (questionsData.questions || questionsData)) {
                if (q.uid === item.uid) {
                    foundTask = task;
                    break;
                }
            }
            if (foundTask) break;
        }
        selectedPath = { 
            course: foundTask.parentCourse, 
            section: foundTask.parentSection, 
            unit: foundTask.parentUnit, 
            task: foundTask 
        };
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

async function renderView(view, filter = "") {
    if (view === "questionDetail" && questionDetail) {
        renderQuestionDetail(questionDetail);
        return;
    }

    document.querySelectorAll('.browser-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
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

    updateSelectedPathDisplay();

    const area = document.getElementById('browserListArea');
    area.innerHTML = `<div class="browser-no-results">Loading...</div>`;
    let items = await getScoped(view);

    if (filter) {
        items = items.filter(item => {
            const field = (item.name || item.prompt || item.text || item.number || "");
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
        btn.addEventListener('click', async function () {
            let id = this.getAttribute("data-id");
            let item = items.find(i => String(i.uid ?? i.id) === String(id));

            await autofillParents(item, view);

            if (view === "courses") {
                currentView = "sections";
            } else if (view === "sections") {
                currentView = "units";
            } else if (view === "units") {
                currentView = "tasks";
            } else if (view === "tasks") {
                currentView = "questions";
            } else if (view === "questions") {
                questionDetail = item;
                currentView = "questionDetail";
            }
            await renderView(currentView, document.getElementById('searchInput').value);
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
        btn.addEventListener('click', async function (e) {
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
            await renderView(currentView, document.getElementById('searchInput').value);
        });
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll('.browser-tab').forEach(btn => {
        btn.addEventListener('click', async function () {
            let view = this.getAttribute('data-view');
            currentView = view;
            await renderView(currentView, document.getElementById('searchInput').value);
        });
    });
    document.getElementById('searchBtn').addEventListener('click', async function () {
        const filter = document.getElementById('searchInput').value;
        await renderView(currentView, filter);
    });
    document.getElementById('searchInput').addEventListener('input', async function () {
        await renderView(currentView, this.value);
    });
    document.getElementById('searchInput').addEventListener('keydown', async function (e) {
        if (e.key === "Escape") {
            this.value = "";
            await renderView(currentView, "");
        }
    });
    await renderView(currentView);
});