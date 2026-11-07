// Uso: node export.mjs <archify|mermaid> <entrada.(html|svg)> <salida-sin-extension>
// Genera .svg y .png (>= 2400 px) con un único estilo de impresión y mide el resultado a 16 cm.
// Requiere Chrome y: npm i puppeteer-core sharp. Las fuentes Mermaid se renderizan antes a SVG:
//   mmdc -i 01-....mmd -o 01.raw.svg -b white -c mermaid.config.json
// Las de Archify, a HTML: archify finalize <tipo> <fuente.json> <salida.html> --repo-root <repo>
// Para el ER y el recorrido completo, la nota al pie va en la variable NOTE (líneas separadas por |).
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import sharp from 'sharp';

const [, , mode, input, outBase] = process.argv;
const FONT = 'Arial, Helvetica, sans-serif';
const MIN_PT = 6.5, PAGE_PT = 453.54; // 16 cm

const STYLE = {
  'c-frontend': { fill: '#E6F0FA', stroke: '#1B5E8F', 'stroke-width': 1.5 },
  'c-backend': { fill: '#E3F3E8', stroke: '#2B6E48', 'stroke-width': 2.5 },
  'c-security': { fill: '#FFF3DC', stroke: '#8A5A00', 'stroke-width': 1.5, 'stroke-dasharray': '6 3' },
  'c-database': { fill: '#D9CDE6', stroke: '#5B3A80', 'stroke-width': 1.5 },
  'c-region': { fill: '#FAFAFA', stroke: '#999999', 'stroke-width': 1 },
  'c-lane': { fill: '#F4F4F4', stroke: '#999999', 'stroke-width': 1 },
  'a-default': { stroke: '#333333', 'stroke-width': 1.6 },
  'a-emphasis': { stroke: '#1B5E8F', 'stroke-width': 2.2 },
  'a-security': { stroke: '#8A5A00', 'stroke-width': 1.6, 'stroke-dasharray': '6 3' },
  'a-dashed': { stroke: '#555555', 'stroke-width': 1.6, 'stroke-dasharray': '3 3' },
  'm-default': { fill: '#333333' }, 'm-emphasis': { fill: '#1B5E8F' }, 'm-security': { fill: '#8A5A00' }, 'm-dashed': { fill: '#555555' },
};

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, args: ['--no-first-run', '--disable-gpu', '--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

let svgText;
if (mode === 'archify') {
  await p.goto('file:///' + input);
  await new Promise((r) => setTimeout(r, 500));
  svgText = await p.evaluate(({ STYLE, FONT, MIN_PT, PAGE_PT, NOTE }) => {
    document.documentElement.setAttribute('data-theme', 'light');
    const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    svg.setAttribute('data-theme', 'light');
    const NS = 'http://www.w3.org/2000/svg';
    svg.querySelectorAll('.ambient-edge-flow,.relationship-hit-overlay,.semantic-sigil,title,desc,[fill^="url(#"]').forEach((e) => e.remove());
    svg.querySelectorAll('[data-legend],.legend,[data-diagram-legend]').forEach((e) => e.remove());
    const W = svg.viewBox.baseVal.width;
    const base = (MIN_PT * W) / PAGE_PT;
    const cls = (e) => e.getAttribute('class') || '';

    // Tamaños: mínimo legible a 16 cm; títulos un 18 % mayores
    svg.querySelectorAll('text').forEach((t) => {
      const c = cls(t);
      const isTitle = /t-primary/.test(c) && !t.closest('[data-er-row]');
      t.setAttribute('font-size', (isTitle ? base * 1.18 : base).toFixed(2));
      t.setAttribute('font-family', FONT);
      t.setAttribute('font-weight', isTitle ? '700' : '400');
      t.style.cssText = '';
      t.setAttribute('fill', '#111111');
      t.setAttribute('stroke', 'none');
      t.setAttribute('opacity', '1');
      t.querySelectorAll('tspan').forEach((s) => s.removeAttribute('font-size'));
    });

    // Reubica el texto dentro de cada caja: centrado y sin solapes
    svg.querySelectorAll('[data-node-id]').forEach((g) => {
      if (g.querySelector('[data-er-row]')) return;
      const rect = [...g.children].find((e) => e.tagName === 'rect' && !/c-mask/.test(cls(e)));
      const texts = [...g.children].filter((e) => e.tagName === 'text').sort((a, b) => +a.getAttribute('y') - +b.getAttribute('y'));
      if (!rect || !texts.length) return;
      const x = +rect.getAttribute('x'), y = +rect.getAttribute('y'), w = +rect.getAttribute('width'), h = +rect.getAttribute('height');
      const lh = texts.map((t) => +t.getAttribute('font-size') * 1.24);
      let cy = y + (h - lh.reduce((s, v) => s + v, 0)) / 2;
      texts.forEach((t, i) => {
        cy += lh[i];
        t.setAttribute('y', (cy - lh[i] * 0.24).toFixed(1));
        t.setAttribute('x', (x + w / 2).toFixed(1));
        t.setAttribute('text-anchor', 'middle');
      });
    });

    // Ajusta el fondo de cada etiqueta de flecha al texto nuevo
    const masks = [...svg.querySelectorAll('rect.c-mask')];
    svg.querySelectorAll('text').forEach((t) => {
      if (!/t-edge|t-muted/.test(cls(t)) || t.closest('[data-node-id]')) return;
      const prev = t.previousElementSibling;
      const m = prev && prev.tagName === 'rect' && /c-mask/.test(cls(prev)) ? prev : null;
      if (!m) return;
      const bb = t.getBBox();
      m.setAttribute('x', (bb.x - 4).toFixed(1)); m.setAttribute('y', (bb.y - 1).toFixed(1));
      m.setAttribute('width', (bb.width + 8).toFixed(1)); m.setAttribute('height', (bb.height + 2).toFixed(1));
    });

    // Colores y trazos explícitos
    svg.querySelectorAll('rect,path,line,polygon,circle,ellipse').forEach((e) => {
      const cs = getComputedStyle(e);
      const key = cls(e).split(/\s+/).find((k) => STYLE[k]);
      const set = { fill: cs.fill, stroke: cs.stroke, 'stroke-width': cs.strokeWidth, 'stroke-dasharray': cs.strokeDasharray === 'none' ? null : cs.strokeDasharray, opacity: null, 'fill-opacity': null, 'stroke-opacity': null };
      if (/c-mask/.test(cls(e))) { set.fill = '#FFFFFF'; set.stroke = 'none'; }
      if (/er-zebra/.test(cls(e))) { set.fill = '#F4F4F4'; set.stroke = 'none'; }
      if (/er-row-rule|c-grid/.test(cls(e))) { set.stroke = '#CCCCCC'; }
      if (key) Object.assign(set, { fill: e.tagName === 'path' ? 'none' : set.fill }, STYLE[key]);
      for (const [k, v] of Object.entries(set)) { if (v === null) e.removeAttribute(k); else e.setAttribute(k, v); }
      e.style.cssText = '';
    });
    svg.querySelectorAll('rect').forEach((r) => { if (/c-(frontend|backend|security|database)/.test(cls(r))) r.setAttribute('rx', '8'); });

    // Tablas del modelo ER: mismo color de base de datos, cuerpo blanco
    svg.querySelectorAll('.er-table-cap,.er-key-badge').forEach((e) => {
      if (e.classList.contains('er-key-badge')) {
        const t = e.nextElementSibling;
        if (t && t.tagName === 'text') { t.setAttribute('font-weight', '700'); t.setAttribute('text-anchor', 'start'); t.setAttribute('x', (+e.getAttribute('x') - 2).toFixed(1)); }
      }
      e.remove();
    });
    svg.querySelectorAll('.er-table').forEach((e) => { e.setAttribute('fill', '#FFFFFF'); e.setAttribute('stroke', '#5B3A80'); e.setAttribute('stroke-width', '1.5'); });
    svg.querySelectorAll('.er-table-header').forEach((e) => { e.setAttribute('fill', '#D9CDE6'); e.setAttribute('stroke', 'none'); });
    svg.querySelectorAll('.er-band').forEach((e) => { e.setAttribute('fill', '#FAFAFA'); e.setAttribute('stroke', '#999999'); e.setAttribute('stroke-width', '1'); });
    svg.querySelectorAll('.er-band-pill').forEach((e) => {
      e.setAttribute('fill', '#FFFFFF'); e.setAttribute('stroke', '#999999'); e.setAttribute('stroke-width', '1');
      const t = e.nextElementSibling;
      if (t && t.tagName === 'text') {
        t.setAttribute('font-weight', '700'); t.setAttribute('letter-spacing', '0');
        const bb = t.getBBox();
        e.setAttribute('x', (bb.x - 6).toFixed(1)); e.setAttribute('width', (bb.width + 12).toFixed(1));
        e.setAttribute('y', (bb.y - 2).toFixed(1)); e.setAttribute('height', (bb.height + 4).toFixed(1));
      }
    });
    svg.querySelectorAll('.er-row-rule,.er-header-rule').forEach((e) => e.setAttribute('stroke', '#CCCCCC'));
    if (NOTE) {
      const band = svg.querySelector('.er-band');
      if (band) {
        const bb0 = band.getBBox();
        NOTE.split('|').forEach((line, i) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', bb0.x + 2); t.setAttribute('y', bb0.y + bb0.height + 26 + i * base * 1.3);
          t.setAttribute('font-size', base.toFixed(2)); t.setAttribute('font-family', FONT); t.setAttribute('fill', '#111111');
          t.textContent = line;
          svg.appendChild(t);
        });
      }
    }
    svg.querySelectorAll('style').forEach((e) => e.remove());
    svg.querySelectorAll('*').forEach((e) => {
      for (const a of [...e.attributes]) if (/^(class|data-|role|tabindex|aria-|style)/.test(a.name)) e.removeAttribute(a.name);
    });
    for (const a of [...svg.attributes]) if (!/^(viewBox|xmlns)/.test(a.name)) svg.removeAttribute(a.name);
    svg.setAttribute('style', 'display:block');
    const bb = svg.getBBox();
    svg.setAttribute('viewBox', `${bb.x - 14} ${bb.y - 14} ${bb.width + 28} ${bb.height + 28}`);
    svg.setAttribute('xmlns', NS);
    return svg.outerHTML;
  }, { STYLE, FONT, MIN_PT, PAGE_PT, NOTE: process.env.NOTE || '' });
} else {
  svgText = fs.readFileSync(input, 'utf8');
  await p.setContent(`<!doctype html><html><body style="margin:0">${svgText}</body></html>`);
  svgText = await p.evaluate((NOTE) => {
    const svg = document.querySelector('svg');
    svg.querySelectorAll('style').forEach((st) => { st.textContent = st.textContent.replace(/filter:[^;}]+;?/g, ''); });
    svg.querySelectorAll('*').forEach((e) => { e.removeAttribute('filter'); if (e.style) e.style.removeProperty('filter'); });
    svg.querySelectorAll('.node rect').forEach((r) => { r.setAttribute('rx', '8'); r.setAttribute('ry', '8'); });
    svg.querySelectorAll('.cluster').forEach((c) => {
      const r = c.querySelector('rect');
      r.setAttribute('rx', '10'); r.setAttribute('ry', '10');
      r.setAttribute('fill', '#FAFAFA'); r.setAttribute('stroke', '#999999'); r.setAttribute('stroke-width', '1');
      r.style.cssText = 'fill:#FAFAFA;stroke:#999999;stroke-width:1px';
      const label = c.querySelector('.cluster-label');
      if (label) {
        const y = /translate\([^,]+,\s*([-\d.]+)/.exec(label.getAttribute('transform') || '');
        const lb = label.getBBox();
        label.setAttribute('transform', `translate(${+r.getAttribute('x') + 12 - lb.x}, ${y ? y[1] : 0})`);
      }
    });
    svg.querySelectorAll('.edgePaths path, path.flowchart-link').forEach((e) => { e.style.strokeWidth = '1.6px'; e.style.stroke = '#333333'; });
    svg.querySelectorAll('text').forEach((t) => { t.setAttribute('font-family', 'Arial, Helvetica, sans-serif'); });
    svg.querySelectorAll('.edgeLabel').forEach((g) => {
      const t = g.querySelector('text');
      if (!t || !t.textContent.trim()) return;
      g.querySelectorAll('rect').forEach((r) => r.remove());
      const bb = t.getBBox();
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [k, v] of Object.entries({ x: bb.x - 5, y: bb.y - 2, width: bb.width + 10, height: bb.height + 4, fill: '#FFFFFF', stroke: 'none' })) r.setAttribute(k, v);
      t.parentNode.insertBefore(r, t);
    });
    if (NOTE) {
      const NS = 'http://www.w3.org/2000/svg';
      const vb = svg.viewBox.baseVal;
      const size = parseFloat(getComputedStyle(svg.querySelector('.node text')).fontSize);
      const lines = NOTE.split('|');
      lines.forEach((line, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', vb.x + 8); t.setAttribute('y', vb.y + vb.height + (i + 0.6) * size * 1.3);
        t.setAttribute('font-size', size); t.setAttribute('font-family', 'Arial, Helvetica, sans-serif'); t.setAttribute('fill', '#111111');
        t.textContent = line;
        svg.appendChild(t);
      });
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height + (lines.length + 0.4) * size * 1.3}`);
    }
    return svg.outerHTML;
  }, process.env.NOTE || '');
}

// Estándar de salida para ambas herramientas: fondo blanco y tamaño natural
const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svgText);
const [vx, vy, vw, vh] = vb.slice(1).map(Number);
svgText = svgText
  .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1')
  .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1')
  .replace(/<svg([^>]*?)\sstyle="[^"]*"/, '<svg$1')
  .replace(/<svg/, `<svg width="${vw}" height="${vh}"`)
  .replace(/(<svg[^>]*>)/, `$1<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#FFFFFF"/>`)
  .replace(/<!--[\s\S]*?-->/g, '');
if (!/xmlns=/.test(svgText.slice(0, 400))) svgText = svgText.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
fs.writeFileSync(outBase + '.svg', svgText);

// PNG desde el SVG final, y verificación sobre lo mismo que se entrega
const scale = Math.max(3, Math.ceil((2400 / vw) * 100) / 100);
const q = await b.newPage();
await q.setViewport({ width: Math.ceil(vw), height: Math.ceil(vh), deviceScaleFactor: scale });
await q.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svgText}</body></html>`);
await new Promise((r) => setTimeout(r, 200));
const report = await q.evaluate(({ MIN_PT, PAGE_PT }) => {
  const svg = document.querySelector('svg');
  const W = svg.viewBox.baseVal.width;
  const pt = (px) => (px * PAGE_PT) / W;
  const leaf = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim());
  const box = (e) => e.getBoundingClientRect();
  const sizes = leaf.map((t) => parseFloat(getComputedStyle(t.querySelector('tspan') || t).fontSize));
  const issues = [];
  const shrink = (r, d = 1) => ({ l: r.left + d, r: r.right - d, t: r.top + d, b: r.bottom - d });
  const hit = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
  for (let i = 0; i < leaf.length; i++) for (let j = i + 1; j < leaf.length; j++) {
    if (hit(shrink(box(leaf[i])), shrink(box(leaf[j])))) issues.push(`solape: "${leaf[i].textContent.trim().slice(0, 30)}" / "${leaf[j].textContent.trim().slice(0, 30)}"`);
  }
  const R = box(svg);
  leaf.forEach((t) => { const r = box(t); if (r.left < R.left || r.right > R.right || r.top < R.top || r.bottom > R.bottom) issues.push(`fuera del lienzo: "${t.textContent.trim().slice(0, 40)}"`); });
  // Texto contra la caja más pequeña que contiene su centro
  const shapes = [...svg.querySelectorAll('rect,polygon,path.label-container')].filter((s) => {
    const r = box(s); return r.width > 30 && r.height > 12 && r.width < R.width * 0.5;
  });
  leaf.forEach((t) => {
    const r = box(t), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const inside = shapes.map((s) => box(s)).filter((c) => c.left <= cx && cx <= c.right && c.top <= cy && cy <= c.bottom).sort((a, c) => a.width * a.height - c.width * c.height)[0];
    if (inside && (r.left < inside.left - 0.5 || r.right > inside.right + 0.5)) issues.push(`desborda su caja: "${t.textContent.trim().slice(0, 40)}"`);
  });
  const fo = svg.querySelectorAll('foreignObject').length;
  if (fo) issues.push(`${fo} foreignObject (no imprimible en algunas herramientas)`);
  return { vw: W, vh: svg.viewBox.baseVal.height, minPx: Math.min(...sizes), minPt: +pt(Math.min(...sizes)).toFixed(2), maxPt: +pt(Math.max(...sizes)).toFixed(2), textos: leaf.length, issues: [...new Set(issues)] };
}, { MIN_PT, PAGE_PT });
await q.screenshot({ path: outBase + '.png', clip: { x: 0, y: 0, width: vw, height: vh } });
const meta = await sharp(outBase + '.png').metadata();
console.log(JSON.stringify({ salida: outBase.split('/').pop(), png: `${meta.width}x${meta.height}`, ...report, cmEnPagina: `16 x ${(16 * vh / vw).toFixed(1)} cm` }, null, 0));
await sharp(outBase + '.png').grayscale().toFile(outBase + '.gris.png');
b.process()?.kill(); process.exit(0);
