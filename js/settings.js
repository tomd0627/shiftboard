(() => {
  /* ------------------------------------------------------------------
     Open settings modal and populate current values
     ------------------------------------------------------------------ */

  function openSettingsModal() {
    DB.getSetting('minHeadcount').then((val) => {
      document.getElementById('field-min-headcount').value = val ?? 1;
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

    DB.setSetting('minHeadcount', minHeadcount).then(() => {
      closeModal('modal-settings');
      window.Grid?.runConflicts?.();
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
