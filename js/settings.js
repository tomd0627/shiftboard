(() => {
  /* ------------------------------------------------------------------
     Open settings modal and populate current values
     ------------------------------------------------------------------ */

  function openSettingsModal() {
    DB.getSettings().then((settings) => {
      document.getElementById('field-min-headcount').value = settings.minHeadcount ?? 1;
      document.getElementById('field-week-start').value = settings.weekStart ?? 'mon';
      document.getElementById('field-show-weekends').checked = settings.showWeekends !== false;
      document.getElementById('modal-settings').showModal();
      document.getElementById('field-min-headcount').focus();
    });
  }

  /* ------------------------------------------------------------------
     Handle settings form submission
     ------------------------------------------------------------------ */

  function handleSettingsSubmit(e) {
    e.preventDefault();
    const minVal = parseInt(document.getElementById('field-min-headcount').value, 10);
    const minHeadcount = Number.isNaN(minVal) || minVal < 0 ? 1 : minVal;
    const weekStart = document.getElementById('field-week-start').value;
    const showWeekends = document.getElementById('field-show-weekends').checked;

    Promise.all([
      DB.setSetting('minHeadcount', minHeadcount),
      DB.setSetting('weekStart', weekStart),
      DB.setSetting('showWeekends', showWeekends),
    ]).then(() => {
      closeModal('modal-settings');
      window.Grid?.renderGrid?.();
    });
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal?.open) modal.close();
  }

  /* ------------------------------------------------------------------
     Bind events
     ------------------------------------------------------------------ */

  function bindEvents() {
    document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
    document.getElementById('form-settings').addEventListener('submit', handleSettingsSubmit);
  }

  /* ------------------------------------------------------------------
     Expose as window.Settings
     ------------------------------------------------------------------ */

  window.Settings = {
    bindEvents,
    openSettingsModal,
  };
})();
