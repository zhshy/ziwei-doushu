# 引擎层说明与补丁记录

`src/engine.js` 是**压缩产物**（约 1.0 MB，单行），原样保留，不参与常规编辑。
它内含 iztro、lunar-javascript 与本地解读知识库，对外只暴露一个入口：

```js
window.ZW = {
  BRANCHES, STEMS, SHICHEN, JU_NAMES, STAR_DESCRIPTIONS, PROVINCES,
  calculateTrueSolarTime, isChinaDST, chinaDSTRange,
  generateChart, getDaXianIndexForAge, getSiHuaByStem, getLiuNianSiHua,
  getYearBranchIndex, getDaXianStartYear,
  getMingGongSummary, detectPatterns, buildReading,
  VERSION, ENGINE
}
```

`src/app.js` 只通过 `window.ZW` 调用它，两者边界清晰。

## 改引擎前必读：亮度表有两张，只有一张生效

| 表 | 位置 | 是否生效 |
|---|---|---|
| iztro 内置 `STARS_INFO`（压缩后名 `Ds`） | 各星的 `brightness:["miao","wang",…]` | **不生效，是死数据** |
| 全流派表 `w2.SB_QS` / `SB_XD1` / `SB_ZZ` / `SB_XD2` | `fs = {QS: w2.SB_QS, …}` | **生效**，默认走 `QS` |

亮度查询链路：`Q1(星名, 地支索引, 流派="QS")` → `Wt[星名]` 取星 ID → `fs.QS[星ID][地支+1]` → `Es.QS[数值]` 转中文。

2026-10-30 曾按 `STARS_INFO` 比对，得出「天梁落巳宫应为得、当前是陷」的结论，**实为误判**：
按实际排盘跑量验证，168 个「主星 × 宫位」组合与上游《紫微斗数全书》派完全一致。
该结论已固化为 `scripts/test-brightness.mjs`。

**结论：改亮度前先跑 `npm test`，不要照着 `STARS_INFO` 改。**

## 修改引擎的流程

1. 在 `src/engine.js` 里做最小字符串级改动（它是单行压缩代码，改动位置务必先做定位确认）。
2. 跑 `npm test`，确认亮度等既有口径未退化。
3. 跑 `npm run build`，再 `npm run check` 确认产物与预期一致。
4. 在下方「变更记录」登记：改了什么、为什么、怎么验证的。

## 变更记录

| 日期 | 改动 | 原因 | 验证 |
|---|---|---|---|
| 2026-10-30 | 无（拆分为源码工程，引擎字节未变） | 建立可维护结构 | 拆解后重建，sha256 与原 `index.html` 一致 |

## 已知未纳入的能力

以下上游能力**不在**当前引擎产物里，如需使用要从上游源码另行接入：

- 十二神煞（将前 / 岁前 / 博士十二神）的排布与展示
- 流派切换（亮度 / 闰月 / 晚子时 / 庚年四化等）
- 农历输入与闰月处理
- 飞星自化体系、合盘
