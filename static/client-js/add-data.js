// Course upload logic
const modal = document.getElementById('courseModal');
const openModalBtn = document.getElementById('openCourseModalBtn');
const cancelBtn = document.getElementById('cancelCourseBtn');
const submitBtn = document.getElementById('submitCourseBtn');
const courseNameInput = document.getElementById('courseNameInput');

openModalBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    courseNameInput.value = '';
    courseNameInput.focus();
});

cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

submitBtn.addEventListener('click', async () => {
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

// Section upload logic
const sectionModal = document.getElementById('sectionModal');
const openSectionModalBtn = document.getElementById('openSectionModalBtn');
const cancelSectionBtn = document.getElementById('cancelSectionBtn');
const submitSectionBtn = document.getElementById('submitSectionBtn');
const sectionNameInput = document.getElementById('sectionNameInput');

openSectionModalBtn.addEventListener('click', () => {
    sectionModal.classList.remove('hidden');
    sectionNameInput.value = '';
    sectionNameInput.focus();
});

cancelSectionBtn.addEventListener('click', () => {
    sectionModal.classList.add('hidden');
});
tSectionBtn.addEventListener('click', async () => {
    const sectionName = sectionNameInput.value.trim();
    if (!sectionName) return alert('Please enter a section name.');

    try {
        const response = await fetch('/api/section-upload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionName }),
        });

        const data = await response.json();
        if (data.success) {
            sectionModal.classList.add('hidden');

            if (window.ALL_SECTION_DATA) {
                window.ALL_SECTION_DATA.push(data.newSection);
                if (typeof renderView === 'function') renderView('sections');
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error creating section.');
    }
});