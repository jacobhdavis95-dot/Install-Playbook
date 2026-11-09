const lastPlaybookTabKey = 'install-playbook.last-tab';

function showTab(tabId) {
  const nextTab = document.getElementById(tabId);
  if (!nextTab?.classList.contains('tab')) return;

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab === nextTab);
  });

  try {
    localStorage.setItem(lastPlaybookTabKey, tabId);
  } catch {
    // Tab navigation still works when browser storage is unavailable.
  }
  
  const picker = document.getElementById('section-picker');
  if (picker) picker.value = tabId;

  const buttons = document.querySelectorAll('nav .tab-btn');
  buttons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  }); 
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab table').forEach((table) => {
    if (table.closest('.parts-table-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    const section = table.closest('details');
    wrap.setAttribute('aria-label', (section?.querySelector('summary')?.textContent.trim() || 'Reference') + ' table; scroll horizontally');
    table.before(wrap);
    wrap.append(table);
  });
  let savedTab;
  try {
    savedTab = localStorage.getItem(lastPlaybookTabKey);
  } catch {
    // Use the default tab when browser storage is unavailable.
  }

  const savedPanel = savedTab && document.getElementById(savedTab);
  showTab(savedPanel?.classList.contains('tab') ? savedTab : 'framing');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});
