import { readFileSync } from 'node:fs';
const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'zhshy', REPO = 'ziwei-doushu', TAG = 'v1.1.0';
const H = { Authorization:`Bearer ${TOKEN}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'rel' };

const body = `单文件离线版紫微斗数排盘工具。

## 本版内容

**排盘**
- 十二宫方格，十四主星带庙旺得利平不陷七档亮度，四化标注
- 真太阳时校正（内置 520 个城市经纬度）、1986–1991 夏令时提示
- 晚子时换日、空宫借对宫星曜

**出生信息**
- 阳历生日按「年 / 月 / 日」分三个框填写，自动校验月份天数与闰年

**详细解读（六个分区）**
- 命局总览：要点速览 + 命宫三方四正 + 身宫福德 + 四化与格局提要
- 十二宫详解：宫职、主星、亮度、吉煞、四化、对宫联动、大限落点、小结
- 生年四化：星性 × 落宫宫职 × 四化本义
- 命局基础：五行局、命主、身主、阴阳男女与大限顺逆
- 格局：等级、涉及宫位、成立条件、破格因素、出处
- 运限：本命 / 大限 / 流年三视角可切换，三方四正与四化落宫

**其它**
- 相邻时辰对照：三个盘并排比对差异
- AI 评语：接入免费模型，标注「AI 生成」，结果按命盘缓存

## 使用

下载下方 \`ziwei-doushu-v1.1.0.html\`，双击用浏览器打开即可，无需安装、无需联网（AI 评语功能除外）。

## 授权

- 排盘引擎来自 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（MIT）
- 「倪师《天纪》」板块归纳自 [nihai-tianji-corpus](https://github.com/Renhuai123/nihai-tianji-corpus)（**CC BY-NC-SA 4.0，非商用**）
- 本项目原创代码 MIT

**因含 CC BY-NC-SA 衍生内容，本项目仅限非商业用途。**

命理内容仅供传统文化研习参考，不构成任何建议。`;

const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
  method:'POST', headers:{...H,'Content-Type':'application/json'},
  body: JSON.stringify({ tag_name:TAG, name:`v1.1.0 · 紫微斗数排盘与解读`, body, draft:false, prerelease:false }),
});
const rel = await r.json();
if (!r.ok) { console.error('建 release 失败', r.status, JSON.stringify(rel).slice(0,300)); process.exit(1); }
console.log('release 已建:', rel.html_url);

const buf = readFileSync('index.html');
const up = await fetch(`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${rel.id}/assets?name=ziwei-doushu-v1.1.0.html`, {
  method:'POST',
  headers:{ Authorization:`Bearer ${TOKEN}`, Accept:'application/vnd.github+json', 'Content-Type':'text/html', 'User-Agent':'rel', 'Content-Length': String(buf.length) },
  body: buf,
});
const asset = await up.json();
if (!up.ok) { console.error('上传附件失败', up.status, JSON.stringify(asset).slice(0,300)); process.exit(1); }
console.log('附件已上传:', asset.name, (asset.size/1024).toFixed(0)+' KB');
console.log('下载地址:', asset.browser_download_url);
