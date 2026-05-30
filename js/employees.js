(() => {
  const CHIP_COLORS = [
    { name: 'Teal', hex: '#0F766E' },
    { name: 'Indigo', hex: '#4338CA' },
    { name: 'Rose', hex: '#BE123C' },
    { name: 'Amber', hex: '#B45309' },
    { name: 'Violet', hex: '#6D28D9' },
    { name: 'Emerald', hex: '#065F46' },
    { name: 'Sky', hex: '#0369A1' },
    { name: 'Fuchsia', hex: '#86198F' },
  ];

  // Employee being edited; null when adding new
  let editingEmployeeId = null;

  /* ------------------------------------------------------------------
     Icon helper — clones an SVG from <template id="icon-*">
     ------------------------------------------------------------------ */

  function getIcon(name) {
    const tpl = document.getElementById(`icon-${name}`);
    if (!tpl) return document.createTextNode('');
    return tpl.content.cloneNode(true);
  }

  /* ------------------------------------------------------------------
     Auto-assign the least-used color preset
     ------------------------------------------------------------------ */

  function pickAutoColor(employees) {
    const counts = new Array(CHIP_COLORS.length).fill(0);
    employees.forEach((emp) => {
      if (emp.colorPreset >= 0 && emp.colorPreset < counts.length) {
        counts[emp.colorPreset]++;
      }
    });
    return counts.indexOf(Math.min(...counts));
  }

  /* ------------------------------------------------------------------
     Render employee list
     ------------------------------------------------------------------ */

  function renderEmployeeList() {
    const list = document.getElementById('employee-list');
    const searchVal = document.getElementById('employee-search').value.toLowerCase().trim();
    const emptyState = document.getElementById('empty-state');
    const gridWrapper = document.querySelector('.grid-wrapper');

    DB.getAllEmployees().then((employees) => {
      if (employees.length === 0) {
        list.innerHTML = '';
        emptyState.hidden = false;
        gridWrapper.hidden = true;
        return;
      }
      emptyState.hidden = true;
      gridWrapper.hidden = false;

      const filtered = employees.filter((emp) => {
        if (!searchVal) return true;
        return (
          emp.name.toLowerCase().includes(searchVal) || emp.role.toLowerCase().includes(searchVal)
        );
      });

      list.innerHTML = '';
      filtered.forEach((emp) => {
        const li = document.createElement('li');
        li.className = 'employee-list-item';
        li.dataset.employeeId = emp.id;

        // Draggable chip
        const chip = document.createElement('div');
        chip.className = 'employee-chip';
        chip.style.backgroundColor = emp.colorHex;
        chip.draggable = true;
        chip.tabIndex = 0;
        chip.dataset.employeeId = emp.id;
        chip.dataset.sourceCellKey = '';
        chip.setAttribute(
          'aria-label',
          `Drag ${emp.name} to schedule. Press Enter to pick up with keyboard.`
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

        // Employee info
        const info = document.createElement('div');
        info.className = 'employee-info';

        const roleEl = document.createElement('div');
        roleEl.className = 'employee-role';
        roleEl.textContent = emp.role;
        info.appendChild(roleEl);

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'employee-actions';

        const availBtn = document.createElement('button');
        availBtn.type = 'button';
        availBtn.className = 'btn-icon';
        availBtn.setAttribute('aria-label', `Edit ${emp.name}'s availability`);
        availBtn.title = `Edit ${emp.name}'s availability`;
        availBtn.dataset.action = 'availability';
        availBtn.dataset.employeeId = emp.id;
        availBtn.appendChild(getIcon('calendar'));

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-icon';
        editBtn.setAttribute('aria-label', `Edit ${emp.name}`);
        editBtn.title = `Edit ${emp.name}`;
        editBtn.dataset.action = 'edit';
        editBtn.dataset.employeeId = emp.id;
        editBtn.appendChild(getIcon('pencil'));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-icon';
        deleteBtn.setAttribute('aria-label', `Delete ${emp.name}`);
        deleteBtn.title = `Delete ${emp.name}`;
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.employeeId = emp.id;
        deleteBtn.appendChild(getIcon('trash'));

        actions.appendChild(availBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        li.appendChild(chip);
        li.appendChild(info);
        li.appendChild(actions);
        list.appendChild(li);
      });

      window.Drag?.attachSidebarListeners?.();
    });
  }

  /* ------------------------------------------------------------------
     Populate color swatches in the modal
     ------------------------------------------------------------------ */

  function renderColorSwatches(selectedPreset) {
    const container = document.getElementById('color-swatches');
    container.innerHTML = '';
    CHIP_COLORS.forEach((color, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch';
      btn.style.backgroundColor = color.hex;
      btn.dataset.preset = String(i);
      btn.setAttribute('aria-label', `Color: ${color.name}`);
      btn.setAttribute('aria-pressed', i === selectedPreset ? 'true' : 'false');
      container.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------
     Open add-employee modal
     ------------------------------------------------------------------ */

  function openAddModal() {
    editingEmployeeId = null;
    document.getElementById('modal-employee-title').textContent = 'Add employee';
    document.getElementById('btn-save-employee').textContent = 'Add employee';
    document.getElementById('field-emp-name').value = '';
    document.getElementById('field-emp-role').value = '';
    document.getElementById('error-emp-name').textContent = '';
    document.getElementById('error-emp-role').textContent = '';

    DB.getAllEmployees().then((employees) => {
      const preset = pickAutoColor(employees);
      renderColorSwatches(preset);
      document.getElementById('modal-employee').showModal();
      document.getElementById('field-emp-name').focus();
    });
  }

  /* ------------------------------------------------------------------
     Open edit-employee modal
     ------------------------------------------------------------------ */

  function openEditModal(employeeId) {
    DB.getEmployee(employeeId).then((emp) => {
      if (!emp) return;
      editingEmployeeId = employeeId;
      document.getElementById('modal-employee-title').textContent = 'Edit employee';
      document.getElementById('btn-save-employee').textContent = 'Save changes';
      document.getElementById('field-emp-name').value = emp.name;
      document.getElementById('field-emp-role').value = emp.role;
      document.getElementById('error-emp-name').textContent = '';
      document.getElementById('error-emp-role').textContent = '';
      renderColorSwatches(emp.colorPreset);
      document.getElementById('modal-employee').showModal();
      document.getElementById('field-emp-name').focus();
    });
  }

  /* ------------------------------------------------------------------
     Styled confirmation dialog — returns a Promise<boolean>
     ------------------------------------------------------------------ */

  function showConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-confirm');
      document.getElementById('modal-confirm-body').textContent = message;

      let result = false;
      modal.addEventListener('close', () => resolve(result), { once: true });

      // Clone buttons to remove any stale listeners from a previous call
      const okBtn = document.getElementById('btn-confirm-ok');
      const cancelBtn = document.getElementById('btn-confirm-cancel');
      const newOk = okBtn.cloneNode(true);
      const newCancel = cancelBtn.cloneNode(true);
      okBtn.replaceWith(newOk);
      cancelBtn.replaceWith(newCancel);

      newOk.addEventListener('click', () => {
        result = true;
        modal.close();
      });
      newCancel.addEventListener('click', () => {
        modal.close();
      });

      modal.showModal();
      newCancel.focus();
    });
  }

  /* ------------------------------------------------------------------
     Delete employee with confirmation
     ------------------------------------------------------------------ */

  function deleteEmployee(employeeId) {
    DB.getEmployee(employeeId).then((emp) => {
      if (!emp) return;
      showConfirm(`Delete ${emp.name}? They will be removed from all scheduled shifts.`).then(
        (confirmed) => {
          if (!confirmed) return;
          DB.deleteEmployee(employeeId).then(() => {
            renderEmployeeList();
            window.Grid?.renderGrid?.();
          });
        }
      );
    });
  }

  /* ------------------------------------------------------------------
     Save employee form submission
     ------------------------------------------------------------------ */

  function handleEmployeeFormSubmit(e) {
    e.preventDefault();

    const nameVal = document.getElementById('field-emp-name').value.trim();
    const roleVal = document.getElementById('field-emp-role').value.trim();
    let valid = true;

    if (!nameVal) {
      document.getElementById('error-emp-name').textContent = 'Name is required.';
      document.getElementById('field-emp-name').focus();
      valid = false;
    } else {
      document.getElementById('error-emp-name').textContent = '';
    }

    if (!roleVal) {
      document.getElementById('error-emp-role').textContent = 'Role is required.';
      if (valid) document.getElementById('field-emp-role').focus();
      valid = false;
    } else {
      document.getElementById('error-emp-role').textContent = '';
    }

    if (!valid) return;

    const swatches = document.querySelectorAll('.color-swatch');
    let selectedPreset = 0;
    swatches.forEach((swatch) => {
      if (swatch.getAttribute('aria-pressed') === 'true') {
        selectedPreset = parseInt(swatch.dataset.preset, 10);
      }
    });
    const colorHex = CHIP_COLORS[selectedPreset].hex;
    const now = Date.now();

    if (editingEmployeeId) {
      DB.getEmployee(editingEmployeeId)
        .then((existing) => {
          const updated = Object.assign({}, existing, {
            colorHex,
            colorPreset: selectedPreset,
            name: nameVal,
            role: roleVal,
            updatedAt: now,
          });
          return DB.setEmployee(updated);
        })
        .then(() => {
          closeModal('modal-employee');
          renderEmployeeList();
          window.Grid?.renderGrid?.();
        });
    } else {
      const employee = {
        colorHex,
        colorPreset: selectedPreset,
        createdAt: now,
        id: DB.generateId(),
        name: nameVal,
        role: roleVal,
        updatedAt: now,
      };
      DB.setEmployee(employee).then(() => {
        closeModal('modal-employee');
        renderEmployeeList();
        window.Grid?.renderGrid?.();
      });
    }
  }

  /* ------------------------------------------------------------------
     Close modal helper
     ------------------------------------------------------------------ */

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal?.open) modal.close();
  }

  /* ------------------------------------------------------------------
     Color swatch selection (event delegation on #color-swatches)
     ------------------------------------------------------------------ */

  function handleSwatchClick(e) {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    document.querySelectorAll('.color-swatch').forEach((s) => {
      s.setAttribute('aria-pressed', 'false');
    });
    swatch.setAttribute('aria-pressed', 'true');
  }

  /* ------------------------------------------------------------------
     Employee list action delegation
     ------------------------------------------------------------------ */

  function handleListAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, employeeId } = btn.dataset;
    if (action === 'edit') openEditModal(employeeId);
    else if (action === 'delete') deleteEmployee(employeeId);
    else if (action === 'availability') openAvailabilityModal(employeeId);
  }

  /* ------------------------------------------------------------------
     Availability modal — open and render
     ------------------------------------------------------------------ */

  function openAvailabilityModal(employeeId) {
    DB.getEmployee(employeeId).then((emp) => {
      if (!emp) return;
      return DB.getAvailability(employeeId).then((avail) => {
        renderAvailabilityMatrix(emp, avail);
        document.getElementById('modal-availability').showModal();
      });
    });
  }

  function renderAvailabilityMatrix(emp, avail) {
    document.getElementById('modal-availability-subtitle').textContent =
      `${emp.name} — ${emp.role}`;

    const DAYS = [
      { key: 'mon', label: 'Monday' },
      { key: 'tue', label: 'Tuesday' },
      { key: 'wed', label: 'Wednesday' },
      { key: 'thu', label: 'Thursday' },
      { key: 'fri', label: 'Friday' },
      { key: 'sat', label: 'Saturday' },
      { key: 'sun', label: 'Sunday' },
    ];
    const BLOCKS = [
      { key: 'morning', label: 'Morning' },
      { key: 'afternoon', label: 'Afternoon' },
      { key: 'evening', label: 'Evening' },
    ];

    const slots = avail?.slots ?? {};
    const tbody = document.querySelector('#avail-matrix tbody');
    tbody.innerHTML = '';

    DAYS.forEach((day) => {
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = day.label;
      tr.appendChild(th);

      BLOCKS.forEach((block) => {
        const cellKey = `${day.key}_${block.key}`;
        const state = slots[cellKey] ?? 'available';

        const td = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avail-cell';
        btn.dataset.cellKey = cellKey;
        btn.dataset.state = state;
        btn.setAttribute(
          'aria-label',
          `${day.label} ${block.label}: ${capitalize(state)}. Click to change.`
        );
        btn.appendChild(buildAvailContent(state));

        btn.addEventListener('click', () => {
          const next = cycleAvailState(btn.dataset.state);
          btn.dataset.state = next;
          btn.innerHTML = '';
          btn.appendChild(buildAvailContent(next));
          btn.setAttribute(
            'aria-label',
            `${day.label} ${block.label}: ${capitalize(next)}. Click to change.`
          );
        });

        td.appendChild(btn);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    // Replace save button to remove stale listeners
    const saveBtn = document.getElementById('btn-save-availability');
    const newSave = saveBtn.cloneNode(true);
    saveBtn.replaceWith(newSave);
    newSave.addEventListener('click', () => saveAvailability(emp.id));
  }

  function buildAvailContent(state) {
    const frag = document.createDocumentFragment();
    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.style.cssText = 'align-items:center;display:inline-flex';
    if (state === 'preferred') iconSpan.appendChild(getIcon('star'));
    else if (state === 'unavailable') iconSpan.appendChild(getIcon('x-mark'));
    frag.appendChild(iconSpan);
    frag.appendChild(document.createTextNode(capitalize(state)));
    return frag;
  }

  function cycleAvailState(current) {
    const states = ['available', 'preferred', 'unavailable'];
    return states[(states.indexOf(current) + 1) % states.length];
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function saveAvailability(employeeId) {
    const cells = document.querySelectorAll('#avail-matrix .avail-cell');
    const slots = {};
    cells.forEach((cell) => {
      slots[cell.dataset.cellKey] = cell.dataset.state;
    });
    DB.setAvailability({ employeeId, slots }).then(() => {
      closeModal('modal-availability');
      window.Grid?.runConflicts?.();
    });
  }

  /* ------------------------------------------------------------------
     Bind all employee-module events
     ------------------------------------------------------------------ */

  function bindEvents() {
    document.getElementById('btn-add-employee').addEventListener('click', openAddModal);
    document.getElementById('btn-add-employee-empty')?.addEventListener('click', openAddModal);

    // Inject icons
    document.getElementById('btn-add-employee').appendChild(getIcon('plus-circle'));
    document.querySelector('#btn-settings .nav-icon')?.appendChild(getIcon('cog'));
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.appendChild(getIcon('x-mark'));
    });

    // Set icon on print/copy buttons (populated here since Employees runs before Export)
    const copyIconEl = document.querySelector('#btn-copy-summary .btn-icon-inline');
    if (copyIconEl) copyIconEl.appendChild(getIcon('clipboard'));
    const printIconEl = document.querySelector('#btn-print .btn-icon-inline');
    if (printIconEl) printIconEl.appendChild(getIcon('printer'));

    // Navigation icons
    document.getElementById('btn-prev-week')?.appendChild(getIcon('chevron-left'));
    document.getElementById('btn-next-week')?.appendChild(getIcon('chevron-right'));

    document.getElementById('employee-search').addEventListener('input', renderEmployeeList);
    document.getElementById('employee-list').addEventListener('click', handleListAction);
    document.getElementById('form-employee').addEventListener('submit', handleEmployeeFormSubmit);
    document.getElementById('color-swatches').addEventListener('click', handleSwatchClick);

    // data-close-modal buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Close on backdrop click
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    });
  }

  /* ------------------------------------------------------------------
     Expose as window.Employees
     ------------------------------------------------------------------ */

  window.Employees = {
    bindEvents,
    CHIP_COLORS,
    getIcon,
    openAddModal,
    openAvailabilityModal,
    openEditModal,
    renderEmployeeList,
  };
})();
