// お手本の手順（src/solve.js）が、全モード × 全サイズ × 持ち上げ数で本当に揃うかを確かめる。
import { GearPuzzle } from '../src/puzzle.js';
import { MODES, liftOptions } from '../src/modes.js';
import { buildLayout } from '../src/layout.js';
import { planFor, solvableDirections } from '../src/solve.js';
import { mulberry32 } from '../src/rng.js';

let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.error('  NG ' + msg); } };
// 盤面が大きいほど 1 局面あたりが重いので、回数を歯車の数で加減する
const roundsFor = (n) => Math.max(25, Math.min(120, Math.round(900 / n)));

for (const mode of MODES) {
  const line = [];
  for (const n of mode.sizes) {
    const layout = buildLayout(mode, n);
    const ROUNDS = roundsFor(layout.cells.length);
    for (const lifts of liftOptions(mode, layout)) {
      let total = 0, worst = 0, missing = 0, wrong = 0, illegal = 0;
      for (let t = 0; t < ROUNDS; t++) {
        const p = new GearPuzzle(layout, lifts);
        p.shuffle(mulberry32(t * 7919 + n * 31 + lifts * 13 + mode.id.length));
        const plan = planFor(p);
        if (!plan) { missing++; continue; }

        for (const mv of plan.moves) {
          // 手順が使う持ち上げ方は、原動力以外を決められた数だけ選んだものであること
          if (mv.lift.length !== lifts || mv.lift.some((k) => p.isDriver[k])) illegal++;
          p.lifted = mv.lift.slice();
          p.turn(mv.d, false);
        }
        if (!p.isSolved()) { wrong++; continue; }
        check(Math.abs(((p.solvedDirection() - plan.angle) % 360 + 360) % 360) < 1e-9,
          `${mode.id} ${n} L=${lifts}: 揃った向きが手順の狙いと違う`);
        total += plan.length; worst = Math.max(worst, plan.length);
      }
      check(missing === 0, `${mode.id} ${n} L=${lifts}: 手順が作れない局面が ${missing} 件`);
      check(wrong === 0, `${mode.id} ${n} L=${lifts}: 手順どおりでも揃わない局面が ${wrong} 件`);
      check(illegal === 0, `${mode.id} ${n} L=${lifts}: 持ち上げ方がおかしい手が ${illegal} 件`);
      line.push(`${n}/L${lifts} 平均${(total / ROUNDS).toFixed(0)}`);
    }
  }
  console.log(`  ${mode.id.padEnd(4)} ${line.join('  ')}`);
}

// 1 個持ち上げで、切り離しが起きない盤面（格子・一列・輪）では手順が最短なので、
// 1 手進めるたびに残り手数がきっかり 1 減る。
// （2 個持ち上げや星は、切り離す手が混じるぶん最短とは限らないので、この検査はしない）
for (const mode of MODES) {
  if (mode.layout === 'star') continue;
  for (const n of mode.sizes) {
    const layout = buildLayout(mode, n);
    for (let t = 0; t < 10; t++) {
      const p = new GearPuzzle(layout, 1);
      p.shuffle(mulberry32(t * 131 + n * 17 + mode.step));
      let prev = planFor(p);
      check(prev !== null, `${mode.id} ${n}: 手順が作れない`);
      let guard = 0;
      while (prev && prev.length > 0 && guard++ < 400) {
        const mv = prev.moves[0];
        p.lifted = mv.lift.slice(); p.turn(mv.d, false);
        const now = planFor(p);
        if (!now || now.length !== prev.length - 1) {
          check(false, `${mode.id} ${n}: 残り手数が ${prev.length} → ${now ? now.length : '無し'}`);
          break;
        }
        prev = now;
      }
      check(p.isSolved(), `${mode.id} ${n}: 1 手ずつ辿って揃わなかった`);
    }
  }
}
console.log('  切り離しの起きない 1 個持ち上げでは、1 手ごとに残り手数が 1 減ることを確認');

// 途中局面からでも手順が作り直せること（次の一手ヒントはこれに依存する）
for (const mode of MODES) {
  const layout = buildLayout(mode, mode.size);
  for (const lifts of liftOptions(mode, layout)) {
    for (let t = 0; t < 30; t++) {
      const p = new GearPuzzle(layout, lifts);
      p.shuffle(mulberry32(t + 5000 + lifts));
      const plan = planFor(p);
      check(plan !== null, `${mode.id} L=${lifts}: 初手の手順が無い`);
      const half = plan.moves.slice(0, Math.ceil(plan.moves.length / 2));
      for (const mv of half) { p.lifted = mv.lift.slice(); p.turn(mv.d, false); }
      const rest = planFor(p);
      check(rest !== null, `${mode.id} L=${lifts}: 途中局面で手順が作れない`);
      for (const mv of rest.moves) { p.lifted = mv.lift.slice(); p.turn(mv.d, false); }
      check(p.isSolved(), `${mode.id} L=${lifts}: 途中から再計算した手順で揃わない`);
      check(solvableDirections(p).length > 0, `${mode.id}: 揃った後に向きが消えた`);
    }
  }
}
console.log('  途中局面からの再計算も 14 並べ方 × 持ち上げ数 × 30 局面で確認');

// 向きを指定するルールでも、その向きへの手順が必ず作れて必ず揃うこと
for (const mode of MODES) {
  const layout = buildLayout(mode, mode.size);
  for (const lifts of liftOptions(mode, layout)) {
    for (let t = 0; t < 4; t++) {
      for (let r = 0; r < 10; r++) {
        const p = new GearPuzzle(layout, lifts);
        p.goal = t * (p.G / 4);
        p.shuffle(mulberry32(r * 97 + t * 7 + lifts));
        const plan = planFor(p);
        check(plan !== null && plan.c === p.goal,
          `${mode.id} L=${lifts} 目標 ${t}: 指定した向きの手順が作れない`);
        if (!plan) continue;
        for (const mv of plan.moves) { p.lifted = mv.lift.slice(); p.turn(mv.d, false); }
        check(p.isSolved(), `${mode.id} L=${lifts} 目標 ${t}: 手順どおりでも指定の向きに揃わない`);
      }
    }
  }
}
console.log('  向き指定ルールの手順を 14 並べ方 × 持ち上げ数 × 4 方向 × 10 局面で確認');

// 斜めの向きへの手順
let diagStages = 0;
for (const mode of MODES) {
  const layout = buildLayout(mode, mode.size);
  const probe = new GearPuzzle(layout, 1);
  if (probe.G % 8 !== 0) continue;
  diagStages++;
  for (const i of [1, 3, 5, 7]) {
    for (let r = 0; r < 6; r++) {
      const p = new GearPuzzle(layout, 1);
      p.goalMode = 'dir';
      p.goal = (i * 45 * p.G) / 360;
      p.shuffle(mulberry32(r * 31 + i));
      const plan = planFor(p);
      check(plan !== null && plan.c === p.goal, `${mode.id}: 斜め ${i * 45}° の手順が作れない`);
      if (!plan) continue;
      for (const mv of plan.moves) { p.lifted = mv.lift.slice(); p.turn(mv.d, false); }
      check(p.isSolved(), `${mode.id}: 斜め ${i * 45}° に揃わない`);
    }
  }
}
console.log(`  斜めの向きへの手順を ${diagStages} 並べ方 × 4 方向 × 6 局面で確認`);

// 全部ちがう向きへの手順
let dn = 0, dtot = 0, dworst = 0;
for (const mode of MODES) {
  for (const n of mode.sizes) {
    const layout = buildLayout(mode, n);
    for (const lifts of liftOptions(mode, layout)) {
      for (let r = 0; r < 6; r++) {
        const p = new GearPuzzle(layout, lifts);
        p.goalMode = 'distinct';
        if (p.shuffle(mulberry32(r * 77 + n + lifts)) === false) continue;
        dn++;
        const plan = planFor(p);
        check(plan !== null, `${mode.id} ${n} L=${lifts}: 全部ちがう向きの手順が作れない`);
        if (!plan) continue;
        for (const mv of plan.moves) { p.lifted = mv.lift.slice(); p.turn(mv.d, false); }
        check(p.isSolved() && p.allDifferent(), `${mode.id} ${n} L=${lifts}: 全部ちがう向きにならない`);
        dtot += plan.length; dworst = Math.max(dworst, plan.length);
      }
    }
  }
}
console.log(`  全部ちがう向きの手順を ${dn} 局面で確認（平均 ${(dtot / dn).toFixed(0)} 手・最長 ${dworst} 手）`);

console.log(fail === 0 ? '\n全テスト通過' : `\n${fail} 件失敗`);
process.exit(fail === 0 ? 0 : 1);
