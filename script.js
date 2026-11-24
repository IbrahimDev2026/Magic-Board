'use strict';
/* Magic Board – MVC.
   MODEL      state.shapes = list of drawing objects (pen, line, rect, circle, image, project, clear). Undo/redo move items between two lists.
   VIEW       render() redraws the whole list on an off-screen layer, then adds grid and previews. updateUI() refreshes every control from `state`.
   CONTROLLER pointer events, keyboard, menus and commands.
   Texts live in i18n.js (English, Arabic, French). */

const COLORS = ['#111827','#ffffff','#dc2626','#ea580c','#facc15','#16a34a','#2563eb','#7c3aed','#ec4899','#8b5a2b','#6b7280','#06b6d4'];
const TOOLS = ['pen','eraser','line','rect','circle'];
const SIZES = [2, 6, 12];
const KEYS = { p:'pen', e:'eraser', l:'line', r:'rect', c:'circle' };
const IC = {
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eraser:'<path d="M20 20H9l-5-5a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 9"/><path d="M7 11l6 6"/>',
  line:'<path d="M5 19L19 5"/>', rect:'<rect x="4" y="6" width="16" height="12" rx="1"/>', circle:'<circle cx="12" cy="12" r="8"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
  open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><path d="M8 21v-7h8v7"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7"/><path d="M12 17h.01"/>',
  moon:'<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  exit:'<path d="M9 21H5V3h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  fill:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', grid:'<path d="M4 4h16v16H4z"/><path d="M4 12h16M12 4v16"/>',
  full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  notes:'<path d="M9 4h6l1 2h3v15H5V6h3z"/><path d="M9 13l2 2 4-4"/>',
  check:'<path d="M5 12l5 5 9-10"/>', next:'<path d="M9 5l7 7-7 7"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 0 0 3-3c0-6-4-11-8-11z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',
  drag:'<circle cx="5" cy="12" r="2"/><path d="M9 12h11M16 8l4 4-4 4"/>'
};
const svg = n => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = { tool:'pen', color:COLORS[0], colorKey:'col_0', size:6, fill:false, grid:false, shapes:[], redo:[], dirty:false };
let current = null, hover = null, game = null, W = 0, H = 0, DPR = 1;
const canvas = $('#canvas'), ctx = canvas.getContext('2d');
const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const colorName = () => state.colorKey ? t(state.colorKey) : t('customName', state.color);
const sizeName = () => t('size_' + Math.max(0, SIZES.indexOf(state.size)));
const saveSettings = () => store.set('mb-settings', { color:state.color, key:state.colorKey, size:state.size, fill:state.fill, grid:state.grid });
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };

/* ---------- MODEL: sanitising anything that comes from a file or storage ---------- */
function clean(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.type === 'image') return typeof s.src === 'string' && /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(s.src) ? { type:'image', src:s.src } : null;
  if (s.type === 'project') return { type:'project', shapes:(Array.isArray(s.shapes) ? s.shapes : []).map(clean).filter(Boolean) };
  if (!['pen','line','rect','circle'].includes(s.type)) return null;
  const o = { type:s.type, color:/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#111827', size:Math.min(60, Math.max(1, +s.size || 6)), erase:!!s.erase, fill:!!s.fill };
  if (s.type === 'pen') {
    if (!Array.isArray(s.points)) return null;
    o.points = s.points.slice(0, 20000).filter(p => p && Number.isFinite(+p.x) && Number.isFinite(+p.y)).map(p => ({ x:+p.x, y:+p.y }));
    return o.points.length ? o : null;
  }
  for (const k of ['x0','y0','x1','y1']) { if (!Number.isFinite(+s[k])) return null; o[k] = +s[k]; }
  return o;
}
function resetIndex() { for (let i = state.shapes.length - 1; i >= 0; i--) if (['clear','project'].includes(state.shapes[i].type)) return i; return -1; }
const visibleShapes = () => state.shapes.slice(Math.max(resetIndex(), 0)).filter(s => s.type !== 'clear');
const countShapes = () => visibleShapes().reduce((n, s) => n + (s.type === 'project' ? s.shapes.length : 1), 0);

/* ---------- VIEW ---------- */
const imgCache = {};
function getImg(src) { if (!imgCache[src]) { const i = new Image(); i.onload = () => render(); i.src = src; imgCache[src] = i; } return imgCache[src]; }
const eraserWidth = size => size * 4 + 8;
function penPath(c, pts) {
  c.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 1) return c.lineTo(pts[0].x + .01, pts[0].y);
  if (pts.length === 2) return c.lineTo(pts[1].x, pts[1].y);
  for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
  c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}
function drawShape(c, s, preview = false) {
  if (s.type === 'project') return s.shapes.forEach(x => drawShape(c, x));
  if (s.type === 'image') {
    const im = getImg(s.src); if (!im.complete || !im.naturalWidth) return;
    const k = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    return c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }
  if (s.type === 'clear') return;
  c.save(); c.lineWidth = s.erase ? eraserWidth(s.size) : s.size; c.lineCap = c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = s.color;
  if (s.erase) c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  if (s.type === 'pen') penPath(c, s.points);
  else if (s.type === 'line') { c.moveTo(s.x0, s.y0); c.lineTo(s.x1, s.y1); }
  else if (s.type === 'rect') c.rect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
  else if (s.type === 'circle') c.arc(s.x0, s.y0, Math.hypot(s.x1 - s.x0, s.y1 - s.y0), 0, Math.PI * 2);
  if (s.fill) { c.globalAlpha = preview ? .3 : 1; c.fill(); c.globalAlpha = 1; }
  if (preview) c.setLineDash([8, 6]);
  c.stroke(); c.restore();
}
function paintLayer() {
  lctx.setTransform(DPR, 0, 0, DPR, 0, 0); lctx.clearRect(0, 0, W, H);
  visibleShapes().forEach(s => drawShape(lctx, s));
  if (current && current.type === 'pen') drawShape(lctx, current);
}
function drawTarget() {
  ctx.save(); ctx.strokeStyle = '#0b6e7f'; ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round'; ctx.setLineDash([10, 9]); ctx.beginPath();
  game.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = '#0b6e7f'; ctx.beginPath(); ctx.arc(game.pts[0].x, game.pts[0].y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
function render() {
  paintLayer();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  if (state.grid) {
    ctx.strokeStyle = '#e1e7ea'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 25; x < W; x += 25) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (let y = 25; y < H; y += 25) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.restore();
  if (game) drawTarget();
  if (current && current.type !== 'pen') {
    drawShape(ctx, current, true);
    ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; const { x0, y0 } = current;
    ctx.beginPath(); ctx.moveTo(x0 - 7, y0); ctx.lineTo(x0 + 7, y0); ctx.moveTo(x0, y0 - 7); ctx.lineTo(x0, y0 + 7); ctx.stroke(); ctx.restore();
  }
  if (hover && state.tool === 'eraser') {
    ctx.save(); ctx.beginPath(); ctx.arc(hover.x, hover.y, eraserWidth(state.size) / 2, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke(); ctx.restore();
  }
}
let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
function fitCanvas() {
  const r = canvas.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
  DPR = Math.min(window.devicePixelRatio || 1, 3); W = Math.round(r.width); H = Math.round(r.height);
  [canvas, layer].forEach(c => { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
  if (game) game.pts = layoutTarget(game.unit);
  render();
}

/* ---------- ONE STATE → every control ---------- */
function penCursor() {
  const d = Math.max(state.size + 6, 14), r = d / 2 + 1;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${d + 2}" height="${d + 2}"><circle cx="${r}" cy="${r}" r="${d / 2}" fill="none" stroke="white" stroke-width="3"/><circle cx="${r}" cy="${r}" r="${d / 2}" fill="none" stroke="black" stroke-width="1.2"/><circle cx="${r}" cy="${r}" r="1" fill="black"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(s)}") ${r} ${r}, crosshair`;
}
function updateUI() {
  const mark = (sel, test) => $$(sel).forEach(b => { const on = test(b); b.classList.toggle('sel', on); b.setAttribute(b.closest('.dropdown') ? 'aria-checked' : 'aria-pressed', on); });
  mark('[data-tool]', b => b.dataset.tool === state.tool);
  mark('[data-color]', b => b.dataset.color === state.color);
  mark('[data-size]', b => +b.dataset.size === state.size);
  ['fill','grid'].forEach(k => $$('.tool[data-act=' + k + ']').forEach(b => { b.classList.toggle('on', state[k]); b.setAttribute('aria-pressed', state[k]); }));
  $('.custom').classList.toggle('sel', !state.colorKey);
  $('#tb-colorname').textContent = colorName();
  const n = countShapes();
  $('#st-tool').textContent = t('toolL') + ': ' + t('tool_' + state.tool);
  $('#st-color').innerHTML = '<i style="background:' + state.color + '"></i>' + t('colorL') + ': ' + colorName();
  $('#st-size').textContent = t('thickL') + ': ' + sizeName();
  $('#st-hint').textContent = game && !game.over ? t('h_game') : t('h_' + state.tool);
  $('#st-count').textContent = t('shapesCount', n);
  $$('[data-act=undo]').forEach(b => b.disabled = !state.shapes.length);
  $$('[data-act=redo]').forEach(b => b.disabled = !state.redo.length);
  $$('[data-act=clear]').forEach(b => b.disabled = n === 0);
  $('#hint').classList.toggle('hide', n > 0 || !!current || !!game);
  canvas.style.cursor = state.tool === 'eraser' ? 'none' : state.tool === 'pen' ? penCursor() : 'crosshair';
  $('[data-act=theme]').innerHTML = svg(isDark() ? 'sun' : 'moon');
  hudUpdate(); render();
}
let msgTimer;
function say(key, ...a) {
  const m = $('#st-msg'); m.textContent = t(key, ...a);
  m.animate([{ opacity:0, transform:'translateY(5px)' }, { opacity:1, transform:'none' }], { duration:220 });
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { m.textContent = ''; }, 9000);
}

/* ---------- LANGUAGE & THEME ---------- */
function applyLang() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  $$('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
  $$('[data-tt]').forEach(e => { const s = t(e.dataset.tt); e.title = s + (e.dataset.k ? ' (' + e.dataset.k + ')' : ''); e.setAttribute('aria-label', s); });
  $$('[data-k]:not([data-tt])').forEach(e => e.title = e.textContent.trim() + ' (' + e.dataset.k + ')');
  $('#lang').value = LANG; updateProgress(); updateUI();
}
const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
function toggleTheme() { const d = !isDark(); document.documentElement.dataset.theme = d ? 'dark' : 'light'; store.set('mb-theme', d ? 'dark' : 'light'); updateUI(); }

/* ---------- COMMANDS ---------- */
function setTool(k) { state.tool = k; hover = null; say('m_tool', t('tool_' + k)); updateUI(); }
function setColor(hex, key) {
  state.color = hex; state.colorKey = key || null; if (state.tool === 'eraser') state.tool = 'pen';
  saveSettings(); say('m_color', colorName()); updateUI();
}
function setSize(n) { state.size = n; saveSettings(); say('m_size', t('size_' + SIZES.indexOf(n))); updateUI(); }
function stepSize(d) { const i = Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(state.size) + d)); setSize(SIZES[i]); }
function toggle(k) { state[k] = !state[k]; saveSettings(); say('m_' + k, t(state[k] ? 'on' : 'off')); updateUI(); }
function addShape(s) { state.shapes.push(s); state.redo = []; state.dirty = true; }
function undo() {
  if (!state.shapes.length) return say('m_noundo');
  state.redo.push(state.shapes.pop()); state.dirty = true; if (game) game.idx = Math.min(game.idx, state.shapes.length);
  say('m_undone'); updateUI();
}
function redo() { if (!state.redo.length) return say('m_noredo'); state.shapes.push(state.redo.pop()); state.dirty = true; say('m_restored'); updateUI(); }
function clearBoard() {
  if (!countShapes()) return say('m_empty');
  addShape({ type:'clear' }); canvas.classList.remove('clearing'); void canvas.offsetWidth; canvas.classList.add('clearing');
  updateUI(); say('m_cleared'); toast('t_cleared', 'undo', () => { undo(); hideToast(); });
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
function exportBlob(cb) { /* PNG without grid, target or previews, on a white sheet */
  paintLayer(); const o = document.createElement('canvas'); o.width = layer.width; o.height = layer.height;
  const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height); c.drawImage(layer, 0, 0); o.toBlob(cb, 'image/png');
}
function savePNG() {
  exportBlob(b => download(b, 'magic-board-' + stamp() + '.png'));
  const kept = store.set('mb-project', visibleShapes()); state.dirty = false; say(kept ? 'm_png' : 'm_png2');
}
function saveProject() {
  download(new Blob([JSON.stringify({ app:'magic-board', version:4, shapes:visibleShapes() })], { type:'application/json' }), 'magic-board-' + stamp() + '.json');
  state.dirty = false; say('m_proj');
}
function copyImage() {
  exportBlob(async b => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png':b })]); say('m_copied'); } catch (e) { say('m_copyfail'); } });
}
function shareImage() {
  exportBlob(async b => {
    const f = new File([b], 'magic-board.png', { type:'image/png' });
    try { await navigator.share({ files:[f], title:'Magic Board' }); say('m_shared'); } catch (e) { if (e.name !== 'AbortError') say('m_sharefail'); }
  });
}
/* Open a picture (PNG/JPG…) or a Magic Board project (.json) */
function openFile(file) {
  if (!file) return; const reader = new FileReader();
  if (/\.json$/i.test(file.name) || file.type === 'application/json') {
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result), raw = Array.isArray(data) ? data : data.shapes;
        if (!Array.isArray(raw)) throw 0;
        const list = raw.map(clean).filter(Boolean); if (!list.length) throw 0;
        addShape({ type:'project', shapes:list }); state.dirty = false; updateUI();
        say('m_opened', file.name); toast('t_opened', 'undo', () => { undo(); hideToast(); });
      } catch (e) { say('m_bad'); }
    };
    reader.readAsText(file);
  } else if (file.type.startsWith('image/')) {
    reader.onload = () => { const s = clean({ type:'image', src:reader.result }); if (!s) return say('m_badtype'); addShape(s); updateUI(); say('m_pic'); };
    reader.readAsDataURL(file);
  } else say('m_badtype');
}
function newBoard() { state.shapes = []; state.redo = []; state.dirty = false; game = null; clearInterval(gameTimer); $('#goodbye').hidden = true; say('m_ready'); updateUI(); }
function doExit() { state.dirty = false; if (game) closeGame(true); window.close(); $('#goodbye').hidden = false; $('#restart').focus(); }
function requestExit() { state.dirty ? $('#dlg-exit').showModal() : doExit(); }
$('#dlg-exit').addEventListener('click', e => {
  const k = e.target.dataset.exit; if (!k) return; $('#dlg-exit').close();
  if (k === 'save') { savePNG(); doExit(); } else if (k === 'discard') doExit(); else say('m_back');
});
$('#dlg-exit').addEventListener('cancel', () => say('m_back'));
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target.hasAttribute('data-close') || e.target === d) d.close(); }));
$('#restart').addEventListener('click', newBoard);

let toastTimer;
function toast(key, labelKey, fn) {
  const el = $('#toast'); el.textContent = t(key);
  if (labelKey) { const b = document.createElement('button'); b.textContent = t(labelKey); b.onclick = fn; el.append(b); }
  el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 6000);
}
const hideToast = () => $('#toast').classList.remove('show');
function fullscreen() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }

/* ---------- TRACE GAME ---------- */
let gameTimer = 0;
const GAME_MS = 30000;
const densify = (pts, step) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step)); for (let k = 0; k < n; k++) out.push({ x:a.x + (b.x - a.x) * k / n, y:a.y + (b.y - a.y) * k / n }); } out.push(pts[pts.length - 1]); return out; };
const UNIT = {
  circle: () => Array.from({ length:97 }, (_, i) => ({ x:Math.cos(i / 96 * 2 * Math.PI - Math.PI / 2), y:Math.sin(i / 96 * 2 * Math.PI - Math.PI / 2) })),
  square: () => densify([[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x, y]) => ({ x:x * .9, y:y * .9 })), .05),
  triangle: () => densify([{ x:0, y:-1 }, { x:1, y:.8 }, { x:-1, y:.8 }, { x:0, y:-1 }], .05),
  star: () => densify([...Array.from({ length:10 }, (_, i) => { const r = i % 2 ? .42 : 1, a = i * Math.PI / 5 - Math.PI / 2; return { x:r * Math.cos(a), y:r * Math.sin(a) + .06 }; }), { x:0, y:-.94 }], .05),
  heart: () => Array.from({ length:121 }, (_, i) => { const a = i / 120 * 2 * Math.PI; return { x:16 * Math.sin(a) ** 3 / 17, y:-(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 + .08 }; })
};
function layoutTarget(unit) { const s = Math.min(W, H) * .3, cx = W / 2, cy = H / 2 + 34; return unit.map(p => ({ x:cx + p.x * s, y:cy + p.y * s })); }
function startGame() {
  const kinds = Object.keys(UNIT), kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (countShapes()) { addShape({ type:'clear' }); toast('t_game', 'undo', () => { undo(); hideToast(); }); }
  state.tool = 'pen'; current = null; clearInterval(gameTimer);
  const unit = UNIT[kind]();
  game = { kind, unit, pts:layoutTarget(unit), start:performance.now(), idx:state.shapes.length, over:false, score:0 };
  gameTimer = setInterval(tick, 200); say('m_gstart'); updateUI();
}
function userPoints(list) {
  const out = [];
  list.forEach(s => s.points.forEach((a, i, arr) => {
    out.push(a); const b = arr[i + 1]; if (!b) return;
    const n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 4);
    for (let k = 1; k <= n; k++) out.push({ x:a.x + (b.x - a.x) * k / (n + 1), y:a.y + (b.y - a.y) * k / (n + 1) });
  }));
  return out;
}
function scoreGame() {
  const user = userPoints(state.shapes.slice(game.idx).filter(s => s.type === 'pen' && !s.erase)); if (!user.length) return 0;
  const tol = 18, near = (p, list, r) => list.some(q => Math.hypot(p.x - q.x, p.y - q.y) <= r);
  const cover = game.pts.filter(p => near(p, user, tol)).length / game.pts.length;
  const precise = user.filter(p => near(p, game.pts, tol * 1.4)).length / user.length;
  return Math.round(100 * cover * precise);
}
function finishGame() {
  if (!game || game.over) return;
  clearInterval(gameTimer); game.score = scoreGame(); game.over = true;
  const best = Math.max(game.score, store.get('mb-best') || 0); store.set('mb-best', best); game.best = best;
  current = null; say('m_gend', game.score); updateUI();
}
function closeGame(silent) { clearInterval(gameTimer); game = null; if (!silent) say('m_gclosed'); updateUI(); }
function tick() {
  if (!game || game.over) return;
  const left = Math.max(0, GAME_MS - (performance.now() - game.start)), s = Math.ceil(left / 1000);
  $('#hud-time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  $('#hud-bar').style.width = left / GAME_MS * 100 + '%';
  if (left <= 0) finishGame();
}
function hudUpdate() {
  const h = $('#hud'); h.hidden = !game; if (!game) return;
  h.dataset.mode = game.over ? 'done' : 'run';
  if (game.over) {
    $('#hud-title').textContent = t('gScore', game.score);
    $('#hud-sub').textContent = t(game.score >= 85 ? 'gV3' : game.score >= 65 ? 'gV2' : game.score >= 40 ? 'gV1' : 'gV0') + ' · ' + t('gBest', game.best);
    $('#hud-time').textContent = ''; $('#hud-bar').style.width = '0%';
  } else { $('#hud-title').textContent = t('gameT', t('shape_' + game.kind)); $('#hud-sub').textContent = t('h_game'); tick(); }
}

/* ---------- BUILD CONTROLS (toolbar + menus from the same data) ---------- */
TOOLS.forEach(k => {
  const key = k === 'rect' ? 'R' : k[0].toUpperCase();
  const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = k; b.dataset.tt = 'tool_' + k; b.dataset.k = key;
  b.innerHTML = svg(k) + '<span data-t="tool_' + k + '"></span>'; $(k === 'pen' || k === 'eraser' ? '#tb-draw' : '#tb-shapes').append(b);
  const m = document.createElement('button'); m.dataset.tool = k; m.setAttribute('role', 'menuitemradio');
  m.innerHTML = svg(k) + '<span data-t="tool_' + k + '"></span><kbd>' + key + '</kbd>'; $('#menu-shapes').append(m);
});
COLORS.forEach((hex, i) => {
  const s = document.createElement('button'); s.className = 'swatch'; s.dataset.color = hex; s.dataset.key = 'col_' + i; s.dataset.tt = 'col_' + i;
  s.style.background = hex; s.style.setProperty('--tick', lum(hex) > .35 ? '#111' : '#fff'); $('#tb-colors').append(s);
  const m = document.createElement('button'); m.dataset.color = hex; m.dataset.key = 'col_' + i; m.setAttribute('role', 'menuitemradio');
  m.innerHTML = '<i class="sw" style="background:' + hex + '"></i><span data-t="col_' + i + '"></span>'; $('#menu-colors').append(m);
});
const mc = document.createElement('label'); mc.className = 'menu-custom';
mc.innerHTML = '<span data-t="custom"></span><input type="color" id="menu-custom" value="#ff6600">'; $('#menu-colors').append(mc);
SIZES.forEach((n, i) => {
  const b = document.createElement('button'); b.className = 'tool'; b.dataset.size = n; b.dataset.tt = 'size_' + i;
  b.innerHTML = '<i class="size-dot" style="width:' + (n + 4) + 'px;height:' + (n + 4) + 'px"></i><span data-t="size_' + i + '"></span>'; $('#tb-size').append(b);
});
$$('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.i)));
if (!(navigator.clipboard && window.ClipboardItem)) $$('[data-act=copy]').forEach(b => b.disabled = true);
if (!(navigator.share && navigator.canShare)) $$('[data-act=share]').forEach(b => b.disabled = true);

/* ---------- MENUS (mouse + keyboard) ---------- */
const menus = () => $$('.menu'), menuItems = m => $$('.dropdown button:not(:disabled)', m);
function closeMenus() { menus().forEach(m => { m.classList.remove('open'); $('.menu-btn', m).setAttribute('aria-expanded', 'false'); }); }
function openMenu(m, focusFirst) { closeMenus(); m.classList.add('open'); $('.menu-btn', m).setAttribute('aria-expanded', 'true'); if (focusFirst) menuItems(m)[0]?.focus(); }
$$('.menu-btn').forEach(b => b.addEventListener('mouseenter', () => { if ($('.menu.open') && !b.parentElement.classList.contains('open')) openMenu(b.parentElement); }));
$('.menus').addEventListener('keydown', e => {
  const m = e.target.closest('.menu'); if (!m) return;
  const open = m.classList.contains('open'), list = menuItems(m), i = list.indexOf(document.activeElement), all = menus();
  const side = d => { const n = all[(all.indexOf(m) + d + all.length) % all.length]; open ? openMenu(n, true) : $('.menu-btn', n).focus(); };
  const rtl = document.documentElement.dir === 'rtl';
  if (e.key === 'ArrowDown') { e.preventDefault(); open ? list[(i + 1) % list.length]?.focus() : openMenu(m, true); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) list[(i - 1 + list.length) % list.length]?.focus(); else { openMenu(m); menuItems(m).at(-1)?.focus(); } }
  else if (e.key === 'ArrowRight') { e.preventDefault(); side(rtl ? -1 : 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); side(rtl ? 1 : -1); }
  else if (e.key === 'Home' && open) { e.preventDefault(); list[0]?.focus(); }
  else if (e.key === 'End' && open) { e.preventDefault(); list.at(-1)?.focus(); }
  else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); closeMenus(); $('.menu-btn', m).focus(); }
});

/* ---------- EVENTS ---------- */
const ACTIONS = { undo, redo, clear:clearBoard, save:savePNG, project:saveProject, copy:copyImage, share:shareImage, open:() => $('#file').click(), exit:requestExit,
  help:() => $('#dlg-guide').showModal(), notes:() => $('#dlg-notes').showModal(), theme:toggleTheme, full:fullscreen, fill:() => toggle('fill'), grid:() => toggle('grid'),
  trace:startGame, gstop:finishGame, gclose:() => closeGame() };
document.addEventListener('click', e => {
  if (e.target.closest('.dropdown input, .dropdown label')) return;
  const btn = e.target.closest('.menu-btn');
  if (btn) { const m = btn.parentElement, was = m.classList.contains('open'); closeMenus(); if (!was) openMenu(m, e.detail === 0); return; }
  closeMenus();
  const el = e.target.closest('button'); if (!el || el.disabled) return;
  if (el.dataset.tool) setTool(el.dataset.tool); else if (el.dataset.color) setColor(el.dataset.color, el.dataset.key);
  else if (el.dataset.size) setSize(+el.dataset.size); else if (el.dataset.act) ACTIONS[el.dataset.act]();
});
['#custom-color', '#menu-custom'].forEach(sel => $(sel).addEventListener('input', e => { $('#custom-color').value = $('#menu-custom').value = e.target.value; setColor(e.target.value); }));
$('#file').addEventListener('change', e => { openFile(e.target.files[0]); e.target.value = ''; });
$('#lang').addEventListener('change', e => { LANG = e.target.value; store.set('mb-lang', LANG); applyLang(); say('m_ready'); });
['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop') openFile(e.dataTransfer.files[0]); }));

document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || $('dialog[open]') || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) { const map = { z:e.shiftKey ? redo : undo, y:redo, s:savePNG, q:requestExit, o:ACTIONS.open }; if (map[k]) { e.preventDefault(); map[k](); } return; }
  if (KEYS[k]) setTool(KEYS[k]);
  else if (k === 'f') toggle('fill'); else if (k === 'g') toggle('grid'); else if (k === 't') startGame();
  else if (k === '[') stepSize(-1); else if (k === ']') stepSize(1); else if (k === '?') $('#dlg-guide').showModal();
  else if (k === 'escape' && game) closeGame();
});
const pos = e => { const r = canvas.getBoundingClientRect(); return { x: Math.round((e.clientX - r.left) * 10) / 10, y: Math.round((e.clientY - r.top) * 10) / 10 }; };
const tiny = s => (s.type === 'line' || s.type === 'circle') ? Math.hypot(s.x1 - s.x0, s.y1 - s.y0) < 4 : s.type === 'rect' ? Math.abs(s.x1 - s.x0) < 4 || Math.abs(s.y1 - s.y0) < 4 : false;
canvas.addEventListener('pointerdown', e => {
  if (e.button > 0 || current) return; canvas.setPointerCapture(e.pointerId); const p = pos(e), er = state.tool === 'eraser';
  current = { type: er ? 'pen' : state.tool, erase: er, color: state.color, size: state.size, fill: state.fill && ['rect','circle'].includes(state.tool), x0:p.x, y0:p.y, x1:p.x, y1:p.y, points:[p] };
  closeMenus(); say('m_draw'); $('#hint').classList.add('hide'); render();
});
canvas.addEventListener('pointermove', e => {
  const p = pos(e); hover = e.pointerType === 'touch' ? null : p;
  $('#st-pos').textContent = 'x ' + Math.round(p.x) + '  y ' + Math.round(p.y);
  if (current) {
    current.x1 = p.x; current.y1 = p.y;
    if (current.type === 'pen') { const l = current.points[current.points.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) >= 1.2) current.points.push(p); }
  }
  if (current || state.tool === 'eraser') schedule();
});
const finish = () => {
  if (!current) return; const s = current; current = null;
  if (tiny(s)) { say('m_tiny', t('tool_' + state.tool).toLowerCase()); return updateUI(); }
  addShape(s); say(s.erase ? 'm_erased' : 'm_added'); updateUI();
};
canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
canvas.addEventListener('pointerleave', () => { hover = null; $('#st-pos').textContent = ''; schedule(); });
new ResizeObserver(fitCanvas).observe(canvas);
window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- DESIGN NOTES & TEST (saved in this browser) ---------- */
const checks = store.get('mb-checks') || {};
function updateProgress() { $$('[data-prog]').forEach(p => { const boxes = $$('[data-chk^="' + p.dataset.prog + '"]'); p.textContent = t('progress', boxes.filter(b => b.checked).length, boxes.length); }); }
$$('[data-chk]').forEach(b => { b.checked = !!checks[b.dataset.chk]; b.addEventListener('change', () => { checks[b.dataset.chk] = b.checked; store.set('mb-checks', checks); updateProgress(); }); });
$('#notes-text').value = store.get('mb-notes') || ''; $('#notes-text').addEventListener('input', e => store.set('mb-notes', e.target.value));
$$('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
  $$('[data-tab]').forEach(o => { const on = o === tab; o.setAttribute('aria-selected', on); o.tabIndex = on ? 0 : -1; $('#' + o.getAttribute('aria-controls')).hidden = !on; });
}));
$('.tabs').addEventListener('keydown', e => {
  const tabs = $$('[data-tab]'), i = tabs.indexOf(document.activeElement), d = { ArrowRight:1, ArrowLeft:-1 }[e.key]; if (i < 0 || !d) return;
  const n = tabs[(i + (document.documentElement.dir === 'rtl' ? -d : d) + tabs.length) % tabs.length]; n.focus(); n.click();
});

(function init() {
  const th = store.get('mb-theme'); if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th;
  const s = store.get('mb-settings');
  if (s) Object.assign(state, { color:/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : state.color, colorKey:s.key || null, size:SIZES.includes(s.size) ? s.size : 6, fill:!!s.fill, grid:!!s.grid });
  const saved = store.get('mb-project'), list = Array.isArray(saved) ? saved.map(clean).filter(Boolean) : [];
  if (list.length) state.shapes = list;
  applyLang(); fitCanvas();
  if (list.length) { say('m_saved'); toast('t_restored', 'newBoard', () => { clearBoard(); }); } else say('m_ready');
})();
