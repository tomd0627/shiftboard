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

      // Initial render — always start on the current week
      Grid.renderGrid();
      Employees.renderEmployeeList();
      Drag.init();
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
     Bootstrap on DOMContentLoaded
     ------------------------------------------------------------------ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
