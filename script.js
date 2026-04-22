function showTab(tabId) {
   const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => tab.classList.remove('active'));

  const nextTab = document.getElementById(tabId);
  if (nextTab) {
    nextTab.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const framingTab = document.getElementById('framing');
  const windowDoorTab = document.getElementById('windowdoor');
  if (!framingTab || !windowDoorTab) return;

  const framingAppwright = Array.from(framingTab.querySelectorAll('details')).find((detail) => {
    const summary = detail.querySelector(':scope > summary');
    return summary && summary.textContent.trim().toLowerCase() === 'appwright';
  });

  const windowDoorAppwright = Array.from(windowDoorTab.querySelectorAll('details')).find((detail) => {
    const summary = detail.querySelector(':scope > summary');
    return summary && summary.textContent.trim().toLowerCase() === 'appwright';
  });

  if (!framingAppwright || !windowDoorAppwright) return;

  const framingMenus = Array.from(framingAppwright.querySelectorAll(':scope > details')).filter((detail) => {
    const summary = detail.querySelector(':scope > summary');
    return summary && /^\d+\)/.test(summary.textContent.trim());
  });

  if (framingMenus.length < 2) return;

  const firstMenu = framingMenus[0];
  const lastMenu = framingMenus[framingMenus.length - 1];

  framingMenus.forEach((menu) => {
    if (menu !== firstMenu && menu !== lastMenu) {
      menu.remove();
    }
  });

  windowDoorAppwright.appendChild(lastMenu);
});
