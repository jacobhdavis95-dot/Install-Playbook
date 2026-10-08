(() => {
  'use strict';
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const stopWords = new Set('a an the is are was were be been do does did can could should would will how what when where why who which i we you me my our their it its to for of on in at with about need needs must all and or please tell have has much'.split(' '));
  const aliases = [
    ['housewrap', 'house wrap'], ['sill seal', 'sill sealer', 'seal sill'],
    ['sheetrock', 'drywall'], ['backcharge', 'backcharges', 'back charge'],
    ['standdown', 'stand down'], ['nonbearing', 'non bearing', 'non load bearing'],
    ['takeoff', 'take off'], ['pay', 'payment', 'payout'],
    ['inspection', 'inspections', 'inspect'], ['flashing', 'flash']
  ];
  const stem = word => word.length > 4 ? word.replace(/s$/, '') : word;
  const containsTerm = (text, term) => term.includes(' ')
    ? (' ' + text + ' ').includes(' ' + term + ' ')
    : text.split(' ').some(word => stem(word) === stem(term));
  function queryTerms(query) {
    const text = normalize(query);
    const terms = [...new Set(text.split(' ').filter(word => word && !stopWords.has(word)).map(stem))];
    return terms.map(term => {
      const alternatives = new Set([term]);
      aliases.forEach(group => {
        if (group.some(phrase => normalize(phrase).split(' ').some(word => stem(word) === term)) && group.some(phrase => text.includes(normalize(phrase)))) {
          group.forEach(phrase => alternatives.add(normalize(phrase)));
        }
      });
      return [...alternatives];
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('playbook-search');
    const results = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    const clear = document.getElementById('search-clear');
    const form = document.getElementById('search-form');
    const entries = [];
    const cleanText = element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const pieces = [];
      while (walker.nextNode()) pieces.push(walker.currentNode.textContent);
      return pieces.join(' ').replace(/\s+/g, ' ').trim();
    };
    document.querySelectorAll('#playbook-content .tab').forEach(tab => {
      const tabName = document.querySelector(`nav [data-tab="${tab.id}"] span`)?.textContent.trim() || tab.id;
      const groups = new Map();
      tab.querySelectorAll('summary, h3, h4, h5, p, li, pre, tr, figcaption').forEach(element => {
        // Keep individual instructions, without repeating nested lists or paragraphs.
        if (element.closest('script, style, .parts-controls') || !cleanText(element)) return;
        const details = element.closest('details');
        const owner = details || tab;
        if (!groups.has(owner)) groups.set(owner, []);
        groups.get(owner).push(element);
      });
      groups.forEach((elements, owner) => {
        const path = [];
        for (let ancestor = owner; ancestor && ancestor !== tab; ancestor = ancestor.parentElement) {
          if (ancestor.matches('details')) {
            const summary = ancestor.querySelector(':scope > summary');
            if (summary) path.unshift(cleanText(summary));
          }
        }
        // Break long sections into instruction-sized matches, then group results by section.
        const blocks = elements.map(element => {
          const clone = element.cloneNode(true);
          if (element.matches('li')) clone.querySelectorAll('ul, ol, p, pre, table').forEach(child => child.remove());
          return {element, text: cleanText(clone)};
        }).filter(block => block.text);
        const title = path.join(' › ') || tab.querySelector('h2')?.textContent.trim() || tabName;
        entries.push({tab, tabName, title, blocks, context: normalize(tabName + ' ' + title)});
      });
    });
    let timer;
    let focusedTarget;
    function render() {
      const query = input.value.trim();
      clear.hidden = !query;
      results.replaceChildren();
      const terms = queryTerms(query);
      if (!terms.length) {
        status.textContent = query ? 'Try a topic or builder name, such as flashing, Drees, or safety inspections.' : '';
        results.hidden = true;
        return;
      }
      const matches = [];
      entries.forEach(entry => {
        const scored = entry.blocks.map(block => {
          const text = normalize(block.text);
          const haystack = ' ' + text + ' ' + entry.context + ' ';
          const count = terms.filter(alternatives => alternatives.some(term => containsTerm(haystack, term))).length;
          const bodyCount = terms.filter(alternatives => alternatives.some(term => containsTerm(text, term))).length;
          return {...block, count, score: count * 10 + bodyCount * 3 + (text.includes(normalize(query)) ? 5 : 0)};
        }).filter(block => block.count);
        if (!scored.length) return;
        scored.sort((a, b) => b.score - a.score);
        matches.push({...entry, best: scored[0], score: scored[0].score});
      });
      matches.sort((a, b) => b.score - a.score);
      const full = matches.filter(match => match.best.count === terms.length).length;
      status.textContent = matches.length ? `${matches.length} matching sections across the playbook${full ? ` · ${full} match all search topics` : ''}. Best matches appear first.` : 'No matching information found. Try fewer words, another term, or a builder name.';
      results.hidden = !matches.length;
      matches.forEach(match => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'search-result';
        const label = document.createElement('span');
        label.className = 'search-result-tab';
        label.textContent = match.tabName;
        const title = document.createElement('strong');
        title.textContent = match.title;
        const snippet = document.createElement('span');
        snippet.className = 'search-result-snippet';
        const text = match.best.text;
        const lower = normalize(text);
        const first = terms.flat().map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] || 0;
        const start = text.length > 320 ? Math.max(0, first - 80) : 0;
        snippet.textContent = (start ? '…' : '') + text.slice(start, start + 320) + (text.length > start + 320 ? '…' : '');
        const action = document.createElement('span');
        action.className = 'search-result-action';
        action.textContent = 'Open section →';
        button.append(label, title, snippet, action);
        button.addEventListener('click', () => {
          window.showTab(match.tab.id);
          const target = match.best.element;
          for (let ancestor = target; ancestor && ancestor !== match.tab; ancestor = ancestor.parentElement) {
            if (ancestor.matches('details')) ancestor.open = true;
          }
          if (focusedTarget) focusedTarget.classList.remove('search-target');
          focusedTarget = target;
          target.classList.add('search-target');
          target.setAttribute('tabindex', '-1');
          target.focus({preventScroll: true});
          target.scrollIntoView({behavior: 'smooth', block: 'center'});
        });
        item.append(button);
        results.append(item);
      });
    }
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 150); });
    form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); render(); });
    clear.addEventListener('click', () => {
      clearTimeout(timer);
      input.value = '';
      render();
      if (focusedTarget) focusedTarget.classList.remove('search-target');
      input.focus();
    });
  });
})();
