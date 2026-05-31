(() => {
  // All days with their fixed offset from the ISO Monday (mon=0 … sat=5, sun=6)
  const ALL_DAYS = [
    { key: 'mon', label: 'Mon', full: 'Monday', offset: 0 },
    { key: 'tue', label: 'Tue', full: 'Tuesday', offset: 1 },
    { key: 'wed', label: 'Wed', full: 'Wednesday', offset: 2 },
    { key: 'thu', label: 'Thu', full: 'Thursday', offset: 3 },
    { key: 'fri', label: 'Fri', full: 'Friday', offset: 4 },
    { key: 'sat', label: 'Sat', full: 'Saturday', offset: 5 },
    { key: 'sun', label: 'Sun', full: 'Sunday', offset: 6 },
  ];

  const BLOCKS = [
    { key: 'morning', label: 'Morning' },
    { key: 'afternoon', label: 'Afternoon' },
    { key: 'evening', label: 'Evening' },
  ];

  // Module state
  let currentWeekOffset = 0;
  let employeeMap = new Map();

  // Last rendered settings — used by ResizeObserver to re-render with same settings
  let lastSettings = { weekStart: 'mon', showWeekends: true };

  /* ------------------------------------------------------------------
     Active days — ordered and filtered by settings
     ------------------------------------------------------------------ */

  function getActiveDays(weekStart, showWeekends) {
    // Determine display order
    let ordered;
    if (weekStart === 'sun') {
      // Sun first, with offset -1 (the day before the ISO Monday)
      const sun = { key: 'sun', label: 'Sun', full: 'Sunday', offset: -1 };
      const weekdays = ALL_DAYS.filter((d) => d.key !== 'sun');
      ordered = [sun, ...weekdays];
    } else {
      ordered = ALL_DAYS.slice();
    }

    if (!showWeekends) {
      ordered = ordered.filter((d) => d.key !== 'sat' && d.key !== 'sun');
    }

    return ordered;
  }

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

  function formatWeekLabel(weekKey, activeDays) {
    const monday = weekKeyToMonday(weekKey);

    const firstOffset = activeDays[0].offset;
    const lastOffset = activeDays[activeDays.length - 1].offset;

    const firstDate = new Date(monday);
    firstDate.setUTCDate(monday.getUTCDate() + firstOffset);
    const lastDate = new Date(monday);
    lastDate.setUTCDate(monday.getUTCDate() + lastOffset);

    const fmt = (d) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });

    if (firstDate.getUTCFullYear() !== lastDate.getUTCFullYear()) {
      return `${fmt(firstDate)}, ${firstDate.getUTCFullYear()} – ${fmt(lastDate)}, ${lastDate.getUTCFullYear()}`;
    }
    return `${fmt(firstDate)} – ${fmt(lastDate)}, ${lastDate.getUTCFullYear()}`;
  }

  function getCurrentWeekKey() {
    const base = getWeekKey(new Date());
    return offsetWeekKey(base, currentWeekOffset);
  }

  function emptyWeekCells() {
    const cells = {};
    ALL_DAYS.forEach((day) => {
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

    Promise.all([
      DB.getAllEmployees(),
      DB.getWeekShifts(weekKey),
      DB.getSetting('weekStart'),
      DB.getSetting('showWeekends'),
    ]).then(([employees, weekShifts, weekStart, showWeekends]) => {
      const ws = weekStart ?? 'mon';
      const sw = showWeekends !== undefined ? showWeekends : true;
      lastSettings = { weekStart: ws, showWeekends: sw };

      employeeMap = new Map(employees.map((emp) => [emp.id, emp]));
      const cells = weekShifts?.cells ?? emptyWeekCells();
      const monday = weekKeyToMonday(weekKey);
      const activeDays = getActiveDays(ws, sw);

      updateWeekLabel(weekKey, activeDays);
      DB.setSetting('lastWeekKey', weekKey);

      // Keep Grid.DAYS in sync so drag.js CELL_KEYS rebuild uses active days
      if (window.Grid) window.Grid.DAYS = activeDays;

      if (window.innerWidth < 768) {
        buildMobileGridDOM(cells, monday, isCurrentWeek, todayDayKey, today, activeDays);
      } else {
        buildGridDOM(cells, monday, isCurrentWeek, todayDayKey, today, activeDays);
      }

      runConflicts(activeDays);
    });
  }

  function buildGridDOM(cells, monday, isCurrentWeek, todayDayKey, today, activeDays) {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = '';
    grid.className = 'schedule-grid';
    grid.style.gridTemplateColumns = `100px repeat(${activeDays.length}, minmax(100px, 1fr))`;

    // Top-left corner cell
    const cornerCell = document.createElement('div');
    cornerCell.className = 'grid-col-header';
    cornerCell.setAttribute('aria-hidden', 'true');
    grid.appendChild(cornerCell);

    // Day column headers
    activeDays.forEach((day) => {
      const colDate = new Date(monday);
      colDate.setUTCDate(monday.getUTCDate() + day.offset);

      // Today: same day-of-week key AND same calendar date
      const isToday =
        isCurrentWeek &&
        day.key === todayDayKey &&
        colDate.toUTCString().slice(0, 16) ===
          new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
            .toUTCString()
            .slice(0, 16);

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

      activeDays.forEach((day) => {
        const colDate = new Date(monday);
        colDate.setUTCDate(monday.getUTCDate() + day.offset);

        const isToday =
          isCurrentWeek &&
          day.key === todayDayKey &&
          colDate.toUTCString().slice(0, 16) ===
            new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
              .toUTCString()
              .slice(0, 16);

        grid.appendChild(buildCell(cells, day, block, isToday));
      });
    });

    // Last column: remove right border — reapply since column count is dynamic
    grid.querySelectorAll('.grid-cell').forEach((cell, i) => {
      const colPos = (i % activeDays.length) + 1;
      cell.style.borderInlineEnd = colPos === activeDays.length ? 'none' : '';
    });

    window.Drag?.attachListeners?.();
  }

  function buildMobileGridDOM(cells, monday, isCurrentWeek, todayDayKey, today, activeDays) {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = '';
    grid.className = 'schedule-grid schedule-grid--mobile';
    grid.style.gridTemplateColumns = '';

    const stack = document.createElement('div');
    stack.className = 'mobile-day-stack';

    activeDays.forEach((day) => {
      const colDate = new Date(monday);
      colDate.setUTCDate(monday.getUTCDate() + day.offset);

      const isToday =
        isCurrentWeek &&
        day.key === todayDayKey &&
        colDate.toUTCString().slice(0, 16) ===
          new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
            .toUTCString()
            .slice(0, 16);

      const card = document.createElement('section');
      card.className = 'day-card';
      if (isToday) card.dataset.today = 'true';

      const cardHeader = document.createElement('h3');
      cardHeader.className = 'day-card-header';
      if (isToday) cardHeader.dataset.today = 'true';

      const dayNameSpan = document.createElement('span');
      dayNameSpan.textContent = day.full;

      const dateSpan = document.createElement('span');
      dateSpan.className = 'day-card-date';
      dateSpan.textContent = colDate.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      });

      cardHeader.appendChild(dayNameSpan);
      cardHeader.appendChild(dateSpan);
      card.appendChild(cardHeader);

      const rows = document.createElement('div');
      rows.className = 'day-card-rows';

      BLOCKS.forEach((block) => {
        const row = document.createElement('div');
        row.className = 'day-card-row';

        const blockLabel = document.createElement('span');
        blockLabel.className = 'day-card-block-label';
        blockLabel.textContent = block.key === 'afternoon' ? 'Aftn.' : block.label;
        blockLabel.setAttribute('aria-hidden', 'true');

        row.appendChild(blockLabel);
        row.appendChild(buildCell(cells, day, block, isToday));
        rows.appendChild(row);
      });

      card.appendChild(rows);
      stack.appendChild(card);
    });

    grid.appendChild(stack);
    window.Drag?.attachListeners?.();
  }

  function buildCell(cells, day, block, isToday) {
    const cellKey = `${day.key}_${block.key}`;
    const empIds = cells[cellKey] ?? [];

    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.cellKey = cellKey;
    cell.dataset.day = day.key;
    cell.dataset.block = block.key;
    cell.setAttribute('role', 'group');
    cell.tabIndex = -1;
    cell.setAttribute(
      'aria-label',
      `${day.full} ${block.label} — ${empIds.length} employee${empIds.length !== 1 ? 's' : ''}`
    );
    if (isToday) cell.dataset.today = 'true';

    const badge = document.createElement('div');
    badge.className = 'cell-conflict-badge';
    badge.setAttribute('aria-hidden', 'true');
    cell.appendChild(badge);

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'cell-chips';

    empIds.forEach((empId) => {
      const emp = employeeMap.get(empId);
      if (!emp) return;
      chipsContainer.appendChild(buildChip(emp, cellKey));
    });

    cell.appendChild(chipsContainer);
    return cell;
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

  function updateWeekLabel(weekKey, activeDays) {
    const label = formatWeekLabel(weekKey, activeDays);
    document.getElementById('week-label').textContent = label;
    document.title = `Shiftboard — ${label}`;
  }

  /* ------------------------------------------------------------------
     Conflict detection integration
     ------------------------------------------------------------------ */

  function runConflicts(activeDays) {
    if (!window.Conflicts) return;
    const weekKey = getCurrentWeekKey();
    const activeDayKeys = activeDays
      ? activeDays.flatMap((d) => BLOCKS.map((b) => `${d.key}_${b.key}`))
      : null;

    DB.getWeekShifts(weekKey).then((weekShifts) => {
      const cells = weekShifts?.cells ?? emptyWeekCells();
      DB.getAllEmployees().then((employees) => {
        if (employees.length === 0) {
          applyConflicts({ cells: {}, employees: {}, summary: [] });
          window.Conflicts.renderConflictPanel(
            { cells: {}, employees: {}, summary: [] },
            employeeMap
          );
          return;
        }
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
              minHeadcount,
              activeDayKeys
            );
            applyConflicts(conflictMap);
            window.Conflicts.renderConflictPanel(conflictMap, employeeMap);
          });
        });
      });
    });
  }

  function applyConflicts(conflictMap) {
    document.querySelectorAll('.grid-cell').forEach((cell) => {
      cell.classList.remove('conflict-error', 'conflict-warning');
      const badge = cell.querySelector('.cell-conflict-badge');
      if (badge) badge.innerHTML = '';
    });

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
    // Sun-start edge case: if today is Sunday, it belongs to the NEXT display week
    if (lastSettings.weekStart === 'sun' && new Date().getDay() === 0) {
      currentWeekOffset = 1;
    }
    renderGrid();
  }

  function setWeekOffset(offset) {
    currentWeekOffset = offset;
  }

  /* ------------------------------------------------------------------
     Resize: re-render when crossing the mobile/desktop breakpoint
     ------------------------------------------------------------------ */

  let lastMobile = window.innerWidth < 768;
  new ResizeObserver(() => {
    const nowMobile = window.innerWidth < 768;
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      renderGrid();
    }
  }).observe(document.body);

  /* ------------------------------------------------------------------
     Expose as window.Grid
     ------------------------------------------------------------------ */

  window.Grid = {
    ALL_DAYS,
    applyConflicts,
    BLOCKS,
    buildChip,
    DAYS: ALL_DAYS, // mutable: updated to active days after each renderGrid
    emptyWeekCells,
    getActiveDays,
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
