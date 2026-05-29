(() => {
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const BLOCK_KEYS = ['morning', 'afternoon', 'evening'];
  const BLOCK_LABELS = ['Morning', 'Afternoon', 'Evening'];

  /* ------------------------------------------------------------------
     Copy week summary to clipboard as plain text
     ------------------------------------------------------------------ */

  function copyWeekSummary() {
    const weekKey = window.Grid.getCurrentWeekKey();

    Promise.all([DB.getWeekShifts(weekKey), DB.getAllEmployees()]).then(
      ([weekShifts, employees]) => {
        const cells = weekShifts?.cells ?? {};
        const empMap = new Map(employees.map((e) => [e.id, e]));
        const lines = [`Shiftboard — Week ${weekKey}`, ''];

        DAY_KEYS.forEach((dayKey, di) => {
          lines.push(DAY_LABELS[di]);
          BLOCK_KEYS.forEach((blockKey, bi) => {
            const cellKey = `${dayKey}_${blockKey}`;
            const empIds = cells[cellKey] ?? [];
            const names = empIds.map((id) => empMap.get(id)?.name ?? 'Unknown').join(', ');
            lines.push(`  ${BLOCK_LABELS[bi]}: ${names || '(empty)'}`);
          });
          lines.push('');
        });

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
          showToast('Copied to clipboard');
        });
      }
    );
  }

  /* ------------------------------------------------------------------
     Print schedule
     ------------------------------------------------------------------ */

  function printSchedule() {
    window.print();
  }

  /* ------------------------------------------------------------------
     Toast notification — 2 second display
     ------------------------------------------------------------------ */

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    setTimeout(() => {
      toast.hidden = true;
    }, 2000);
  }

  /* ------------------------------------------------------------------
     Expose as window.Export
     ------------------------------------------------------------------ */

  window.Export = {
    copyWeekSummary,
    printSchedule,
    showToast,
  };
})();
