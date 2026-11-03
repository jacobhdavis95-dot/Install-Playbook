(() => {
'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('pdf-dialog');
  const list = document.getElementById('pdf-sections');
  const status = document.getElementById('pdf-status');
  const exportButton = document.getElementById('pdf-export');
  const choices = [];
  const tabs = [...document.querySelectorAll('#playbook-content > .tab')];
  const nameOf = tab => document.querySelector('nav [data-tab="' + tab.id + '"] span')?.textContent.trim() || tab.querySelector('h2')?.textContent.trim() || tab.id;
  function update() {
    const selected = choices.filter(choice => choice.input.checked);
    exportButton.disabled = !selected.length;
    status.textContent = selected.length ? selected.length + ' selected. Choosing a parent section includes its subsections and photos.' : 'Choose at least one section.';
  }
  function addChoice(node, label, container, depth) {
    const row = document.createElement('label');
    row.className = 'pdf-choice';
    row.style.paddingLeft = Math.min(depth, 4) * 16 + 12 + 'px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const text = document.createElement('span');
    text.textContent = label;
    row.append(input, text);
    container.append(row);
    choices.push({node, input, label});
    input.addEventListener('change', () => {
      // Selecting a parent replaces individual child selections.
      if (input.checked) choices.forEach(choice => {
        if (choice !== choices.find(item => item.input === input) && node.contains(choice.node)) choice.input.checked = false;
      });
      choices.forEach(choice => {
        choice.input.disabled = choices.some(parent => parent !== choice && parent.input.checked && parent.node.contains(choice.node));
      });
      update();
    });
  }
  tabs.forEach(tab => {
    const group = document.createElement('details');
    group.className = 'pdf-group';
    const summary = document.createElement('summary');
    summary.textContent = nameOf(tab);
    group.append(summary);
    addChoice(tab, 'Entire ' + nameOf(tab) + ' tab', group, 0);
    tab.querySelectorAll('details').forEach(section => {
      const title = section.querySelector(':scope > summary')?.textContent.trim();
      if (!title) return;
      let depth = 1;
      for (let parent = section.parentElement; parent && parent !== tab; parent = parent.parentElement) {
        if (parent.matches('details')) depth++;
      }
      addChoice(section, title, group, depth);
    });
    group.dataset.tab = tab.id;
    list.append(group);
  });
  document.getElementById('pdf-open').addEventListener('click', () => {
    list.querySelectorAll('.pdf-group').forEach(group => {
      group.open = document.getElementById(group.dataset.tab)?.classList.contains('active');
    });
    update();
    dialog.showModal();
  });
  document.getElementById('pdf-cancel').addEventListener('click', () => dialog.close());
  document.getElementById('pdf-clear').addEventListener('click', () => {
    choices.forEach(choice => { choice.input.checked = false; choice.input.disabled = false; });
    update();
  });
  exportButton.addEventListener('click', () => {
    const selected = choices.filter(choice => choice.input.checked && !choices.some(parent => parent !== choice && parent.input.checked && parent.node.contains(choice.node)));
    if (!selected.length) return;
    const preview = window.open('', '_blank');
    if (!preview) { status.textContent = 'Please allow a new tab for this site, then select Save selected sections as PDF again.'; return; }
    const doc = preview.document;
    doc.open();
    doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Playbook — Selected Sections</title></head><body></body></html>');
    doc.close();
    const style = doc.createElement('style');
    style.textContent = `
      *{box-sizing:border-box}body{font:15px/1.55 Arial,sans-serif;color:#142c45;max-width:1000px;margin:24px auto;padding:0 20px}
      h1{font-size:24px}h2{font-size:21px;border-bottom:2px solid #c8102e;padding-bottom:8px}h3{font-size:18px}h4,h5{font-size:16px}
      h1,h2,h3,h4,h5{break-after:avoid}a{color:#12548a;overflow-wrap:anywhere}
      .pdf-toolbar{position:sticky;top:0;background:#eef3f8;border:1px solid #cbd5e1;padding:16px;z-index:1}
      button{padding:12px 18px;background:#08294c;color:white;border:0;border-radius:6px;font:700 16px Arial;cursor:pointer}
      img{max-width:100%!important;width:auto!important;height:auto!important;max-height:8in;object-fit:contain}
      figure{break-inside:avoid;margin:20px 0}figcaption p{margin-top:8px}
      table{border-collapse:collapse;width:100%;font-size:11px;table-layout:auto}th,td{border:1px solid #adb9c5;padding:6px;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}
      pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}section{margin:20px 0}.pdf-source{font-size:12px;color:#526477}
      .table-scroll,.parts-table-wrap{overflow:visible!important}.pdf-cover{max-height:130px;width:100%!important;object-fit:contain}
      @page{size:letter;margin:.55in}
      @media print{body{max-width:none;margin:0;padding:0;color:#000}.pdf-toolbar{display:none}.pdf-selection+.pdf-selection{break-before:page}a{color:inherit;text-decoration:none}}
    `;
    doc.head.append(style);
    const toolbar = doc.createElement('div');
    toolbar.className = 'pdf-toolbar';
    const save = doc.createElement('button');
    save.textContent = 'Save as PDF';
    save.addEventListener('click', () => preview.print());
    const help = doc.createElement('p');
    help.textContent = 'Choose Save as PDF in the print destination. On iPhone/iPad, open the print preview, then use Share to save or send the PDF. Your selected content is below.';
    toolbar.append(save, help);
    doc.body.append(toolbar);
    const cover = document.querySelector('.hero-header-image');
    if (cover) {
      const image = doc.createElement('img');
      image.src = cover.src;
      image.alt = cover.alt;
      image.className = 'pdf-cover';
      doc.body.append(image);
    }
    const heading = doc.createElement('h1');
    heading.textContent = 'Install Playbook | Builders FirstSource Raleigh';
    const source = doc.createElement('p');
    source.className = 'pdf-source';
    source.textContent = 'Selected sections • ' + new Date().toLocaleDateString('en-US');
    doc.body.append(heading, source);
    selected.forEach(choice => {
      const section = doc.createElement('section');
      section.className = 'pdf-selection';
      const tab = choice.node.closest('.tab');
      const path = [];
      for (let parent = choice.node.parentElement; parent && parent !== tab; parent = parent.parentElement) {
        if (parent.matches('details')) path.unshift(parent.querySelector(':scope > summary')?.textContent.trim() || '');
      }
      const label = doc.createElement('p');
      label.className = 'pdf-source';
      label.textContent = [nameOf(tab), ...path].filter(Boolean).join(' › ');
      section.append(label);
      const clone = doc.importNode(choice.node, true);
      clone.querySelectorAll('script,style,button,input,select,textarea,.parts-controls').forEach(el => el.remove());
      [clone, ...clone.querySelectorAll('*')].forEach(el => {
        el.removeAttribute('id');
        el.removeAttribute('style');
        el.removeAttribute('hidden');
        el.removeAttribute('tabindex');
        el.removeAttribute('class');
        [...el.attributes].forEach(attr => { if (attr.name.startsWith('on')) el.removeAttribute(attr.name); });
        if (el.matches('img')) { el.src = new URL(el.getAttribute('src'), document.baseURI).href; el.loading = 'eager'; }
        if (el.matches('a[href]')) el.href = new URL(el.getAttribute('href'), document.baseURI).href;
      });
      // Convert disclosure widgets to ordinary headings so collapsed content always prints.
      [clone, ...clone.querySelectorAll('details')].filter(el => el.matches('details')).reverse().forEach(details => {
        const replacement = doc.createElement('section');
        const summary = details.querySelector(':scope > summary');
        if (summary) {
          const title = doc.createElement('h3');
          title.textContent = summary.textContent.trim();
          summary.remove();
          replacement.append(title);
        }
        replacement.append(...details.childNodes);
        if (details === clone) section.append(replacement); else details.replaceWith(replacement);
      });
      if (!choice.node.matches('details')) section.append(clone);
      doc.body.append(section);
    });
    const footer = doc.createElement('p');
    footer.className = 'pdf-source';
    const link = doc.createElement('a');
    link.href = new URL('./', document.baseURI).href;
    link.textContent = 'Full Install Playbook: ' + link.href;
    footer.append(link);
    doc.body.append(footer);
    dialog.close();
    preview.focus();
    // Leave a ready-to-save preview open; user chooses the PDF destination with one tap.
  });
});
})();