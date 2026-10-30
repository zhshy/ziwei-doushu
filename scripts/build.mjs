/**
 * 构建：把 src/ 拼回单文件 index.html。
 *
 * 原则：产物必须与上一版逐字节可对拍（除刻意改动处）。
 * 任何改动前先跑 `node scripts/build.mjs --check` 确认没有意外漂移。
 *
 * 用法：
 *   node scripts/build.mjs          构建，写 index.html
 *   node scripts/build.mjs --check  只构建到内存，与现有 index.html 比对，输出差异位置
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const shell = read('src/index.html');
const css = read('src/styles.css');
const engine = read('src/engine.js');
const plain = read('src/plain-reading.js');
const app = read('src/app.js');

// 用函数式替换，避免 $& / $1 在内容里被当成分组引用（引擎代码含 $）
let out = shell
  .replace('<!--INJECT:STYLE-->', () => '<style>' + css + '</style>')
  .replace('<!--INJECT:ENGINE-->', () => '<script>' + engine + '</script>')
  .replace('<!--INJECT:PLAIN-->', () => '<script>' + plain + '</script>')
  .replace('<!--INJECT:APP-->', () => '<script>' + app + '</script>');

const leftover = out.match(/<!--INJECT:[A-Z]+-->/);
if (leftover) throw new Error('注入点未替换：' + leftover[0]);

const target = path.join(ROOT, 'index.html');

if (process.argv.includes('--check')) {
  const prev = fs.readFileSync(target, 'utf8');
  if (prev === out) {
    console.log('✅ 无漂移：构建产物与 index.html 完全一致');
    console.log('   字节数', out.length, ' sha256', crypto.createHash('sha256').update(out).digest('hex').slice(0, 16));
    process.exit(0);
  }
  // 定位第一处差异，便于排查
  let i = 0;
  while (i < prev.length && i < out.length && prev[i] === out[i]) i++;
  console.error('❌ 有漂移，首处差异在字符偏移', i);
  console.error('   现有:', JSON.stringify(prev.slice(Math.max(0, i - 60), i + 60)));
  console.error('   构建:', JSON.stringify(out.slice(Math.max(0, i - 60), i + 60)));
  console.error('   长度：现有', prev.length, ' 构建', out.length);
  process.exit(1);
}

fs.writeFileSync(target, out, 'utf8');
console.log('✅ 已构建 index.html');
console.log('   字节数', out.length);
console.log('   sha256', crypto.createHash('sha256').update(out).digest('hex'));
