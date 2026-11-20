/*
 * Scène de la page de présentation : une salle dessinée en points de lumière, pilotée par le
 * défilement. Code repris de la maquette (visionviewer-landing.html), d'où le JavaScript sans
 * types. Deux adaptations : l'horloge (three.js r187) et les salles, qui ne sont plus écrites
 * ici mais lues dans les données de la démo (halls.ts).
 */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {halls, num} from './halls';

const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const span = (p, a, b) => clamp((p - a) / (b - a));
const band = (p, a, b, c, d) => span(p, a, b) * (1 - span(p, c, d));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // tirage fixe : la salle est la même à chaque visite

/* ---------- les salles : celles de la démo (src/data/rooms), via halls.ts ---------- */
const H1 = halls[0], H2 = halls[1] ?? halls[0];                 // la salle racontée, puis celle vers laquelle elle se transforme
const D = H1.dim, NR = H1.rows.length, HW = H1.box.halfWidth, DEPTH = H1.box.depth, HH = H1.box.height;
const OY = 1.7, OZ = DEPTH / 2;                              // pivot : centre de la salle
const V = (x, y, z) => new THREE.Vector3(x, y - OY, z - OZ);
const SC = V(0, D.screenBottom + D.screenH / 2, 0);

const SX = (s, h) => s.span === 2 ? (2 * h.dim.seatW - .1) / .5 : 1;     // une place double : une banquette de deux largeurs
const seats = H1.seats.map(s => ({id: s.id, r: s.row, n: s.number, span: s.span, sx: SX(s, H1), pmr: s.pmr, busy: s.busy, sel: s.id === H1.selected, pos: V(s.x, s.y, s.z)}));
const real = seats.filter(s => !s.pmr), selSeat = real.find(s => s.sel);
const eyeOf = id => { const s = seats.find(x => x.id === id); return s.pos.clone().add(new THREE.Vector3(0, D.eye, 0)); };   // les yeux, là où la démo les place

/* ---------- renderer ---------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
renderer.setClearColor(0, 0);
const scene = new THREE.Scene(), hall = new THREE.Group(); scene.add(hall);
const camera = new THREE.PerspectiveCamera(38, 1, .05, 200);

/* ---------- les points ---------- */
const aPos = [], aStart = [], aCol = [], aSize = [], aRnd = [], aSel = [], aKind = [], aDust = [];
let dust = 0;
let kind = 1;                                                // 1 : points qui deviennent des fauteuils pleins
const R0 = 4.7;
// forme de départ : un seul fauteuil géant, échantillonné sur ses surfaces
const PARTS = [
  {c: [0, .45, -.02], s: [.5, .14, .47], rx: 0}, {c: [0, .76, .27], s: [.5, .58, .13], rx: .16},
  {c: [.29, .37, .02], s: [.055, .5, .38], rx: 0}, {c: [-.29, .37, .02], s: [.055, .5, .38], rx: 0},
  {c: [.29, .645, .02], s: [.085, .06, .44], rx: 0}, {c: [-.29, .645, .02], s: [.085, .06, .44], rx: 0},
  {c: [0, .19, .04], s: [.36, .38, .3], rx: 0}
].map(q => ({...q, a: q.s[0] * q.s[1] + q.s[1] * q.s[2] + q.s[0] * q.s[2]}));
const PART_A = PARTS.reduce((t, q) => t + q.a, 0), GS = 6.3;
function giantSeat() {
  let r = rnd() * PART_A, q = PARTS[0];
  for (const o of PARTS) { if (r < o.a) { q = o; break; } r -= o.a; }
  const [sx, sy, sz] = q.s, f = rnd() * q.a, ax = f < sx * sy ? 2 : f < sx * sy + sy * sz ? 0 : 1;
  const v = [(rnd() - .5) * sx, (rnd() - .5) * sy, (rnd() - .5) * sz];
  v[ax] = (rnd() < .5 ? -.5 : .5) * q.s[ax];
  if (rnd() < .32) { const b = (ax + 1 + (rnd() < .5 ? 0 : 1)) % 3; v[b] = (rnd() < .5 ? -.5 : .5) * q.s[b]; }   // arêtes plus denses : la silhouette se lit
  const cs = Math.cos(q.rx), sn = Math.sin(q.rx), y = v[1] * cs - v[2] * sn, z = v[1] * sn + v[2] * cs;
  return [(v[0] + q.c[0]) * GS * 1.45, (y + q.c[1] - .56) * GS, (z + q.c[2] - .08) * GS * 1.15];
}
const cloud = () => { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = R0 * (.75 + .75 * rnd()), q = Math.sqrt(1 - u * u); return [rr * q * Math.cos(th), rr * u, rr * q * Math.sin(th)]; };
let startFn = cloud;
function pt(x, y, z, c, size, sel = 0) {
  aPos.push(x, y, z);
  aStart.push(...startFn());
  const k = .7 + .5 * rnd(); aCol.push(c[0] * k, c[1] * k, c[2] * k);
  aSize.push(size * (.7 + .6 * rnd())); aRnd.push(rnd()); aSel.push(sel); aKind.push(kind); aDust.push(dust);
}
const headX = s => s.sx > 1 ? [-.28, .28] : [0];                  // un fauteuil double occupé accueille deux spectateurs
const RED = [.92, .2, .24], DARK = [.3, .09, .13], WHITE = [.95, .96, 1], GREY = [.34, .36, .46];
for (const s of real) {
  const c = s.busy ? DARK : RED, p = s.pos, sel = s.sel ? 1 : 0, w = .46 * s.sx, m = Math.round(s.sx);
  startFn = c === RED || c === DARK ? giantSeat : cloud;
  for (let i = 0; i < 13 * m; i++) pt(p.x + (rnd() - .5) * w, p.y + .5, p.z - .25 + rnd() * .44, c, .095, sel);
  for (let i = 0; i < 21 * m; i++) { const h = rnd() * .6; pt(p.x + (rnd() - .5) * w, p.y + .5 + h * .99, p.z + .24 + h * .13, c, .095, sel); }
  for (let i = 0; i < 8 * m; i++) pt(p.x - w / 2 + i * w / (8 * m - 1), p.y + 1.1, p.z + .32, c, .105, sel);   // arête du dossier
  if (s.busy) for (const hx of headX(s)) { startFn = cloud;                                                           // spectateur
    for (let i = 0; i < 22; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, q = Math.sqrt(1 - u * u); pt(p.x + hx + .115 * q * Math.cos(th), p.y + 1.22 + .115 * u, p.z + .1 + .115 * q * Math.sin(th), WHITE, .05); }
    for (let i = 0; i < 12; i++) pt(p.x + hx + (rnd() - .5) * .44, p.y + .98 + rnd() * .08, p.z + .14 + (rnd() - .5) * .16, WHITE, .05);
  }
}
kind = 0;
for (const s of seats.filter(s => s.pmr)) for (let i = 0; i < 16; i++) { startFn = cloud; pt(s.pos.x + .22 * Math.cos(i / 16 * 6.283), s.pos.y + .02, s.pos.z + .05 + .22 * Math.sin(i / 16 * 6.283), WHITE, .05); }
startFn = cloud;
for (let i = 0; i < 1300; i++) {                                                                     // sol en gradins
  const z = rnd() * DEPTH, r = clamp(Math.floor((z - D.firstRow + .55) / D.rowGap), 0, NR - 1), v = V((rnd() * 2 - 1) * HW, r * D.step, z);
  pt(v.x, v.y, v.z, GREY, .04);
}
for (let i = 0; i < 260; i++) {                                                                      // cadre de l'écran
  const e = i % 4, t = rnd(), w = D.screenW / 2 + .12, h = D.screenH / 2 + .12;
  const x = e < 2 ? (t * 2 - 1) * w : (e === 2 ? -w : w), y = e < 2 ? (e ? h : -h) : (t * 2 - 1) * h;
  pt(x, SC.y + y, SC.z + .1, WHITE, .06);
}
startFn = cloud;
dust = 1;
for (let i = 0; i < 700; i++) { const v = V((rnd() * 2 - 1) * HW, rnd() * HH, rnd() * DEPTH); pt(v.x, v.y, v.z, GREY, .035); }   // poussière dans le faisceau

const pg = new THREE.BufferGeometry();
pg.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
pg.setAttribute('aStart', new THREE.Float32BufferAttribute(aStart, 3));
pg.setAttribute('aCol', new THREE.Float32BufferAttribute(aCol, 3));
pg.setAttribute('aSize', new THREE.Float32BufferAttribute(aSize, 1));
pg.setAttribute('aRnd', new THREE.Float32BufferAttribute(aRnd, 1));
pg.setAttribute('aSel', new THREE.Float32BufferAttribute(aSel, 1));
pg.setAttribute('aKind', new THREE.Float32BufferAttribute(aKind, 1));
pg.setAttribute('aDust', new THREE.Float32BufferAttribute(aDust, 1));
const pm = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: {uGone: {value: 0}, uSolid: {value: 0}, uForm: {value: 0}, uTime: {value: 0}, uPx: {value: 1}, uMax: {value: 16}, uSel: {value: 0}, uLit: {value: 0}},
  vertexShader: `attribute vec3 aStart,aCol;attribute float aSize,aRnd,aSel,aKind,aDust;
  uniform float uGone,uSolid,uForm,uTime,uPx,uMax,uSel,uLit;varying vec3 vC;varying float vA;
  void main(){
    float t=smoothstep(aRnd*.55,aRnd*.55+.45,uForm);t=t*t*(3.-2.*t);
    float a=3.14159+.7*sin(uTime*.32);vec3 s=aStart;s.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*s.xz;s.yz=mat2(.927,.375,-.375,.927)*s.yz;
    vec3 p=mix(s,position,t);
    p+=sin(t*3.14159)*1.6*vec3(sin(aRnd*40.),cos(aRnd*63.),sin(aRnd*91.));
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=min(aSize*(1.+.5*aSel*uSel)*uPx/-mv.z,uMax);
    vec3 c=mix(aCol,vec3(.36,.95,.56),aSel*uSel);
    c*=mix(1.,.62,uSel*(1.-aSel))*(1.+uLit*.5);
    vC=c;
    vA=(.72+.28*sin(uTime*(1.+aRnd*2.)+aRnd*50.))*smoothstep(.3,1.3,-mv.z)*(1.-uSolid*aKind)*(1.-uGone*(1.-aDust));
  }`,
  fragmentShader: `varying vec3 vC;varying float vA;
  void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.12,d);gl_FragColor=vec4(vC*a*vA,a*vA);}`
});
const points = new THREE.Points(pg, pm); points.frustumCulled = false; points.renderOrder = 2; hall.add(points);

/* ---------- les fauteuils pleins : les points s'y condensent ---------- */
const hemi = new THREE.HemisphereLight(0xffffff, 0x2a0d12, 0), screenLight = new THREE.PointLight(0xffffff, 0, 60, 1);
screenLight.position.copy(SC).z += 1.6; hall.add(hemi, screenLight);
const cushG = new RoundedBoxGeometry(.5, .13, .47, 3, .05); cushG.translate(0, .45, -.02);
const backG = new RoundedBoxGeometry(.5, .62, .11, 3, .05); backG.rotateX(.13); backG.translate(0, .77, .26);
const armG = new RoundedBoxGeometry(.055, .06, .4, 2, .025); armG.translate(.28, .62, .02);
const footG = new THREE.BoxGeometry(.4, .38, .34); footG.translate(0, .19, .02);
const solidMats = [];
const sm = o => { const m = new THREE.MeshStandardMaterial({transparent: true, opacity: 0, ...o}); solidMats.push(m); return m; };
const fabric = sm({color: 0xffffff, roughness: .75}), shell = sm({color: 0x2a0c10, roughness: .6}), bodyMat = sm({color: 0x0c0c12, roughness: .9});
const mtx = new THREE.Matrix4(), tc = new THREE.Color();
const cSeat = new THREE.Color(0xa3212a), cBusy = new THREE.Color(0x4a1118), cSel = new THREE.Color(0x43b76b);

/* ---------- deux salles : la première, puis la disposition de la suivante ---------- */
const lay = h => { const d = h.box.depth, list = h.seats.filter(s => !s.pmr).map(s => ({id: s.id, x: s.x, y: s.y - OY, z: s.z - d / 2, sx: SX(s, h), busy: s.busy}));
  const sel = list.splice(list.findIndex(s => s.id === h.selected), 1)[0];
  const heads = list.flatMap(s => s.busy ? (s.sx > 1 ? [-.28, .28] : [0]).map(dx => ({x: s.x + dx, y: s.y, z: s.z})) : []);
  if (!heads.length) heads.push({x: 0, y: -60, z: 0});          // salle vide : une tête hors champ, pour garder les tableaux non vides
  return {name: h.name, desc: h.description, seats: list, sel, places: h.places, heads,
    scr: {w: h.dim.screenW, h: h.dim.screenH, y: h.dim.screenBottom + h.dim.screenH / 2 - OY, z: -d / 2}, bx: {hw: h.box.halfWidth, hh: h.box.height, d}}; };
const LA = lay(H1), LAYS = [LA, lay(H2)], NMAX = Math.max(...LAYS.map(l => l.seats.length)), HN = Math.max(...LAYS.map(l => l.heads.length));
const cushM = new THREE.InstancedMesh(cushG, fabric, NMAX), backM = new THREE.InstancedMesh(backG, fabric, NMAX);
const armM = new THREE.InstancedMesh(armG, shell, NMAX), footM = new THREE.InstancedMesh(footG, shell, NMAX);
const headM = new THREE.InstancedMesh(new THREE.SphereGeometry(.115, 20, 14), bodyMat, HN);
const shG = new THREE.SphereGeometry(.14, 20, 12); shG.scale(1.65, .8, .95);
const shM = new THREE.InstancedMesh(shG, bodyMat, HN);
const selMat = sm({color: 0xa3212a, roughness: .7, emissive: 0x2f9a58, emissiveIntensity: 0});
const selG = new THREE.Group(); selG.add(new THREE.Mesh(cushG, selMat), new THREE.Mesh(backG, selMat), new THREE.Mesh(armG, shell), new THREE.Mesh(footG, shell));
const solids = new THREE.Group(); solids.add(cushM, backM, armM, footM, headM, shM, selG); solids.visible = false; hall.add(solids);
const instAll = [cushM, backM, armM, footM, headM, shM];
for (const m of instAll) m.frustumCulled = false;


/* ---------- les fils : filet posé sur les dossiers, nez de marche, volume de la salle ---------- */
const L = [];
const seg = (a, b) => L.push(a.x, a.y, a.z, b.x, b.y, b.z);
const top = s => s.pos.clone().add(new THREE.Vector3(0, 1.1, .32));
const at = Object.fromEntries(real.map(s => [s.r + ':' + s.n, s]));      // par rangée et numéro de position
for (const s of real) {
  const near = o => o && Math.abs(o.pos.x - s.pos.x) < (s.span + o.span) * D.seatW / 2 + D.seatW * .6;   // voisins directs : pas de fil par-dessus une allée
  const right = at[s.r + ':' + (s.n + s.span)], back = real.find(o => o.r === s.r + 1 && Math.abs(o.pos.x - s.pos.x) < .05), diag = back && at[back.r + ':' + (back.n + back.span)];
  if (near(right)) seg(top(s), top(right));
  if (back) seg(top(s), top(back));
  if (back && near(diag) && (s.r + s.n) % 2) seg(top(s), top(diag));
}
const box = (x0, x1, y0, y1, z0, z1) => { const c = (x, y, z) => V(x, y, z);
  for (const [a, b] of [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]]) {
    const q = i => c(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0); seg(q(a), q(b)); } };
const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(L, 3)),
  new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}));
hall.add(lines);
const bp = [];
for (const [a, b] of [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]]) for (const i of [a, b]) bp.push(i & 1 ? .5 : -.5, i & 2 ? 1 : 0, i & 4 ? .5 : -.5);
const roomBox = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)), lines.material.clone());
roomBox.position.y = -OY; hall.add(roomBox);

/* ---------- l'écran : rectangle blanc et son halo ---------- */
const screenMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide});
const screen = new THREE.Mesh(new THREE.PlaneGeometry(D.screenW, D.screenH), screenMat); screen.position.copy(SC); hall.add(screen);
const haloMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {o: {value: 0}},
  vertexShader: `varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform float o;varying vec2 v;void main(){vec2 q=abs(v-.5)*2.;float d=max(q.x*1.05,q.y*1.25);float a=pow(1.-smoothstep(.36,1.,d),2.);gl_FragColor=vec4(vec3(.82,.86,1.)*a*o,a*o);}`});
const halo = new THREE.Mesh(new THREE.PlaneGeometry(D.screenW * 2.6, D.screenH * 3.2), haloMat); halo.position.copy(SC).z -= .05; hall.add(halo);

/* ---------- le fauteuil choisi : anneau et champ de vision ---------- */
const GREEN = 0x5fd08a, eyeG = eyeOf(H1.selected);
const ringMat = new THREE.MeshBasicMaterial({color: GREEN, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending});
const pingMat = ringMat.clone();
const ring = new THREE.Mesh(new THREE.RingGeometry(.44, .5, 64), ringMat), ping = new THREE.Mesh(new THREE.RingGeometry(.47, .5, 64), pingMat);
for (const m of [ring, ping]) { m.rotation.x = -Math.PI / 2; m.position.copy(selSeat.pos).add(new THREE.Vector3(0, 1.5, .1)); hall.add(m); }
const cone = [], w2 = D.screenW / 2, h2 = D.screenH / 2;
const corners = [[-w2, -h2], [w2, -h2], [w2, h2], [-w2, h2]].map(([x, y]) => new THREE.Vector3(SC.x + x, SC.y + y, SC.z + .05));
corners.forEach(c => cone.push(eyeG.x, eyeG.y, eyeG.z, c.x, c.y, c.z));
const coneMat = new THREE.LineBasicMaterial({color: GREEN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
hall.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cone, 3)), coneMat));

/* ---------- passage d'une salle à l'autre ---------- */
const rI = Array.from({length: NMAX}, () => rnd()), cur = {places: LA.places, w: D.screenW, h: D.screenH, idx: 0};
let lastM = -1;
function applyLayout(m) {
  if (Math.abs(m - lastM) < 1e-5) return; lastM = m;
  const i0 = Math.min(LAYS.length - 2, Math.floor(m)), t = m - i0, A = LAYS[i0], B = LAYS[i0 + 1], na = A.seats.length, nb = B.seats.length;
  for (let i = 0; i < NMAX; i++) {
    const a = A.seats[i % na], b = B.seats[i % nb], te = ease(clamp(t * 1.5 - rI[i] * .5)), oa = i < na ? 1 : 0, ob = i < nb ? 1 : 0;
    const sc = mix(oa, ob, te), lift = Math.sin(te * Math.PI) * (.5 + rI[i] * 1.4);
    mtx.makeScale(mix(a.sx, b.sx, te) * sc, sc, sc).setPosition(mix(a.x, b.x, te), mix(a.y, b.y, te) + lift, mix(a.z, b.z, te));
    cushM.setMatrixAt(i, mtx); backM.setMatrixAt(i, mtx); armM.setMatrixAt(i, mtx); footM.setMatrixAt(i, mtx);
    tc.copy(a.busy && oa ? cBusy : cSeat).lerp(b.busy && ob ? cBusy : cSeat, te); cushM.setColorAt(i, tc); backM.setColorAt(i, tc);
  }
  for (let j = 0; j < HN; j++) {
    const a = A.heads[j % A.heads.length], b = B.heads[j % B.heads.length], te = ease(clamp(t * 1.5 - rI[j] * .5));
    const sc = mix(j < A.heads.length ? 1 : 0, j < B.heads.length ? 1 : 0, te) * (1 - Math.sin(te * Math.PI));
    const x = mix(a.x, b.x, te), y = mix(a.y, b.y, te), z = mix(a.z, b.z, te);
    mtx.makeScale(sc, sc, sc).setPosition(x, y + 1.22, z + .1); headM.setMatrixAt(j, mtx);
    mtx.setPosition(x, y + .98, z + .14); shM.setMatrixAt(j, mtx);
  }
  for (const im of instAll) im.instanceMatrix.needsUpdate = true;
  cushM.instanceColor.needsUpdate = backM.instanceColor.needsUpdate = true;
  const te = ease(t), L = k => mix(k(A), k(B), te);
  selG.position.set(L(l => l.sel.x), L(l => l.sel.y), L(l => l.sel.z));
  const w = L(l => l.scr.w), h = L(l => l.scr.h), y = L(l => l.scr.y), z = L(l => l.scr.z);
  screen.scale.set(w / D.screenW, h / D.screenH, 1); screen.position.set(0, y, z);
  halo.scale.copy(screen.scale); halo.position.set(0, y, z - .05); screenLight.position.set(0, y, z + 1.6);
  roomBox.scale.set(2 * L(l => l.bx.hw), L(l => l.bx.hh), L(l => l.bx.d));
  cur.places = Math.round(L(l => l.places)); cur.w = w; cur.h = h; cur.idx = Math.round(m);
}
applyLayout(0);

/* ---------- caméra ---------- */
let asp = 1, W = 1, H = 1, KEYS = [];
const PMAX = 1.27;                                           // la timeline continue après la vue assise
const povFov = () => Math.min(2 * Math.atan(Math.tan(41 * Math.PI / 180) / asp) * 180 / Math.PI, asp < 1 ? 92 : 62);
function buildKeys() {
  const k = Math.max(1, 1.45 / asp), kh = Math.max(1, .8 / asp), pf = povFov(), O = [0, 0, 0];
  const k2 = k * 1.2 * LAYS[1].bx.d / LAYS[0].bx.d;              // recul devant la seconde salle, à proportion de sa profondeur
  KEYS = [
    {p: 0,   pos: [0, .6, 20 * kh], look: O, fov: 38},
    {p: .06, pos: [0, .6, 20 * kh], look: O, fov: 38},
    {p: .3,  pos: [0, 7.2 * k, 18 * k], look: [0, -.5, 0], fov: 38},
    {p: .5,  pos: [0, 6.4 * k, 16.5 * k], look: [0, -.5, 0], fov: 38},
    {p: .62, pos: eyeOf(H1.selected).toArray(), look: SC.toArray(), fov: pf},
    {p: .69, pos: eyeOf(H1.selected).toArray(), look: SC.toArray(), fov: pf},
    {p: .75, pos: eyeOf(H1.front).toArray(), look: SC.toArray(), fov: pf},
    {p: .79, pos: eyeOf(H1.front).toArray(), look: SC.toArray(), fov: pf},
    {p: .85, pos: eyeOf(H1.back).toArray(), look: SC.toArray(), fov: pf},
    {p: .88, pos: eyeOf(H1.back).toArray(), look: SC.toArray(), fov: pf},
    {p: .96, pos: [0, 7.2 * k, 18.5 * k], look: [0, -.5, 0], fov: 38},
    {p: 1.04, pos: [0, 7.2 * k, 18.5 * k], look: [0, -.5, 0], fov: 38},
    {p: 1.14, pos: [0, 7.2 * k2, 18.5 * k2], look: [0, -.8 * k2 / k, 0], fov: 38},
    {p: PMAX, pos: [0, 6.85 * k2, 17.5 * k2], look: [0, -.8 * k2 / k, 0], fov: 38},
  ].map(q => ({...q, pos: new THREE.Vector3(...q.pos), look: new THREE.Vector3(...q.look)}));
}
const cp = new THREE.Vector3(), cl = new THREE.Vector3();
function poseCamera(p, pov) {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = ease(span(p, a.p, b.p));
  cp.lerpVectors(a.pos, b.pos, t); cl.lerpVectors(a.look, b.look, t);
  cl.x += mx * 1.4 * pov; cl.y -= my * .7 * pov;                 // assis, la souris tourne la tête
  camera.fov = mix(a.fov, b.fov, t);
  camera.position.copy(cp); camera.lookAt(cl); camera.updateProjectionMatrix();
}
function resize() {
  W = innerWidth; H = innerHeight; asp = W / H;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H, false);
  camera.aspect = asp; buildKeys();
}
addEventListener('resize', resize); resize();

/* ---------- entrées ---------- */
let target = 0, p = 0, mxT = 0, myT = 0, mx = 0, my = 0;
const track = $('track');
const readScroll = () => { target = clamp(scrollY / (track.offsetHeight - innerHeight)) * PMAX; };
addEventListener('scroll', readScroll, {passive: true}); readScroll(); p = target;
addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mxT = e.clientX / W * 2 - 1; myT = e.clientY / H * 2 - 1; }, {passive: true});
$('replay').addEventListener('click', () => scrollTo({top: 0, behavior: reduce ? 'auto' : 'smooth'}));

/* ---------- overlays ---------- */
const caps = [['c1', .1, .14, .26, .3], ['c2', .31, .34, .4, .43], ['c3', .44, .47, .55, .59], ['c4', .62, .65, .69, .72], ['c5', .73, .76, .85, .88], ['c7', .97, 1, 1.18, 1.21], ['c6', 1.215, 1.24, 2, 3]].map(([id, ...k]) => [$(id), ...k]);
const fmt = num;                                        // virgule en français, point en anglais
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), proj = new THREE.Vector3();
const el = {hero: $('hero'), sub: $('sub'), hud: $('hud'), hSeat: $('hSeat'), hDist: $('hDist'), hAng: $('hAng'), tag: $('tagSeat'), hint: $('hint'), tc: $('tc'), sName: $('sName'), sPlaces: $('sPlaces'), sScreen: $('sScreen'), sDesc: $('sDesc')};

el.tag.textContent = el.hSeat.textContent = H1.selected;

/* ---------- boucle ---------- */
let last = performance.now();
let time = 0;
function frame() {
  p += (target - p) * (reduce ? .3 : .08);
  if (Math.abs(target - p) < .00004) p = target;
  const now = performance.now();
  time += (now - last) / 1000 * (reduce ? .25 : 1); last = now;
  mx += (mxT - mx) * .05; my += (myT - my) * .05;

  const form = span(p, .06, .3), pov = band(p, .5, .6, .88, .96), sel = ease(span(p, .42, .47)) * (1 - span(p, .92, .96)), gone = span(p, .97, 1.02);
  hall.rotation.y = (-.62 * ease(form) + .2 * Math.sin(time * .22) + mx * .32) * (1 - pov);
  hall.rotation.x = my * .12 * (1 - pov);
  poseCamera(p, pov);

  const u = pm.uniforms;
  const solid = ease(span(p, .24, .33));
  solids.visible = solid > .001;
  for (const m of solidMats) m.opacity = solid;
  hemi.intensity = solid * mix(1.5, .35, pov);
  selMat.color.copy(cSeat).lerp(cSel, sel); selMat.emissiveIntensity = sel * (.6 + .1 * Math.sin(time * 2.4));
  applyLayout(ease(span(p, 1.04, 1.14)));
  if (p > .95) {
    const l = LAYS[cur.idx];
    el.sName.textContent = l.name; el.sDesc.textContent = l.desc; el.sPlaces.textContent = cur.places;
    el.sScreen.textContent = fmt(cur.w, 2) + ' × ' + fmt(cur.h, 2) + ' m';
  }
  u.uGone.value = gone; u.uSolid.value = solid; u.uForm.value = form; u.uTime.value = time; u.uSel.value = sel; u.uLit.value = pov;
  u.uPx.value = H * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
  u.uMax.value = mix(10, 13, pov) * renderer.getPixelRatio();
  roomBox.material.opacity = span(p, .22, .34) * mix(.16, .07, pov);
  lines.material.opacity = roomBox.material.opacity * (1 - gone);
  const scr = ease(span(p, .2, .32));
  screenLight.intensity = scr * mix(14, 34, pov);
  screenMat.opacity = scr * mix(.82, 1, pov); haloMat.uniforms.o.value = scr * mix(.35, .6, pov) * (.94 + .06 * Math.sin(time * 9) * Math.sin(time * 5.3));
  const ra = sel * (1 - span(p, .53, .57));
  ringMat.opacity = ra; coneMat.opacity = ra * .75;
  const k = (time * .55) % 1; ping.scale.setScalar(1 + k * 1.6); pingMat.opacity = ra * (1 - k) * .7;

  const h0 = 1 - span(p, .03, .08);
  el.hero.style.opacity = h0; el.sub.style.opacity = h0; el.hint.style.opacity = h0;
  el.hero.style.transform = `translateY(${-(1 - h0) * 30}px)`;
  for (const [c, a, b, cc, d] of caps) {
    const o = band(p, a, b, cc, d);
    c.style.opacity = o; c.style.visibility = o < .01 ? 'hidden' : 'visible';
    c.style.transform = `translateY(${(1 - o) * 14}px)`;
  }

  // relevé calculé à partir de la position réelle de la caméra
  const hudA = band(p, .6, .63, .87, .9);
  el.hud.style.opacity = hudA;
  if (hudA > 0) {
    const e = camera.position;
    v1.set(-w2, SC.y, SC.z).sub(e).setY(0); v2.set(w2, SC.y, SC.z).sub(e).setY(0);
    el.hDist.textContent = fmt(e.distanceTo(SC), 1) + ' m';
    el.hAng.textContent = Math.round(v1.angleTo(v2) * 180 / Math.PI) + '°';
    let best = null, bd = .9;
    for (const s of real) { const dd = Math.hypot(s.pos.x - e.x, s.pos.z - e.z); if (dd < bd) { bd = dd; best = s; } }
    el.hSeat.textContent = best ? best.id : '·';
  }
  // étiquette du fauteuil choisi
  hall.updateMatrixWorld();
  proj.copy(selSeat.pos).add(v1.set(.55, 1.5, .1)).applyMatrix4(hall.matrixWorld).project(camera);
  el.tag.style.opacity = proj.z < 1 ? ra : 0;
  el.tag.style.transform = `translate(${(proj.x * .5 + .5) * W + 8}px,calc(${(.5 - proj.y * .5) * H}px - 50%))`;

  const secs = p * 7200;
  el.tc.textContent = [secs / 3600, secs / 60 % 60, secs % 60, (secs % 1) * 24].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');

  if (scrollY < track.offsetHeight) renderer.render(scene, camera);   // plus bas dans la page, la scène est hors champ : rien à dessiner
  requestAnimationFrame(frame);
}
frame();
