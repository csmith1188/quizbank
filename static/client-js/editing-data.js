function initEditSystem(area) {
    area.addEventListener('click', (event) => {
      const editBtn = event.target.closest('.edit-btn');
      if (!editBtn) return;
  
      const itemId = editBtn.dataset.id;
      openEditPopup(itemId);
    });
  }
  
  function openEditPopup(itemId) {
    const overlay = document.createElement('div');
    overlay.classList.add('edit-overlay');
    overlay.innerHTML = `
      <div class="edit-popup">
        <h3>Edit Item</h3>
        <textarea id="edit-input" placeholder="Enter new content..."></textarea>
        <div class="edit-actions">
          <button id="save-edit" class="save-btn">Save</button>
          <button id="cancel-edit" class="cancel-btn">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  
    overlay.querySelector('#cancel-edit').addEventListener('click', () => {
      overlay.remove();
    });
  
    overlay.querySelector('#save-edit').addEventListener('click', async () => {
      const newValue = overlay.querySelector('#edit-input').value.trim();
      if (!newValue) return alert('Please enter new text.');
  
      try {
        const res = await fetch('/api/resource/edit/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: itemId, newValue })
        });
  
        if (!res.ok) throw new Error('Failed to update.');
  
        alert('Item updated successfully!');
        overlay.remove();
  
        const btn = document.querySelector(`.browser-list-item[data-id="${itemId}"] span:first-child`);
        if (btn) btn.textContent = newValue;
      } catch (err) {
        console.error(err);
        alert('Error saving edit.');
      }
    });
  }  