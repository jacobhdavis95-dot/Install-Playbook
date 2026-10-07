function showTab(tabId) {
const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => tab.classList.remove('active'));

  const nextTab = document.getElementById(tabId);
  if (nextTab) {
    nextTab.classList.add('active');
  }
  
  const picker = document.getElementById('section-picker');
  if (picker && nextTab) picker.value = tabId;

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
  showTab('framing');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});
