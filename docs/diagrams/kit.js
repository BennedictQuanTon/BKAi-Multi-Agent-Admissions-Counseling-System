// BKAi diagram kit — orthogonal connectors between elements, drawn after layout.
const COLORS = {
  blue: "#2563eb", green: "#16a34a", orange: "#f97316", purple: "#7c3aed",
  teal: "#0d9488", red: "#dc2626", slate: "#64748b", gray: "#94a3b8",
};

function anchor(el, side, canvas, t = 0.5) {
  const r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  const x0 = r.left - c.left, y0 = r.top - c.top;
  return {
    r: [x0 + r.width, y0 + r.height * t], l: [x0, y0 + r.height * t],
    t: [x0 + r.width * t, y0], b: [x0 + r.width * t, y0 + r.height],
  }[side];
}

/**
 * wire("a", "b", {from:"r", to:"l", color:"blue", dash:false, label:"", via:"h"|"v", tf, tt, mid})
 * Routes with one elbow (H-V-H or V-H-V); `mid` fixes the elbow coordinate (0..1 between ends or px).
 */
function wire(a, b, o = {}) {
  const canvas = document.getElementById("canvas");
  const svg = document.getElementById("wires");
  const A = document.getElementById(a), B = document.getElementById(b);
  if (!A || !B) { console.error("missing", a, b); return; }
  const from = o.from || "r", to = o.to || "l";
  const [x1, y1] = anchor(A, from, canvas, o.tf ?? 0.5);
  const [x2, y2] = anchor(B, to, canvas, o.tt ?? 0.5);
  const color = COLORS[o.color || "blue"] || o.color;
  const horiz = (from === "r" || from === "l");
  let d;
  if (o.path) d = o.path(x1, y1, x2, y2);
  else if (horiz && (to === "l" || to === "r")) {
    const mx = o.mid !== undefined ? (o.mid <= 1 ? x1 + (x2 - x1) * o.mid : o.mid) : (x1 + x2) / 2;
    d = `M${x1},${y1} H${mx} V${y2} H${x2}`;
  } else if (!horiz && (to === "t" || to === "b")) {
    const my = o.mid !== undefined ? (o.mid <= 1 ? y1 + (y2 - y1) * o.mid : o.mid) : (y1 + y2) / 2;
    d = `M${x1},${y1} V${my} H${x2} V${y2}`;
  } else if (horiz) d = `M${x1},${y1} H${x2} V${y2}`;
  else d = `M${x1},${y1} V${y2} H${x2}`;
  const id = "m" + color.replace("#", "");
  if (!document.getElementById(id)) {
    const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    m.setAttribute("id", id); m.setAttribute("viewBox", "0 0 10 10"); m.setAttribute("refX", "8.5"); m.setAttribute("refY", "5");
    m.setAttribute("markerWidth", "7"); m.setAttribute("markerHeight", "7"); m.setAttribute("orient", "auto-start-reverse");
    m.innerHTML = `<path d="M0,0 L10,5 L0,10 z" fill="${color}"/>`;
    svg.querySelector("defs").appendChild(m);
  }
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", color);
  p.setAttribute("stroke-width", o.width || 2.2); p.setAttribute("stroke-linejoin", "round");
  if (o.dash) p.setAttribute("stroke-dasharray", "7 6");
  p.setAttribute("marker-end", `url(#${id})`);
  if (o.both) p.setAttribute("marker-start", `url(#${id})`);
  svg.appendChild(p);
  if (o.label) {
    const len = p.getTotalLength(), pt = p.getPointAtLength(len * (o.lpos ?? 0.5));
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("class", "lbl"); t.setAttribute("fill", color); t.setAttribute("text-anchor", "middle");
    t.setAttribute("x", pt.x + (o.lx || 0)); t.setAttribute("y", pt.y + 4.5 + (o.ly || 0)); t.textContent = o.label;
    g.appendChild(t); svg.appendChild(g);
    const bb = t.getBBox();
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", bb.x - 6); bg.setAttribute("y", bb.y - 3); bg.setAttribute("width", bb.width + 12); bg.setAttribute("height", bb.height + 6);
    bg.setAttribute("rx", 6); bg.setAttribute("fill", "#fff");
    g.insertBefore(bg, t);
  }
}

function legendLine(color, dash) {
  const c = COLORS[color] || color;
  return `<svg viewBox="0 0 44 10"><line x1="1" y1="5" x2="36" y2="5" stroke="${c}" stroke-width="2.2" ${dash ? 'stroke-dasharray="6 5"' : ""}/><path d="M34,1 L42,5 L34,9 z" fill="${c}"/></svg>`;
}

function legend(items) {
  return `<div class="legend">${items.map(([c, label, dash]) => `<span>${legendLine(c, dash)}${label}</span>`).join("")}</div>`;
}

function ready(fn) {
  const go = () => { lucide.createIcons({ attrs: { "stroke-width": 1.6 } }); requestAnimationFrame(() => requestAnimationFrame(() => { fn(); document.body.dataset.ready = "1"; })); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else window.addEventListener("load", go);
}

function rel(id) {
  const c = document.getElementById("canvas").getBoundingClientRect();
  const r = document.getElementById(id).getBoundingClientRect();
  return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height, r: r.right - c.left, b: r.bottom - c.top, cx: r.left - c.left + r.width / 2, cy: r.top - c.top + r.height / 2 };
}
/** Straight vertical wire from the bottom of `a` to the top of `b` at x (px, or 0..1 across the overlap). */
function vwire(a, b, x, o = {}) {
  const A = rel(a), B = rel(b);
  const lo = Math.max(A.x, B.x), hi = Math.min(A.r, B.r);
  const X = x <= 1 ? lo + (hi - lo) * x : x;
  const up = o.up;
  wire(a, b, { ...o, path: () => up ? `M${X},${A.y} V${B.b}` : `M${X},${A.b} V${B.y}` });
}
/** Straight horizontal wire from the right of `a` to the left of `b` at y (px, or 0..1 across the overlap). */
function hwire(a, b, y, o = {}) {
  const A = rel(a), B = rel(b);
  const lo = Math.max(A.y, B.y), hi = Math.min(A.b, B.b);
  const Y = y <= 1 ? lo + (hi - lo) * y : y;
  const left = o.left;
  wire(a, b, { ...o, path: () => left ? `M${A.x},${Y} H${B.r}` : `M${A.r},${Y} H${B.x}` });
}
