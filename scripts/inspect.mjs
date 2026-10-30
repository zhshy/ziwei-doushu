/**
 * 单盘检视：打印一张命盘的完整排盘结果，供人工核对。
 *
 * 用法：
 *   node scripts/inspect.mjs 1990 1 1 12 0 male [经度]
 *   参数依次为：年 月 日 时(0-23) 分 性别(male|female) [出生地经度]
 *   不给经度则不做真太阳时校正。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8');
globalThis.window = {};
new Function(code)();
const ZW = globalThis.window.ZW;

const [y, mo, d, hh, mm, gender, lonArg] = process.argv.slice(2);
if (!y) { console.error('用法: node scripts/inspect.mjs 1990 1 1 12 0 male [经度]'); process.exit(1); }

const year = Number(y), month = Number(mo), day = Number(d);
const hour24 = Number(hh), minute = Number(mm || 0);
const lon = lonArg !== undefined ? Number(lonArg) : undefined;

// 钟表时间 → 时辰索引（23:00-00:59 = 子 = 0）
const hourIdx = Math.floor(((hour24 + 1) % 24) / 2);

const BR = ZW.BRANCHES, ST = ZW.STEMS;
const TYPE_LABEL = { major: '主星', lucky: '吉星', sha: '煞星', minor: '杂曜' };
const PAD = s => {
  const w = [...String(s)].reduce((n, ch) => n + (/[\u4e00-\u9fa5（）·]/.test(ch) ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, 14 - w));
};

console.log('═'.repeat(72));
console.log(`  排盘检视  ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
  `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}  ` +
  `${gender === 'male' ? '男' : '女'}${lon !== undefined ? `   经度 ${lon}` : '   未做真太阳时校正'}`);
console.log('═'.repeat(72));

// ── 真太阳时 ──────────────────────────────────────────────
let tsr = null;
try {
  tsr = ZW.calculateTrueSolarTime({
    year, month, day, clockHour: hour24, clockMinute: minute,
    longitude: lon, utcOffsetMinutes: 480,
  });
} catch (e) { /* 无经度时引擎可能直接返回未校正 */ }

if (tsr && tsr.corrected) {
  console.log(`真太阳时：${String(tsr.hour).padStart(2, '0')}:${String(tsr.minute).padStart(2, '0')}  ` +
    `（经度修正 ${tsr.longitudeCorrectionMinutes.toFixed(1)} 分，均时差 ${tsr.equationOfTimeMinutes.toFixed(1)} 分，` +
    `合计 ${tsr.totalCorrectionMinutes.toFixed(1)} 分${tsr.dayOffset ? `，跨日 ${tsr.dayOffset}` : ''}）`);
  console.log(`  校正后时辰：${BR[tsr.branch]}时（索引 ${tsr.branch}）`);
} else {
  console.log(`时辰：${BR[hourIdx]}时（索引 ${hourIdx}，未校正）`);
}

const ch = ZW.generateChart({ year, month, day, hour: hourIdx, gender, longitude: lon });
const L = ch.lunarInfo;

console.log();
console.log('【一、基本信息】');
console.log(`  公历      ${year}年${month}月${day}日 ${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
console.log(`  农历      ${L.lunarYear}年${L.lunarMonth}月${L.lunarDay}日${L.isLeapMonth ? '（闰月）' : ''}`);
console.log(`  四柱      年 ${L.fourPillars[0]}   月 ${L.fourPillars[1]}   日 ${L.fourPillars[2]}   时 ${L.fourPillars[3]}`);
if (L.fourPillarsLunar && L.fourPillarsLunar.join() !== L.fourPillars.join()) {
  console.log(`  四柱(农历) 年 ${L.fourPillarsLunar[0]}   月 ${L.fourPillarsLunar[1]}   日 ${L.fourPillarsLunar[2]}   时 ${L.fourPillarsLunar[3]}`);
}
console.log(`  命宫      ${BR[ch.mingGongBranch]}宫         身宫 ${BR[ch.shenGongBranch]}宫` +
  (ch.mingGongBranch === ch.shenGongBranch ? '（命身同宫）' : ''));
console.log(`  五行局    ${ch.wuxingJuName}        紫微落 ${BR[ch.ziweiPos]}宫`);
console.log(`  命主      ${ch.mingZhu}          身主 ${ch.shenZhu}`);
console.log(`  阴阳      ${ch.yinYangGender}        当前 ${ch.currentAge} 岁，第 ${ch.currentDaXianIndex + 1} 大限`);

// ── 十二宫 ────────────────────────────────────────────────
console.log();
console.log('【二、十二宫】');
for (let b = 0; b < 12; b++) {
  const p = ch.palaces.find(x => x.branch === b);
  if (!p) continue;
  const marks = [];
  if (p.isMingGong) marks.push('命宫');
  if (p.isShenGong) marks.push('身宫');
  if (p.isCurrentDaXian) marks.push('现大限');
  const head = `${BR[b]}宫 ${String(p.name).padEnd(2, '　')} ${ST[p.stem]}${BR[b]}` +
    (marks.length ? ` [${marks.join('/')}]` : '');

  const byType = { major: [], lucky: [], sha: [], minor: [] };
  for (const s of p.stars || []) {
    const t = TYPE_LABEL[s.type] ? s.type : 'minor';
    let txt = s.name;
    if (s.brightnessRaw) txt += `(${s.brightnessRaw})`;
    if (s.siHua) txt += `[${s.siHua}]`;
    byType[t].push(txt);
  }
  const parts = [];
  for (const k of ['major', 'lucky', 'sha', 'minor']) {
    if (byType[k].length) parts.push(`${TYPE_LABEL[k]} ${byType[k].join(' ')}`);
  }
  const dxAge = p.daXianAge ? `　大限 ${p.daXianAge[0]}-${p.daXianAge[1]}` : '';
  console.log(`  ${PAD(head)}${parts.length ? parts.join('  ') : '（空宫，借对宫）'}${dxAge}`);
}

// ── 大限 ──────────────────────────────────────────────────
console.log();
console.log('【三、大限】');
console.log('  ' + ch.daXians.map((x, i) =>
  `${String(x.startAge).padStart(2)}-${String(x.endAge).padStart(2)} ${x.palaceName}(${BR[x.palaceBranch]})${i === ch.currentDaXianIndex ? '*' : ''}`
).join('   '));

// ── 格局 ──────────────────────────────────────────────────
console.log();
console.log('【四、格局】');
let pats = [];
try { pats = ZW.detectPatterns(ch) || []; } catch (e) { console.log('  判定失败：' + e.message); }
if (!pats.length) console.log('  无成格');
else {
  const LV = { excellent: '上', good: '吉', neutral: '平', caution: '慎' };
  for (const p of pats) {
    console.log(`  · ${p.name} [${LV[p.level] || p.level}]  落 ${(p.palaces || []).join('、')}`);
    console.log(`    ${p.description}`);
    if (p.source) console.log(`    出处：${p.source}`);
  }
}

// ── 命宫摘要 ──────────────────────────────────────────────
console.log();
console.log('【五、命宫摘要】');
const sm = ZW.getMingGongSummary(ch);
console.log('  ' + JSON.stringify(sm));

// ── 复核：与《全书》派亮度和上游对拍用 ────────────────────
console.log();
console.log('【六、主星亮度清单（供核对）】');
const majors = [];
for (let b = 0; b < 12; b++) {
  const p = ch.palaces.find(x => x.branch === b);
  for (const s of p?.stars || []) if (s.type === 'major') majors.push(`${s.name}@${BR[b]}=${s.brightnessRaw || '—'}`);
}
console.log('  ' + majors.join('  '));
