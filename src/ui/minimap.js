// Round mini-map that rotates with the camera: roads, buildings, the GPS route, mission
// markers, the current objective (pinned to the rim when off-map) and Sarge.
import { vert } from '../map/graph.js';

const PX_PER_M = 0.6; // resolution of the pre-rendered map
const VIEW_RADIUS_M = 170; // meters from the center to the rim

export class Minimap {
  constructor(el, map) {
    this.el = el;
    this.ctx = el.getContext('2d');
    this.size = 0;
    this.frame = 0;
    this.prerender(map);
  }

  prerender(map) {
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < map.verts.length; i += 2) {
      minX = Math.min(minX, map.verts[i]); maxX = Math.max(maxX, map.verts[i]);
      minZ = Math.min(minZ, map.verts[i + 1]); maxZ = Math.max(maxZ, map.verts[i + 1]);
    }
    this.origin = [minX - 50, minZ - 50];
    const w = Math.ceil((maxX - minX + 100) * PX_PER_M);
    const h = Math.ceil((maxZ - minZ + 100) * PX_PER_M);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const P = (x, z) => [(x - this.origin[0]) * PX_PER_M, (z - this.origin[1]) * PX_PER_M];
    g.fillStyle = '#6fbf5a';
    g.fillRect(0, 0, w, h);
    const poly = (flat, color) => {
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i < flat.length; i += 2) {
        const [x, y] = P(flat[i], flat[i + 1]);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    };
    for (const p of map.parks) poly(p, '#58a845');
    for (const p of map.water) poly(p, '#4fc3f7');
    for (const b of map.buildings) poly(b.p, '#e9dfc9');
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const pass of [['#2f3440', 3], ['#f4f1ea', 0]]) {
      for (const r of map.roads) {
        if (r.t === 'service') continue;
        g.strokeStyle = pass[0];
        g.lineWidth = r.w * PX_PER_M + pass[1];
        g.beginPath();
        r.v.forEach((v, i) => {
          const [x, y] = P(...vert(map, v));
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
      }
    }
    this.base = c;
  }

  resize() {
    const css = this.el.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (css && css * dpr !== this.size) {
      this.size = css * dpr;
      this.el.width = this.size;
      this.el.height = this.size;
    }
  }

  // view: { x, z, heading, yaw, route, markers:[{x,z,color,label}], target:{x,z}, sarge:{x,z}, cans:[{x,z}] }
  draw(view) {
    if (++this.frame % 2) return; // 30 fps is plenty
    this.resize();
    const g = this.ctx;
    const S = this.size;
    const R = S / 2;
    const scale = R / VIEW_RADIUS_M; // device px per meter
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#6fbf5a';
    g.fillRect(0, 0, S, S);

    // World layer, rotated so the camera's forward points up.
    g.translate(R, R);
    g.rotate(view.yaw);
    g.scale(scale, scale);
    g.translate(-view.x, -view.z);
    const k = 1 / PX_PER_M;
    g.drawImage(this.base, this.origin[0], this.origin[1], this.base.width * k, this.base.height * k);
    if (view.route && view.route.length > 1) {
      g.strokeStyle = '#3fa9f5';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      view.route.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
      g.stroke();
    }
    g.restore();

    // Icons are drawn upright in screen space.
    const toScreen = (x, z, clamp) => {
      const dx = x - view.x;
      const dz = z - view.z;
      const c = Math.cos(view.yaw);
      const s = Math.sin(view.yaw);
      let sx = (dx * c - dz * s) * scale;
      let sy = (dx * s + dz * c) * scale;
      const d = Math.hypot(sx, sy);
      const edge = R - 12;
      if (d > edge) {
        if (!clamp) return null;
        sx = (sx / d) * edge;
        sy = (sy / d) * edge;
      }
      return [R + sx, R + sy];
    };
    const dot = (x, z, color, r, clamp = false, ring = '#fff') => {
      const p = toScreen(x, z, clamp);
      if (!p) return;
      g.fillStyle = color;
      g.strokeStyle = ring;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p[0], p[1], r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    };
    const u = S / 120; // icon unit
    for (const c of view.cans || []) dot(c.x, c.z, '#ff8a3d', 4 * u, true);
    for (const m of view.markers || []) {
      const p = toScreen(m.x, m.z, true);
      if (!p) continue;
      g.fillStyle = '#ffc21a';
      g.strokeStyle = '#1d2433';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(p[0], p[1], 6 * u, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#1d2433';
      g.font = `900 ${9 * u}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', p[0], p[1] + 0.5);
    }
    if (view.target) dot(view.target.x, view.target.z, '#3fa9f5', 6 * u, true);
    if (view.sarge && Math.floor(performance.now() / 250) % 2) dot(view.sarge.x, view.sarge.z, '#ff3b30', 5 * u, true);

    // Player arrow at the center.
    g.save();
    g.translate(R, R);
    g.rotate(view.yaw - view.heading + Math.PI);
    g.fillStyle = '#ff3b30';
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -9 * u);
    g.lineTo(6 * u, 7 * u);
    g.lineTo(0, 3.5 * u);
    g.lineTo(-6 * u, 7 * u);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();

    g.strokeStyle = '#1d2433';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(R, R, R - 3, 0, Math.PI * 2);
    g.stroke();
  }
}
