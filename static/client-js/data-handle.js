// Course upload varibles
const modal = document.getElementById('courseModal');
const openModalBtn = document.getElementById('openCourseModalBtn');
const cancelBtn = document.getElementById('cancelCourseBtn');
const submitBtn = document.getElementById('submitCourseBtn');
const courseNameInput = document.getElementById('courseNameInput');
const courseDescInput = document.getElementById('courseDescriptionInput');

// Section upload varibles
const sectionModal = document.getElementById('newSectionModal');
const openSectionModalBtn = document.getElementById('openSectionModalBtn');
const cancelSectionBtn = document.getElementById('cancelModuleBtn');
const submitSectionBtn = document.getElementById('submitModuleBtn');
const sectionNameInput = document.getElementById('moduleNameInput');
const sectionDescInput = document.getElementById('moduleDescriptionInput');

// Unit upload varibles
const unitModal = document.getElementById('unitModal');
const openUnitModalBtn = document.getElementById('openUnitBtn');
const cancelUnitBtn = document.getElementById('cancelUnitBtn');
const submitUnitBtn = document.getElementById('submitUnitBtn');
const unitNameInput = document.getElementById('unitNameInput');
const unitDescInput = document.getElementById('unitDescriptionInput');

// Task upload varibles
const taskModal = document.getElementById('taskModal');
const openTaskModalBtn = document.getElementById('openTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const submitTaskBtn = document.getElementById('submitTaskBtn');
const taskNameInput = document.getElementById('taskNameInput');
const taskDescInput = document.getElementById('taskDescriptionInput');
const taskGenPromptInput = document.getElementById('taskGenPrompt');

// Question upload variables
const questionModal = document.getElementById('question-creation');
const openQuestionModalBtn = document.getElementById('openQuestionBtn');
const cancelQuestionBtn = document.getElementById('cancelQuestionBtn');
const submitQuestionBtn = document.getElementById('submitQuestionBtn');
const questionOptionsInput = document.getElementById('questionOptionsInput');
const qustionCreation = document.getElementById('question-creation');

// Course upload handlers
openModalBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    courseNameInput.value = '';
    courseNameInput.focus();
});

cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

submitBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const courseName = courseNameInput.value.trim();
    if (!courseName) return alert('Please enter a course name.');

    try {
        const response = await fetch('/api/course-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName, description: courseDescInput.value.trim() }),
        });

        const data = await response.json();
        if (data.success) {
            modal.classList.add('hidden');

            if (window.ALL_COURSE_DATA && window.ALL_COURSE_DATA.courses) {
                window.ALL_COURSE_DATA.courses.push(data.newCourse);
                if (typeof renderView === 'function') renderView('courses');
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error creating course.');
    }
});

// Section upload handlers
openSectionModalBtn.addEventListener('click', () => {
    sectionModal.classList.remove('hidden');
    sectionNameInput.value = '';
    sectionNameInput.focus();
});

cancelSectionBtn.addEventListener('click', () => {
    sectionModal.classList.add('hidden');
});

submitSectionBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const sectionName = sectionNameInput.value.trim();
    const description = sectionDescInput.value.trim();
    const path = selectedPath;
    const courseUid = path.course.uid;

    if (!sectionName) return alert('Please enter a section name.');

    try {
        const response = await fetch('/api/section-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionName, courseUid, description }),
        });

        const data = await response.json();
        if (data.success) {
            sectionModal.classList.add('hidden');

            if (window.ALL_COURSE_DATA && window.ALL_COURSE_DATA.courses) {
                const course = window.ALL_COURSE_DATA.courses.find(c => c.uid === courseUid);
                if (course) {
                    if (!course.sections) {
                        course.sections = [];
                    }
                    course.sections.push(data.newSection);
                    if (typeof renderView === 'function') renderView('sections');
                }
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error creating section.');
    }
});

// Unit upload handlers
openUnitModalBtn.addEventListener('click', () => {
    unitModal.classList.remove('hidden');
    unitNameInput.value = '';
    unitNameInput.focus();
});

cancelUnitBtn.addEventListener('click', () => {
    unitModal.classList.add('hidden');
});

submitUnitBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const unitName = unitNameInput.value.trim();
    const description = unitDescInput.value.trim();
    const path = selectedPath;
    const sectionUid = path.section.uid;

    if (!unitName) return alert('Please enter a unit name.');

    try {
        const response = await fetch('/api/unit-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unitName, sectionUid, description }),
        });

        const data = await response.json();
        if (data.success) {
            unitModal.classList.add('hidden');

            if (window.ALL_COURSE_DATA && window.ALL_COURSE_DATA.courses) {
                const course = window.ALL_COURSE_DATA.courses.find(c => c.uid === path.course.uid);
                if (course) {
                    const section = course.sections.find(s => s.uid === sectionUid);
                    if (section) {
                        if (!section.units) {
                            section.units = [];
                        }
                        section.units.push(data.newUnit);
                        if (typeof renderView === 'function') renderView('units');
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error creating unit.');
    }
});

// Task upload handlers
openTaskModalBtn.addEventListener('click', () => {
    taskModal.classList.remove('hidden');
    taskNameInput.value = '';
    taskNameInput.focus();
});

cancelTaskBtn.addEventListener('click', () => {
    taskModal.classList.add('hidden');
});

submitTaskBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const taskName = taskNameInput.value.trim();
    const description = taskDescInput.value.trim();
    const genPrompt = taskGenPromptInput.value.trim();
    const path = selectedPath;
    const unitUid = path.unit.uid;

    if (!taskName) return alert('Please enter a task name.');

    try {
        const response = await fetch('/api/task-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskName, unitUid, description, genPrompt }),
        });

        const data = await response.json();
        if (data.success) {
            taskModal.classList.add('hidden');

            if (window.ALL_COURSE_DATA && window.ALL_COURSE_DATA.courses) {
                const course = window.ALL_COURSE_DATA.courses.find(c => c.uid === path.course.uid);
                if (course) {
                    const section = course.sections.find(s => s.uid === path.section.uid);
                    if (section) {
                        const unit = section.units.find(u => u.uid === unitUid);
                        if (unit) {
                            if (!unit.tasks) {
                                unit.tasks = [];
                            }
                            unit.tasks.push(data.newTask);
                            if (typeof renderView === 'function') renderView('tasks');
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error creating task.');
    }
});

// Question upload handlers
openQuestionModalBtn.addEventListener('click', () => {
    questionModal.classList.remove('hidden');
    questionOptionsInput.value = '';
    questionOptionsInput.focus();
});

cancelQuestionBtn.addEventListener('click', () => {
    questionModal.classList.add('hidden');
});

submitQuestionBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const questionOptions = questionOptionsInput.value.trim();
    const path = selectedPath;
    const taskUid = path.task.uid;

    if (!questionOptions) return alert('Please enter question data.');

    const parsedQuestion = parseFormattedQuestion(questionOptions);

    try {
        const response = await fetch('/api/question-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskUid,
                question: parsedQuestion
            }),
        });

        const data = await response.json();
        if (data.success) {
            questionModal.classList.add('hidden');

            if (window.ALL_COURSE_DATA && window.ALL_COURSE_DATA.courses) {
                const course = window.ALL_COURSE_DATA.courses.find(c => c.uid === path.course.uid);
                if (course) {
                    const section = course.sections.find(s => s.uid === path.section.uid);
                    if (section) {
                        const unit = section.units.find(u => u.uid === path.unit.uid);
                        if (unit) {
                            const task = unit.tasks.find(t => t.uid === taskUid);
                            if (task) {
                                if (!task.questions) {
                                    task.questions = [];
                                }
                                task.questions.push(data.newQuestion);
                                if (typeof renderView === 'function') renderView('questions');
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error creating question.');
    }
});