// 「その盤面で作れる手」が張る整数格子。
//
// 1 手は「持ち上げた歯車を外したあと、原動力とつながっている歯車を ±1 歩進める」なので、
// 動く歯車の集合 M を 0/1 ベクトルにすれば、到達できる x は {Σ c_M·1_M} の格子になる。
// 目標は x ≡ v0 (mod P) なので、生成元に P_j·e_j も足して「x - v0 が格子に入るか」を見る。
// 格子は盤面と持ち上げ数だけで決まるので、盤面ごとに 1 回だけ作れば済む。
//
// 切り離しが起きる持ち上げ方も手として数えるため、M が「持ち上げた以外の全部」とは
// 限らない。そのぶん到達できる向きが増えることがあり、それをここで正しく拾う。

export function buildLattice(gearCount, P, moves) {
  const G = gearCount;
  const basis = new Array(G).fill(null);   // basis[c] = { v, coef }（先頭が列 c）
  // 先に法（P_j·e_j）を入れておく。以後どの成分も P_j で割った余りに直せるので、
  // 消去の途中で数字が膨らまない（これをしないと桁があふれて答えを間違える）。
  for (let j = 0; j < G; j++) {
    const v = new Array(G).fill(0);
    v[j] = P[j];
    insert(basis, v, new Map(), G, P);
  }
  moves.forEach((m, i) => insert(basis, m.vec.slice(), new Map([[i, 1]]), G, P));
  return { basis, G, moves, P };
}

const mod = (a, m) => ((a % m) + m) % m;
// 先頭より後ろの成分だけを P_j で割った余りに直す。
// 先頭まで畳むと「P_j·e_j」の行そのものが 0 になって基底が壊れる。
function reduceTail(v, P, from) {
  for (let i = from; i < v.length; i++) v[i] = mod(v[i], P[i]);
  return v;
}

// 目標 target を格子で表せるか。表せれば各手を何回使うかを返す。
export function solveIn(lat, target) {
  const { basis, G, P } = lat;
  const v = reduceTail(target.slice(), P, 0);
  const coef = new Map();
  for (let c = 0; c < G; c++) {
    if (v[c] === 0) continue;
    const b = basis[c];
    if (!b || b.v[c] === 0 || v[c] % b.v[c] !== 0) return null;
    const q = v[c] / b.v[c];
    for (let i = c; i < G; i++) v[i] = mod(v[i] - q * b.v[i], P[i]);
    for (const [k, n] of b.coef) coef.set(k, (coef.get(k) || 0) + q * n);
  }
  return coef;
}

function insert(basis, v, coef, G, P) {
  for (let c = 0; c < G; c++) {
    if (v[c] === 0) continue;
    const b = basis[c];
    if (!b) { basis[c] = { v: reduceTail(v, P, c + 1), coef }; return; }
    const [g, x, y] = egcd(b.v[c], v[c]);
    const bv = b.v, bc = b.coef;
    const nv = new Array(G).fill(0), mv = new Array(G).fill(0);
    for (let i = c; i < G; i++) {
      nv[i] = x * bv[i] + y * v[i];               // 先頭が gcd になる行
      mv[i] = (bv[c] / g) * v[i] - (v[c] / g) * bv[i];  // 先頭が消える行
    }
    const nc = combine(bc, x, coef, y);
    const mc = combine(coef, bv[c] / g, bc, -(v[c] / g));
    // 成分を P で割った余りに直す（格子は P_j·e_j を含むので、これで中身は変わらない）
    basis[c] = { v: reduceTail(nv, P, c + 1), coef: nc };
    v = reduceTail(mv, P, c + 1); coef = mc;
  }
}

function combine(a, ka, b, kb) {
  const out = new Map();
  for (const [k, n] of a) out.set(k, (out.get(k) || 0) + ka * n);
  for (const [k, n] of b) out.set(k, (out.get(k) || 0) + kb * n);
  for (const [k, n] of out) if (n === 0) out.delete(k);
  return out;
}

function egcd(a, b) {
  let [old_r, r] = [a, b], [old_s, s] = [1, 0], [old_t, t] = [0, 1];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
    [old_t, t] = [t, old_t - q * t];
  }
  return [old_r, old_s, old_t];
}
