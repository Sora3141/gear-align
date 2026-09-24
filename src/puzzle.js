// 歯車パズルの状態と規則。描画のことは一切知らない。
//
// 盤面には合いマークの無い「原動力」の歯車がある。回したとき実際に動くのは
// 原動力とつながっている歯車だけ（poweredSet）。原動力から切り離す持ち上げ方は
// layout.liftable / canLift で禁じてあるので、ふつうは「持ち上げた歯車以外が全部回る」。
//
// 歯車 k の回転量は「歯が何枚ぶん送られたか」a[k]（整数）で持つ。
// 実際の角度は a[k]·360/T[k] 度。噛み合う歯車どうしは送られる歯数が同じで
// 回転向きが逆になるので、1 手（歯車 m を持ち上げて系を d = ±1 方向に step 歯送る）は
//
//     a[k] += d · step · s(k)          （k ≠ m）
//
// と書ける。s(k) は市松の ±1。歯数が違えば同じ 1 手でも回る角度が変わる。

import { poweredSet } from './layout.js';

export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
export const lcm = (a, b) => (a / gcd(a, b)) * b;
export const mod = (a, m) => ((a % m) + m) % m;

// step·x ≡ 1 (mod m) を満たす x（gcd(step, m) = 1 のとき）
export function modInv(a, m) {
  a = mod(a, m);
  let [old_r, r] = [a, m], [old_s, s] = [1, 0];
  while (r !== 0) { const q = Math.floor(old_r / r); [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; }
  return old_r === 1 ? mod(old_s, m) : null;
}

export class GearPuzzle {
  // layout は buildLayout の返り値、lifts は 1 手で持ち上げる歯車の数
  constructor(layout, lifts = 1) {
    this.layout = layout;
    this.T = layout.teeth.slice();
    this.S = layout.signs.slice();
    this.step = layout.step;
    this.N = this.T.length;
    this.lifts = lifts;
    this.isDriver = layout.isDriver.slice();
    this.liftable = layout.liftable.slice();
    this.gears = [];                               // 合いマークのある（揃える対象の）歯車
    for (let k = 0; k < this.N; k++) if (!this.isDriver[k]) this.gears.push(k);
    const target = this.gears.map((k) => this.T[k]);
    this.G = target.reduce((a, b) => gcd(a, b));   // 揃えられる向きの候補数
    this.L = target.reduce((a, b) => lcm(a, b));   // 角度を整数で比べるための共通分母
    this.a = new Array(this.N).fill(0);
    this.goalMode = 'free';    // free: どの向きでも / dir: 指定の向き / distinct: 全部ちがう向き
    this.goal = null;          // dir のときの c の値
    this.goalA = null;         // distinct のときの目標（歯数単位の回転量）
    this.lifted = [];
    this.moves = 0;
    this.history = [];
    this._powered = new Map();
  }

  // 持ち上げた歯車を外したとき、原動力から電源が届く歯車。
  // 手順の検証で何度も呼ぶので、持ち上げ方ごとに覚えておく。
  poweredSet(lifted = this.lifted) {
    const key = lifted.slice().sort((a, b) => a - b).join(',');
    let got = this._powered.get(key);
    if (!got) { got = poweredSet(this.layout.adj, this.layout.drivers, lifted); this._powered.set(key, got); }
    return got;
  }

  // k を持ち上げてよいか。原動力以外はどれでも持ち上げられる
  // （その結果つながらなくなった歯車は、その手では止まる）。
  canLift(k) {
    return !this.isDriver[k];
  }

  ready() { return this.lifted.length === this.lifts; }

  get size() { return this.N; }

  sign(k) { return this.S[k]; }

  teethOf(k) { return this.T[k]; }
  angle(k) { return (this.a[k] * 360) / this.T[k]; }         // 度（範囲を丸めない＝連続的に回る）
  unit(k) { return mod(this.a[k] * (this.L / this.T[k]), this.L); }  // 向きの整数表現

  // 1 手で何度回るか（表示用）
  stepAngleOf(k) { return (this.step * 360) / this.T[k]; }
  // その歯車が取りうる向きの数
  orientationsOf(k) { return this.T[k] / gcd(this.step, this.T[k]); }

  select(k) {
    const at = this.lifted.indexOf(k);
    if (at >= 0) { this.lifted.splice(at, 1); return true; }
    if (!this.canLift(k)) return false;
    if (this.lifted.length >= this.lifts) this.lifted.shift();   // 古いほうを下ろす
    this.lifted.push(k);
    return true;
  }

  turn(d, record = true) {
    const moving = this.poweredSet();
    for (const k of moving) this.a[k] += d * this.step * this.sign(k);
    if (record) { this.history.push({ lifted: this.lifted.slice(), d }); this.moves++; }
    return moving;
  }

  undo() {
    const last = this.history.pop();
    if (!last) return false;
    this.lifted = last.lifted.slice();
    this.turn(-last.d, false);
    this.moves = Math.max(0, this.moves - 1);
    return true;
  }

  // 合いマークが全部同じ向きか
  aligned() {
    const u0 = this.unit(this.gears[0]);
    for (const k of this.gears) if (this.unit(k) !== u0) return false;
    return true;
  }

  // 目標の向きの整数表現
  unitOf(c) { return mod((c * this.L) / this.G, this.L); }

  // 合いマークが全部ちがう向きか
  allDifferent() {
    const seen = new Set();
    for (const k of this.gears) {
      const u = this.unit(k);
      if (seen.has(u)) return false;
      seen.add(u);
    }
    return true;
  }

  // クリアしたか。ルールによって条件が変わる。
  isSolved() {
    if (this.goalMode === 'distinct') return this.allDifferent();
    if (!this.aligned()) return false;
    return this.goal === null || this.unit(this.gears[0]) === this.unitOf(this.goal);
  }

  // 「全部ちがう向き」にできる割り当てを探す（できなければ null）。
  // 歯車 k が向けられるのは L/T[k] の倍数だけなので、歯車と向きの二部マッチングになる。
  distinctGoal(rand = Math.random) {
    const gears = this.gears.slice();
    // 選べる向きが少ない歯車（歯数が少ない）から埋めると、素直にまとまりやすい
    gears.sort((a, b) => this.T[a] - this.T[b]);
    const taken = new Map();                     // 向き -> 歯車
    const choices = (k) => {
      const stepU = this.L / this.T[k];
      const out = [];
      for (let u = 0; u < this.L; u += stepU) out.push(u);
      for (let i = out.length - 1; i > 0; i--) {  // 盤面ごとに違う割り当てになるよう混ぜる
        const j = (rand() * (i + 1)) | 0;
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };
    const tryAssign = (k, seen) => {
      for (const u of choices(k)) {
        if (seen.has(u)) continue;
        seen.add(u);
        const other = taken.get(u);
        if (other === undefined || tryAssign(other, seen)) { taken.set(u, k); return true; }
      }
      return false;
    };
    for (const k of gears) if (!tryAssign(k, new Set())) return null;

    const a = new Array(this.N).fill(0);
    for (const [u, k] of taken) a[k] = (u * this.T[k]) / this.L;
    return a;
  }

  // 揃っている向き（揃っていなければ null）
  solvedDirection() {
    if (!this.aligned()) return null;
    return (this.unit(this.gears[0]) * 360) / this.L;
  }

  // ---- 可解性 ----------------------------------------------------------
  //
  // zₖ = s(k)·aₖ と置くと 1 手は「持ち上げた 1 個を除く全部に +d·step」。
  // 歯車 k を d=+1 方向に持ち上げて回した正味回数を nₖ、S = Σnₖ とすると
  // zₖ の総変化量は step·(S - nₖ)。vₖ = S - nₖ と置けば Σvₖ = (N-1)S なので、
  // 到達できる v は「Σvₖ が N-1 で割り切れるもの全部」。
  //
  // 向き c（角度 c·360/G、aₖ ≡ c·Tₖ/G (mod Tₖ)）に揃えるには
  //     step·vₖ ≡ eₖ  (mod Tₖ),  eₖ = z*ₖ - zₖ
  // が要る。gₖ = gcd(step, Tₖ) が eₖ を割らなければその向きには行けない。
  // 割れるときの解は vₖ ≡ vₖ⁰ (mod Pₖ), Pₖ = Tₖ/gₖ。あとは Σvₖ ≡ 0 (mod N-1)
  // にできるかどうかで、Pₖ を足し引きして届く範囲は h = gcd(N-1, P₁…P_N) の倍数。
  // よって  Σvₖ⁰ ≡ 0 (mod h)  が到達条件。
  // 向き c に揃えるために各歯車が必要とする「回された回数」の剰余条件。
  // 原動力は合いマークが無いので条件なし（free）。
  particular(c) {
    return this.particularTarget(this.T.map((T) => (c * T) / this.G));
  }

  // 目標の状態（歯数単位の回転量）に持っていくための剰余条件
  particularTarget(targetA) {
    const out = { v0: [], P: [], free: [], ok: true };
    for (let k = 0; k < this.N; k++) {
      const T = this.T[k], s = this.sign(k);
      const g = gcd(this.step, T), P = T / g;
      out.P.push(P);
      if (this.isDriver[k]) { out.v0.push(0); out.free.push(true); continue; }
      out.free.push(false);
      const e = mod(s * targetA[k] - s * this.a[k], T);
      if (e % g !== 0) { out.ok = false; return out; }
      const inv = modInv(this.step / g, P);
      out.v0.push(inv === null ? 0 : mod((e / g) * inv, P));
    }
    return out;
  }

  // 歯数の都合で「そもそも角度が合わない」向きを除いた候補。
  // 向きを指定するルールのときは、その向きだけが候補になる。
  candidateDirections() {
    if (this.goal !== null) return this.particular(this.goal).ok ? [this.goal] : [];
    const out = [];
    for (let c = 0; c < this.G; c++) if (this.particular(c).ok) out.push(c);
    return out;
  }

  // 向き c を度で
  dirAngle(c) { return (c * 360) / this.G; }

  // 合法手だけでかき混ぜる（＝必ず解ける盤面しか作らない）。
  // 出発点の「揃った向き」を上下左右からランダムに選ぶので、揃う向きは毎回変わる。
  // 向きを指定するルールのときは、その向きから配り始める（＝必ずその向きに揃えられる）。
  shuffle(rand = Math.random) {
    const pool = [];
    for (let k = 0; k < this.N; k++) if (this.liftable[k]) pool.push(k);
    let guard = 0;
    do {
      if (this.goalMode === 'distinct') {
        // 目標そのものから配り始めるので、必ずその状態に戻せる
        const g0 = this.goalA || this.distinctGoal(rand);
        if (!g0) return false;
        this.goalA = g0;
        this.a = g0.slice();
      } else {
        const c0 = this.goal !== null ? this.goal : ((rand() * 4) | 0) * (this.G / 4);
        for (let k = 0; k < this.N; k++) this.a[k] = (c0 * this.T[k]) / this.G;
      }
      for (let i = 0; i < 10 * this.N; i++) {
        this.lifted = [];
        // 配る盤面は「どこも切り離さない手」だけで作る（遊ぶときは切り離してもよい）
        let tries = 0;
        while (this.lifted.length < this.lifts && tries++ < 50) {
          const k = pool[(rand() * pool.length) | 0];
          if (this.lifted.includes(k)) continue;
          const next = this.lifted.concat(k);
          if (this.poweredSet(next).size === this.N - next.length) this.lifted = next;
        }
        if (this.lifted.length === this.lifts) this.turn(rand() < 0.5 ? 1 : -1, false);
      }
    } while ((this.goalMode === 'distinct' ? this.allDifferent() : this.aligned()) && ++guard < 50);
    this.lifted = [];
    this.moves = 0;
    this.history.length = 0;
    // 小さい盤面だと「かき混ぜても目標のまま」ということがある。そのときは遊べないので false。
    return !this.isSolved();
  }

  snapshot() { return this.a.slice(); }
  restore(a) { this.a = a.slice(); }
}
