// 盤面の並べ方。歯車ごとの位置・歯数・半径・位相・回転の向きを決める。
//
// 噛み合うための条件は 3 つ。
//  (1) 噛み合う 2 つの中心間距離が R₁ + R₂（＝ m(T₁+T₂)/2）
//  (2) ある歯車から出る噛み合い方向どうしが、その歯車のピッチ 360/T の整数倍だけ離れている
//      （＝曲がり角はピッチの整数倍にしかできない。90° の角は T が 4 の倍数なら作れる）
//  (3) 閉じた輪は偶数個（回転の向きが一周して整合するため）
//
// 回転の向きは噛み合いのグラフを 2 色に塗り分ければ決まる（格子の市松はその特別な場合）。
// 位相は「白は相手の方向に歯、黒は相手の方向に谷」を 1 本の辺に対して決めれば、
// (2) の条件からほかの辺にも自動的に合う。
//
// 原動力（driver）は合いマークの無い歯車で、盤面の歯車にぶら下がる。回して動くのは
// 「原動力とつながっている歯車」だけで、切り離された歯車はその手では止まる。
//
// 原動力は必ず 2 つ、別々の歯車に付ける。1 つだと、それが噛んでいる歯車を持ち上げた瞬間に
// 盤面全部が止まってしまい、その歯車だけ実質持ち上げられなくなるため。
// 2 つあれば、片方の相手を持ち上げても、もう片方が残り全部を回す。
//
// そのうえで、2 つの原動力が必ず同じ向きに回るように付ける相手を選ぶ。
// 噛み合うたびに向きが反転するので、相手の市松（sign）が同じなら原動力も同じ向きになる。
// こうしておくと「原動力を右回り」というボタンの言い方が曖昧にならない。
//
// 輪の辺長を 1 つおきに足し引きすると e₁-e₂+e₃-… = 0 が恒等的に成り立つので、
// 半径側に追加の条件は出ない。閉じるかどうかは位置だけの問題。
// 軸に平行な正方格子だと、この「閉じる」条件が dx = dy に化けて歯数が 2 種類に潰れる。
// 長方形の輪のように対辺の長さを釣り合わせれば、歯数は何種類でも入る。

import { MODULE, pitchRadius } from './modes.js';

export function buildLayout(mode, size) {
  const spec =
    mode.layout === 'train' ? trainSpec(mode, size)
    : mode.layout === 'ring' ? ringSpec(mode, size)
    : mode.layout === 'star' ? starSpec(mode, size)
    : gridSpec(mode, size);
  return finalize(spec, mode);
}

// ---- 並べ方ごとの位置と噛み合い ---------------------------------------

// 格子から切り抜く形。どれも格子の部分グラフなので、噛み合いの条件（間隔が一様・
// 曲がり角が 90°・奇数の輪が無い）は自動的に満たされる。
const SHAPES = {
  diamond: (r, c, n) => { const m = (n - 1) / 2; return Math.abs(r - m) + Math.abs(c - m) <= m; },
  plus: (r, c, n) => { const m = (n - 1) / 2; return Math.abs(r - m) <= 1 || Math.abs(c - m) <= 1; },
  stair: (r, c) => Math.abs(r - c) <= 1,
  // 中を抜いた四角の枠（輪と同じく 2 連結なので、どれを外しても残りはつながる）
  frame: (r, c, n) => r === 0 || c === 0 || r === n - 1 || c === n - 1,
  // 上の一列と真ん中の縦一列（木なので、途中を外すとその先が止まる）
  tee: (r, c, n) => r === 0 || c === (n - 1) / 2,
};

function gridSpec(mode, n) {
  const spacing = pitchRadius(mode.teeth[0]) + pitchRadius(mode.teeth[1]);
  const keep = mode.shape ? SHAPES[mode.shape] : () => true;
  const index = new Map();                       // 行列 -> セル番号
  const cells = [], edges = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!keep(r, c, n)) continue;
      index.set(`${r},${c}`, cells.length);
      cells.push({
        x: c * spacing, y: r * spacing,
        teeth: mode.teeth[(r + c) % 2 === 0 ? 0 : 1],
        row: r, col: c,
        label: `${r + 1}行 ${c + 1}列`,
      });
    }
  }
  for (const [key, k] of index) {
    const [r, c] = key.split(',').map(Number);
    const right = index.get(`${r},${c + 1}`);
    const down = index.get(`${r + 1},${c}`);
    if (right !== undefined) edges.push([k, right]);
    if (down !== undefined) edges.push([k, down]);
  }

  if (!mode.shape) {
    // 埋まった格子は左辺と右辺に 1 つずつ。右側は、左側と市松が揃う行を選ぶ
    // （n が偶数だと同じ行の左端と右端は市松が逆になってしまうため）。
    const r1 = (n / 2) | 0;
    const r2 = (n - 1) % 2 === 0 ? r1 : (r1 + 1 < n ? r1 + 1 : r1 - 1);
    return { cells, edges, drivers: [{ host: index.get(`${r1},0`), dir: 180 }, { host: index.get(`${r2},${n - 1}`), dir: 0 }] };
  }
  return { cells, edges, drivers: gridDrivers(cells, index) };
}

// 型抜きした格子の原動力。歯車が無い格子点のうち「隣り合う歯車がちょうど 1 つ」の
// ところに置く（2 つ以上だと宣言していない噛み合いができてしまう）。
// 2 つの原動力が同じ向きに回るよう、相手の市松が揃う組から、いちばん離れた 2 つを選ぶ。
function gridDrivers(cells, index) {
  const dirs = [[1, 0, 0], [-1, 0, 180], [0, 1, 90], [0, -1, 270]];  // dc, dr, 角度
  const spots = [];
  for (const [key, k] of index) {
    const [r, c] = key.split(',').map(Number);
    for (const [dc, dr, deg] of dirs) {
      const p = `${r + dr},${c + dc}`;
      if (index.has(p)) continue;
      // その空き格子点に接している歯車がこの 1 つだけか
      let touch = 0;
      for (const [dc2, dr2] of dirs) if (index.has(`${r + dr + dr2},${c + dc + dc2}`)) touch++;
      if (touch === 1) spots.push({ host: k, dir: deg, sign: (r + c) % 2 });
    }
  }
  let best = null;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if (spots[i].sign !== spots[j].sign || spots[i].host === spots[j].host) continue;
      const a = cells[spots[i].host], b = cells[spots[j].host];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || d > best.d) best = { d, pair: [spots[i], spots[j]] };
    }
  }
  return best ? best.pair.map(({ host, dir }) => ({ host, dir })) : [];
}

// 一列。閉じないので歯数は自由。
function trainSpec(mode, len) {
  const cells = [], edges = [];
  let x = 0;
  for (let k = 0; k < len; k++) {
    const teeth = mode.teeth[k % mode.teeth.length];
    const R = pitchRadius(teeth);
    x = k === 0 ? R : x + pitchRadius(cells[k - 1].teeth) + R;
    cells.push({ x, y: 0, teeth, label: `左から ${k + 1} 番目` });
    if (k) edges.push([k - 1, k]);
  }
  // 一列は両端に。片側だけだと、途中を持ち上げたとき反対の端が二度と回らなくなる。
  // 歯車の数が奇数なら両端の市松が揃うので、2 つの原動力は同じ向きに回る（サイズは奇数だけ用意）。
  return { cells, edges, drivers: [{ host: 0, dir: 180 }, { host: len - 1, dir: 0 }] };
}

// 長方形の輪。歯数を前半と後半で同じにする（点対称にする）と、
// 上辺と下辺・左辺と右辺の長さが必ず一致するので、輪はぴたりと閉じる。
function ringSpec(mode, m) {
  const half = [];
  for (let i = 0; i < m / 2; i++) half.push(mode.teeth[i % mode.teeth.length]);
  const teeth = half.concat(half);
  const per = m / 4;
  const dir = (i) => [[1, 0], [0, 1], [-1, 0], [0, -1]][(i / per) | 0];

  const cells = [{ x: 0, y: 0, teeth: teeth[0], label: '1 番' }];
  for (let i = 1; i < m; i++) {
    const e = pitchRadius(teeth[i - 1]) + pitchRadius(teeth[i]);
    const [dx, dy] = dir(i - 1);
    cells.push({
      x: cells[i - 1].x + dx * e, y: cells[i - 1].y + dy * e,
      teeth: teeth[i], label: `${i + 1} 番`,
    });
  }
  const edges = [];
  for (let i = 1; i < m; i++) edges.push([i - 1, i]);
  edges.push([m - 1, 0]);      // 輪を閉じる（m は 4 の倍数なので偶数）
  // 輪は 2 個持ち上げると 2 本の弧に割れるので、原動力を 3 か所に散らす。
  // 2 か所だと「組にできる持ち上げ方」が対角どうしに限られて手順が作れない盤面が出る。
  // 原動力は辺の外側にぶら下げる。どの歯車に付けるかは、隣の歯車とぶつからない
  // ものを実際に当たり判定して選ぶ（小さい歯車に大きい原動力を付けると隣に当たる）。
  const outward = [270, 0, 90, 180];
  const drivers = [];
  for (const side of [0, 2]) {
    let hosts = [];
    for (let i = 0; i < per; i++) hosts.push(side * per + i);
    // 2 つ目は 1 つ目と市松が揃う歯車に付ける（輪では添字の偶奇がそのまま市松）
    if (drivers.length) hosts = hosts.filter((i) => i % 2 === drivers[0].host % 2);
    hosts.sort((a, b) => pitchRadius(teeth[b]) - pitchRadius(teeth[a]));  // 大きい歯車から試す
    const found = pickDriver(cells, hosts, outward[side]);
    if (found) drivers.push(found);
  }
  return { cells, edges, drivers };
}

// 中心 1 つと、そこから放射状に伸びる腕。
// 腕の方向は中心のピッチの整数倍でないといけないので、腕の本数は中心の歯数を割り切ること。
// 中心 1 つと、そこから放射状に伸びる腕。枠は「腕の数 + 原動力 1 つ」ぶん均等に割る。
// 枠の向きは中心のピッチの整数倍でないといけないので、(腕の数 + 1) は中心の歯数を割り切ること。
// 腕は 1 段。2 段にすると内側を持ち上げたとき外側が原動力から切り離されてしまう。
// 中心 1 つと、そこから放射状に伸びる腕。腕の向きは中心のピッチの整数倍でないといけないので、
// 腕の本数は中心の歯数を割り切る数だけ。腕は 1 段（2 段だと内側を外したとき外側が止まる）。
// 原動力は腕の先に外向きにぶら下げる。中心に付けると、中心を持ち上げたとき両方とも
// 外れて盤面が完全に止まってしまうため。
function starSpec(mode, arms) {
  const [center, ...pattern] = mode.teeth;
  const armLen = mode.armLength || 1;
  const cells = [{ x: 0, y: 0, teeth: center, label: '中心' }];
  const edges = [];
  const angles = [], tips = [];
  for (let i = 0; i < arms; i++) {
    const deg = (i * 360) / arms;
    const a = deg * (Math.PI / 180);
    let dist = pitchRadius(center), prev = 0;
    for (let j = 0; j < armLen; j++) {
      const teeth = pattern[(i * armLen + j) % pattern.length];
      dist += j === 0 ? pitchRadius(teeth) : pitchRadius(cells[prev].teeth) + pitchRadius(teeth);
      cells.push({
        x: dist * Math.cos(a), y: dist * Math.sin(a), teeth,
        label: armLen === 1 ? `${i + 1} 本目の腕` : `${i + 1} 本目の腕の ${j + 1} 個目`,
      });
      edges.push([prev, cells.length - 1]);
      prev = cells.length - 1;
    }
    angles.push(deg);
    tips.push(prev);            // 腕の先（原動力はここにぶら下げる）
  }
  const far = Math.max(1, (arms / 2) | 0);
  return {
    cells, edges,
    drivers: [{ host: tips[0], dir: angles[0] }, { host: tips[far], dir: angles[far] }],
  };
}

// ---- 共通の仕上げ ------------------------------------------------------

function finalize(spec, mode) {
  const { cells, edges } = spec;
  // 原動力の歯車を足す。指定された向き（相手のピッチの整数倍）に、半径の和だけ離して置く。
  const drivers = [];
  for (const d of spec.drivers || []) {
    const host = cells[d.host];
    const teeth = d.teeth || DRIVER_TEETH;
    const dist = pitchRadius(host.teeth) + pitchRadius(teeth);
    const a = (d.dir * Math.PI) / 180;
    cells.push({
      x: host.x + dist * Math.cos(a), y: host.y + dist * Math.sin(a),
      teeth, driver: true, label: '原動力',
    });
    edges.push([d.host, cells.length - 1]);
    drivers.push(cells.length - 1);
  }
  for (const c of cells) {
    c.R = pitchRadius(c.teeth);
    c.outer = c.R + MODULE;
    c.root = c.R - 1.28 * MODULE;
  }

  const adj = cells.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }

  // 回転の向き：噛み合いのグラフを 2 色に塗り分ける
  const sign = new Array(cells.length).fill(0);
  sign[0] = 1;
  const queue = [0];
  while (queue.length) {
    const k = queue.shift();
    for (const j of adj[k]) if (!sign[j]) { sign[j] = -sign[k]; queue.push(j); }
  }

  // 位相：白は相手の方向に歯、黒は相手の方向に谷が来るようにする
  cells.forEach((c, k) => {
    c.sign = sign[k];
    const j = adj[k][0];
    const phi = Math.atan2(cells[j].y - c.y, cells[j].x - c.x) * (180 / Math.PI);
    const p = 360 / c.teeth;
    c.phase = mod(c.sign === 1 ? phi : phi - p / 2, p);
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x - c.outer); maxX = Math.max(maxX, c.x + c.outer);
    minY = Math.min(minY, c.y - c.outer); maxY = Math.max(maxY, c.y + c.outer);
  }

  // 持ち上げられるのは原動力以外の全部。外した結果つながらなくなった歯車は、その手では止まる。
  const liftable = cells.map((c) => !c.driver);

  return {
    kind: mode.layout, module: MODULE, cells, edges, adj, drivers, liftable,
    teeth: cells.map((c) => c.teeth),
    signs: cells.map((c) => c.sign),
    isDriver: cells.map((c) => !!c.driver),
    step: mode.step,
    bbox: { minX, minY, maxX, maxY },
  };
}

const DRIVER_TEETH = 12;

// ぶら下げ先の候補を順に試して、既にある歯車とぶつからない付け方を選ぶ
function pickDriver(cells, hosts, dir) {
  for (const teeth of [DRIVER_TEETH, 8]) {
    for (const host of hosts) {
      const h = cells[host];
      const dist = pitchRadius(h.teeth) + pitchRadius(teeth);
      const a = (dir * Math.PI) / 180;
      const x = h.x + dist * Math.cos(a), y = h.y + dist * Math.sin(a);
      const outer = pitchRadius(teeth) + MODULE;
      const clear = cells.every((c, i) => i === host
        || Math.hypot(c.x - x, c.y - y) > pitchRadius(c.teeth) + MODULE + outer);
      if (clear) return { host, dir, teeth };
    }
  }
  return null;
}

// 持ち上げた歯車を外したあと、原動力とつながっている歯車の数
export function poweredCount(adj, drivers, lifted) {
  return poweredSet(adj, drivers, lifted).size;
}

export function poweredSet(adj, drivers, lifted) {
  const out = new Set(), seen = new Set(lifted);
  for (const d of drivers) {
    if (seen.has(d)) continue;
    seen.add(d); out.add(d);
    const stack = [d];
    while (stack.length) {
      const k = stack.pop();
      for (const j of adj[k]) if (!seen.has(j)) { seen.add(j); out.add(j); stack.push(j); }
    }
  }
  return out;
}

const mod = (a, m) => ((a % m) + m) % m;

// ---- 検証（テストから使う） --------------------------------------------
// 噛み合うはずの組が本当に噛み合い、噛み合わない組がぶつかっていないかを全部見る。
export function validateLayout(layout) {
  const problems = [];
  const { cells, edges, adj } = layout;
  const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const meshed = new Set(edges.map(([a, b]) => key(a, b)));
  const dist = (i, j) => Math.hypot(cells[i].x - cells[j].x, cells[i].y - cells[j].y);

  for (const [a, b] of edges) {
    const d = dist(a, b);
    if (Math.abs(d - (cells[a].R + cells[b].R)) > 1e-7) problems.push(`噛み合い ${a}-${b} の距離が半径の和でない`);
    for (const [u, v] of [[a, b], [b, a]]) {
      const tip = d - cells[u].outer;
      if (!(tip > cells[v].root + 0.3)) problems.push(`${u} の歯先が ${v} の円板に埋まる`);
      if (!(tip < cells[v].outer)) problems.push(`${u} の歯先が ${v} の歯に届かない`);
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (meshed.has(key(i, j))) continue;
      if (dist(i, j) <= cells[i].outer + cells[j].outer) problems.push(`噛み合わない ${i}-${j} がぶつかっている`);
    }
  }
  // 位相：辺の方向どうしがピッチの整数倍だけ離れているか
  cells.forEach((c, k) => {
    const p = 360 / c.teeth;
    const dirs = adj[k].map((j) => Math.atan2(cells[j].y - c.y, cells[j].x - c.x) * (180 / Math.PI));
    for (const d of dirs.slice(1)) {
      const r = mod(d - dirs[0], p);
      if (Math.min(r, p - r) > 1e-7) problems.push(`歯車 ${k}（${c.teeth} 歯）の曲がり角 ${(d - dirs[0]).toFixed(2)}° がピッチ ${p}° の整数倍でない`);
    }
    if (adj[k].length === 0) problems.push(`歯車 ${k} がどこにも噛み合っていない`);
    if (c.sign === 0) problems.push(`歯車 ${k} が他とつながっていない`);
  });
  // 閉じた輪は偶数個でないと回転の向きが一周して食い違う
  for (const [a, b] of edges) {
    if (cells[a].sign === cells[b].sign) problems.push(`辺 ${a}-${b} の両端の回転向きが同じ（奇数の輪がある）`);
  }
  // 2 つの原動力は同じ向きに回ること（ボタンの「右回り」を曖昧にしないため）
  const d = layout.drivers;
  if (d.length !== 2) problems.push(`原動力が ${d.length} 個`);
  else if (cells[d[0]].sign !== cells[d[1]].sign) problems.push('2 つの原動力の回る向きが逆');
  return problems;
}

// 歯車を 1 つ外しても残りが 1 つながりのままか（＝ 1 つの入力で全部回せるか）
export function stays2Connected(layout) {
  const n = layout.cells.length;
  for (let skip = 0; skip < n; skip++) {
    const seen = new Set([skip]);
    const start = skip === 0 ? 1 : 0;
    const queue = [start]; seen.add(start);
    while (queue.length) {
      const k = queue.shift();
      for (const j of layout.adj[k]) if (!seen.has(j)) { seen.add(j); queue.push(j); }
    }
    if (seen.size !== n) return false;
  }
  return true;
}
