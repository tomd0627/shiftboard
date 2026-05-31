(() => {
  const { createStore, get, set, del, entries } = idbKeyval;

  // Each store gets its own database — idb-keyval's createStore uses indexedDB.open()
  // with version 1, so sharing one database name means only the first open request
  // triggers upgradeneeded; the rest skip the upgrade and their stores are never created.
  const employeeStore = createStore('shiftboard-employees', 'employees');
  const availabilityStore = createStore('shiftboard-availability', 'availability');
  const shiftsStore = createStore('shiftboard-shifts', 'shifts');
  const settingsStore = createStore('shiftboard-settings', 'settings');

  /* ------------------------------------------------------------------
     ID generation
     ------------------------------------------------------------------ */

  function generateId() {
    return `emp_${Math.random().toString(36).slice(2, 10)}`;
  }

  /* ------------------------------------------------------------------
     Employee operations
     ------------------------------------------------------------------ */

  function getAllEmployees() {
    return entries(employeeStore).then((pairs) => pairs.map((pair) => pair[1]));
  }

  function getEmployee(id) {
    return get(id, employeeStore);
  }

  function setEmployee(employee) {
    return set(employee.id, employee, employeeStore);
  }

  function deleteEmployee(id) {
    return del(id, employeeStore)
      .then(() => del(id, availabilityStore))
      .then(() => entries(shiftsStore))
      .then((allShifts) => {
        const saves = [];
        allShifts.forEach(([weekKey, weekData]) => {
          let changed = false;
          Object.keys(weekData.cells).forEach((cellKey) => {
            const before = weekData.cells[cellKey].length;
            weekData.cells[cellKey] = weekData.cells[cellKey].filter((eid) => eid !== id);
            if (weekData.cells[cellKey].length !== before) {
              changed = true;
            }
          });
          if (changed) {
            saves.push(set(weekKey, weekData, shiftsStore));
          }
        });
        return Promise.all(saves);
      });
  }

  /* ------------------------------------------------------------------
     Availability operations
     ------------------------------------------------------------------ */

  function getAvailability(employeeId) {
    return get(employeeId, availabilityStore);
  }

  function setAvailability(record) {
    return set(record.employeeId, record, availabilityStore);
  }

  /* ------------------------------------------------------------------
     Shifts operations
     ------------------------------------------------------------------ */

  function getWeekShifts(weekKey) {
    return get(weekKey, shiftsStore);
  }

  function setWeekShifts(weekShifts) {
    return set(weekShifts.weekKey, weekShifts, shiftsStore);
  }

  /* ------------------------------------------------------------------
     Settings operations
     ------------------------------------------------------------------ */

  function getSetting(key) {
    return get(key, settingsStore);
  }

  function setSetting(key, value) {
    return set(key, value, settingsStore);
  }

  function getSettings() {
    return Promise.all([
      getSetting('minHeadcount'),
      getSetting('weekStart'),
      getSetting('showWeekends'),
      getSetting('lastWeekKey'),
    ]).then(([minHeadcount, weekStart, showWeekends, lastWeekKey]) => ({
      minHeadcount: minHeadcount !== undefined ? minHeadcount : 1,
      lastWeekKey,
      showWeekends: showWeekends !== undefined ? showWeekends : true,
      weekStart: weekStart !== undefined ? weekStart : 'mon',
    }));
  }

  function initSettings() {
    return getSetting('minHeadcount')
      .then((val) => {
        if (val === undefined) return setSetting('minHeadcount', 1);
      })
      .then(() => getSetting('weekStart'))
      .then((val) => {
        if (val === undefined) return setSetting('weekStart', 'mon');
      })
      .then(() => getSetting('showWeekends'))
      .then((val) => {
        if (val === undefined) return setSetting('showWeekends', true);
      });
  }

  /* ------------------------------------------------------------------
     Expose as window.DB
     ------------------------------------------------------------------ */

  window.DB = {
    generateId,
    getAllEmployees,
    getEmployee,
    setEmployee,
    deleteEmployee,
    getAvailability,
    setAvailability,
    getWeekShifts,
    setWeekShifts,
    getSetting,
    setSetting,
    getSettings,
    initSettings,
  };
})();
