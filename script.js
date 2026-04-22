function showTab(tabId) {
   const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => tab.classList.remove('active'));

  const nextTab = document.getElementById(tabId);
  if (nextTab) {
    nextTab.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
 if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});
