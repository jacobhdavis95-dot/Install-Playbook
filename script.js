function showTab(tabId) {
 const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => tab.classList.remove('active'));

  const nextTab = document.getElementById(tabId);
  if (nextTab) {
    nextTab.classList.add('active');
  }
  
  const buttons = document.querySelectorAll('nav .tab-btn');
  buttons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  }); 
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});
