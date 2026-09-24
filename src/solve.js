// お手本の手順を組み立てる。盤面の探索はしない（整数の最小化に落とす）。
//
// 1 手で持ち上げる数を L とする。歯車 k を d=+1 方向に持ち上げて回した正味回数を nₖ、
// 手の総数（符号つき）を C とすると、動くのは持ち上げた歯車以外の全部なので
//
//     zₖ の総変化量 = step·(C - nₖ)、  Σnₖ = L·C
//
// 目標に対して必要な条件は puzzle.particular(c) が返す vₖ ≡ v0ₖ (mod Pₖ)。
// x ₖ= C - nₖ と置けば nₖ ≡ C - v0ₖ (mod Pₖ)。原動力は合いマークが無いので条件なし（nₖ = 0）、
// 持ち上げられない歯車も nₖ = 0 なので C ≡ v0ₖ (mod Pₖ) が要る。
//
// C を直接走査する代わりに rho = C mod Λ（Λ = Pₖ の最小公倍数）で場合分けすると
// 各 nₖ の候補が 0 に近いところに定まるので、Σnₖ mod (L·Λ) を状態にした最短経路で
// Σ|nₖ| が最小の組み合わせを選ぶ。L = 2 のときは最後に手を 2 個ずつ組にする。

import { mod, gcd, lcm } from './puzzle.js';
import { buildLattice, solveIn } from './lattice.js';

// その盤面で作れる手を全部並べる（持ち上げ方 → 実際に動く歯車の集合）。
// 盤面と持ち上げ数だけで決まるので一度だけ作って覚えておく。
// 手の一覧と格子は「並べ方 × 持ち上げ数」だけで決まるので、盤面（layout）側に覚えておく
function cacheOf(puzzle) {
  const box = puzzle.layout._solveCache || (puzzle.layout._solveCache = {});
  return box[puzzle.lifts] || (box[puzzle.lifts] = {});
}

function movesOf(puzzle) {
  const box = cacheOf(puzzle);
  if (box.moves) return box.moves;
  const all = [];
  for (let k = 0; k < puzzle.N; k++) if (puzzle.liftable[k]) all.push(k);
  const sets = puzzle.lifts === 1 ? all.map((k) => [k])
    : all.flatMap((a, i) => all.slice(i + 1).map((b) => [a, b]));
  const seen = new Map();
  for (const lift of sets) {
    const powered = puzzle.poweredSet(lift);
    const vec = puzzle.gears.map((k) => (powered.has(k) ? 1 : 0));
    const key = vec.join('');
    if (vec.every((x) => x === 0)) continue;             // 何も動かない手は使わない
    const cut = powered.size !== puzzle.N - lift.length; // 原動力から切り離される歯車が出るか
    if (!seen.has(key)) seen.set(key, { lift, vec, cut });
    else if (seen.get(key).cut && !cut) seen.set(key, { lift, vec, cut });
  }
  box.moves = [...seen.values()];
  return box.moves;
}

function latticeOf(puzzle) {
  const box = cacheOf(puzzle);
  if (box.lattice) return box.lattice;
  const P = puzzle.gears.map((k) => puzzle.T[k] / gcd(puzzle.step, puzzle.T[k]));
  box.lattice = buildLattice(puzzle.gears.length, P, movesOf(puzzle));
  return box.lattice;
}

const SHIFTS = [-2, -1, 0, 1];
const PREFIX_TRIES = 6;   // 頭に置いてみる「切り離す手」の数

// きれい族（どこも切り離さない手）で持ち上げられる歯車か。
// 1 個持ち上げのとき、外すと誰かが原動力から切れてしまう歯車はここで除く。
function cleanUsable(puzzle, k) {
  if (!puzzle.liftable[k]) return false;
  if (puzzle.lifts !== 1) return true;              // 2 個のときは組を作るときに見る
  return puzzle.poweredSet([k]).size === puzzle.N - 1;
}

// 揃えられる向きは、格子に入るかどうかで決まる（手順が作れるかとは別に、厳密に判定できる）
export function solvableDirections(puzzle) {
  if (puzzle.goalMode === 'distinct') return [];
  const lat = latticeOf(puzzle);
  const out = [];
  for (const c of puzzle.candidateDirections()) {
    const { v0 } = puzzle.particular(c);
    if (solveIn(lat, puzzle.gears.map((k) => v0[k]))) out.push(c);
  }
  return out;
}

// 格子から直に手順を作る（切り離しを使う手も含む。短さは保証しない）
export function rawPlan(puzzle, part) {
  if (!part.ok) return null;
  const coef = solveIn(latticeOf(puzzle), puzzle.gears.map((k) => part.v0[k]));
  if (!coef) return null;
  const moves = [];
  for (const [i, n] of coef) {
    const mv = latticeOf(puzzle).moves[i];
    for (let t = 0; t < Math.abs(n); t++) moves.push({ lift: mv.lift, d: Math.sign(n) });
  }
  return moves;
}

// いまのルールでの目標。distinct は「全部ちがう向き」の割り当て、そうでなければ向きごと。
function targets(puzzle) {
  if (puzzle.goalMode === 'distinct') {
    return [{ part: puzzle.particularTarget(puzzle.goalA), c: null }];
  }
  return puzzle.candidateDirections().map((c) => ({ part: puzzle.particular(c), c }));
}

function directPlan(puzzle) {
  let best = null;
  for (const { part, c } of targets(puzzle)) {
    const found = planForTarget(puzzle, part, c);
    if (found && (!best || found.length < best.length)) best = found;
  }
  return best;
}

// お手本。まず「どこも切り離さない手」だけで解く（短くて最短に近い）。
// それで届かないときは、切り離す手を 1 手だけ頭に置いてからもう一度解く。
// それでも駄目なら格子から直に作る（長くなるが必ず解ける）。
export function planFor(puzzle) {
  let best = directPlan(puzzle);
  const keep = (plan) => { if (plan && (!best || plan.length < best.length)) best = plan; };
  if (best) return best;

  const saved = puzzle.snapshot(), savedLift = puzzle.lifted.slice();
  const cutting = movesOf(puzzle).filter((m) => m.cut).slice(0, PREFIX_TRIES);
  outer:
  for (const mv of cutting) {
    for (const d of [1, -1]) {
      puzzle.restore(saved);
      puzzle.lifted = mv.lift.slice();
      puzzle.turn(d, false);
      const rest = directPlan(puzzle);
      if (rest) {
        keep({ ...rest, moves: [{ lift: mv.lift, d }].concat(rest.moves), length: rest.length + 1 });
        break outer;
      }
    }
  }
  puzzle.restore(saved);
  puzzle.lifted = savedLift;
  if (best) return best;

  // 最後の手段：格子から直に組み立てる
  for (const { part, c } of targets(puzzle)) {
    const moves = rawPlan(puzzle, part);
    if (moves) keep({ c, angle: c === null ? null : puzzle.dirAngle(c), moves, length: moves.length });
  }
  return best;
}

function planForTarget(puzzle, part, c) {
  const { v0, P, free, ok } = part;
  if (!ok) return null;
  const N = puzzle.N, L = puzzle.lifts;
  let lam = 1;
  for (let k = 0; k < N; k++) if (!free[k]) lam = lcm(lam, P[k]);
  const span = L * lam;

  const best = [];
  for (let rho = 0; rho < lam; rho++) {
    const fixed = [];                 // 動かせない歯車（原動力・持ち上げ不可）
    let feasible = true;
    for (let k = 0; k < N && feasible; k++) {
      if (cleanUsable(puzzle, k)) continue;
      fixed.push(k);
      if (!free[k] && mod(rho - v0[k], P[k]) !== 0) feasible = false;
    }
    if (!feasible) continue;

    // 各歯車の候補：持ち上げられない歯車は 0 だけ、そうでなければ 0 に近い数本
    const cands = [];
    for (let k = 0; k < N; k++) {
      if (!cleanUsable(puzzle, k)) { cands.push([0]); continue; }
      const base = mod(rho - v0[k], P[k]);
      cands.push(SHIFTS.map((s2) => base + s2 * P[k]));
    }

    // dp[r] = ここまでの Σnₖ ≡ r (mod span) にできる最小の Σ|nₖ|
    let dp = new Array(span).fill(Infinity);
    dp[0] = 0;
    const took = [];
    for (let k = 0; k < N; k++) {
      const nd = new Array(span).fill(Infinity);
      const pick = new Int8Array(span).fill(-1);
      for (let r = 0; r < span; r++) {
        if (dp[r] === Infinity) continue;
        for (let ci = 0; ci < cands[k].length; ci++) {
          const n = cands[k][ci];
          const cost = dp[r] + Math.abs(n);
          const r2 = mod(r + n, span);
          if (cost < nd[r2]) { nd[r2] = cost; pick[r2] = ci; }
        }
      }
      took.push(pick);
      dp = nd;
    }
    const goal = mod(L * rho, span);
    if (dp[goal] === Infinity) continue;

    const n = new Array(N).fill(0);
    let r = goal;
    for (let k = N - 1; k >= 0; k--) {
      const v = cands[k][took[k][r]];
      n[k] = v;
      r = mod(r - v, span);
    }
    best.push({ total: dp[goal], n });
  }
  if (!best.length) return null;
  best.sort((a, b) => a.total - b.total);

  // 手数の少ない候補から順に、実際に組める手順になるまで試す
  // （2 個持ち上げは「組める相手」が限られるので、最小の nₖ が必ず組めるとは限らない）
  let moves = null;
  for (const cand of best) {
    moves = L === 1 ? singleMoves(cand.n) : pairedMoves(cand.n, puzzle);
    if (moves) break;
  }
  if (!moves) return null;

  // 念のため手順どおりに動かして確かめる
  const keepA = puzzle.snapshot(), keepLift = puzzle.lifted.slice();
  for (const mv of moves) { puzzle.lifted = mv.lift.slice(); puzzle.turn(mv.d, false); }
  const reached = puzzle.isSolved()
    && (c === null || puzzle.unit(puzzle.gears[0]) === mod((c * puzzle.L) / puzzle.G, puzzle.L));
  puzzle.restore(keepA);
  puzzle.lifted = keepLift;
  if (!reached) return null;

  return { c, angle: c === null ? null : puzzle.dirAngle(c), moves, length: moves.length };
}

// 1 個持ち上げ：回す回数が多い歯車から順に
function singleMoves(n) {
  const order = n.map((v, k) => k).filter((k) => n[k] !== 0)
    .sort((a, b) => Math.abs(n[b]) - Math.abs(n[a]));
  const moves = [];
  for (const k of order) {
    const d = Math.sign(n[k]);
    for (let i = 0; i < Math.abs(n[k]); i++) moves.push({ lift: [k], d });
  }
  return moves;
}

// 2 個持ち上げ：1 手で 2 個ぶん消えるので、同じ向きの歯車どうしを組にする。
// 組にできるのは「その 2 つを外しても電源が全員に届く」ペアだけ。
// 端数や偏りで組めないときは、同じ歯車に +1 と -1 を足して（差し引き 0）組めるようにする。
function pairedMoves(n, puzzle) {
  const pool = [];
  for (let k = 0; k < n.length; k++) if (puzzle.liftable[k]) pool.push(k);
  if (pool.length < 2) return null;
  const okPair = (a, b) => puzzle.poweredSet([a, b]).size === puzzle.N - 2;

  // 差し引き 0 のまま、ある歯車に +t と -t を足して組めるようにする（結果は変わらない）。
  // どこに足すかで組めるかどうかが変わるので、2 通りの足し方を順に試す。
  const p0 = n.map((v) => Math.max(v, 0));
  const q0 = n.map((v) => Math.max(-v, 0));
  const attempt = (p, q) => {
    const plus = realize(p, pool, okPair);
    if (!plus) return null;
    const minus = realize(q, pool, okPair);
    if (!minus) return null;
    return plus.map(([a, b]) => ({ lift: [a, b], d: 1 }))
      .concat(minus.map(([a, b]) => ({ lift: [a, b], d: -1 })));
  };

  // (1) 1 つの歯車にまとめて足す（輪のように相手側の弧に寄せたいとき）
  for (let t = 0; t <= 4; t++) {
    for (const k of t === 0 ? [null] : pool) {
      const p = p0.slice(), q = q0.slice();
      if (k !== null) { p[k] += t; q[k] += t; }
      const got = attempt(p, q);
      if (got) return got;
    }
  }
  // (2) 順ぐりに 1 ずつ足していく（端数や偏りをならしたいとき）
  const p = p0.slice(), q = q0.slice();
  for (let r = 0; r < 3 * pool.length + 6; r++) {
    const k = pool[r % pool.length];
    p[k] += 1; q[k] += 1;
    const got = attempt(p, q);
    if (got) return got;
  }
  return null;
}

// counts を「許されたペア」だけで組にしていく（多い歯車から順に相手を探す）
function realize(counts, pool, okPair) {
  const c = counts.slice(), out = [];
  for (;;) {
    const act = pool.filter((k) => c[k] > 0).sort((a, b) => c[b] - c[a]);
    if (act.length === 0) return out;
    let paired = false;
    for (let i = 0; i < act.length && !paired; i++) {
      for (let j = i + 1; j < act.length && !paired; j++) {
        if (!okPair(act[i], act[j])) continue;
        c[act[i]] -= 1; c[act[j]] -= 1;
        out.push([act[i], act[j]]);
        paired = true;
      }
    }
    if (!paired) return null;
  }
}

export { gcd, lcm };
