(() => {
  /* ------------------------------------------------------------------
     Application entry point — runs after all module scripts have loaded
     ------------------------------------------------------------------ */

  function init() {
    // Initialise IndexedDB defaults
    DB.initSettings().then(() => {
      // Bind all UI event handlers
      Employees.bindEvents();
      Settings.bindEvents();
      bindWeekNavEvents();
      bindExportEvents();

      // Restore last-viewed week, or default to current week
      DB.getSetting('lastWeekKey').then((lastKey) => {
        if (lastKey) {
          const currentKey = Grid.getWeekKey(new Date());
          Grid.setWeekOffset(weekKeyDiff(currentKey, lastKey));
        }
        // Initial render
        Grid.renderGrid();
        Employees.renderEmployeeList();
        Drag.init();
      });
    });
  }

  /* ------------------------------------------------------------------
     Week navigation button bindings
     ------------------------------------------------------------------ */

  function bindWeekNavEvents() {
    document.getElementById('btn-prev-week').addEventListener('click', Grid.goToPrevWeek);
    document.getElementById('btn-next-week').addEventListener('click', Grid.goToNextWeek);
    document.getElementById('btn-today').addEventListener('click', Grid.goToCurrentWeek);
  }

  /* ------------------------------------------------------------------
     Export button bindings
     ------------------------------------------------------------------ */

  function bindExportEvents() {
    document.getElementById('btn-copy-summary').addEventListener('click', Export.copyWeekSummary);
    document.getElementById('btn-print').addEventListener('click', Export.printSchedule);
  }

  /* ------------------------------------------------------------------
     Calculate the offset (in weeks) between two week keys
     ------------------------------------------------------------------ */

  function weekKeyDiff(baseKey, targetKey) {
    const baseMonday = Grid.weekKeyToMonday(baseKey);
    const targetMonday = Grid.weekKeyToMonday(targetKey);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.round((targetMonday - baseMonday) / msPerWeek);
  }

  /* ------------------------------------------------------------------
     Bootstrap on DOMContentLoaded
     ------------------------------------------------------------------ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
