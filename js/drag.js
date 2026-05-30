(() => {
  /* ------------------------------------------------------------------
     Shared drag state — single source of truth for all three paths
     ------------------------------------------------------------------ */

  const dragState = {
    availSlots: null, // employee's availability slots, cached when drag starts
    employeeId: null,
    phase: 'idle', // 'idle' | 'dragging' | 'keyboard_pickup'
    preSnapshot: null, // deep clone of weekCells taken BEFORE any mutation
    sourceCellKey: null, // null = dragging from sidebar
    targetCellKey: null,
    touchCloneEl: null,
    touchOffsetX: 0,
    touchOffsetY: 0,
  };

  /* ------------------------------------------------------------------
     Announce to screen readers via aria-live region
     ------------------------------------------------------------------ */

  function announce(msg) {
    const el = document.getElementById('dnd-announcer');
    if (!el) return;
    el.textContent = '';
    // Tiny delay so screen readers re-announce even if text is the same
    setTimeout(() => {
      el.textContent = msg;
    }, 50);
  }

  /* ------------------------------------------------------------------
     Take a deep snapshot of the current week's cells
     ------------------------------------------------------------------ */

  function snapshotCells(cells) {
    const snap = {};
    Object.keys(cells).forEach((key) => {
      snap[key] = [...cells[key]];
    });
    return snap;
  }

  /* ------------------------------------------------------------------
     Perform a drop: move employeeId from sourceCellKey into targetCellKey
     ------------------------------------------------------------------ */

  function performDrop(employeeId, sourceCellKey, targetCellKey) {
    if (!targetCellKey) return;
    if (sourceCellKey === targetCellKey) return;

    const weekKey = window.Grid.getCurrentWeekKey();
    DB.getWeekShifts(weekKey).then((weekShifts) => {
      const cells = weekShifts?.cells ?? window.Grid.emptyWeekCells();

      // Save snapshot before mutating (only if not already saved this drag)
      if (!dragState.preSnapshot) {
        dragState.preSnapshot = snapshotCells(cells);
      }

      // Remove from source cell (if it came from a cell, not the sidebar)
      if (sourceCellKey) {
        cells[sourceCellKey] = (cells[sourceCellKey] ?? []).filter((id) => id !== employeeId);
      }

      // Add to target (deduplicate)
      if (!(cells[targetCellKey] ?? []).includes(employeeId)) {
        cells[targetCellKey] = [...(cells[targetCellKey] ?? []), employeeId];
      }

      DB.setWeekShifts({ weekKey, cells, updatedAt: Date.now() }).then(() => {
        window.Grid.renderGrid();
      });
    });
  }

  /* ------------------------------------------------------------------
     Remove an employee chip from its source cell
     ------------------------------------------------------------------ */

  function setDropZoneLabel(text) {
    const label = document.querySelector('#sidebar-drop-zone .drop-zone-label');
    if (label) label.textContent = text;
  }

  /* ------------------------------------------------------------------
     Availability overlay — highlights cells while an employee is being
     dragged so the scheduler can see viable drops at a glance
     ------------------------------------------------------------------ */

  function showAvailabilityOverlay(employeeId) {
    DB.getAvailability(employeeId).then((avail) => {
      const slots = avail?.slots ?? {};
      dragState.availSlots = slots;
      document.querySelectorAll('.grid-cell').forEach((cell) => {
        const state = slots[cell.dataset.cellKey] ?? 'available';
        if (state === 'unavailable') cell.dataset.availDrag = 'unavailable';
        else if (state === 'preferred') cell.dataset.availDrag = 'preferred';
      });
    });
  }

  function clearAvailabilityOverlay() {
    document.querySelectorAll('[data-avail-drag]').forEach((cell) => {
      delete cell.dataset.availDrag;
    });
    dragState.availSlots = null;
  }

  function performRemove(employeeId, sourceCellKey) {
    if (!sourceCellKey) return;

    const weekKey = window.Grid.getCurrentWeekKey();
    DB.getWeekShifts(weekKey).then((weekShifts) => {
      const cells = weekShifts?.cells ?? window.Grid.emptyWeekCells();

      if (!dragState.preSnapshot) {
        dragState.preSnapshot = snapshotCells(cells);
      }

      cells[sourceCellKey] = (cells[sourceCellKey] ?? []).filter((id) => id !== employeeId);

      DB.setWeekShifts({ weekKey, cells, updatedAt: Date.now() }).then(() => {
        window.Grid.renderGrid();
      });
    });
  }

  function performRemoveAllCells(employeeId) {
    const weekKey = window.Grid.getCurrentWeekKey();
    DB.getWeekShifts(weekKey).then((weekShifts) => {
      const cells = weekShifts?.cells ?? window.Grid.emptyWeekCells();

      if (!dragState.preSnapshot) {
        dragState.preSnapshot = snapshotCells(cells);
      }

      let removed = false;
      Object.keys(cells).forEach((key) => {
        const before = cells[key].length;
        cells[key] = cells[key].filter((id) => id !== employeeId);
        if (cells[key].length < before) removed = true;
      });

      if (!removed) return;

      DB.setWeekShifts({ weekKey, cells, updatedAt: Date.now() }).then(() => {
        window.Grid.renderGrid();
        window.Export?.showToast?.('Removed from all shifts this week');
      });
    });
  }

  /* ------------------------------------------------------------------
     Undo last drag operation
     ------------------------------------------------------------------ */

  function undoLastDrag() {
    if (!dragState.preSnapshot) {
      announce('Nothing to undo.');
      return;
    }

    // Cancel any active keyboard pickup
    if (dragState.phase === 'keyboard_pickup') {
      cancelKeyboardPickup();
    }

    const weekKey = window.Grid.getCurrentWeekKey();
    const snapshot = dragState.preSnapshot;
    dragState.preSnapshot = null;

    DB.setWeekShifts({ weekKey, cells: snapshot, updatedAt: Date.now() }).then(() => {
      window.Grid.renderGrid();
      announce('Last action undone.');
    });
  }

  /* ------------------------------------------------------------------
     HTML5 drag events
     ------------------------------------------------------------------ */

  function onDragStart(e) {
    const chip = e.currentTarget;
    dragState.phase = 'dragging';
    dragState.employeeId = chip.dataset.employeeId;
    dragState.sourceCellKey = chip.dataset.sourceCellKey || null;
    dragState.preSnapshot = null; // will be captured on first mutation
    e.dataTransfer.setData('text/plain', chip.dataset.employeeId);
    e.dataTransfer.effectAllowed = 'move';
    chip.classList.add('drag-source');
    setDropZoneLabel(
      dragState.sourceCellKey ? 'Remove from this shift' : 'Remove from all shifts this week'
    );
    showAvailabilityOverlay(dragState.employeeId);
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('drag-source');
    clearDragOverStyles();
    clearAvailabilityOverlay();
    dragState.phase = 'idle';
    setDropZoneLabel('Remove from schedule');
  }

  function onDragOver(e) {
    const cellKey = e.currentTarget.dataset.cellKey;
    if (dragState.availSlots?.[cellKey] === 'unavailable') {
      e.dataTransfer.dropEffect = 'none';
      clearDragOverStyles();
      dragState.targetCellKey = null;
      return;
    }
    // REQUIRED: prevents browser default which blocks the drop event
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDragOverStyles();
    e.currentTarget.classList.add('drag-over');
    dragState.targetCellKey = cellKey;
  }

  function onDragLeave(e) {
    // Only clear if leaving the cell itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over');
    }
  }

  function onDropCell(e) {
    e.preventDefault();
    clearDragOverStyles();
    const empId = e.dataTransfer.getData('text/plain');
    const cellKey = e.currentTarget.dataset.cellKey;
    performDrop(empId, dragState.sourceCellKey, cellKey);
    dragState.phase = 'idle';
  }

  function onDropSidebar(e) {
    e.preventDefault();
    clearDragOverStyles();
    const empId = e.dataTransfer.getData('text/plain');
    if (dragState.sourceCellKey) {
      performRemove(empId, dragState.sourceCellKey);
    } else {
      performRemoveAllCells(empId);
    }
    dragState.phase = 'idle';
  }

  function onSidebarDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.getElementById('sidebar-drop-zone').classList.add('drag-over');
  }

  function onSidebarDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      document.getElementById('sidebar-drop-zone').classList.remove('drag-over');
    }
  }

  function clearDragOverStyles() {
    document.querySelectorAll('.drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
  }

  /* ------------------------------------------------------------------
     Touch drag events (parallel path for mobile)
     ------------------------------------------------------------------ */

  function onTouchStart(e) {
    const chip = e.currentTarget;
    const touch = e.touches[0];

    dragState.phase = 'dragging';
    dragState.employeeId = chip.dataset.employeeId;
    dragState.sourceCellKey = chip.dataset.sourceCellKey || null;
    dragState.preSnapshot = null;
    setDropZoneLabel(
      dragState.sourceCellKey ? 'Remove from this shift' : 'Remove from all shifts this week'
    );
    showAvailabilityOverlay(dragState.employeeId);

    // Create floating clone
    const rect = chip.getBoundingClientRect();
    dragState.touchOffsetX = touch.clientX - rect.left;
    dragState.touchOffsetY = touch.clientY - rect.top;

    const clone = chip.cloneNode(true);
    clone.style.cssText = `
      left: ${rect.left}px;
      opacity: 0.85;
      pointer-events: none;
      position: fixed;
      top: ${rect.top}px;
      z-index: 1000;
      width: ${rect.width}px;
    `;
    document.body.appendChild(clone);
    dragState.touchCloneEl = clone;
  }

  function onTouchMove(e) {
    if (dragState.phase !== 'dragging' || !dragState.touchCloneEl) return;
    e.preventDefault(); // prevent page scroll during drag
    const touch = e.touches[0];

    dragState.touchCloneEl.style.left = `${touch.clientX - dragState.touchOffsetX}px`;
    dragState.touchCloneEl.style.top = `${touch.clientY - dragState.touchOffsetY}px`;

    // Find element under finger (hide clone briefly to pierce it)
    dragState.touchCloneEl.style.display = 'none';
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    dragState.touchCloneEl.style.display = '';

    clearDragOverStyles();
    const cell = target?.closest('[data-cell-key]');
    if (cell) {
      cell.classList.add('drag-over');
      dragState.targetCellKey = cell.dataset.cellKey;
    } else {
      dragState.targetCellKey = null;
      const zone = target?.closest('#sidebar-drop-zone');
      if (zone) zone.classList.add('drag-over');
    }
  }

  function onTouchEnd(e) {
    if (dragState.phase !== 'dragging') return;
    const touch = e.changedTouches[0];

    // Remove clone
    dragState.touchCloneEl?.remove();
    dragState.touchCloneEl = null;
    clearDragOverStyles();

    const savedSlots = dragState.availSlots;
    clearAvailabilityOverlay();

    // Find final target
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = target?.closest('[data-cell-key]');
    const zone = target?.closest('#sidebar-drop-zone');

    if (cell) {
      if (savedSlots?.[cell.dataset.cellKey] === 'unavailable') {
        announce('Cannot drop here — this slot is unavailable.');
        window.Export?.showToast?.('Cannot schedule — employee is unavailable');
      } else {
        performDrop(dragState.employeeId, dragState.sourceCellKey, cell.dataset.cellKey);
      }
    } else if (zone) {
      if (dragState.sourceCellKey) {
        performRemove(dragState.employeeId, dragState.sourceCellKey);
      } else {
        performRemoveAllCells(dragState.employeeId);
      }
    }

    dragState.phase = 'idle';
    dragState.employeeId = null;
    dragState.sourceCellKey = null;
    dragState.targetCellKey = null;
    setDropZoneLabel('Remove from schedule');
  }

  /* ------------------------------------------------------------------
     Keyboard drag alternative
     ------------------------------------------------------------------ */

  // 7×3 coordinate map: [dayIndex][blockIndex] → cellKey
  const CELL_KEYS = window.Grid
    ? window.Grid.DAYS.flatMap((day, di) =>
        window.Grid.BLOCKS.map((block, bi) => ({ key: `${day.key}_${block.key}`, di, bi }))
      )
    : [];

  function getCellCoords(cellKey) {
    const entry = CELL_KEYS.find((c) => c.key === cellKey);
    return entry ? { di: entry.di, bi: entry.bi } : null;
  }

  function getCellKeyFromCoords(di, bi) {
    const entry = CELL_KEYS.find((c) => c.di === di && c.bi === bi);
    return entry ? entry.key : null;
  }

  function startKeyboardPickup(chip) {
    if (dragState.phase !== 'idle') return;
    dragState.phase = 'keyboard_pickup';
    dragState.employeeId = chip.dataset.employeeId;
    dragState.sourceCellKey = chip.dataset.sourceCellKey || null;
    dragState.preSnapshot = null;
    dragState.targetCellKey = dragState.sourceCellKey;

    chip.classList.add('keyboard-active');
    showAvailabilityOverlay(dragState.employeeId);

    const empName = chip.querySelector('.chip-name')?.textContent ?? 'employee';
    const location = dragState.sourceCellKey
      ? `from ${dragState.sourceCellKey.replace('_', ' ')}`
      : 'from the sidebar';
    announce(
      `Picked up ${empName} ${location}. Use arrow keys to navigate to a cell, Enter to drop, Escape to cancel.`
    );
  }

  function cancelKeyboardPickup() {
    dragState.phase = 'idle';
    dragState.employeeId = null;
    dragState.sourceCellKey = null;
    dragState.targetCellKey = null;
    document.querySelectorAll('.keyboard-active').forEach((el) => {
      el.classList.remove('keyboard-active');
    });
    clearAvailabilityOverlay();
    announce('Cancelled.');
  }

  function navigateKeyboard(direction) {
    if (dragState.phase !== 'keyboard_pickup') return;

    const current = dragState.targetCellKey ?? dragState.sourceCellKey;
    if (!current) return;

    const coords = getCellCoords(current);
    if (!coords) return;

    let { di, bi } = coords;
    const maxDi = (window.Grid?.DAYS?.length ?? 7) - 1;
    const maxBi = (window.Grid?.BLOCKS?.length ?? 3) - 1;

    if (direction === 'left') di = Math.max(0, di - 1);
    else if (direction === 'right') di = Math.min(maxDi, di + 1);
    else if (direction === 'up') bi = Math.max(0, bi - 1);
    else if (direction === 'down') bi = Math.min(maxBi, bi + 1);

    const newKey = getCellKeyFromCoords(di, bi);
    if (!newKey || newKey === dragState.targetCellKey) return;

    dragState.targetCellKey = newKey;

    // Focus the target cell and highlight it
    clearDragOverStyles();
    const targetCell = document.querySelector(`[data-cell-key="${newKey}"]`);
    if (targetCell) {
      targetCell.classList.add('drag-over');
      targetCell.focus();
    }

    const [day, block] = newKey.split('_');
    announce(`${capitalize(day)} ${block}.`);
  }

  function dropKeyboard() {
    if (dragState.phase !== 'keyboard_pickup') return;
    const { employeeId, sourceCellKey, targetCellKey } = dragState;

    if (dragState.availSlots?.[targetCellKey] === 'unavailable') {
      announce('This slot is unavailable — use arrow keys to navigate to another cell.');
      return;
    }

    clearDragOverStyles();
    document.querySelectorAll('.keyboard-active').forEach((el) => {
      el.classList.remove('keyboard-active');
    });
    clearAvailabilityOverlay();

    dragState.phase = 'idle';
    dragState.employeeId = null;
    dragState.sourceCellKey = null;
    dragState.targetCellKey = null;

    if (targetCellKey) {
      performDrop(employeeId, sourceCellKey, targetCellKey);
      const [day, block] = targetCellKey.split('_');
      announce(`Dropped into ${capitalize(day)} ${block}.`);
    }
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ------------------------------------------------------------------
     Global keydown handler (phase-aware)
     ------------------------------------------------------------------ */

  function onKeyDown(e) {
    // Chip Enter = pick up
    if (e.key === 'Enter' && dragState.phase === 'idle' && e.target.matches('[data-employee-id]')) {
      e.preventDefault();
      startKeyboardPickup(e.target);
      return;
    }

    // Keyboard pickup controls
    if (dragState.phase === 'keyboard_pickup') {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelKeyboardPickup();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        dropKeyboard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateKeyboard('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateKeyboard('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateKeyboard('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateKeyboard('down');
      }
      return;
    }

    // Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoLastDrag();
    }
  }

  /* ------------------------------------------------------------------
     Attach listeners to chips and cells after grid render
     ------------------------------------------------------------------ */

  function attachListeners() {
    // Rebuild CELL_KEYS map now that Grid is initialized
    if (window.Grid) {
      CELL_KEYS.length = 0;
      window.Grid.DAYS.forEach((day, di) => {
        window.Grid.BLOCKS.forEach((block, bi) => {
          CELL_KEYS.push({ key: `${day.key}_${block.key}`, di, bi });
        });
      });
    }

    // Grid cell drag targets
    document.querySelectorAll('.grid-cell').forEach((cell) => {
      cell.addEventListener('dragover', onDragOver);
      cell.addEventListener('dragleave', onDragLeave);
      cell.addEventListener('drop', onDropCell);
    });

    // Grid chips (HTML5 + touch)
    document.querySelectorAll('.grid-cell .chip').forEach((chip) => {
      chip.addEventListener('dragstart', onDragStart);
      chip.addEventListener('dragend', onDragEnd);
      chip.addEventListener('touchstart', onTouchStart, { passive: true });
      chip.addEventListener('touchmove', onTouchMove, { passive: false });
      chip.addEventListener('touchend', onTouchEnd);
    });
  }

  function attachSidebarListeners() {
    document.querySelectorAll('.employee-chip').forEach((chip) => {
      chip.addEventListener('dragstart', onDragStart);
      chip.addEventListener('dragend', onDragEnd);
      chip.addEventListener('touchstart', onTouchStart, { passive: true });
      chip.addEventListener('touchmove', onTouchMove, { passive: false });
      chip.addEventListener('touchend', onTouchEnd);
    });
  }

  /* ------------------------------------------------------------------
     One-time setup
     ------------------------------------------------------------------ */

  function init() {
    // Sidebar drop zone
    const zone = document.getElementById('sidebar-drop-zone');

    const iconSlot = zone.querySelector('.drop-zone-icon');
    if (iconSlot) {
      const tpl = document.getElementById('icon-trash');
      if (tpl) iconSlot.appendChild(tpl.content.cloneNode(true));
    }

    zone.addEventListener('dragover', onSidebarDragOver);
    zone.addEventListener('dragleave', onSidebarDragLeave);
    zone.addEventListener('drop', onDropSidebar);

    // Global keydown for keyboard drag + undo
    document.addEventListener('keydown', onKeyDown);
  }

  /* ------------------------------------------------------------------
     Expose as window.Drag
     ------------------------------------------------------------------ */

  window.Drag = {
    attachListeners,
    attachSidebarListeners,
    init,
    undoLastDrag,
  };
})();
