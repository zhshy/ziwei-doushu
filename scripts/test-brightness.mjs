/**
 * 回归测试：14 主星 × 12 宫位的实际排盘亮度，必须与《紫微斗数全书》派一致。
 *
 * 为什么需要这个测试：
 *   引擎产物里有两张亮度表 —— iztro 内置的 STARS_INFO（压缩后变量名 Ds）与全流派表
 *   w2.SB_QS。实际生效的只有 w2.SB_QS，STARS_INFO 是死数据。
 *   2026-10-30 曾按 STARS_INFO 比对，得出「天梁落巳宫标错」的错误结论；
 *   实盘验证为 168/168 全对。本测试钉住这个结论，也防止将来有人照 STARS_INFO 改错。
 *
 * 期望值来源：上游 Renhuai123/ziwei-doushu 的 lib/ziwei/school-data.ts
 *   SCHOOL_BRIGHTNESS_QS（1=庙 2=旺 3=得 4=利 5=平 6=不 7=陷，索引 1-12 = 子起一）。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8');

globalThis.window = {};
new Function(code)();
const ZW = globalThis.window.ZW;
if (!ZW) throw new Error('引擎未挂载 window.ZW');

/** 上游《全书》派亮度表：[星名, 子..亥 的 1-7 码] */
const EXPECTED = {
  紫微: [5, 1, 2, 2, 3, 2, 1, 1, 2, 2, 3, 2],
  天机: [1, 7, 3, 2, 4, 5, 1, 7, 3, 2, 4, 5],
  太阳: [7, 6, 2, 1, 2, 2, 2, 3, 3, 5, 6, 7],
  武曲: [2, 1, 3, 4, 1, 5, 2, 1, 3, 4, 1, 5],
  天同: [2, 6, 4, 5, 5, 1, 7, 6, 2, 5, 5, 1],
  廉贞: [5, 4, 1, 5, 4, 7, 5, 4, 1, 5, 4, 7],
  天府: [1, 1, 1, 3, 1, 3, 2, 1, 3, 2, 1, 3],
  太阴: [1, 1, 2, 7, 7, 7, 6, 6, 4, 2, 2, 1],
  贪狼: [2, 1, 5, 4, 1, 7, 2, 1, 5, 4, 1, 7],
  巨门: [2, 6, 1, 1, 7, 2, 2, 6, 1, 1, 7, 2],
  天相: [1, 1, 1, 7, 3, 3, 1, 3, 1, 7, 3, 3],
  天梁: [1, 2, 1, 1, 1, 3, 1, 2, 7, 3, 1, 7],
  七杀: [2, 1, 1, 2, 1, 5, 2, 1, 1, 2, 1, 5],
  破军: [1, 2, 3, 7, 2, 5, 1, 2, 3, 7, 2, 5],
};
const NUM2CN = { 1: '庙', 2: '旺', 3: '得', 4: '利', 5: '平', 6: '不', 7: '陷' };
const DZ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 覆盖 14 主星 × 12 宫，需要足够多样的盘
// 亮度只由「星曜 + 所在宫支」决定，与年份无关；单个年份的 12 月 × 2 日 × 12 时辰
// 共 288 盘即可覆盖全部 168 个组合（实测 168/168，约 15 秒）。
const seen = new Map();
let charts = 0;
for (let month = 1; month <= 12; month++) {
  for (const day of [1, 15]) {
    for (let hour = 0; hour < 12; hour++) {
      let ch;
      try { ch = ZW.generateChart({ year: 1990, month, day, hour, gender: 'male' }); } catch { continue; }
      charts++;
      for (const p of ch.palaces) {
        for (const s of p.stars || []) {
          if (s.type !== 'major') continue;
          const k = s.name + '|' + p.branch;
          if (!seen.has(k)) seen.set(k, new Set());
          seen.get(k).add(s.brightnessRaw || '');
        }
      }
    }
  }
}

let fail = 0;
const missing = [];
for (const [name, row] of Object.entries(EXPECTED)) {
  for (let b = 0; b < 12; b++) {
    const set = seen.get(name + '|' + b);
    if (!set) { missing.push(name + DZ[b]); continue; }
    const vals = [...set].filter(Boolean);
    if (vals.length > 1) { console.error(`✗ ${name}${DZ[b]} 同宫出现多种亮度: ${vals.join('/')}`); fail++; continue; }
    if (vals[0] !== NUM2CN[row[b]]) {
      console.error(`✗ ${name}落${DZ[b]}宫：实际=${vals[0]} 期望=${NUM2CN[row[b]]}`);
      fail++;
    }
  }
}

const covered = 168 - missing.length;
console.log(`造盘 ${charts} 张，覆盖 ${covered}/168 个「主星×宫位」组合`);
if (missing.length) console.error('未覆盖组合：' + missing.join('、'));

if (fail === 0 && missing.length === 0) {
  console.log('✅ 亮度全表与《紫微斗数全书》派一致（168/168）');
  process.exit(0);
}
if (fail === 0 && missing.length > 0) {
  console.error(`⚠️ 未覆盖 ${missing.length} 个组合，测试不完整`);
  process.exit(2);
}
console.error(`❌ ${fail} 处不一致`);
process.exit(1);
