/**
 * HTML5 drag-and-drop reorder for list tables.
 * Use: add data-reorder-url to the table or tbody, and data-id to each row (tr).
 * Rows are sent as { ids: [id1, id2, ...] } in new order.
 */
(function () {
    function init() {
        var tables = document.querySelectorAll('table[data-reorder-url] tbody, tbody[data-reorder-url]');
        tables.forEach(function (tbody) {
            var table = tbody.closest && tbody.closest('table') || tbody.parentNode;
            var url = (table && table.getAttribute('data-reorder-url')) || tbody.getAttribute('data-reorder-url');
            if (!url) return;
            var rows = tbody.querySelectorAll('tr[data-id]');
            if (rows.length < 2) return;
            tbody._reorderUrl = url;
            tbody._rowSelector = 'tr[data-id]';
            rows.forEach(function (tr) {
                tr.setAttribute('draggable', 'true');
                tr.classList.add('reorderable-row');
                tr.addEventListener('dragstart', handleDragStart);
                tr.addEventListener('dragover', handleDragOver);
                tr.addEventListener('drop', handleDrop);
                tr.addEventListener('dragend', handleDragEnd);
                tr.addEventListener('dragenter', handleDragEnter);
                tr.addEventListener('dragleave', handleDragLeave);
            });
            tbody._reorderUrl = url;
        });
        // Accordion / list containers
        var containers = document.querySelectorAll('[data-reorder-url].reorderable-list');
        containers.forEach(function (container) {
            var url = container.getAttribute('data-reorder-url');
            if (!url) return;
            var rows = container.querySelectorAll(':scope > [data-id]');
            if (rows.length < 2) return;
            container._reorderUrl = url;
            container._rowSelector = ':scope > [data-id]';
            rows.forEach(function (row) {
                row.classList.add('reorderable-row');
                var handle = row.querySelector('.reorderable-handle');
                if (handle) {
                    handle.setAttribute('draggable', 'true');
                    handle.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    });
                    handle.addEventListener('dragstart', function (e) {
                        handleDragStart.call(row, e);
                        e.stopPropagation();
                    });
                    handle.addEventListener('dragend', function (e) {
                        handleDragEnd.call(row, e);
                    });
                } else {
                    row.setAttribute('draggable', 'true');
                    row.addEventListener('dragstart', handleDragStart);
                    row.addEventListener('dragend', handleDragEnd);
                }
                row.addEventListener('dragover', handleDragOver);
                row.addEventListener('drop', handleDrop);
                row.addEventListener('dragenter', handleDragEnter);
                row.addEventListener('dragleave', handleDragLeave);
            });
        });
    }

    var draggedEl = null;

    function handleDragStart(e) {
        var el = e.currentTarget;
        var row = el.getAttribute('data-id') ? el : (typeof this !== 'undefined' && this.getAttribute && this.getAttribute('data-id') ? this : null) || (el.closest && el.closest('[data-id]')) || el;
        draggedEl = row;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedEl.getAttribute('data-id'));
        draggedEl.classList.add('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        var row = e.currentTarget;
        if (!row.getAttribute('data-id') && row.closest) row = row.closest('[data-id]');
        if (row && row !== draggedEl) row.classList.add('drop-target');
    }

    function handleDragLeave(e) {
        var row = e.currentTarget;
        if (!row.getAttribute('data-id') && row.closest) row = row.closest('[data-id]');
        if (row) row.classList.remove('drop-target');
    }

    function handleDrop(e) {
        e.preventDefault();
        var targetRow = e.currentTarget;
        if (!targetRow.getAttribute('data-id')) targetRow = targetRow.closest('[data-id]');
        targetRow.classList.remove('drop-target');
        if (!draggedEl || targetRow === draggedEl) return;
        var container = targetRow.parentNode;
        var url = container._reorderUrl;
        var rowSelector = container._rowSelector;
        if (!url) return;
        var rows = Array.from(container.querySelectorAll(rowSelector || 'tr[data-id]'));
        var fromIndex = rows.indexOf(draggedEl);
        var toIndex = rows.indexOf(targetRow);
        if (fromIndex === -1 || toIndex === -1) return;
        var moved = rows.splice(fromIndex, 1)[0];
        rows.splice(toIndex, 0, moved);
        var ids = rows.map(function (r) { return parseInt(r.getAttribute('data-id'), 10); });
        fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids }),
            credentials: 'same-origin'
        }).then(function (r) {
            if (r.ok) {
                rows.forEach(function (r) { container.appendChild(r); });
                // Update displayed order numbers unless container has data-renumber="false" (e.g. tasks keep their own number)
                if (container.getAttribute('data-renumber') !== 'false') {
                    rows.forEach(function (row, i) {
                        var orderEl = row.querySelector('.unit-order');
                        if (orderEl) {
                            var prefix = orderEl.getAttribute('data-prefix') || '';
                            orderEl.textContent = prefix + (i + 1);
                        }
                    });
                }
            } else {
                alert('Reorder failed');
            }
        }).catch(function () {
            alert('Reorder failed');
        });
        return false;
    }

    function handleDragEnd(e) {
        var el = e.currentTarget;
        var row = el.getAttribute('data-id') ? el : (typeof this !== 'undefined' && this.getAttribute && this.getAttribute('data-id') ? this : null) || (el.closest && el.closest('[data-id]'));
        if (row) row.classList.remove('dragging');
        Array.prototype.forEach.call(document.querySelectorAll('.drop-target'), function (el) {
            el.classList.remove('drop-target');
        });
        draggedEl = null;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
