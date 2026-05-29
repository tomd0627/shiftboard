(() => {
  const DAYS = [
    { key: 'mon', label: 'Mon', full: 'Monday' },
    { key: 'tue', label: 'Tue', full: 'Tuesday' },
    { key: 'wed', label: 'Wed', full: 'Wednesday' },
    { key: 'thu', label: 'Thu', full: 'Thursday' },
    { key: 'fri', label: 'Fri', full: 'Friday' },
    { key: 'sat', label: 'Sat', full: 'Saturday' },
    { key: 'sun', label: 'Sun', full: 'Sunday' },
  ];

  const BLOCKS = [
    { key: 'morning', label: 'Morning' },
    { key: 'afternoon', label: 'Afternoon' },
    { key: 'evening', label: 'Evening' },
  ];

  // Module state
  let currentWeekOffset = 0;
  let employeeMap = new Map();

  /* ------------------------------------------------------------------
     Week key utilities (ISO 8601 week numbers)
     ------------------------------------------------------------------ */

  function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  function weekKeyToMonday(weekKey) {
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    // Jan 4 is always in week 1 per ISO 8601
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
    return monday;
  }

  function offsetWeekKey(weekKey, offset) {
    const monday = weekKeyToMonday(weekKey);
    monday.setUTCDate(monday.getUTCDate() + offset * 7);
    return getWeekKey(monday);
  }

  function formatWeekLabel(weekKey) {
    const monday = weekKeyToMonday(weekKey);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const fmt = (d) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });

    if (monday.getUTCFullYear() !== sunday.getUTCFullYear()) {
      return `${fmt(monday)}, ${monday.getUTCFullYear()} – ${fmt(sunday)}, ${sunday.getUTCFullYear()}`;
    }
    return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getUTCFullYear()}`;
  }

  function getCurrentWeekKey() {
    const base = getWeekKey(new Date());
    return offsetWeekKey(base, currentWeekOffset);
  }

  function emptyWeekCells() {
    const cells = {};
    DAYS.forEach((day) => {
      BLOCKS.forEach((block) => {
        cells[`${day.key}_${block.key}`] = [];
      });
    });
    return cells;
  }

  /* ------------------------------------------------------------------
     Grid rendering
     ------------------------------------------------------------------ */

  function renderGrid() {
    const weekKey = getCurrentWeekKey();
    const today = new Date();
    const todayWeekKey = getWeekKey(today);
    const todayDayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];
    const isCurrentWeek = weekKey === todayWeekKey;

    // Fetch employees and week data in parallel
    Promise.all([DB.getAllEmployees(), DB.getWeekShifts(weekKey)]).then(
      ([employees, weekShifts]) => {
        // Build employee lookup map
        employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

        const cells = weekShifts?.cells ?? emptyWeekCells();

        // Build week start date for column headers
        const monday = weekKeyToMonday(weekKey);

        buildGridDOM(cells, monday, isCurrentWeek, todayDayKey);
        updateWeekLabel(weekKey);
        DB.setSetting('lastWeekKey', weekKey);

        // Run conflict detection after render
        runConflicts();
      }
    );
  }

  function buildGridDOM(cells, monday, isCurrentWeek, todayDayKey) {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = '';

    // Top-left corner cell
    const cornerCell = document.createElement('div');
    cornerCell.className = 'grid-col-header';
    cornerCell.setAttribute('aria-hidden', 'true');
    grid.appendChild(cornerCell);

    // Day column headers
    DAYS.forEach((day, i) => {
      const colDate = new Date(monday);
      colDate.setUTCDate(monday.getUTCDate() + i);
      const isToday = isCurrentWeek && day.key === todayDayKey;

      const header = document.createElement('div');
      header.className = 'grid-col-header';
      header.setAttribute('aria-label', day.full);
      if (isToday) header.dataset.today = 'true';

      const dayLabel = document.createElement('span');
      dayLabel.textContent = day.label;

      const dateLabel = document.createElement('span');
      dateLabel.className = 'col-date';
      dateLabel.textContent = colDate.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      });

      header.appendChild(dayLabel);
      header.appendChild(dateLabel);
      grid.appendChild(header);
    });

    // Row headers + cells
    BLOCKS.forEach((block) => {
      const rowHeader = document.createElement('div');
      rowHeader.className = 'grid-row-header';
      rowHeader.textContent = block.label;
      rowHeader.setAttribute('aria-hidden', 'true');
      grid.appendChild(rowHeader);

      DAYS.forEach((day) => {
        const cellKey = `${day.key}_${block.key}`;
        const empIds = cells[cellKey] ?? [];
        const isToday = isCurrentWeek && day.key === todayDayKey;

        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.cellKey = cellKey;
        cell.dataset.day = day.key;
        cell.dataset.block = block.key;
        cell.setAttribute('role', 'group');
        cell.setAttribute(
          'aria-label',
          `${day.full} ${block.label} — ${empIds.length} employee${empIds.length !== 1 ? 's' : ''}`
        );
        if (isToday) cell.dataset.today = 'true';

        // Conflict badge placeholder
        const badge = document.createElement('div');
        badge.className = 'cell-conflict-badge';
        badge.setAttribute('aria-hidden', 'true');
        cell.appendChild(badge);

        // Employee chips
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'cell-chips';

        empIds.forEach((empId) => {
          const emp = employeeMap.get(empId);
          if (!emp) return;
          chipsContainer.appendChild(buildChip(emp, cellKey));
        });

        cell.appendChild(chipsContainer);
        grid.appendChild(cell);
      });
    });

    // Attach drag listeners to the newly built DOM
    window.Drag?.attachListeners?.();
  }

  function buildChip(emp, sourceCellKey) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.backgroundColor = emp.colorHex;
    chip.draggable = true;
    chip.tabIndex = 0;
    chip.dataset.employeeId = emp.id;
    chip.dataset.sourceCellKey = sourceCellKey;
    chip.setAttribute(
      'aria-label',
      `Drag ${emp.name} to reschedule. Press Enter to pick up with keyboard.`
    );

    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.backgroundColor = 'rgba(255,255,255,0.4)';
    dot.setAttribute('aria-hidden', 'true');

    const nameEl = document.createElement('span');
    nameEl.className = 'chip-name';
    nameEl.textContent = emp.name;

    chip.appendChild(dot);
    chip.appendChild(nameEl);
    return chip;
  }

  function updateWeekLabel(weekKey) {
    document.getElementById('week-label').textContent = formatWeekLabel(weekKey);
    document.title = `Shiftboard — ${formatWeekLabel(weekKey)}`;
  }

  /* ------------------------------------------------------------------
     Conflict detection integration
     ------------------------------------------------------------------ */

  function runConflicts() {
    if (!window.Conflicts) return;
    const weekKey = getCurrentWeekKey();
    DB.getWeekShifts(weekKey).then((weekShifts) => {
      const cells = weekShifts?.cells ?? emptyWeekCells();
      DB.getAllEmployees().then((employees) => {
        const availPromises = employees.map((emp) =>
          DB.getAvailability(emp.id).then((avail) => [emp.id, avail])
        );
        Promise.all(availPromises).then((availPairs) => {
          const availabilityMap = {};
          availPairs.forEach(([id, avail]) => {
            availabilityMap[id] = avail;
          });
          DB.getSetting('minHeadcount').then((mc) => {
            const minHeadcount = mc ?? 1;
            const conflictMap = window.Conflicts.detectConflicts(
              cells,
              availabilityMap,
              minHeadcount
            );
            applyConflicts(conflictMap);
            window.Conflicts.renderConflictPanel(conflictMap, employeeMap);
          });
        });
      });
    });
  }

  function applyConflicts(conflictMap) {
    // Clear previous conflict states
    document.querySelectorAll('.grid-cell').forEach((cell) => {
      cell.classList.remove('conflict-error', 'conflict-warning');
      const badge = cell.querySelector('.cell-conflict-badge');
      if (badge) badge.innerHTML = '';
    });

    // Apply cell-level conflicts
    Object.entries(conflictMap.cells).forEach(([cellKey, conflicts]) => {
      const cell = document.querySelector(`[data-cell-key="${cellKey}"]`);
      if (!cell || conflicts.length === 0) return;

      const hasError = conflicts.some((c) => c.severity === 'error');
      cell.classList.add(hasError ? 'conflict-error' : 'conflict-warning');

      const badge = cell.querySelector('.cell-conflict-badge');
      if (badge) {
        const iconName = hasError ? 'x-circle' : 'exclamation-triangle';
        const tpl = document.getElementById(`icon-${iconName}`);
        if (tpl) badge.appendChild(tpl.content.cloneNode(true));
      }
    });

    // Apply employee-level conflicts
    Object.entries(conflictMap.employees).forEach(([, conflicts]) => {
      conflicts.forEach((conflict) => {
        const cell = document.querySelector(`[data-cell-key="${conflict.cellKey}"]`);
        if (!cell) return;
        const isError = conflict.severity === 'error';
        cell.classList.add(isError ? 'conflict-error' : 'conflict-warning');
        const badge = cell.querySelector('.cell-conflict-badge');
        if (badge && badge.innerHTML === '') {
          const iconName = isError ? 'x-circle' : 'exclamation-triangle';
          const tpl = document.getElementById(`icon-${iconName}`);
          if (tpl) badge.appendChild(tpl.content.cloneNode(true));
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Week navigation
     ------------------------------------------------------------------ */

  function goToPrevWeek() {
    currentWeekOffset--;
    renderGrid();
  }

  function goToNextWeek() {
    currentWeekOffset++;
    renderGrid();
  }

  function goToCurrentWeek() {
    currentWeekOffset = 0;
    renderGrid();
  }

  function setWeekOffset(offset) {
    currentWeekOffset = offset;
  }

  /* ------------------------------------------------------------------
     Expose as window.Grid
     ------------------------------------------------------------------ */

  window.Grid = {
    applyConflicts,
    BLOCKS,
    buildChip,
    DAYS,
    emptyWeekCells,
    getCurrentWeekKey,
    getWeekKey,
    goToCurrentWeek,
    goToNextWeek,
    goToPrevWeek,
    renderGrid,
    runConflicts,
    setWeekOffset,
    weekKeyToMonday,
  };
})();
