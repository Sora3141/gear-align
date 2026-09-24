// 盤面の規則そのものを検証する。
//  1) 幾何と原動力：噛み合い・当たり判定・曲がり角、原動力から電源が届くか
//  2) 総当たり：小さい盤面で「揃えられる向き」の判定が実際の到達可能性と一致するか
//  3) shuffle / turn / undo / 持ち上げの可否
import { GearPuzzle, gcd } from '../src/puzzle.js';
import { MODES, MODULE, liftOptions } from '../src/modes.js';
import { buildLayout, validateLayout, poweredSet } from '../src/layout.js';
import { mulberry32 } from '../src/rng.js';
import { solvableDirections } from '../src/solve.js';

let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.error('  NG ' + msg); } };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const pairs = (xs) => xs.flatMap((x, i) => xs.slice(i + 1).map((y) => [x, y]));

// ---- 1) 幾何と原動力 --------------------------------------------------
console.log('— 幾何と原動力 —');
for (const mode of MODES) {
  // 上下左右のどれかに揃った状態から配るので、歯数の最大公約数は 4 の倍数でないといけない
  check(mode.teeth.reduce(gcd) % 4 === 0,
    `${mode.id}: 歯数の最大公約数 ${mode.teeth.reduce(gcd)} が 4 の倍数でない（左右に揃えられない）`);
  for (const size of mode.sizes) {
    const layout = buildLayout(mode, size);
    const problems = validateLayout(layout);
    check(problems.length === 0, `${mode.id} ${size}: ${problems.slice(0, 2).join(' / ')}`);
    check(layout.drivers.length > 0, `${mode.id} ${size}: 原動力が無い`);
    check(layout.drivers.every((k) => layout.adj[k].length === 1),
      `${mode.id} ${size}: 原動力が 2 つ以上の歯車に噛んでいる`);
    check(layout.drivers.every((k) => !layout.liftable[k]), `${mode.id}: 原動力が持ち上げられる`);

    // 原動力は 2 つ、別々の歯車に付いている
    const hosts = layout.drivers.map((k) => layout.adj[k][0]);
    check(layout.drivers.length === 2 && new Set(hosts).size === 2,
      `${mode.id} ${size}: 原動力が 2 つ別々の歯車に付いていない`);

    // 原動力以外はどれでも持ち上げられて、どれを持ち上げても盤面が全部止まることはない
    const n = layout.cells.length;
    for (let k = 0; k < n; k++) {
      check(layout.liftable[k] === !layout.cells[k].driver,
        `${mode.id} ${size}: 歯車 ${k} の持ち上げ可否がおかしい`);
      if (layout.cells[k].driver) continue;
      const powered = poweredSet(layout.adj, layout.drivers, [k]);
      let moving = 0;
      for (const j of powered) if (!layout.cells[j].driver) moving++;
      check(moving > 0, `${mode.id} ${size}: 歯車 ${k} を持ち上げると盤面が全部止まる`);
    }
  }
  const l = buildLayout(mode, mode.size);
  const kinds = [...new Set(l.teeth.filter((t, i) => !l.isDriver[i]))];
  console.log(`  ${mode.id.padEnd(4)} ${mode.layout.padEnd(5)} 歯車${l.cells.length - l.drivers.length}`
    + `+原動力${l.drivers.length} 歯数 ${kinds.join('/')}`
    + `　持ち上げ ${liftOptions(mode, l).join('/')} 個`);
}
check(near(MODULE, 7.5), 'モジュールが全モード共通でない');

// ---- 2) 総当たり ------------------------------------------------------
// 「揃った状態」から合法手で行ける範囲を全部たどり、各状態について実際に到達できる
// 向きの集合を作って、solvableDirections() の答えと突き合わせる。
function exhaustive(mode, size, lifts) {
  const layout = buildLayout(mode, size);
  const p = new GearPuzzle(layout, lifts);
  const gears = p.gears;                       // 矢印のある歯車だけを状態にする
  // 切り離しが起きる持ち上げ方も含めて、選べる組を全部使う
  const liftSets = lifts === 1
    ? [...Array(p.N).keys()].filter((k) => p.liftable[k]).map((k) => [k])
    : pairs([...Array(p.N).keys()].filter((k) => p.liftable[k]));
  const moving = liftSets.map((s) => p.poweredSet(s));

  const keyOf = (a) => gears.map((k) => mod(a[k], p.T[k])).join(',');
  const fromKey = (kk) => {
    const a = new Array(p.N).fill(0);
    kk.split(',').forEach((v, i) => { a[gears[i]] = Number(v); });
    return a;
  };

  const comp = new Map();        // 状態 -> 連結成分の番号
  const compDirs = new Map();    // 連結成分 -> そこから揃えられる向きの集合
  for (let c = 0; c < p.G; c++) {
    const start = p.a.map((_, k) => (c * p.T[k]) / p.G);
    const startKey = keyOf(start);
    const known = comp.get(startKey);
    if (known !== undefined) { compDirs.get(known).add(c); continue; }

    const id = compDirs.size;
    compDirs.set(id, new Set([c]));
    comp.set(startKey, id);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const state of frontier) {
        for (let si = 0; si < liftSets.length; si++) {
          for (const d of [1, -1]) {
            // 動くのは原動力とつながっている歯車だけ
            const a2 = state.slice();
            for (const k of moving[si]) a2[k] += d * p.step * p.sign(k);
            const kk = keyOf(a2);
            if (comp.has(kk)) continue;
            comp.set(kk, id);
            next.push(a2);
          }
        }
      }
      frontier = next;
    }
  }

  // 到達可能性は全状態をたどって確かめたうえで、予測との突き合わせは
  // そこから一定数を抜き出して行う（solvableDirections は手順を組み立てるので重い）
  const keys = [...comp.keys()];
  const stride = Math.max(1, Math.floor(keys.length / SAMPLE));
  let bad = 0, checked = 0;
  for (let i = 0; i < keys.length; i += stride) {
    p.a = fromKey(keys[i]);
    p.lifted = [];
    checked++;
    const got = solvableDirections(p).join(',');
    const want = [...compDirs.get(comp.get(keys[i]))].sort((x, y) => x - y).join(',');
    if (got !== want) { if (bad++ < 2) console.error(`  NG ${mode.id} L=${lifts}: 予測 ${got} / 実際 ${want}`); }
  }
  check(bad === 0, `${mode.id} size=${size} L=${lifts}: 食い違う状態が ${bad} 件`);
  return { total: keys.length, checked };
}

const mod = (a, m) => ((a % m) + m) % m;
const SAMPLE = 120;

console.log('— 総当たり —');
// 輪と星は本番のサイズだと状態数が多すぎるので、同じ規則の最小構成で確かめる
const TINY = [
  { id: 'ring4', layout: 'ring', teeth: [16, 12], step: 2, sizes: [4], size: 4 },
  { id: 'star1', layout: 'star', teeth: [24, 8, 12, 8], step: 2, sizes: [3], size: 3 },
  { id: 'star2', layout: 'star', armLength: 2, teeth: [24, 8, 8], step: 2, sizes: [3], size: 3 },
  { id: 'diam3', layout: 'grid', shape: 'diamond', teeth: [16, 12], step: 2, sizes: [3], size: 3 },
];
// 型抜きした格子は最小でも 13 個あって総当たりできないので、同じ規則の小さい版（diam3）で見る
for (const mode of [
  ...MODES.filter((m) => (m.layout === 'grid' && !m.shape) || m.layout === 'train'), ...TINY]) {
  const size = mode.layout === 'grid' && !mode.shape ? 2 : Math.min(...mode.sizes);
  const layout = buildLayout(mode, size);
  check(validateLayout(layout).length === 0, `${mode.id}: 最小構成が噛み合っていない`);
  for (const lifts of liftOptions(mode, layout)) {
    const gears = layout.cells.length - layout.drivers.length;
    const r = exhaustive(mode, size, lifts);
    console.log(`  ${mode.id.padEnd(5)} ${mode.layout.padEnd(5)} 歯車${gears} L=${lifts}: `
      + `到達可能な ${r.total} 状態をすべて列挙し、うち ${r.checked} 件で予測と突き合わせ`);
  }
}

// ---- 3) ふるまい ------------------------------------------------------
console.log('— ふるまい —');
for (const mode of MODES) {
  for (const size of mode.sizes) {
    const layout = buildLayout(mode, size);
    for (const lifts of liftOptions(mode, layout)) {
      for (let t = 0; t < 20; t++) {
        const p = new GearPuzzle(layout, lifts);
        p.shuffle();
        check(!p.isSolved(), `${mode.id} ${size}: shuffle 直後に揃っている`);
        check(p.moves === 0 && p.lifted.length === 0, `${mode.id}: shuffle 後に状態が残る`);
        check(solvableDirections(p).length > 0, `${mode.id} ${size} L=${lifts}: 揃えられる向きが無い`);

        // 原動力は持ち上げられない
        for (const d of layout.drivers) check(!p.canLift(d), `${mode.id}: 原動力を持ち上げられてしまう`);

        // 持ち上げた歯車は回らず、残りは歯数どおりに回る
        const before = p.snapshot();
        const pick = [...Array(p.N).keys()].filter((k) => p.canLift(k));
        p.lifted = [];
        for (const k of pick) { if (p.lifted.length < lifts && p.canLift(k)) p.select(k); }
        check(p.ready(), `${mode.id} L=${lifts}: ${lifts} 個選べない`);
        // 動くのは原動力とつながっている歯車だけ。切り離された歯車は止まったまま。
        const powered = p.poweredSet();
        p.turn(1);
        for (const k of p.lifted) check(p.a[k] === before[k], `${mode.id}: 持ち上げた歯車が回った`);
        for (let k = 0; k < p.N; k++) {
          if (p.lifted.includes(k)) continue;
          const want = powered.has(k) ? mode.step * p.sign(k) : 0;
          check(p.a[k] - before[k] === want,
            powered.has(k) ? `${mode.id}: 送り歯数か向きが違う` : `${mode.id}: 切り離された歯車が回った`);
        }
        p.undo();
        check(JSON.stringify(p.a) === JSON.stringify(before), `${mode.id} ${size}: undo で戻らない`);
        check(p.moves === 0, `${mode.id}: undo 後の手数が 0 でない`);
      }
    }
  }
}
console.log('  原動力 / 持ち上げ / 回転量 / undo を 14 並べ方 × 全サイズ × 持ち上げ数 × 20 局面で確認');

// 向きを指定するルール：指定した向きには必ず揃えられ、別の向きで揃えてもクリアにならない
for (const mode of MODES) {
  const layout = buildLayout(mode, mode.size);
  for (const lifts of liftOptions(mode, layout)) {
    for (let t = 0; t < 4; t++) {
      const p = new GearPuzzle(layout, lifts);
      p.goal = t * (p.G / 4);
      p.shuffle();
      check(!p.aligned(), `${mode.id}: 向き指定で配った直後に揃っている`);
      check(solvableDirections(p).join(',') === String(p.goal),
        `${mode.id} L=${lifts} 目標 ${t}: 指定した向きに揃えられない`);

      // 指定と違う向きで揃えてもクリアにはならない
      for (const k of p.gears) p.a[k] = ((t + 1) % 4) * (p.G / 4) * (p.T[k] / p.G);
      check(p.aligned() && !p.isSolved(), `${mode.id}: 別の向きで揃えたのにクリア扱いになった`);
      for (const k of p.gears) p.a[k] = p.goal * (p.T[k] / p.G);
      check(p.isSolved(), `${mode.id}: 指定どおりに揃えてもクリアにならない`);
    }
  }
}
console.log('  向き指定ルールを 14 並べ方 × 持ち上げ数 × 4 方向で確認');

// 斜めの向き：45° がその盤面で作れる角度（歯数の最大公約数が 8 の倍数）のときだけ指定できる
for (const mode of MODES) {
  const layout = buildLayout(mode, mode.size);
  const p0 = new GearPuzzle(layout, 1);
  const canDiag = p0.G % 8 === 0;
  check(canDiag === Number.isInteger((45 * p0.G) / 360), `${mode.id}: 斜めの可否の判定が合わない`);
  if (!canDiag) continue;
  for (const i of [1, 3, 5, 7]) {
    const p = new GearPuzzle(layout, 1);
    p.goalMode = 'dir';
    p.goal = (i * 45 * p.G) / 360;
    p.shuffle();
    check(!p.aligned(), `${mode.id}: 斜め指定で配った直後に揃っている`);
    check(solvableDirections(p).join(',') === String(p.goal), `${mode.id}: 斜め ${i * 45}° に揃えられない`);
    for (const k of p.gears) p.a[k] = p.goal * (p.T[k] / p.G);
    check(p.isSolved() && Math.abs(p.solvedDirection() - i * 45) < 1e-9,
      `${mode.id}: 斜め ${i * 45}° に揃えてもクリアにならない`);
  }
}
console.log('  斜めの向き指定を、指定できる並べ方すべて × 4 方向で確認');

// 全部ちがう向き：組み合わせが取れる盤面でだけ遊べ、1 つでも重なるとクリアにならない
let distinctOk = 0, distinctNo = 0;
for (const mode of MODES) {
  for (const size of mode.sizes) {
    const layout = buildLayout(mode, size);
    // 割り当てが取れて、かつ「配ったら目標のまま」にならないステージだけ遊べる
    let dealt = null;
    for (let t = 0; t < 8 && !dealt; t++) {
      const q = new GearPuzzle(layout, 1);
      q.goalMode = 'distinct';
      if (q.shuffle(mulberry32(t)) !== false) dealt = q;
    }
    if (!dealt) { distinctNo++; continue; }
    distinctOk++;

    check(!dealt.allDifferent() && !dealt.isSolved(),
      `${mode.id} ${size}: 配った直後に達成している`);
    // 目標そのものは「全部ちがう向き」になっている
    dealt.a = dealt.goalA.slice();
    check(dealt.allDifferent() && dealt.isSolved(),
      `${mode.id} ${size}: 目標が全部ちがう向きになっていない`);
    // 2 つを同じ向きにしたらクリアではない
    const [a, b] = dealt.gears;
    dealt.a[b] = (dealt.unit(a) * dealt.T[b]) / dealt.L;
    check(!dealt.allDifferent() && !dealt.isSolved(),
      `${mode.id} ${size}: 重なってもクリア扱いになった`);
  }
}
console.log(`  全部ちがう向きルールを ${distinctOk} ステージで確認（できないステージ ${distinctNo} は除外）`);

for (const mode of MODES) {
  const p = new GearPuzzle(buildLayout(mode, mode.size));
  for (const k of p.gears) {
    const T = p.teethOf(k);
    check(p.orientationsOf(k) === T / gcd(mode.step, T), `${mode.id}: 向きの数が合わない`);
    check(near(p.stepAngleOf(k), (mode.step * 360) / T), `${mode.id}: 1 手の角度が合わない`);
  }
}

console.log(fail === 0 ? '\n全テスト通過' : `\n${fail} 件失敗`);
process.exit(fail === 0 ? 0 : 1);
