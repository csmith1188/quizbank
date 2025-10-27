// Course upload logic
const modal = document.getElementById('courseModal');
const openModalBtn = document.getElementById('openCourseModalBtn');
const cancelBtn = document.getElementById('cancelCourseBtn');
const submitBtn = document.getElementById('submitCourseBtn');
const courseNameInput = document.getElementById('courseNameInput');

// Section upload logic
const sectionModal = document.getElementById('newSectionModal');
const openSectionModalBtn = document.getElementById('openSectionModalBtn');
const cancelSectionBtn = document.getElementById('cancelModuleBtn');
const submitSectionBtn = document.getElementById('submitModuleBtn');
const sectionNameInput = document.getElementById('moduleNameInput');

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
            body: JSON.stringify({ courseName }),
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
    const path = selectedPath;
    const courseUid = path.course.uid;

    if (!sectionName) return alert('Please enter a section name.');
    if (!courseUid) return alert('Course UID is missing.');

    try {
        const response = await fetch('/api/section-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionName, courseUid }),
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
