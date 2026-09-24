// 歯車の形を SVG パスとして組み立てる。
//
// 歯の大きさ（モジュール m）が同じ歯車どうしだけが噛み合う。ピッチ円半径は R = m·T/2 で、
// 中心間距離が R₁ + R₂ になるように置くと噛み合う。歯末の高さは m、歯 1 枚ぶんの角度は
// p = 360°/teeth。黒マスは位相を半ピッチ (p/2) ずらすと、白マスの歯が谷に収まる。
//
// 歯形はインボリュートの見た目に寄せて、歯元から歯先へ向かって膨らんだ曲線で細らせる。
// ピッチ円上の歯厚が谷幅より小さくなるように幅を選んであるので、噛み合う相手と重ならない。

const TIP = 0.14;    // 歯先の半幅（ピッチの何倍か）
const ROOT = 0.31;   // 歯元の半幅
const DEDENDUM = 1.28;
const FLANK = [0, 0.18, 0.38, 0.58, 0.78, 0.92, 1];   // 歯面を刻む高さ（歯元 0 〜 歯先 1）

export const rootRadius = (R, m) => R - DEDENDUM * m;

// 歯 1 枚ぶんの輪郭（左の歯元 → 歯先 → 右の歯元）
function toothPoints(i, teeth, R, m, phaseDeg) {
  const p = (Math.PI * 2) / teeth;
  const a = i * p + (phaseDeg * Math.PI) / 180;
  const ro = R + m, rr = rootRadius(R, m);
  // 歯先に近いほど急に細る（膨らんだ歯面）
  const half = (t) => (ROOT - (ROOT - TIP) * t ** 1.5) * p;
  const left = FLANK.map((t) => pt(rr + (ro - rr) * t, a - half(t)));
  const right = FLANK.slice().reverse().map((t) => pt(rr + (ro - rr) * t, a + half(t)));
  return [...left, pt(ro, a), ...right];
}

export function gearPath(teeth, R, m, phaseDeg = 0) {
  const p = (Math.PI * 2) / teeth;
  const rr = rootRadius(R, m);
  const seg = [];
  for (let i = 0; i < teeth; i++) {
    seg.push(...toothPoints(i, teeth, R, m, phaseDeg));
    // 歯底は円弧に沿わせる
    seg.push(pt(rr, i * p + (phaseDeg * Math.PI) / 180 + p / 2));
  }
  return 'M' + seg.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
}

// 1 枚おきの歯だけを別パスで返す。濃淡をつけると歯が数えやすくなる
// （歯数が分かれば 1 手で何度回るか step·360/T が読める）。
export function altTeethPath(teeth, R, m, phaseDeg = 0) {
  let d = '';
  for (let i = 0; i < teeth; i += 2) {
    const q = toothPoints(i, teeth, R, m, phaseDeg);
    d += 'M' + q.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
  }
  return d;
}

// ---- 円板の肉抜き ------------------------------------------------------
//
// 大きい歯車は、実物と同じようにリム・スポーク・ボスを残して円板を抜く。
// 抜いた穴は地板が透けて見える（evenodd で本体のパスに穴として足す）。
// スポークの 1 本は真上（向き 0）に置き、合いマークの線をその上に通す。

export const hasSpokes = (teeth) => teeth >= 16;
const spokeCount = (teeth) => (teeth >= 20 ? 6 : 5);

// 円板のうち、リムより内側の凹んだ部分（ウェブ）の半径
export const webRadius = (R, m) => rootRadius(R, m) - 0.95 * m;

export function holesPath(teeth, R, m) {
  if (!hasSpokes(teeth)) return '';
  const rw = webRadius(R, m);
  const rOut = rw - 0.55 * m;
  const rIn = Math.max(R * 0.36, rw * 0.44);
  const n = spokeCount(teeth);
  const hw = rw * 0.1;                       // スポークの半幅（長さの単位で一定）
  let d = '';
  for (let j = 0; j < n; j++) {
    const s0 = -Math.PI / 2 + (j * 2 * Math.PI) / n;
    const s1 = s0 + (2 * Math.PI) / n;
    const oa = Math.asin(hw / rOut), ia = Math.asin(hw / rIn);
    const poly = [];
    const arc = (r, a0, a1, steps) => {
      for (let k = 0; k <= steps; k++) poly.push(pt(r, a0 + ((a1 - a0) * k) / steps));
    };
    arc(rOut, s0 + oa, s1 - oa, 4);
    arc(rIn, s1 - ia, s0 + ia, 3);
    d += smoothClosed(poly, 3);
  }
  return d;
}

// ウェブ（リムの内側の一段低い面）。穴は抜いておく。
export function webPath(teeth, R, m) {
  return circlePath(webRadius(R, m)) + holesPath(teeth, R, m);
}

export function circlePath(r) {
  const q = round(r);
  return `M${-q},0A${q},${q} 0 1 0 ${q},0A${q},${q} 0 1 0 ${-q},0Z`;
}

// 折れ線の角を Chaikin 法で丸めて閉じたパスにする
function smoothClosed(points, iterations) {
  let ps = points;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < ps.length; i++) {
      const [x0, y0] = ps[i], [x1, y1] = ps[(i + 1) % ps.length];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      out.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    ps = out;
  }
  return 'M' + ps.map(([x, y]) => `${round(x)},${round(y)}`).join('L') + 'Z';
}

function pt(r, a) { return [round(r * Math.cos(a)), round(r * Math.sin(a))]; }
function round(v) { return Math.round(v * 1000) / 1000; }

// ---- 合いマーク ----------------------------------------------------------
//
// 歯車の向きは、実物の歯車を組むときに使う「合いマーク」で示す（上向き = 向き 0）。
// ボスからリムまで白い塗料の線を引き、リムの上には幅の広い塗りとポンチの打刻を置く。
// 真上が歯になるか谷になるかは歯車ごとに違う（市松の片方は谷）ので、歯そのものは塗らない。
// どの歯車でも同じ場所（リム）に同じ形の印が出るので、見比べて揃えやすい。
// 線は真上のスポークの上に乗る（スポークの 1 本は必ず真上に置いてある）。

export function indexMarkPath(teeth, R, m) {
  const rr = rootRadius(R, m), rw = webRadius(R, m);
  const hub = Math.min(R * 0.24, rw * 0.5);
  const f = (v) => round(v);
  const sw = 0.46 * m;                      // 線の半幅
  const d0 = 1.05 * m, d1 = 1.5 * m;        // リムの塗りの半幅（内側・外側）
  const top = rw - Math.min(1.1 * m, (rw - hub) * 0.35);   // 塗りはリムから少し内側まで
  const line = `M${f(-sw)},${f(-hub * 0.8)}L${f(-sw)},${f(-top)}L${f(sw)},${f(-top)}L${f(sw)},${f(-hub * 0.8)}Z`;
  const dab = `M${f(-d0)},${f(-top)}L${f(-d1)},${f(-rr + 0.15)}L${f(d1)},${f(-rr + 0.15)}L${f(d0)},${f(-top)}Z`;
  return line + dab;
}

// リムの塗りの中央に打つポンチの位置と大きさ
export function indexDot(teeth, R, m) {
  const rw = webRadius(R, m), hub = Math.min(R * 0.24, rw * 0.5);
  const top = rw - Math.min(1.1 * m, (rw - hub) * 0.35);
  return { cy: round(-(top + rootRadius(R, m)) / 2), r: round(0.34 * m) };
}

// 原動力の歯車に描くハンドル（クランク）。合いマークではないので向きは問われない。
// 軸から取っ手に向かって細くなる腕。
export function crankPath(R) {
  const arm = R * 0.55;
  const w0 = R * 0.16, w1 = R * 0.09;
  const f = (v) => round(v);
  return `M${f(-w0)},0L${f(-w1)},${f(-arm)}A${f(w1)},${f(w1)} 0 0 1 ${f(w1)},${f(-arm)}`
    + `L${f(w0)},0A${f(w0)},${f(w0)} 0 0 1 ${f(-w0)},0Z`;
}

// ハンドルの周りに描く「回す向き」の矢印。dir = 1 で時計回り（右回し）。
// どの歯車を基準に「右／左」と言っているのかを、盤面の上で直接示すために使う。
export function turnArcPath(r, dir) {
  const A = dir > 0 ? 130 : 50;
  const B = dir > 0 ? 50 : 130;
  const sweep = dir > 0 ? 1 : 0;
  const p = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [round(r * Math.cos(a)), round(r * Math.sin(a))];
  };
  const [x0, y0] = p(A), [x1, y1] = p(B);
  // 終点の接線向きに三角の矢じりを付ける
  const t = ((B + dir * 90) * Math.PI) / 180;
  const h = r * 0.22;
  const tip = [round(x1 + h * Math.cos(t)), round(y1 + h * Math.sin(t))];
  const s = t + Math.PI / 2;
  const w = h * 0.45;
  const l = [round(x1 + w * Math.cos(s)), round(y1 + w * Math.sin(s))];
  const rr = [round(x1 - w * Math.cos(s)), round(y1 - w * Math.sin(s))];
  return {
    arc: `M${x0},${y0}A${round(r)},${round(r)} 0 1 ${sweep} ${x1},${y1}`,
    head: `M${tip[0]},${tip[1]}L${l[0]},${l[1]}L${rr[0]},${rr[1]}Z`,
  };
}
