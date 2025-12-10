function findParents(item, view) {
  item.parentCourse = null;
  item.parentSection = null;
  item.parentUnit = null;

  for (const course of window.ALL_COURSE_DATA) {

    if (view === "sections" || view === "units" || view === "tasks") {
      const section = course.sections?.find(s => s.uid === item.sectionUid || s.uid === item.uid);
      if (section) {
        item.parentCourse = course;
        item.parentSection = section;
      }
    }

    if (view === "units" || view === "tasks") {
      const section = course.sections?.find(s => s.units.some(u => u.uid === item.uid));
      if (section) {
        item.parentCourse = course;
        item.parentSection = section;

        const unit = section.units.find(u => u.uid === item.uid);
        if (unit) item.parentUnit = unit;
      }
    }

    if (view === "tasks") {
      for (const section of course.sections || []) {
        for (const unit of section.units || []) {
          const task = unit.tasks?.find(t => t.uid === item.uid);
          if (task) {
            item.parentCourse = course;
            item.parentSection = section;
            item.parentUnit = unit;
          }
        }
      }
    }

    if (view === "courses" && course.uid === item.uid) {
      item.parentCourse = course;
    }
  }

  return item;
}

function updateRamAfterEdit(type, updatedItem) {
  const view = type + "s";
  findParents(updatedItem, view);

  const c = updatedItem.parentCourse;
  const s = updatedItem.parentSection;
  const u = updatedItem.parentUnit;

  if (!window.ALL_COURSE_DATA) return;

  if (type === "course") {
    const course = window.ALL_COURSE_DATA.find(c => c.uid === updatedItem.uid);
    if (!course) return;
    Object.assign(course, updatedItem);
    window.ALL_COURSE_DATA.sort((a, b) => a.index - b.index);
    return;
  }

  if (type === "section") {
    if (!c || !s) return console.error("Missing parentCourse or parentSection");
    const section = c.sections.find(sec => sec.uid === updatedItem.uid);
    if (!section) return;
    Object.assign(section, updatedItem);
    c.sections.sort((a, b) => a.index - b.index);
    return;
  }

  if (type === "unit") {
    if (!c || !s) return console.error("Missing parents for unit");
    const unit = s.units.find(un => un.uid === updatedItem.uid);
    if (!unit) return;
    Object.assign(unit, updatedItem);
    s.units.sort((a, b) => a.index - b.index);
    return;
  }

  if (type === "task") {
    if (!c || !s || !u) return console.error("Missing parents for task");
    const task = u.tasks.find(t => t.uid === updatedItem.uid);
    if (!task) return;
    Object.assign(task, updatedItem);
    u.tasks.sort((a, b) => a.index - b.index);
    return;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('edit-btn')) return;

    const id = e.target.getAttribute('data-id');
    const view = document.querySelector('.browser-tab.active')?.getAttribute('data-view') || 'courses';

    const items = window.getScoped(view);
    const item = items.find(i => String(i.uid) === String(id));
    if (!item) return alert('Item not found.');

    const popup = document.createElement('div');
    popup.classList.add('custom-popup');
    popup.innerHTML = `
      <div class="popup-content">
        <h2>Edit ${view.slice(0, -1)}</h2>

        <label>Name:</label>
        <input type="text" id="name" value="${item.name || ''}" />

        <label>Index:</label>
        <input type="number" id="index" value="${item.index || 0}" />

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
      const newGenPrompt =
        item.genprompt !== undefined ? document.getElementById('genprompt').value.trim() : undefined;

      const oldIndex = item.index;

      try {
        const response = await fetch('/api/edit/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: view.slice(0, -1),
            uid: item.uid,
            name: newName,
            description: newDescription,
            genprompt: newGenPrompt,
            oldIndex,
            newIndex
          })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Update failed');

        // Extract objects with uid (0,1,2,...)
        const updatedItems = Object.values(data).filter(v => v && typeof v === "object" && v.uid);

        updatedItems.forEach(obj => updateRamAfterEdit(data.type, obj));

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