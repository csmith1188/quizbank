document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('edit-btn')) return;

    const id = e.target.getAttribute('data-id');
    const view = document.querySelector('.browser-tab.active')?.getAttribute('data-view') || 'courses';

    const items = window.getScoped(view);
    const item = items.find(i => String(i.uid ?? i.id) === String(id));
    if (!item) return alert('Item not found.');
    
    // Create a custom popup for editing
    const popup = document.createElement('div');
    popup.classList.add('custom-popup');
    popup.innerHTML = `
      <div class="popup-content">
        <h2>Edit ${view.slice(0, -1)}</h2>
        <label for="name">Name:</label>
        <input type="text" id="name" value="${item.name || ''}" />
        <label for="index">Index:</label>
        <input type="number" id="index" value="${item.index || ''}" />
        <label for="description">Description:</label>
        <textarea id="description">${item.description || ''}</textarea>
        ${item.genprompt !== undefined ? `
        <label for="genprompt">Generation Prompt:</label>
        <input type="text" id="genprompt" value="${item.genprompt || ''}" />
        ` : ''}
        <button id="save-btn">Save</button>
        <button id="cancel-btn">Cancel</button>
      </div>
    `;
    document.body.appendChild(popup);

    // Handle save button click
    document.getElementById('save-btn').addEventListener('click', async () => {
      const newName = document.getElementById('name').value.trim();
      const newIndex = document.getElementById('index').value.trim();
      const newDescription = document.getElementById('description').value.trim();
      const newGenPrompt = item.genprompt !== undefined ? document.getElementById('genprompt').value.trim() : undefined;
    
      // Check for duplicate index
      const existingItem = items.find(i => String(i.index) === String(newIndex) && String(i.uid ?? i.id) !== String(item.uid ?? item.id));
      if (existingItem) {
        return alert('An item with the same index already exists. Please choose a different index.');
      }
    
      try {
        const response = await fetch('/api/edit/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: view.slice(0, -1),
            uid: item.uid ?? item.id,
            name: newName,
            index: newIndex,
            description: newDescription,
            genprompt: newGenPrompt
          })
        });
    
        if (!response.ok) throw new Error('Failed to update');
        const updated = await response.json();
    
        if (window.ALL_COURSE_DATA && window.ALL_COURSE_DATA.courses) {
          const courses = window.ALL_COURSE_DATA.courses;
          updateInMemoryData(courses, view, id, updated);
        }
        
        renderView(view, document.getElementById('searchInput').value);
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
