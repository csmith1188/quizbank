function updateRamAfterEdit(type, updatedItem) {
  console.log('Updating RAM for', type, updatedItem);
  if (!window.ALL_COURSE_DATA) return;

  const findCourse = () =>
    window.ALL_COURSE_DATA.find(c => c.uid === updatedItem.courseUid);

  const findSection = (course) =>
    course.sections.find(s => s.uid === updatedItem.sectionUid);

  const findUnit = (section) =>
    section.units.find(u => u.uid === updatedItem.unitUid);

  if (type === "course") {
    const course = window.ALL_COURSE_DATA.find(c => c.uid === updatedItem.uid);
    if (!course) return;

    Object.assign(course, updatedItem);
    window.ALL_COURSE_DATA.sort((a, b) => a.index - b.index);
    return;
  }

  if (type === "section") {
    const course = findCourse();
    if (!course) return;

    const section = course.sections.find(s => s.uid === updatedItem.uid);
    if (!section) return;

    Object.assign(section, updatedItem);
    course.sections.sort((a, b) => a.index - b.index);
    return;
  }

  if (type === "unit") {
    const course = findCourse();
    if (!course) return;

    const section = findSection(course);
    if (!section) return;

    const unit = section.units.find(u => u.uid === updatedItem.uid);
    if (!unit) return;

    Object.assign(unit, updatedItem);
    section.units.sort((a, b) => a.index - b.index);
    return;
  }

  if (type === "task") {
    const course = findCourse();
    if (!course) return;

    const section = findSection(course);
    if (!section) return;

    const unit = findUnit(section);
    if (!unit) return;

    const task = unit.tasks.find(t => t.uid === updatedItem.uid);
    if (!task) return;

    Object.assign(task, updatedItem);
    unit.tasks.sort((a, b) => a.index - b.index);
    return;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('edit-btn')) return;

    const id = e.target.getAttribute('data-id');
    const view = document.querySelector('.browser-tab.active')?.getAttribute('data-view') || 'courses';

    const items = window.getScoped(view);
    const item = items.find(i => String(i.uid ?? i.id) === String(id));
    if (!item) return alert('Item not found.');

    const popup = document.createElement('div');
    popup.classList.add('custom-popup');
    popup.innerHTML = `
      <div class="popup-content">
        <h2>Edit ${view.slice(0, -1)}</h2>

        <label>Name:</label>
        <input type="text" id="name" value="${item.name || ''}" />

        <label>Index:</label>
        <input type="number" id="index" value="${item.index || ''}" />

        <label>Description:</label>
        <textarea id="description">${item.description || ''}</textarea>

        ${item.genprompt !== undefined ? `
        <label>Generation Prompt:</label>
        <input type="text" id="genprompt" value="${item.genprompt || ''}" />
        ` : ''}

        <button id="save-btn">Save</button>
        <button id="cancel-btn">Cancel</button>
      </div>
    `;
    document.body.appendChild(popup);

    document.getElementById('save-btn').addEventListener('click', async () => {
      const newName = document.getElementById('name').value.trim();
      const newIndex = Number(document.getElementById('index').value);
      const newDescription = document.getElementById('description').value.trim();
      const newGenPrompt = item.genprompt !== undefined
        ? document.getElementById('genprompt').value.trim()
        : undefined;

      const oldIndex = item.index;

      try {
        const response = await fetch('/api/edit/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: view.slice(0, -1),
            uid: item.uid ?? item.id,
            name: newName,
            description: newDescription,
            genprompt: newGenPrompt,
            oldIndex,
            newIndex
          })
        });

        const data = await response.json();
        console.log('Edit response:', data);
        console.log('hello', data.uid);
        console.log('Type:', data.type);
        if (!data.success) throw new Error(data.error || 'Update failed');

        // Update RAM
        updateRamAfterEdit(data.type, {
          uid: data.uid,
          name: data.name,
          description: data.description,
          index: data.index,
          sectionUid: data.sectionUid,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });

        location.reload();

        // Re-render UI
        if (typeof renderView === 'function') {
          renderView(view, document.getElementById('searchInput')?.value);
        }

      } catch (err) {
        console.error(err);
        alert('Edit failed: ' + err.message);
      } finally {
        document.body.removeChild(popup);
      }
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      document.body.removeChild(popup);
    });
  });
});