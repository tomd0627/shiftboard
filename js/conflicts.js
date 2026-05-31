(() => {
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const BLOCKS = ['morning', 'afternoon', 'evening'];
  const ALL_CELL_KEYS = ALL_DAYS.flatMap((day) => BLOCKS.map((block) => `${day}_${block}`));

  /* ------------------------------------------------------------------
     Pure conflict detection — no DOM access, no async
     ------------------------------------------------------------------ */

  // activeDayKeys: optional array of cell keys for visible days only.
  // When provided, conflict rules are scoped to those cells so hidden
  // days (e.g. weekends) never produce phantom panel items.
  function detectConflicts(weekCells, availabilityMap, minHeadcount, activeDayKeys) {
    const activeKeys = activeDayKeys ?? ALL_CELL_KEYS;
    const result = {
      cells: {},
      employees: {},
      summary: [],
    };

    const activeKeySet = new Set(activeKeys);

    // Rule 1: Double-booking — same employee in the same cell key more than once
    // (data integrity guard; prevented by performDrop dedup but caught here too)
    const empCells = {};
    Object.entries(weekCells).forEach(([cellKey, empIds]) => {
      if (!activeKeySet.has(cellKey)) return;
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
      if (!activeKeySet.has(cellKey)) return;
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

    // Rule 3: Understaffed — fewer employees than minHeadcount (active days only)
    if (minHeadcount > 0) {
      activeKeys.forEach((cellKey) => {
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
      panel.classList.remove('conflict-panel--error');
      panel.innerHTML = '';
      return;
    }

    panel.hidden = false;

    const errors = summary.filter((c) => c.severity === 'error');
    const warnings = summary.filter((c) => c.severity === 'warning');
    const hasErrors = errors.length > 0;

    panel.classList.toggle('conflict-panel--error', hasErrors);

    // Header: "2 errors, 5 warnings" or "14 warnings"
    const parts = [];
    if (errors.length > 0) parts.push(`${errors.length} error${errors.length !== 1 ? 's' : ''}`);
    if (warnings.length > 0)
      parts.push(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);

    const header = document.createElement('div');
    header.className = 'conflict-panel-header';

    const iconTplId = hasErrors ? 'icon-x-circle' : 'icon-exclamation-triangle';
    const iconTpl = document.getElementById(iconTplId);
    if (iconTpl) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'conflict-item-icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.appendChild(iconTpl.content.cloneNode(true));
      header.appendChild(iconSpan);
    }

    const title = document.createElement('span');
    title.className = `conflict-panel-title${hasErrors ? ' conflict-panel-title--error' : ''}`;
    title.textContent = parts.join(', ');
    header.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'conflict-list';

    // Errors first
    errors.forEach((conflict) => {
      list.appendChild(buildConflictItem(conflict, employeeMap));
    });

    // Availability violations and double-bookings as individual items
    warnings
      .filter((c) => c.type !== 'understaffed')
      .forEach((c) => {
        list.appendChild(buildConflictItem(c, employeeMap));
      });

    // Understaffed: collapse into a group when there are more than 3
    const understaffed = warnings.filter((c) => c.type === 'understaffed');
    if (understaffed.length > 0) {
      if (understaffed.length <= 3) {
        understaffed.forEach((c) => {
          list.appendChild(buildConflictItem(c, employeeMap));
        });
      } else {
        list.appendChild(buildUnderstaffedGroup(understaffed));
      }
    }

    panel.innerHTML = '';
    panel.appendChild(header);
    panel.appendChild(list);
  }

  function buildConflictItem(conflict, employeeMap) {
    const li = document.createElement('li');
    li.className = `conflict-item conflict-item--${conflict.severity}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'conflict-item-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    const icoId = conflict.severity === 'error' ? 'icon-x-circle' : 'icon-exclamation-triangle';
    const icoTpl = document.getElementById(icoId);
    if (icoTpl) iconSpan.appendChild(icoTpl.content.cloneNode(true));

    const body = document.createElement('div');
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
    return li;
  }

  function buildUnderstaffedGroup(conflicts) {
    const li = document.createElement('li');
    li.className = 'conflict-item conflict-item--warning conflict-group';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'conflict-item-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    const icoTpl = document.getElementById('icon-exclamation-triangle');
    if (icoTpl) iconSpan.appendChild(icoTpl.content.cloneNode(true));

    const body = document.createElement('div');
    body.className = 'conflict-item-body';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'conflict-group-toggle';
    toggle.setAttribute('aria-expanded', 'false');

    const toggleText = document.createElement('span');
    toggleText.textContent = `${conflicts.length} shifts understaffed`;
    toggle.appendChild(toggleText);

    const chevTpl = document.getElementById('icon-chevron-right');
    if (chevTpl) {
      const chevSpan = document.createElement('span');
      chevSpan.className = 'conflict-group-chevron';
      chevSpan.setAttribute('aria-hidden', 'true');
      chevSpan.appendChild(chevTpl.content.cloneNode(true));
      toggle.appendChild(chevSpan);
    }

    const sublist = document.createElement('ul');
    sublist.className = 'conflict-sublist';
    sublist.hidden = true;

    conflicts.forEach((c) => {
      const subli = document.createElement('li');
      subli.className = 'conflict-subitem';

      const [day, block] = c.cellKey.split('_');
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const blockLabel = block.charAt(0).toUpperCase() + block.slice(1);

      const textSpan = document.createElement('span');
      textSpan.textContent = `${dayLabel} ${blockLabel}: ${c.count}/${c.minHeadcount} staff`;

      const link = document.createElement('a');
      link.className = 'conflict-link';
      link.href = '#';
      link.textContent = 'Go to cell';
      link.dataset.cellKey = c.cellKey;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToCell(c.cellKey);
      });

      subli.appendChild(textSpan);
      subli.appendChild(link);
      sublist.appendChild(subli);
    });

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      sublist.hidden = expanded;
    });

    body.appendChild(toggle);
    body.appendChild(sublist);
    li.appendChild(iconSpan);
    li.appendChild(body);
    return li;
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
    cell.classList.remove('cell-jump');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cell.classList.add('cell-jump');
        cell.addEventListener('animationend', () => cell.classList.remove('cell-jump'), {
          once: true,
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     Expose as window.Conflicts
     ------------------------------------------------------------------ */

  window.Conflicts = {
    detectConflicts,
    renderConflictPanel,
  };
})();
