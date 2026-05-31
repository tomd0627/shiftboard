(() => {
  const ALL_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const ALL_DAY_LABELS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  const BLOCK_KEYS = ['morning', 'afternoon', 'evening'];
  const BLOCK_LABELS = ['Morning', 'Afternoon', 'Evening'];

  /* ------------------------------------------------------------------
     Copy week summary to clipboard as plain text
     ------------------------------------------------------------------ */

  function formatWeekRange(weekKey) {
    const monday = window.Grid.weekKeyToMonday(weekKey);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const fmt = (d, opts) => d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
    const sameYear = monday.getUTCFullYear() === sunday.getUTCFullYear();
    const sameMonth = sameYear && monday.getUTCMonth() === sunday.getUTCMonth();
    if (sameMonth) {
      return `Week of ${fmt(monday, { month: 'short', day: 'numeric' })}–${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`;
    } else if (sameYear) {
      return `Week of ${fmt(monday, { month: 'short', day: 'numeric' })}–${fmt(sunday, { month: 'short', day: 'numeric' })}, ${sunday.getUTCFullYear()}`;
    }
    return `Week of ${fmt(monday, { month: 'short', day: 'numeric', year: 'numeric' })}–${fmt(sunday, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  function copyWeekSummary() {
    const weekKey = window.Grid.getCurrentWeekKey();

    Promise.all([
      DB.getWeekShifts(weekKey),
      DB.getAllEmployees(),
      DB.getSetting('weekStart'),
      DB.getSetting('showWeekends'),
    ]).then(([weekShifts, employees, weekStart, showWeekends]) => {
      const cells = weekShifts?.cells ?? {};
      const empMap = new Map(employees.map((e) => [e.id, e]));

      // Build ordered, filtered day list matching the grid display
      let orderedIndices =
        weekStart === 'sun'
          ? [6, 0, 1, 2, 3, 4, 5] // sun first (index 6 in ALL_DAY_KEYS)
          : [0, 1, 2, 3, 4, 5, 6]; // mon first

      if (showWeekends === false) {
        orderedIndices = orderedIndices.filter((i) => i !== 5 && i !== 6); // drop sat(5) sun(6)
      }

      const lines = [`Shiftboard — ${formatWeekRange(weekKey)}`, ''];

      orderedIndices.forEach((di) => {
        const dayKey = ALL_DAY_KEYS[di];
        lines.push(ALL_DAY_LABELS[di]);
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
    });
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
