(() => {
  const { createStore, get, set, del, entries } = idbKeyval;

  const employeeStore = createStore('shiftboard-db', 'employees');
  const availabilityStore = createStore('shiftboard-db', 'availability');
  const shiftsStore = createStore('shiftboard-db', 'shifts');
  const settingsStore = createStore('shiftboard-db', 'settings');

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
      getSetting('lastWeekKey'),
    ]).then(([minHeadcount, weekStart, lastWeekKey]) => ({
      minHeadcount: minHeadcount !== undefined ? minHeadcount : 1,
      weekStart: weekStart !== undefined ? weekStart : 'mon',
      lastWeekKey,
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
