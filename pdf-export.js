(() => {
'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('pdf-dialog');
  const list = document.getElementById('pdf-sections');
  const status = document.getElementById('pdf-status');
  const exportButton = document.getElementById('pdf-export');
  const choices = [];

  let pdfLibraries;
  function loadPdfLibraries() {
    if (!pdfLibraries) {
      const load = path => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timer = setTimeout(() => { script.remove(); reject(new Error('PDF tools took too long to load. Please try again.')); }, 30000);
        script.src = 'https://cdn.jsdelivr.net/npm/' + path;
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Could not load PDF tools. Check your connection and try again.')); };
        document.head.append(script);
      });
      pdfLibraries = (async () => {
        if (!window.pdfMake) await load('pdfmake@0.2.20/build/pdfmake.min.js');
        await load('pdfmake@0.2.20/build/vfs_fonts.js');
        if (!window.htmlToPdfmake) await load('html-to-pdfmake@2.5.32/browser.js');
      })().catch(error => { pdfLibraries = null; throw error; });
    }
    return pdfLibraries;
  }
  async function downloadPdf(preview, help, save, filename) {
    if (save.disabled) return;
    save.disabled = true;
    save.textContent = 'Preparing PDF…';
    help.textContent = 'Preparing your PDF with the selected sections and photos…';
    try {
      await loadPdfLibraries();
      const doc = preview.document;
      const printable = doc.body.cloneNode(true);
      printable.querySelectorAll('.pdf-toolbar').forEach(node => node.remove());
      // Embed actual image bytes so the downloaded PDF does not depend on image URLs.
      const imageCache = new Map();
      async function embedImage(url) {
        if (!imageCache.has(url)) imageCache.set(url, (async () => {
          const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
          if (!response.ok) throw new Error('Image request failed');
          const blob = await response.blob();
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const picture = new Image();
          picture.src = data;
          await picture.decode();
          const scale = Math.min(1, 1600 / Math.max(picture.naturalWidth, picture.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(picture, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.9);
        })());
        return imageCache.get(url);
      }
      // Work sequentially to keep memory use bounded on phones and tablets.
      for (const img of printable.querySelectorAll('img')) {
        try {
          img.src = await embedImage(img.src);
        } catch {
          throw new Error('A photo could not be included (' + (img.alt || 'reference image') + '). Please check your connection and try again.');
        }
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.removeAttribute('style');
        img.setAttribute('data-pdfmake', JSON.stringify({fit: img.classList.contains('pdf-cover') ? [500, 95] : [500, 580]}));
      }
      // Capture the preview's colors and borders before converting the detached copy.
      const styledSelector = 'h1,h2,h3,h4,h5,h6,aside,mark,th';
      const previewNodes = doc.body.querySelectorAll(styledSelector);
      const pdfColor = color => {
        const channels = color.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').map(Number);
        if (!channels || channels.length < 3) return color;
        const opacity = channels[3] ?? 1;
        return '#' + channels.slice(0, 3).map(channel =>
          Math.round(channel * opacity + 255 * (1 - opacity)).toString(16).padStart(2, '0')
        ).join('');
      };
      printable.querySelectorAll(styledSelector).forEach((node, index) => {
        const style = preview.getComputedStyle(previewNodes[index]);
        const background = style.backgroundColor;
        const hasFill = background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent';
        const sides = ['Top', 'Right', 'Bottom', 'Left'];
        const borders = sides.map(side => {
          const width = parseFloat(style['border' + side + 'Width']);
          return style['border' + side + 'Style'] !== 'none' && width > 0 ? width * 0.75 : 0;
        });
        const box = !node.matches('mark,th') && (hasFill || borders.some(Boolean));
        const data = {color: pdfColor(style.color)};
        if (box) {
          data.playbookBox = {
            fillColor: hasFill ? pdfColor(background) : undefined,
            borders,
            colors: sides.map(side => pdfColor(style['border' + side + 'Color']))
          };
          // The fill goes on the PDF cell, not behind individual text runs.
          node.style.backgroundColor = '';
        } else if (hasFill) {
          data[node.matches('th') ? 'fillColor' : 'background'] = pdfColor(background);
        }
        if (node.matches('mark')) {
          const span = doc.createElement('span');
          span.append(...node.childNodes);
          node.replaceWith(span);
          node = span;
        }
        node.setAttribute('data-pdfmake', JSON.stringify(data));
      });
      // Convert generic wrappers to supported blocks, retaining headings and tables.
      printable.querySelectorAll('section,figure,figcaption,main,aside').forEach(node => {
        const div = doc.createElement('div');
        [...node.attributes].forEach(attr => div.setAttribute(attr.name, attr.value));
        div.append(...node.childNodes);
        node.replaceWith(div);
      });
      const converted = window.htmlToPdfmake(printable.innerHTML.replace(/☐/g, '[ ]'), {
        window: preview,
        defaultStyles: {
          h1: {fontSize: 19, bold: true, color: '#08294c', margin: [0, 12, 0, 10]},
          h2: {fontSize: 17, bold: true, color: '#08294c', margin: [0, 12, 0, 8]},
          h3: {fontSize: 14, bold: true, color: '#08294c', margin: [0, 12, 0, 7]},
          h4: {fontSize: 12, bold: true, color: '#08294c', margin: [0, 10, 0, 5]},
          p: {margin: [0, 3, 0, 7]},
          li: {margin: [0, 0, 0, 4]},
          th: {bold: true, fillColor: '#edf2f7'}
        }
      });
      function sizeTables(value) {
        if (!value || typeof value !== 'object') return;
        const styles = Array.isArray(value.style) ? value.style : [value.style];
        if (styles.some(style => /^html-h[1-6]$/.test(style || ''))) value.headlineLevel = 1;
        if (value.table?.body?.length) {
          value.table.widths = Array(value.table.body[0].length).fill('*');
          value.fontSize = 8;
          value.layout ??= {
            hLineColor: () => '#adb9c5',
            vLineColor: () => '#adb9c5'
          };
        }
        Object.values(value).forEach(child => {
          if (Array.isArray(child)) child.forEach(sizeTables);
          else if (child && typeof child === 'object') sizeTables(child);
        });
        if (value.playbookBox) {
          const {fillColor, borders, colors} = value.playbookBox;
          const {margin, headlineLevel, ...cell} = value;
          delete cell.playbookBox;
          Object.keys(value).forEach(key => delete value[key]);
          Object.assign(value, {
            margin,
            headlineLevel,
            table: {widths: ['*'], body: [[{...cell, fillColor}]]},
            layout: {
              hLineWidth: index => borders[index ? 2 : 0],
              vLineWidth: index => borders[index ? 1 : 3],
              hLineColor: index => colors[index ? 2 : 0],
              vLineColor: index => colors[index ? 1 : 3],
              paddingTop: () => 5,
              paddingBottom: () => 5,
              paddingLeft: () => 8,
              paddingRight: () => 8
            }
          });
          if (headlineLevel) value.table.dontBreakRows = true;
        }
      }
      sizeTables(converted);
      const definition = {
        pageSize: 'LETTER', pageMargins: [40, 40, 40, 45],
        info: {title: 'Install Playbook — Selected Sections', author: 'Builders FirstSource Raleigh'},
        defaultStyle: {font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: '#142c45'},
        content: converted,
        pageBreakBefore: (node, following) => Boolean(node.headlineLevel && following.length === 0),
        footer: (page, pages) => ({text: page + ' / ' + pages, alignment: 'center', fontSize: 9, color: '#526477', margin: [0, 12, 0, 0]})
      };
      const blob = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('PDF preparation timed out. Try selecting fewer sections.')), 90000);
        try {
          window.pdfMake.createPdf(definition).getBlob(result => { clearTimeout(timer); resolve(result); });
        } catch (error) { clearTimeout(timer); reject(error); }
      });
      const url = URL.createObjectURL(blob);
      const link = doc.createElement('a');
      link.href = url;
      link.download = filename;
      link.textContent = 'Download PDF';
      link.style.cssText = 'display:inline-block;margin-top:8px;padding:10px 16px;background:#08294c;color:white;border-radius:6px;font-weight:bold';
      help.replaceChildren(doc.createTextNode('Your PDF is ready. If the download does not start, tap Download PDF. On iPhone/iPad, use Share → Save to Files if the PDF opens.'), doc.createElement('br'), link);
      save.textContent = 'PDF ready';
      link.click();
      preview.addEventListener('unload', () => URL.revokeObjectURL(url), {once: true});
    } catch (error) {
      help.textContent = error.message || 'Could not create the PDF. Please try again.';
      save.disabled = false;
      save.textContent = 'Retry PDF download';
    }
  }

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
      h1,h2,h3,h4,h5,h6,aside,mark,th{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      @page{size:letter;margin:.55in}
      @media print{body{max-width:none;margin:0;padding:0;color:#000}.pdf-toolbar{display:none}.pdf-selection+.pdf-selection{break-before:page}a{color:inherit;text-decoration:none}}
    `;
    doc.head.append(style);
    const toolbar = doc.createElement('div');
    toolbar.className = 'pdf-toolbar';
    const save = doc.createElement('button');
    save.textContent = 'Download PDF';
    const filename = 'BFS-Install-Playbook-' + new Date().toISOString().slice(0, 10) + '.pdf';
    save.addEventListener('click', () => downloadPdf(preview, help, save, filename));
    const help = doc.createElement('p');
    help.textContent = 'Download your selected sections as a PDF file. Your selected content is below.';
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
      const styledSelector = 'h1,h2,h3,h4,h5,h6,summary,aside,mark,th';
      const originalStyles = [...choice.node.querySelectorAll(styledSelector)];
      const preservedStyles = new Map();
      clone.querySelectorAll(styledSelector).forEach((el, index) => {
        const source = originalStyles[index];
        const style = window.getComputedStyle(source);
        const properties = ['color', 'background-color', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius'];
        if (el.matches('aside,mark') || style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          properties.push('padding');
        }
        if (el.matches('mark')) properties.push('font-weight');
        preservedStyles.set(el, properties
          .filter(property => style.getPropertyValue(property))
          .map(property => property + ':' + style.getPropertyValue(property)).join(';'));
      });
      clone.querySelectorAll('script,style,button,input,select,textarea,.parts-controls').forEach(el => el.remove());
      [clone, ...clone.querySelectorAll('*')].forEach(el => {
        el.removeAttribute('id');
        const color = el.style.color || (el.classList.contains('osha-alert') ? '#c8102e' : '');
        el.removeAttribute('style');
        if (preservedStyles.has(el)) el.style.cssText = preservedStyles.get(el);
        if (color) el.style.color = color;
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
          title.style.cssText = summary.style.cssText;
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
    // Download a real PDF from the preview without opening the print dialog.
  });
});
})();