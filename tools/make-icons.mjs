// アプリのアイコンの SVG を、盤面と同じ歯車の形（src/gear.js）から組み立てる。
//   node tools/make-icons.mjs で icons/*.svg を書き出し、PNG は README の手順で Chrome に描かせる。
import { gearPath, holesPath, webPath, webRadius, rootRadius, indexMarkPath, indexDot } from '../src/gear.js';
import { writeFileSync } from 'node:fs';

function icon({ size = 512, outer = 196, rounded = true, bgPad = 0 }) {
  const T = 16, m = outer / (T / 2 + 1), R = (m * T) / 2;
  const root = rootRadius(R, m), rw = webRadius(R, m), hub = Math.min(R * 0.24, rw * 0.5);
  const body = gearPath(T, R, m, 0) + holesPath(T, R, m);
  const dot = indexDot(T, R, m);
  const c = size / 2, rx = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f46"/><stop offset="0.5" stop-color="#23272c"/><stop offset="1" stop-color="#121417"/></linearGradient>
  <radialGradient id="perl" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.05"/><stop offset="0.66" stop-color="#000" stop-opacity="0"/><stop offset="0.7" stop-color="#000" stop-opacity="0.14"/><stop offset="0.74" stop-color="#000" stop-opacity="0"/></radialGradient>
  <pattern id="pp" width="${size / 12}" height="${size / 12}" patternUnits="userSpaceOnUse"><circle cx="${size / 24}" cy="${size / 24}" r="${size / 17}" fill="url(#perl)"/></pattern>
  <radialGradient id="brass" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9a042"/><stop offset="0.8" stop-color="#c9a042"/><stop offset="0.93" stop-color="#fbe7a6"/><stop offset="1" stop-color="#5f4611"/></radialGradient>
  <linearGradient id="light" x1="0.18" y1="0.08" x2="0.82" y2="0.96"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.06"/><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>
  <radialGradient id="grain" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${m * 0.35}" spreadMethod="repeat"><stop offset="0" stop-color="#000" stop-opacity="0.3"/><stop offset="0.5" stop-color="#000" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></radialGradient>
  <radialGradient id="hub" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#f4f6f9"/><stop offset="0.5" stop-color="#a3abb6"/><stop offset="1" stop-color="#3f454e"/></radialGradient>
  <radialGradient id="jewel" cx="0.36" cy="0.3" r="0.75"><stop offset="0" stop-color="#ffd0d6"/><stop offset="0.3" stop-color="#e0304d"/><stop offset="1" stop-color="#4a0613"/></radialGradient>
  <linearGradient id="recess" x1="0.2" y1="0.1" x2="0.8" y2="0.9"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0.45"/></linearGradient>
  <clipPath id="clip"><path d="${body}" clip-rule="evenodd"/></clipPath>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${size / 60}"/></filter>
</defs>
<rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
<rect width="${size}" height="${size}" rx="${rx}" fill="url(#pp)"/>
${rounded ? `<rect x="${size * 0.012}" y="${size * 0.012}" width="${size * 0.976}" height="${size * 0.976}" rx="${rx * 0.95}" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="${size * 0.006}"/>` : ''}
<circle cx="${c + size * 0.014}" cy="${c + size * 0.026}" r="${outer * 0.97}" fill="#000" opacity="0.6" filter="url(#soft)"/>
<g transform="translate(${c},${c})">
  <path d="${body}" fill="url(#brass)" fill-rule="evenodd" stroke="#2b1f06" stroke-width="${m * 0.12}" stroke-linejoin="round"/>
  <path d="${webPath(T, R, m)}" fill="#b08a34" fill-rule="evenodd"/>
  <path d="${webPath(T, R, m)}" fill="url(#grain)" fill-rule="evenodd"/>
  <path d="${indexMarkPath(T, R, m)}" fill="#f6f1e4" stroke="#0a0804" stroke-opacity="0.8" stroke-width="${m * 0.16}" stroke-linejoin="round" paint-order="stroke"/>
  <circle cy="${dot.cy}" r="${dot.r}" fill="#3a342a"/>
  <g clip-path="url(#clip)"><circle r="${outer}" fill="url(#light)"/></g>
  <circle r="${rw}" fill="none" stroke="url(#recess)" stroke-width="${m * 0.22}"/>
  <circle r="${hub}" fill="url(#hub)" stroke="#000" stroke-opacity="0.6" stroke-width="${m * 0.1}"/>
  <circle r="${R * 0.075}" fill="url(#jewel)"/>
</g>
</svg>`;
}

const out = new URL('../icons/', import.meta.url).pathname;
writeFileSync(out + 'icon.svg', icon({ rounded: true, outer: 196 }));
writeFileSync(out + 'maskable.svg', icon({ rounded: false, outer: 170 }));   // 丸く切り抜かれても歯が欠けないよう、安全域（直径 80%）に収める
writeFileSync(out + 'apple.svg', icon({ rounded: false, outer: 190 }));      // iOS は自分で角を丸めるので全面に塗る
console.log('ok');
