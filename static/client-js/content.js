// content.js (updated)
// NOTE: replace your current content.js with this file

const allCourseDataText = document.getElementById('all-course-data').textContent;
const uploadSection = document.getElementsByClassName('upload-section')[0];
const uploadForm = document.getElementById('bulk-upload-form');
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

function addBrowserTabIfMissing(view, label) {
    const tabsContainer = document.querySelector('.browser-tabs');
    if (!tabsContainer) return;
    if (tabsContainer.querySelector(`[data-view="${view}"]`)) return; // already exists

    const btn = document.createElement('button');
    btn.className = 'browser-tab';
    btn.setAttribute('data-view', view);
    btn.setAttribute('type', 'button');
    btn.innerHTML = `<span>${label}</span> <button class="unselect-btn" data-unselect="${view}" title="Close">×</button>`;

    // main click: switch to view
    btn.addEventListener('click', function (e) {
        // avoid firing when close button is clicked (it will stopPropagation)
        if (e.target && e.target.classList && e.target.classList.contains('unselect-btn')) return;
        currentView = view;
        renderView(currentView, document.getElementById('searchInput')?.value || "");
    });

    tabsContainer.appendChild(btn);
    attachUnselectListeners(); // bind the close button we just created
}

/**
 * Render the main browser view (courses/sections/units/tasks/questions/questionDetail/questionEdit)
 */
function renderView(view, filter = "") {
    // special direct render for questionDetail (keeps behavior as before)
    if (view === "questionDetail" && questionDetail) {
        renderQuestionDetail(questionDetail);
        return;
    }

    if (view === 'units' && selectedPath.section) {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
    }


    // special: questionEdit -> call renderQuestionEdit if available
    if (view === "questionEdit") {
        if (!questionDetail) {
            // nothing to edit; go back
            currentView = "questions";
            view = currentView;
        } else {
            // render edit UI (prefer external renderQuestionEdit if loaded)
            if (typeof renderQuestionEdit === "function") {
                renderQuestionEdit(questionDetail);
                return;
            } else {
                // fallback message until edit-question.js loads
                const area = document.getElementById('browserListArea');
                area.innerHTML = `<div class="browser-no-results">Edit UI not yet available.</div>`;
                return;
            }
        }
    }

    document.querySelectorAll('.browser-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        let v = btn.getAttribute('data-view').slice(0,-1);
        let currentPath = selectedPath[v]; // remove 's' for plural
        if (currentPath) {
            btn.innerHTML = `<span>${currentPath.name}</span> <button class="unselect-btn" data-unselect="${v}" title="Unselect">×</button>`;
        } else {
            btn.innerHTML = `<span>${v.charAt(0).toUpperCase() + v.slice(1) + 's'}</span>`;
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
    area.classList.add('question-detail-mode'); // optional visual class

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
      <div class="question-prompt">${question.prompt || question.text || ""}</div>
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
      <div class="question-detail-actions">
        <button id="questionDetailEditBtn" class="edit-btn">✎ Edit</button>
        <button id="questionDetailBackBtn" class="back-btn">Back</button>
      </div>
    </div>
    `;
    area.innerHTML = html;

    document.getElementById('questionDetailBackBtn').onclick = () => {
        questionDetail = null;
        currentView = "questions";
        renderView(currentView);
    };

    document.getElementById('questionDetailEditBtn').onclick = () => {
        // keep questionDetail set (used by edit view)
        questionDetail = question;

        // create the tab (if it doesn't exist) and switch to it
        addBrowserTabIfMissing('questionEdit', 'Question Edit');

        currentView = 'questionEdit';
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
    // attach close/unselect handlers for any unselect buttons
    document.querySelectorAll('.unselect-btn').forEach(btn => {
        // avoid attaching duplicate listeners by checking a marker
        if (btn._hasUnselectListener) return;
        btn._hasUnselectListener = true;

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
                case "questionEdit":
                    const tabEl = document.querySelector(`.browser-tab[data-view="questionEdit"]`);
                    if (tabEl) tabEl.remove();
                    currentView = questionDetail ? "questionDetail" : "questions";
                    break;
                default:
                    break;
            }
            renderView(currentView, document.getElementById('searchInput').value);
        });
    });
}

function pickQuestions() {
    const numberToPick = parseInt(prompt("How many questions would you like to pick?", "1"), 10) || 1;
    const path = selectedPath;
    let questions = [];

    const collectQuestions = (items) => {
        items.forEach(item => {
            if (item.questions) {
                questions = questions.concat(item.questions);
            }
        });
    };

    if (path.task) {
        collectQuestions([path.task]);
    } else if (path.unit) {
        collectQuestions(path.unit.tasks || []);
    } else if (path.section) {
        path.section.units.forEach(unit => {
            collectQuestions(unit.tasks || []);
        });
    } else if (path.course) {
        path.course.sections.forEach(section => {
            section.units.forEach(unit => {
                collectQuestions(unit.tasks || []);
            });
        });
    } else {
        questions = getAllQuestions();
    }

    // Remove duplicates
    questions = Array.from(new Set(questions.map(q => JSON.stringify(q)))).map(q => JSON.parse(q));

    questions = questions.sort(() => Math.random() - 0.5);
    const pickedQuestions = questions.slice(0, Math.max(numberToPick, 0));

    // Create a pop-up
    let popUpContent = "<h3>Picked Questions</h3>";

    pickedQuestions.forEach(q => {
        let answers = [];
        try {
            answers = typeof q.answers === "string" ? JSON.parse(q.answers) : q.answers;
        } catch {
            answers = q.answers || [];
        }
        let correctIdx = (typeof q.correct_index !== "undefined" ? q.correct_index : q.correctIndex);
        let correctAns = q.correctAnswer || q.correct_answer;

        // Construct the path for the question (can implement if needed)
        /*
        const paths = [
            q.parentCourse ? q.parentCourse.name : null,
            q.parentSection ? q.parentSection.name : null,
            q.parentUnit ? q.parentUnit.name : null,
            q.parentTask ? q.parentTask.name : null
        ].filter(Boolean).join(' > ');
        */

        popUpContent += `<div style="margin-bottom: 20px;">
            <strong>Question:</strong> ${q.prompt || q.text}<br>
            <strong>Answers:</strong>
            <ul style="list-style-type: none; padding-left: 0;">
            ${answers.map((ans, idx) => `
            <li style="${(correctIdx === idx || ans === correctAns) ? 'font-weight:bold; color:green;' : ''}">
             ${correctIdx === idx || ans === correctAns ? '*' : ''} ${ans}${(correctIdx === idx || ans === correctAns)}
            </li>`).join('')}
            </ul>
        </div>`;
    });

    // Display the pop-up
    const popUp = document.createElement('div');
    popUp.style.position = 'fixed';
    popUp.style.top = '50%';
    popUp.style.left = '50%';
    popUp.style.transform = 'translate(-50%, -50%)';
    popUp.style.backgroundColor = 'black';
    popUp.style.border = '2px solid #333';
    popUp.style.borderRadius = '8px';
    popUp.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    popUp.style.padding = '20px';
    popUp.style.zIndex = '1000';
    popUp.style.maxWidth = '90%';
    popUp.style.maxHeight = '80%';
    popUp.style.overflowY = 'auto';
    popUp.innerHTML = popUpContent + '<button id="closePopUp" style="margin-top: 10px;">Close</button>';
    document.body.appendChild(popUp);

    const closeButton = document.getElementById('closePopUp');
    closeButton.onclick = () => {
        document.body.removeChild(popUp);
    };

    return pickedQuestions;
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

    uploadForm.onsubmit = function (e) {
        e.preventDefault();

        if (!selectedPath.section) {
            alert("Please select a section to upload to.");
            return;
        }

        if (!uploadForm.sheet.files || uploadForm.sheet.files.length === 0) {
            alert("Please select a file to upload.");
            return;
        }

        const formData = new FormData(uploadForm);
        formData.set('sectionUid', selectedPath.section ? selectedPath.section.uid : "");
        fetch('/api/bulk-upload/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.text())
            .then(data => {
                const updatedSection = JSON.parse(data);
                const course = ALL_COURSE_DATA.courses.find(c => c.uid === updatedSection.courseUid);
                course.sections[updatedSection.index - 1] = updatedSection;
                selectedPath.section = updatedSection;
                renderView('units');
                uploadForm.reset();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Upload failed: ' + error.message);
            });
    };

    renderView(currentView);
});