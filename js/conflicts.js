(() => {
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const BLOCKS = ['morning', 'afternoon', 'evening'];
  const ALL_CELL_KEYS = DAYS.flatMap((day) => BLOCKS.map((block) => `${day}_${block}`));

  /* ------------------------------------------------------------------
     Pure conflict detection — no DOM access, no async
     ------------------------------------------------------------------ */

  function detectConflicts(weekCells, availabilityMap, minHeadcount) {
    const result = {
      cells: {},
      employees: {},
      summary: [],
    };

    // Rule 1: Double-booking — same employee in the same cell key more than once
    // (data integrity guard; prevented by performDrop dedup but caught here too)
    const empCells = {};
    Object.entries(weekCells).forEach(([cellKey, empIds]) => {
      const seen = new Set();
      empIds.forEach((eid) => {
        if (seen.has(eid)) {
          addEmployeeConflict(result, {
            cellKey,
            employeeId: eid,
            message: `${eid} appears twice in ${cellKey}`,
            severity: 'error',
            type: 'double_booking',
          });
        }
        seen.add(eid);
        if (!empCells[eid]) empCells[eid] = [];
        empCells[eid].push(cellKey);
      });
    });

    // Rule 2: Availability violation — employee scheduled in an Unavailable slot
    Object.entries(weekCells).forEach(([cellKey, empIds]) => {
      empIds.forEach((eid) => {
        const avail = availabilityMap[eid];
        if (avail?.slots?.[cellKey] === 'unavailable') {
          addEmployeeConflict(result, {
            cellKey,
            employeeId: eid,
            message: `${eid} is unavailable on ${cellKey}`,
            severity: 'warning',
            type: 'availability_violation',
          });
        }
      });
    });

    // Rule 3: Understaffed — fewer employees than minHeadcount
    if (minHeadcount > 0) {
      ALL_CELL_KEYS.forEach((cellKey) => {
        const count = (weekCells[cellKey] ?? []).length;
        if (count < minHeadcount) {
          addCellConflict(result, {
            cellKey,
            count,
            message: `${cellKey} has ${count}/${minHeadcount} staff`,
            minHeadcount,
            severity: 'warning',
            type: 'understaffed',
          });
        }
      });
    }

    return result;
  }

  function addCellConflict(result, conflict) {
    if (!result.cells[conflict.cellKey]) result.cells[conflict.cellKey] = [];
    result.cells[conflict.cellKey].push(conflict);
    result.summary.push(conflict);
  }

  function addEmployeeConflict(result, conflict) {
    if (!result.employees[conflict.employeeId]) result.employees[conflict.employeeId] = [];
    result.employees[conflict.employeeId].push(conflict);
    result.summary.push(conflict);
  }

  /* ------------------------------------------------------------------
     Conflict panel renderer
     ------------------------------------------------------------------ */

  function renderConflictPanel(conflictMap, employeeMap) {
    const panel = document.getElementById('conflict-panel');
    const summary = conflictMap.summary;

    if (summary.length === 0) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }

    panel.hidden = false;

    const hasErrors = summary.some((c) => c.severity === 'error');
    const label = `${summary.length} conflict${summary.length !== 1 ? 's' : ''} found`;

    const header = document.createElement('div');
    header.className = 'conflict-panel-header';

    const iconTplId = hasErrors ? 'icon-x-circle' : 'icon-exclamation-triangle';
    const iconTpl = document.getElementById(iconTplId);
    if (iconTpl) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'conflict-item-icon';
      iconSpan.appendChild(iconTpl.content.cloneNode(true));
      header.appendChild(iconSpan);
    }

    const title = document.createElement('span');
    title.className = `conflict-panel-title${hasErrors ? ' conflict-panel-title--error' : ''}`;
    title.textContent = label;
    header.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'conflict-list';

    summary.forEach((conflict) => {
      const li = document.createElement('li');
      li.className = `conflict-item conflict-item--${conflict.severity}`;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'conflict-item-icon';
      const icoId = conflict.severity === 'error' ? 'icon-x-circle' : 'icon-exclamation-triangle';
      const icoTpl = document.getElementById(icoId);
      if (icoTpl) iconSpan.appendChild(icoTpl.content.cloneNode(true));

      const body = document.createElement('span');
      body.className = 'conflict-item-body';

      const msg = document.createElement('span');
      msg.className = 'conflict-item-message';
      msg.textContent = buildConflictMessage(conflict, employeeMap);
      body.appendChild(msg);

      const link = document.createElement('a');
      link.className = 'conflict-link';
      link.href = '#';
      link.textContent = 'Go to cell';
      link.dataset.cellKey = conflict.cellKey;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToCell(conflict.cellKey);
      });
      body.appendChild(link);

      li.appendChild(iconSpan);
      li.appendChild(body);
      list.appendChild(li);
    });

    panel.innerHTML = '';
    panel.appendChild(header);
    panel.appendChild(list);
  }

  function buildConflictMessage(conflict, employeeMap) {
    const [day, block] = conflict.cellKey.split('_');
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    const blockLabel = block.charAt(0).toUpperCase() + block.slice(1);
    const cellLabel = `${dayLabel} ${blockLabel}`;

    if (conflict.type === 'understaffed') {
      return `${cellLabel}: ${conflict.count}/${conflict.minHeadcount} staff (understaffed)`;
    }

    const emp = employeeMap?.get(conflict.employeeId);
    const empName = emp ? emp.name : conflict.employeeId;

    if (conflict.type === 'availability_violation') {
      return `${empName} — ${cellLabel}: scheduled when unavailable`;
    }

    if (conflict.type === 'double_booking') {
      return `${empName} — ${cellLabel}: appears twice`;
    }

    return conflict.message;
  }

  function scrollToCell(cellKey) {
    const cell = document.querySelector(`[data-cell-key="${cellKey}"]`);
    if (!cell) return;
    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    cell.focus();
  }

  /* ------------------------------------------------------------------
     Expose as window.Conflicts
     ------------------------------------------------------------------ */

  window.Conflicts = {
    detectConflicts,
    renderConflictPanel,
  };
})();
