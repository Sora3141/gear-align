// 盤面のプリセット。
//
// 歯車は「歯の大きさ（モジュール m）」が同じどうしでないと噛み合わない。
// モジュール m の歯車のピッチ円半径は R = m·T/2 なので、歯数を変えると半径も変わり、
// 噛み合う 2 つの中心間距離は R₁ + R₂ = m(T₁+T₂)/2 になる。
// m は全モード共通（MODULE）にしてあるので、どのモードでも歯 1 枚の大きさは同じ。
// 歯数を数えれば、その歯車が 1 手で何度回るか（step·360/T）が分かる。
//
// 格子（grid）… 上下左右が全部噛み合う正方格子。
//   このとき歯数は 2 種類しか置けない。どの単位正方形も 4 つの歯車の輪になるので
//   R(i,j)+R(i,j+1) = R(i+1,j)+R(i+1,j+1) = 横の間隔、縦も同様、という条件が全部に効き、
//   解くと R(i,j) = (間隔 ± δ)/2 の市松にしかならない（README に導出）。
// 一列（train）… 輪にならない一本のチェーン。閉じないので歯数を全部バラバラにできる。
//   歯車ごとに回る角度が違う盤面はこれで作れる。

// 盤面は「上下左右のどれか」に揃った状態から配るので、全部の歯数の最大公約数は 4 の倍数にすること
// （揃えられる向きは 360/G 度刻み。G = 2 だと左右に揃えられず、配った盤面が解けなくなる）。
// 10 歯や 18 歯のような 4 の倍数でない歯数は、そのため入れていない。

export const MODULE = 7.5;
export const pitchRadius = (teeth) => (MODULE * teeth) / 2;

export const MODES = [
  {
    id: 'm90', name: '格子・そろい歯 90°', rank: 'やさしい', layout: 'grid',
    teeth: [16, 16], step: 4, sizes: [2, 3, 4, 5, 6], size: 3,
    blurb: '全部 16 歯。1 手でどれも 90° 回る。',
  },
  {
    id: 'm45', name: '格子・そろい歯 45°', rank: 'ふつう', layout: 'grid',
    teeth: [16, 16], step: 2, sizes: [2, 3, 4, 5, 6], size: 3,
    blurb: '全部 16 歯で 1 手 2 歯送り。45° ずつなので向きが 8 通りになる。',
  },
  {
    id: 'm43', name: '格子・大小 16/12', rank: 'ふつう', layout: 'grid',
    teeth: [16, 12], step: 2, sizes: [2, 3, 4, 5, 6], size: 3,
    blurb: '16 歯と 12 歯の市松。同じ 1 手で 16 歯は 45°、12 歯は 60° 回る。',
  },
  {
    id: 'm53', name: '格子・大小 20/12', rank: 'むずかしい', layout: 'grid',
    teeth: [20, 12], step: 5, sizes: [2, 3, 4, 5, 6], size: 3,
    blurb: '20 歯と 12 歯の市松。1 手 5 歯送りで 90° と 150°。12 歯は向きが 12 通り。',
  },
  {
    id: 'm22', name: '格子・そろい歯 22.5°', rank: '鬼', layout: 'grid',
    teeth: [16, 16], step: 1, sizes: [2, 3, 4, 5, 6], size: 3,
    blurb: '1 手 1 歯送り。22.5° ずつで向きは 16 通り。腰を据えて。',
  },
  {
    id: 'gd', name: 'ひし形・大小 16/12', rank: 'ふつう', layout: 'grid', shape: 'diamond',
    teeth: [16, 12], step: 2, sizes: [5, 7, 9], size: 7,
    blurb: '格子をひし形に切り抜いた盤面。角が減るぶん、端の歯車の効き方が格子とは変わる。',
  },
  {
    id: 'gp', name: '十字・そろい歯 90°', rank: 'ふつう', layout: 'grid', shape: 'plus',
    teeth: [16, 16], step: 4, sizes: [5, 7, 9], size: 5,
    blurb: '格子を十字に切り抜いた盤面。全部 16 歯で 1 手 90°。',
  },
  {
    id: 'gs', name: '斜め帯・大小 20/12', rank: 'むずかしい', layout: 'grid', shape: 'stair',
    teeth: [20, 12], step: 5, sizes: [4, 5, 6, 7], size: 6,
    blurb: '格子の対角線まわりだけを残した細い帯。大は 90°、小は 150° 回る。',
  },
  {
    id: 'm64', name: '格子・大小 24/16', rank: 'ふつう', layout: 'grid',
    teeth: [24, 16], step: 2, sizes: [2, 3, 4, 5], size: 3,
    blurb: '24 歯と 16 歯の市松。1 手で 24 歯は 30°、16 歯は 45° 回る。歯数の最大公約数が 8 なので斜めにも揃えられる。',
  },
  {
    id: 'm86', name: '格子・特大 32/24', rank: 'むずかしい', layout: 'grid',
    teeth: [32, 24], step: 4, sizes: [2, 3, 4], size: 3,
    blurb: '32 歯と 24 歯の大きな歯車の市松。1 手 4 歯送りで 32 歯は 45°、24 歯は 60°。',
  },
  {
    id: 'gf', name: '額縁・大小 16/12', rank: 'ふつう', layout: 'grid', shape: 'frame', words: 'grid',
    teeth: [16, 12], step: 2, sizes: [4, 5, 6, 7], size: 5,
    blurb: '格子の中を抜いた四角い枠。輪と同じで、どの歯車を外しても残りは 1 つにつながったまま回る。',
  },
  {
    id: 'gt', name: 'T 字・大小 20/12', rank: 'むずかしい', layout: 'grid', shape: 'tee',
    teeth: [20, 12], step: 5, sizes: [5, 7, 9], size: 7,
    blurb: '横一列と縦一列の T 字。枝分かれの近くを外すと、その先が原動力から切り離されて止まる。',
  },
  {
    id: 't2', name: '一列・2 種', rank: 'やさしい', layout: 'train',
    teeth: [16, 8], step: 2, sizes: [5, 7, 9, 11], size: 7,
    blurb: '一列の歯車列。16 歯は 45°、8 歯は 90° 回る。',
  },
  {
    id: 't4', name: '一列・4 種', rank: 'むずかしい', layout: 'train',
    teeth: [24, 8, 16, 12], step: 2, sizes: [5, 7, 9, 11], size: 7,
    blurb: '24・8・16・12 歯。同じ 1 手で 30° / 90° / 45° / 60° と、歯車ごとに回る量が違う。',
  },
  {
    id: 't5', name: '一列・5 種', rank: '鬼', layout: 'train',
    teeth: [24, 16, 8, 20, 12], step: 2, sizes: [5, 7, 9, 11], size: 7,
    blurb: '5 種類すべて別の角度で回る（30° / 45° / 90° / 36° / 60°）。',
  },
  {
    id: 't6', name: '一列・大歯車 5 種', rank: '鬼', layout: 'train',
    teeth: [36, 20, 32, 8, 24], step: 2, sizes: [5, 7, 9], size: 5,
    blurb: '36・20・32・8・24 歯。同じ 1 手で 20° / 36° / 22.5° / 90° / 30° と、どれも違う角度で回る。',
  },
  {
    id: 'r4', name: '輪・4〜5 種', rank: 'ふつう', layout: 'ring',
    teeth: [24, 20, 16, 8, 8, 12, 24, 12], step: 2, sizes: [8, 12, 16, 20], size: 12,
    blurb: '長方形の輪。前半と後半を同じ歯数にすると対辺の長さが釣り合って、輪がぴたりと閉じる。'
      + '角が 90° なので歯数は 4 の倍数から選ぶ。',
  },
  {
    id: 'r6', name: '輪・大歯車 6 種', rank: '鬼', layout: 'ring',
    teeth: [36, 12, 32, 24, 16, 8], step: 2, sizes: [8, 12, 16], size: 12,
    blurb: '36 歯と 32 歯の大歯車を含む輪。20° / 60° / 22.5° / 30° / 45° / 90° が混ざる。',
  },
  {
    id: 'sf', name: '星・花形', rank: 'むずかしい', layout: 'star',
    teeth: [36, 8, 12], step: 2, sizes: [4, 6, 9], size: 6,
    blurb: '36 歯の中心に 8 歯と 12 歯の花びら。花びらの数は 36 を割り切る 4・6・9 枚。中心は 1 手 20° しか回らない。',
  },
  {
    id: 's2', name: '星・2 段の腕', rank: '鬼', layout: 'star', armLength: 2,
    teeth: [24, 8, 20, 8, 16, 8, 12, 8, 24], step: 2, sizes: [3, 4, 6], size: 4,
    blurb: '腕が 2 段の星。内側を持ち上げると外側が原動力から切り離されて止まる。',
  },
  {
    id: 's4', name: '星・中心と腕', rank: 'むずかしい', layout: 'star',
    teeth: [24, 12, 20, 16, 8, 12, 16], step: 2,
    sizes: [3, 4, 6], size: 6,
    blurb: '中心 1 つと放射状の腕。腕の向きは中心のピッチの整数倍でないといけないので、'
      + '腕の本数は中心の歯数（24）を割り切る数だけ。原動力は腕の先に 2 つ。',
  },
];

export const getMode = (id) => MODES.find((m) => m.id === id) || MODES[0];

// 1 手で持ち上げられる数。
// 一列は 2 個持ち上げを出さない。両端が原動力なので、隣り合う 2 つ以外を持ち上げると
// 必ず真ん中の区間が丸ごと止まり、連動する歯車列としてほとんど成立しなくなるため。
// 腕が 2 段の星も同じで、内側を持ち上げると外側が必ず止まるので 2 個持ち上げは出さない。
export function liftOptions(mode, layout) {
  if (mode.layout === 'train') return [1];
  if (mode.layout === 'star' && (mode.armLength || 1) > 1) return [1];
  const n = layout ? layout.liftable.filter(Boolean).length : 99;
  return n >= 4 ? [1, 2] : [1];
}

// 歯数ごとの材質。数を数えなくても「同じ歯数＝同じ回り方」が見て分かるように、
// 実際の歯車に使われる金属の色で塗り分ける（銅・真鍮・鋼・陽極酸化アルミ・焼き青）。
// light / mid / dark は同じ材質の明・中・暗。face* は凹んだ円板面、tooth は 1 枚おきの濃い歯。
const METALS = {
  8:  { name: '銅',     hue: 20,  light: '#f7c3a0', mid: '#c46e3e', dark: '#5e2a12' },
  12: { name: '真鍮',   hue: 44,  light: '#fbe7a6', mid: '#c9a042', dark: '#5f4611' },
  16: { name: '鋼',     hue: 210, light: '#f4f6f9', mid: '#a3abb6', dark: '#3f454e' },
  20: { name: '緑アルマイト', hue: 165, light: '#b4f0dd', mid: '#2f9d80', dark: '#0f3e33' },
  24: { name: '焼き青', hue: 220, light: '#b3ccff', mid: '#3a5fb0', dark: '#111f45' },
  32: { name: '紫アルマイト', hue: 275, light: '#dcc4ff', mid: '#7a4cb8', dark: '#2a1447' },
  36: { name: 'ローズゴールド', hue: 5, light: '#ffd9d2', mid: '#c98479', dark: '#55291f' },
};
export const DRIVER_METAL = { name: '黒染め鋼', hue: 215, light: '#9aa2ad', mid: '#3b4048', dark: '#101216' };

export function toneOf(teeth) {
  const m = METALS[teeth] || (() => {
    const h = (teeth * 37) % 360;
    return { name: `${teeth} 歯`, hue: h, light: `hsl(${h} 60% 84%)`, mid: `hsl(${h} 45% 52%)`, dark: `hsl(${h} 45% 20%)` };
  })();
  return {
    ...m,
    faceLight: m.light,
    faceMid: m.mid,
    faceDark: m.dark,
    tooth: m.dark,     // 1 枚おきに濃くして数えやすくする
  };
}

// 盤面の大きさの呼び方は並べ方で変わる
const SIZE_WORDS = {
  grid:  { label: '盤面', option: (s) => `${s} × ${s}` },
  shape: { label: '大きさ', option: (s) => `${s} 段` },
  train: { label: '歯車の数', option: (s) => `${s} 個` },
  ring:  { label: '輪の歯車', option: (s) => `${s} 個` },
  star:  { label: '腕の数', option: (s) => `${s} 本` },
};
export const sizeWords = (mode) => SIZE_WORDS[mode.words || (mode.shape ? 'shape' : mode.layout)] || SIZE_WORDS.grid;
