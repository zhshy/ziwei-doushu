/**
 * 一次性抽取脚本：把发布态单文件 index.html 拆成可维护源码。
 *
 * 拆出四块：
 *   src/index.html  — 骨架（style / script 位置留注入标记）
 *   src/styles.css  — 全部样式
 *   src/app.js      — UI 层（作者自写，未压缩，可读）
 *   src/engine.js   — 引擎层产物（iztro + lunar + 本地解读库，已压缩为单行，原样保留）
 *
 * 不修改任何字节内容；构建脚本 build.mjs 负责拼回去。
 * 保留本脚本是为了留审计痕迹：任何人可重跑，确认源码与发布文件同源。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 1) style
const styleRe = /<style>([\s\S]*?)<\/style>/;
const styleMatch = html.match(styleRe);
if (!styleMatch) throw new Error('未找到 <style> 块');
const css = styleMatch[1];

// 2) script：按长度区分引擎与 App
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
const scripts = [...html.matchAll(scriptRe)].map(m => m[1]);
if (scripts.length !== 2) throw new Error(`预期 2 个 <script>，实际 ${scripts.length}`);
const [a, b] = scripts;
const engine = a.length > b.length ? a : b;
const app = a.length > b.length ? b : a;

// 3) 骨架：把三块按原位置替换为注入标记
let shell = html
  .replace(styleRe, '<!--INJECT:STYLE-->')
  .replace(/<script>[\s\S]*?<\/script>(\r?\n)<script>[\s\S]*?<\/script>/, (m, nl) => '<!--INJECT:ENGINE-->' + nl + '<!--INJECT:APP-->');

if (!shell.includes('<!--INJECT:STYLE-->')) throw new Error('骨架缺少 STYLE 注入点');
if (!shell.includes('<!--INJECT:ENGINE-->')) throw new Error('骨架缺少 ENGINE 注入点');

fs.mkdirSync(SRC, { recursive: true });
fs.mkdirSync(path.join(SRC, 'engine'), { recursive: true });

fs.writeFileSync(path.join(SRC, 'index.html'), shell, 'utf8');
fs.writeFileSync(path.join(SRC, 'styles.css'), css, 'utf8');
fs.writeFileSync(path.join(SRC, 'app.js'), app, 'utf8');
// 引擎产物原样留在 src/engine.js，带独立版本记录
fs.writeFileSync(path.join(SRC, 'engine.js'), engine, 'utf8');

// 引擎版本信息（从产物里的 window.ZW 导出块抓取）
const verMatch = engine.match(/VERSION:"([^"]+)",ENGINE:"([^"]+)"/);
const meta = {
  version: verMatch ? verMatch[1] : 'unknown',
  engine: verMatch ? verMatch[2] : 'unknown',
  bytes: engine.length,
  note: '压缩产物，来源见 NOTICE.md；改动记入 src/engine/PATCHES.md',
  extractedAt: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(path.join(SRC, 'engine', 'VERSION.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

console.log('抽出完成：');
console.log('  骨架   ', shell.length, '字节');
console.log('  样式   ', css.length, '字节');
console.log('  App    ', app.length, '字节（可读）');
console.log('  引擎   ', engine.length, '字节（压缩）');
console.log('  引擎版本', meta.version, '/', meta.engine);
