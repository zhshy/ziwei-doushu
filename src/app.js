
(function(){
'use strict';
const ZW = window.ZW;
const BR = ZW.BRANCHES, ST = ZW.STEMS;
const PALACE_ORDER = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];

/* 地支 → 4x4 盘面位置 [row, col] */
const POS = {
  5:[1,1], 6:[1,2], 7:[1,3], 8:[1,4],
  4:[2,1],                  9:[2,4],
  3:[3,1],                 10:[3,4],
  2:[4,1], 1:[4,2], 0:[4,3],11:[4,4]
};

const state = {
  chart:null, view:'mingpan', dxIndex:0, lnYear:new Date().getFullYear(),
  selBranch:null, brightnessSchool:'default', cmpOpen:false,
  ai:{ status:'idle', map:{}, err:'', flagged:0, sig:'' }, aiCfgOpen:false, readMode:'mingpan',
};

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ───────── 工具 ───────── */
function clockToBranch(h){ return Math.floor(((h + 1) % 24) / 2); }
function fmtDate(o){ return `${o.y}-${String(o.m).padStart(2,'0')}-${String(o.d).padStart(2,'0')}`; }
function addDays(y,m,d,n){
  const dt = new Date(Date.UTC(y, m-1, d+n));
  return { y:dt.getUTCFullYear(), m:dt.getUTCMonth()+1, d:dt.getUTCDate() };
}
function palaceNameFrom(mingBranch, branch){
  return PALACE_ORDER[((branch - mingBranch) % 12 + 12) % 12];
}
const BR_CLASS = { '庙':'b-strong','旺':'b-strong','得':'','利':'','平':'','不':'b-weak','陷':'b-weak' };

/* ───────── 起盘 ───────── */
function buildChart(){
  const timeStr = $('#f-time').value || '12:00';
  const errBox = $('#f-err');
  errBox.textContent = '';

  const dtIn = readDate();
  if(dtIn.err){ errBox.textContent = dtIn.err; return; }
  const y = dtIn.y, m = dtIn.m, d = dtIn.d;
  const [ch,cm] = timeStr.split(':').map(Number);
  const gender = $('#f-gender .on').dataset.g;

  let cy=y, cmo=m, cd=d, clockH=ch, clockM=cm, notes=[];

  // 真太阳时
  const cityOpt = $('#f-city').selectedOptions[0];
  const lon = cityOpt && cityOpt.dataset.lon ? parseFloat(cityOpt.dataset.lon) : null;
  if(lon !== null){
    const r = ZW.calculateTrueSolarTime({
      year:y, month:m, day:d, clockHour:ch, clockMinute:cm, longitude:lon,
    });
    if(r.corrected){
      const shift = addDays(y,m,d,r.dayOffset);
      cy=shift.y; cmo=shift.m; cd=shift.d;
      clockH=r.hour; clockM=r.minute;
      const sign = r.totalCorrectionMinutes>=0 ? '+' : '−';
      notes.push(`真太阳时 ${String(r.hour).padStart(2,'0')}:${String(r.minute).padStart(2,'0')}（校正 ${sign}${Math.abs(r.totalCorrectionMinutes).toFixed(1)} 分钟）`);
    }
  }

  // 晚子时换日
  if(clockH === 23){
    const nx = addDays(cy,cmo,cd,1);
    cy=nx.y; cmo=nx.m; cd=nx.d;
    notes.push('23 时属晚子时，已按次日排盘');
  }

  const hour = clockToBranch(clockH);

  // 夏令时提示
  if(ZW.isChinaDST(y,m,d)){
    const rg = ZW.chinaDSTRange(y);
    notes.push(`⚠ ${y} 年 ${rg.start}–${rg.end} 为中国夏令时期间，钟表时间比标准时快 1 小时，如需精确请自行回拨 1 小时后再排`);
  }

  let chart;
  try{
    chart = ZW.generateChart({ year:cy, month:cmo, day:cd, hour, gender, longitude: lon ?? undefined });
  }catch(e){
    errBox.textContent = '排盘失败：' + e.message;
    return;
  }
  chart.__notes = notes;
  chart.__origDate = { y, m, d, ch, cm };
  chart.__hourBranch = hour;

  state.chart = chart;
  state.selBranch = chart.mingGongBranch;
  state.view = 'mingpan';
  // 换盘则丢弃上一张盘的 AI 评语
  state.ai = { status:'idle', map:{}, err:'', flagged:0, sig:'' };
  document.querySelectorAll('#view-seg button').forEach(b=>b.classList.toggle('on', b.dataset.v==='mingpan'));
  syncViewCfg();

  // 大限默认定位到当前年龄
  const dxForAge = ZW.getDaXianIndexForAge(chart, chart.currentAge);
  state.dxIndex = (typeof dxForAge === 'number' && dxForAge >= 0) ? dxForAge : 0;

  // 流年年份下拉
  const birthY = chart.birthInfo.year;
  const sel = $('#ln-year');
  const nowY = new Date().getFullYear();
  const from = Math.min(birthY, nowY), to = birthY + 110;
  sel.innerHTML = '';
  for(let yy=from; yy<=to; yy++){
    const o = document.createElement('option');
    o.value = yy; o.textContent = yy + ' 年';
    sel.appendChild(o);
  }
  sel.value = nowY;
  state.lnYear = nowY;

  $('#form-panel').hidden = true;
  $('#chart-panel').hidden = false;
  render();
}

/* ───────── 渲染 ───────── */
function syncViewCfg(){
  $('#cfg-daxian').hidden  = state.view !== 'daxian';
  $('#cfg-liunian').hidden = state.view !== 'liunian';
}

function currentOverlay(){
  const c = state.chart;
  if(state.view === 'daxian'){
    const dx = c.daXians[state.dxIndex];
    if(!dx) return null;
    const dp = c.palaces.find(p=>p.branch===dx.palaceBranch);
    // 引擎已下线 daXians[].siHua，改按大限宫的宫干推算（主流口径）
    let sh = null;
    if(dx.siHua){
      sh = { 禄:dx.siHua.lu, 权:dx.siHua.quan, 科:dx.siHua.ke, 忌:dx.siHua.ji };
    } else if(dp){
      const t = ZW.getSiHuaByStem(dp.stem);
      sh = { 禄:t['禄'], 权:t['权'], 科:t['科'], 忌:t['忌'] };
    }
    return {
      kind:'daxian', branch:dx.palaceBranch, sihua:sh, dx, prefix:'限',
      stemName: dx.stemName || (dp ? ST[dp.stem] : ''),
    };
  }
  if(state.view === 'liunian'){
    const ln = ZW.getLiuNianSiHua(state.lnYear);
    const yearBranch = ZW.getYearBranchIndex(state.lnYear);
    return { kind:'liunian', branch:yearBranch, sihua:ln.transforms, ln, prefix:'年' };
  }
  return null;
}

function render(){
  const c = state.chart;
  const ov = currentOverlay();

  // 校正 / 换日 / 夏令时提示
  const nb = $('#notes');
  const notes = c.__notes || [];
  if(notes.length){
    nb.hidden = false;
    nb.innerHTML = notes.map(n=>`<span class="nt${n.indexOf('⚠')>=0?' warn':''}">${esc(n)}</span>`).join('');
  } else {
    nb.hidden = true; nb.innerHTML = '';
  }

  // 工具条
  if(state.view === 'daxian'){
    const dx = c.daXians[state.dxIndex];
    const sy = ZW.getDaXianStartYear(c, state.dxIndex);
    $('#dx-label').textContent = dx
      ? `第 ${state.dxIndex+1} 大限 · ${dx.startAge}–${dx.endAge} 岁${sy?` · ${sy}–${sy+(dx.endAge-dx.startAge)}`:''} · ${dx.palaceName}`
      : '—';
    $('#dx-prev').disabled = state.dxIndex <= 0;
    $('#dx-next').disabled = state.dxIndex >= c.daXians.length-1;
  }
  if(state.view === 'liunian'){
    const ln = ZW.getLiuNianSiHua(state.lnYear);
    const yb = ZW.getYearBranchIndex(state.lnYear);
    $('#ln-label').textContent = `${ST[ln.stemIndex]}${BR[yb]}年 · 流年命宫在${BR[yb]}`;
  }

  renderBoard(c, ov);
  renderDetail(c, ov);
  renderPatterns(c);
  renderCompare();
  // 解读页可见时同步刷新（换大限 / 流年会改变运限解读）
  if(!$('#view-reading').hidden) renderReading();
}

function renderBoard(c, ov){
  const board = $('#board');
  board.innerHTML = '';

  for(let branch=0; branch<12; branch++){
    const p = c.palaces.find(x=>x.branch===branch);
    const pos = POS[branch];
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.gridRow = pos[0]; cell.style.gridColumn = pos[1];
    cell.dataset.branch = branch;

    const isHl = branch === (ov ? ov.branch : c.mingGongBranch);
    if(isHl) cell.classList.add('hl');
    if(state.selBranch === branch) cell.classList.add('sel');

    // 大限岁数
    const dxAge = p && p.daXianAge ? `${p.daXianAge[0]}–${p.daXianAge[1]}` : '';

    // 流年宫名
    let lnTag = '';
    if(ov && ov.kind === 'liunian'){
      const nm = palaceNameFrom(ov.branch, branch);
      if(nm !== (p?p.name:'')) lnTag = `<div class="liunian-tag">流年${nm}</div>`;
    }

    let starsHtml = '';
    if(p){
      for(const s of p.stars){
        const cls = s.type === 'major' ? 'major' : s.type === 'minor' ? 'minor' : s.type === 'sha' ? 'sha' : 'lucky';
        const bRaw = s.brightnessRaw || '';
        const bCls = BR_CLASS[bRaw] || '';
        let shHtml = '';
        if(s.siHua) shHtml += `<b class="sh ${s.siHua}">${s.siHua}</b>`;
        if(ov && ov.sihua){
          for(const [k,v] of Object.entries(ov.sihua)){
            if(v === s.name) shHtml += `<b class="sh x ${k}">${ov.prefix}${k}</b>`;
          }
        }
        starsHtml += `<span class="st ${cls}">${esc(s.name)}${bRaw?`<i class="br ${bCls}">${bRaw}</i>`:''}${shHtml}</span>`;
      }
      if(p.isEmpty && p.borrowedStars && p.borrowedStars.length){
        starsHtml += `<span class="st minor" style="opacity:.7">借${esc(p.borrowedStars.join('、'))}</span>`;
      }
    }

    cell.innerHTML = `
      <div class="cell-top">
        <span class="pname">${p ? esc(p.name) : ''}</span>
        <span class="dx">${dxAge}</span>
      </div>
      <div class="stars">${starsHtml}</div>
      ${lnTag}
      <span class="branch">${BR[branch]}</span>
    `;
    cell.addEventListener('click', ()=>{ state.selBranch = branch; render(); });
    board.appendChild(cell);
  }

  // 中宫
  const center = document.createElement('div');
  center.className = 'center';
  const bi = c.birthInfo, li = c.lunarInfo || {};
  const orig = c.__origDate || {};
  const lunarStr = li.lunarYear ? `${li.lunarYear} 年${li.isLeapMonth?'闰':''}${Math.abs(li.lunarMonth)}月${li.lunarDay}日` : '—';
  const fp = li.fourPillars ? li.fourPillars.join(' · ') : '—';

  let overlayInfo = '';
  if(ov && ov.kind === 'daxian'){
    overlayInfo = `<div class="lab">当前视角 · 大限</div>
      <dl class="kv"><dt>大限宫</dt><dd>${esc(ov.dx.palaceName)}（${BR[ov.branch]}）</dd>
      <dt>年龄段</dt><dd>${ov.dx.startAge}–${ov.dx.endAge} 岁</dd>
      <dt>大限干</dt><dd>${ov.stemName || '—'}</dd></dl>`;
  } else if(ov && ov.kind === 'liunian'){
    overlayInfo = `<div class="lab">当前视角 · 流年</div>
      <dl class="kv"><dt>流年</dt><dd>${ST[ov.ln.stemIndex]}${BR[ov.branch]}年</dd>
      <dt>流年命宫</dt><dd>${BR[ov.branch]}宫（本命${esc(palaceNameFrom(c.mingGongBranch, ov.branch))}）</dd></dl>`;
  }

  const shRows = ov && ov.sihua ? `
    <div class="sihua-row">
      ${Object.entries(ov.sihua).map(([k,v])=>`<span class="item"><b class="sh ${k}">${k}</b>${esc(v)}</span>`).join('')}
    </div>` : `
    <div class="sihua-row">
      ${['禄','权','科','忌'].map(k=>{
        const found = (c.palaces||[]).flatMap(p=>p.stars).find(s=>s.siHua===k);
        return `<span class="item"><b class="sh ${k}">${k}</b>${found?esc(found.name):'—'}</span>`;
      }).join('')}
    </div>`;

  center.innerHTML = `
    <h3>${bi.gender==='male'?'乾造':'坤造'} · ${bi.year} 年</h3>
    <dl class="kv">
      <dt>阳历</dt><dd>${fmtDate({y:orig.y||bi.year, m:orig.m||bi.month, d:orig.d||bi.day})} ${orig.ch!==undefined?String(orig.ch).padStart(2,'0')+':'+String(orig.cm).padStart(2,'0'):''}</dd>
      <dt>农历</dt><dd>${lunarStr}</dd>
      <dt>四柱</dt><dd>${esc(fp)}</dd>
      <dt>时辰</dt><dd>${BR[c.__hourBranch]}时</dd>
      <dt>五行局</dt><dd>${esc(c.wuxingJuName||'')}</dd>
      <dt>命主</dt><dd>${esc(c.mingZhu||'—')}</dd>
      <dt>身主</dt><dd>${esc(c.shenZhu||'—')}</dd>
      <dt>阴阳</dt><dd>${esc(c.yinYangGender||'—')}</dd>
    </dl>
    ${overlayInfo}
    <div class="lab" style="margin-top:6px">${ov && ov.sihua ? (ov.kind==='daxian'?'大限':'流年')+'四化' : '生年四化'}</div>
    ${shRows}
  `;
  board.appendChild(center);
}

function renderDetail(c, ov){
  const branch = state.selBranch;
  const p = c.palaces.find(x=>x.branch===branch);
  const card = $('#detail-card');
  if(!p){ card.innerHTML = ''; return; }

  const groups = [
    { key:'major', label:'主星' },
    { key:'minor', label:'辅星' },
    { key:'sha',   label:'煞星' },
    { key:'lucky', label:'杂曜' },
  ];

  let html = `<h3>${esc(p.name === '命宫' ? '命宫' : p.name + '宫')} <small>${BR[branch]}宫 · ${ST[p.stem]}干${p.daXianAge?` · ${p.daXianAge[0]}–${p.daXianAge[1]} 岁`:''}</small></h3>`;

  if(p.isEmpty){
    html += `<p class="empty">空宫${p.borrowedStars&&p.borrowedStars.length?`，借对宫（${esc(p.borrowedFromName||'')}）${esc(p.borrowedStars.join('、'))}`:'，无主星'}</p>`;
  }

  let any = false;
  for(const g of groups){
    const stars = p.stars.filter(s=>s.type===g.key);
    if(!stars.length) continue;
    any = true;
    html += `<div style="font-size:10.5px;color:var(--ink3);letter-spacing:1px;margin:10px 0 6px">${g.label}</div><div class="starlist">`;
    for(const s of stars){
      const desc = ZW.STAR_DESCRIPTIONS && ZW.STAR_DESCRIPTIONS[s.name];
      const meta = [s.brightnessRaw, s.siHua?`化${s.siHua}`:''].filter(Boolean).join(' · ');
      let ovTag = '';
      if(ov && ov.sihua){
        for(const [k,v] of Object.entries(ov.sihua)){
          if(v === s.name) ovTag += ` <b class="sh ${k}">${ov.prefix}${k}</b>`;
        }
      }
      html += `<div class="sitem">
        <span class="n">${esc(s.name)}</span>
        <span class="meta">${esc(meta)}${ovTag}</span>
        ${desc?`<span class="kws">${esc(desc.keywords||'')}</span>`:''}
      </div>`;
    }
    html += `</div>`;
  }
  if(!any && !p.isEmpty) html += `<p class="empty">此宫无星</p>`;

  if(p.selfSihua && p.selfSihua.length){
    html += `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line2)">
      <div style="font-size:10.5px;color:var(--ink3);letter-spacing:1px;margin-bottom:5px">宫干自化</div>
      <div class="starlist">${p.selfSihua.map(x=>`<div class="sitem"><span class="n">${esc(x.starName)}</span><span class="meta">自化${esc(x.siHua)}</span></div>`).join('')}</div>
    </div>`;
  }

  // 命宫摘要
  if(branch === c.mingGongBranch){
    const sum = ZW.getMingGongSummary(c);
    if(sum && sum.keywords && sum.keywords.length){
      html += `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line2)">
        <div style="font-size:10.5px;color:var(--ink3);letter-spacing:1px;margin-bottom:5px">命宫气象</div>
        <div class="kws" style="font-size:12px;color:var(--ink2)">${esc(sum.keywords.join(' · '))}${sum.nature?`<div style="color:var(--ink3);font-size:11.5px;margin-top:3px">${esc(sum.nature)}</div>`:''}</div>
      </div>`;
    }
  }

  card.innerHTML = html;
}

function renderPatterns(c){
  const card = $('#pattern-card');
  let pats = [];
  try{ pats = ZW.detectPatterns(c) || []; }catch(e){ pats = []; }

  if(!pats.length){ card.innerHTML = `<h3>格局 <small>未识别到成格</small></h3><p class="empty">此盘未见规则库内成形的经典格局</p>`; return; }

  const order = { excellent:0, good:1, neutral:2, caution:3 };
  pats.sort((a,b)=>(order[a.level]??9)-(order[b.level]??9));

  card.innerHTML = `<h3>格局 <small>命中 ${pats.length} 项</small></h3>
    ${pats.slice(0,12).map(pt=>`
      <div class="pat ${pt.level}">
        <span class="nm">${esc(pt.name)}</span>
        <span class="ds">${esc(pt.description||'')}${pt.source?`<span class="src">— ${esc(pt.source)}</span>`:''}</span>
      </div>`).join('')}
    ${pats.length>12?`<p class="empty">另有 ${pats.length-12} 项未列出</p>`:''}`;
}

/* ───────── 相邻时辰对照 ───────── */
let cmpCache = null;
const p2 = n => String(n).padStart(2, '0');

/* 时辰 h 覆盖的钟点区间：从 2h-1 到 2h+1 */
function clockRange(h){
  return `${p2((2*h - 1 + 24) % 24)}–${p2((2*h + 1) % 24)} 时`;
}

function briefOf(ch){
  if(!ch) return null;
  const mb = ch.mingGongBranch;
  const gp = b => ch.palaces.find(x => x.branch === b);
  const fmt = b => {
    const p = gp(b);
    const arr = p ? p.stars.filter(s => s.type === 'major') : [];
    if(arr.length) return arr.map(s => s.name + (s.brightnessRaw ? `(${s.brightnessRaw})` : '')).join('·');
    return p && p.borrowedStars && p.borrowedStars.length ? `借${p.borrowedStars.join('·')}` : '空宫';
  };
  let pats = { n:0, top:'' };
  try{
    const ps = ZW.detectPatterns(ch) || [];
    pats = { n: ps.length, top: ps.slice(0,2).map(x => x.name).join('、') };
  }catch(e){ /* 格局识别失败不影响对照 */ }
  const ming = gp(mb);
  return {
    hour: ch.__hourBranch,
    ming: BR[mb] + '宫' + (ming ? '（' + ST[ming.stem] + '）' : ''),
    mingStars: fmt(mb),
    cai: fmt((mb - 4 + 12) % 12),
    guan: fmt((mb - 8 + 12) % 12),
    qian: fmt((mb - 6 + 12) % 12),
    shen: BR[ch.shenGongBranch] + '宫',
    ju: ch.wuxingJuName || '—',
    zhu: `${ch.mingZhu || '—'} · ${ch.shenZhu || '—'}`,
    pats,
  };
}

/* 上一时辰 / 下一时辰：子时往前是前一日的亥时，亥时往后是次日的子时 */
function buildCompare(){
  const c = state.chart;
  if(!c) return null;
  const bi = c.birthInfo;
  const h = c.__hourBranch;

  const mk = (hh, shift) => {
    const d = addDays(bi.year, bi.month, bi.day, shift);
    try{
      const ch = ZW.generateChart({ year:d.y, month:d.m, day:d.d, hour:hh, gender:bi.gender });
      ch.__hourBranch = hh;
      return { chart:ch, y:d.y, m:d.m, d:d.d, hour:hh };
    }catch(e){ return null; }
  };

  return {
    prev: mk((h + 11) % 12, h === 0 ? -1 : 0),
    cur:  { chart:c, y:bi.year, m:bi.month, d:bi.day, hour:h },
    next: mk((h + 1) % 12, h === 11 ? 1 : 0),
  };
}

function renderCompare(){
  const box = $('#cmp');
  if(!state.cmpOpen || !state.chart){ box.hidden = true; return; }

  const cmp = buildCompare();
  if(!cmp){ box.hidden = true; return; }
  cmpCache = cmp;
  box.hidden = false;

  const cols = [cmp.prev, cmp.cur, cmp.next];
  const briefs = cols.map(x => x ? briefOf(x.chart) : null);

  const sameMing = new Set(briefs.filter(Boolean).map(b => b.mingStars)).size === 1;
  const seq = briefs.filter(Boolean).map(b => `${BR[b.hour]}时「${b.mingStars}」`).join(' → ');
  const summary = sameMing
    ? `三个时辰的命宫主星相同，差异只在辅星、宫位与格局。说明这条时辰边界对<b>命局骨架影响不大</b>，可再比对下方"命宫"与"格局"两行定夺。`
    : `三个盘命宫主星依次为：${seq}。命宫主星一变，性格与一生格局的判断随之改变——<b>这一项需要你先确认</b>，其余各项可作辅助。`;

  const rows = [
    ['命宫',     b => b.ming],
    ['命宫主星', b => b.mingStars],
    ['财帛主星', b => b.cai],
    ['官禄主星', b => b.guan],
    ['迁移主星', b => b.qian],
    ['身宫',     b => b.shen],
    ['五行局',   b => b.ju],
    ['命主·身主', b => b.zhu],
    ['格局',     b => b.pats.n ? `${b.pats.n} 项${b.pats.top ? ' · ' + b.pats.top : ''}` : '无'],
  ];

  const isDiff = fn => {
    const vals = briefs.map(b => b ? String(fn(b)) : null).filter(v => v !== null);
    return vals.length > 1 && new Set(vals).size > 1;
  };

  let grid = `<div class="cmp-grid">
    <div class="cmp-c lb">时辰</div>
    ${cols.map((col,i) => col
      ? `<div class="cmp-c hd ${i === 1 ? 'cur' : ''}">${BR[col.hour]}时${i === 1 ? '<span class="tag">本盘</span>' : ''}
           <span class="rng">${clockRange(col.hour)} · ${col.y}-${p2(col.m)}-${p2(col.d)}</span></div>`
      : `<div class="cmp-c hd">—</div>`).join('')}
  `;

  for(const [label, fn] of rows){
    const d = isDiff(fn);
    const key = label === '命宫主星';
    const dot = d ? `<span class="dot${key ? ' hot' : ''}"></span>` : '';
    grid += `<div class="cmp-c lb${key ? ' key' : ''}">${label}${dot}</div>`;
    for(let i = 0; i < 3; i++){
      const b = briefs[i];
      const cls = ['cmp-c', key ? 'key' : '', i === 1 ? 'cur' : '', (d && i !== 1 && !key) ? 'df' : ''].filter(Boolean).join(' ');
      grid += `<div class="${cls}">${b ? esc(String(fn(b))) : '—'}</div>`;
    }
  }

  grid += `<div class="cmp-c lb">以此排盘</div>`;
  for(let i = 0; i < 3; i++){
    const col = cols[i];
    if(i === 1){
      grid += `<div class="cmp-c cur"><span style="color:var(--ink3);font-size:11.5px">当前所用</span></div>`;
    } else if(!col){
      grid += `<div class="cmp-c">—</div>`;
    } else {
      grid += `<div class="cmp-c"><button class="btn btn-ghost btn-sm act" data-cmp="${i}">按${BR[col.hour]}时起盘</button></div>`;
    }
  }
  grid += `</div>`;

  box.innerHTML = `
    <div class="cmp-head">
      <span class="cmp-t">相邻时辰对照</span>
      <button class="cmp-x" id="cmp-close" title="关闭">✕</button>
    </div>
    <p class="cmp-sum">${summary}</p>
    ${grid}
    <p class="cmp-note">
      标「变」的行表示三个盘在这一项上不同。子时往前是前一日的亥时、亥时往后是次日的子时，跨日已自动处理。
      「以此排盘」会关闭出生地的真太阳时校正，直接以该时辰起盘。
    </p>`;
}

function applyCol(col){
  if(!col) return;
  setDate(col.y, col.m, col.d);
  $('#f-time').value = `${p2((2 * col.hour) % 24)}:00`;
  // 直接以该时辰起盘，故关闭经度校正
  $('#f-prov').value = '';
  $('#f-city').innerHTML = '<option value="">（先选省份）</option>';
  $('#f-city').disabled = true;

  buildChart();
  if(state.chart){
    state.chart.__notes = (state.chart.__notes || []).concat(
      [`已按 ${BR[col.hour]}时直接起盘（钟表 ${p2((2 * col.hour) % 24)}:00 为该时辰中点），出生地真太阳时校正已关闭`]
    );
    render();
  }
}

/* ───────── 表单交互 ───────── */
function daysInMonth(y, m){
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function readDate(){
  const y = parseInt($('#f-y').value, 10);
  const m = parseInt($('#f-m').value, 10);
  const d = parseInt($('#f-d').value, 10);
  if(!y || !m || !d) return { err:'请把年、月、日都填上' };
  if(y < 1900 || y > 2030) return { err:'年份请在 1900–2030 之间' };
  if(m < 1 || m > 12) return { err:'月份请在 1–12 之间' };
  const max = daysInMonth(y, m);
  if(d < 1 || d > max) return { err:`${y} 年 ${m} 月只有 ${max} 天，请改一下日` };
  return { y, m, d };
}

function setDate(y, m, d){
  $('#f-y').value = y;
  $('#f-m').value = m;
  $('#f-d').value = d;
  syncDayMax();
}

function syncDayMax(){
  const y = parseInt($('#f-y').value, 10) || 2000;
  const m = parseInt($('#f-m').value, 10) || 1;
  const max = daysInMonth(y, m);
  const el = $('#f-d');
  el.max = max;
  if(parseInt(el.value, 10) > max) el.value = max;
}

function initForm(){
  // 默认日期 1990-01-01
  setDate(1990, 1, 1);

  $('#f-gender').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    $('#f-gender').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
  });

  // 省份
  const prov = $('#f-prov'), city = $('#f-city');
  for(const p of ZW.PROVINCES){
    const o = document.createElement('option');
    o.value = p.name; o.textContent = p.name;
    prov.appendChild(o);
  }
  prov.addEventListener('change', ()=>{
    city.innerHTML = '';
    const p = ZW.PROVINCES.find(x=>x.name===prov.value);
    if(!p){ city.disabled = true; city.innerHTML = '<option value="">（先选省份）</option>'; return; }
    city.disabled = false;
    for(const ci of p.cities){
      const o = document.createElement('option');
      o.value = ci.name; o.textContent = ci.name;
      o.dataset.lon = ci.longitude;
      city.appendChild(o);
    }
  });

  ['#f-y','#f-m','#f-d'].forEach(sel => {
    const el = $(sel);
    if(el) el.addEventListener('input', () => { if(sel !== '#f-d') syncDayMax(); });
  });

  $('#f-go').addEventListener('click', buildChart);
  $('#f-demo').addEventListener('click', ()=>{
    setDate(1990, 1, 1);
    $('#f-time').value = '00:30';
    $('#f-gender').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.g==='male'));
    $('#f-prov').value = ''; $('#f-city').innerHTML='<option value="">（先选省份）</option>'; $('#f-city').disabled = true;
    buildChart();
  });

  $('#btn-copy-chart').addEventListener('click', openCopySheet);
  $('#copy-close').addEventListener('click', closeCopySheet);
  $('#copy-do').addEventListener('click', doCopy);
  $('#copy-sheet').addEventListener('click', e => { if(e.target.id === 'copy-sheet') closeCopySheet(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && !$('#copy-sheet').hidden) closeCopySheet();
  });

  $('#btn-restart').addEventListener('click', ()=>{
    $('#form-panel').hidden = false;
    $('#chart-panel').hidden = true;
    state.chart = null;
  });

  // 相邻时辰对照
  $('#btn-cmp').addEventListener('click', ()=>{
    state.cmpOpen = !state.cmpOpen;
    $('#btn-cmp').classList.toggle('on', state.cmpOpen);
    renderCompare();
  });

  $('#cmp').addEventListener('click', e=>{
    if(e.target.closest('#cmp-close')){
      state.cmpOpen = false;
      $('#btn-cmp').classList.remove('on');
      renderCompare();
      return;
    }
    const btn = e.target.closest('[data-cmp]');
    if(btn && cmpCache){
      const idx = parseInt(btn.dataset.cmp, 10);
      applyCol(idx === 0 ? cmpCache.prev : cmpCache.next);
    }
  });

  // 视角切换
  $('#view-seg').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    state.view = b.dataset.v;
    $('#view-seg').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
    syncViewCfg();
    if(state.view === 'liunian'){
      const yb = ZW.getYearBranchIndex(state.lnYear);
      state.selBranch = yb;
    } else if(state.view === 'daxian'){
      const dx = state.chart.daXians[state.dxIndex];
      if(dx) state.selBranch = dx.palaceBranch;
    } else {
      state.selBranch = state.chart.mingGongBranch;
    }
    render();
  });

  $('#dx-prev').addEventListener('click', ()=>{
    if(state.dxIndex>0) state.dxIndex--;
    const dx = state.chart.daXians[state.dxIndex];
    if(dx) state.selBranch = dx.palaceBranch;
    render();
  });
  $('#dx-next').addEventListener('click', ()=>{
    if(state.dxIndex < state.chart.daXians.length-1) state.dxIndex++;
    const dx = state.chart.daXians[state.dxIndex];
    if(dx) state.selBranch = dx.palaceBranch;
    render();
  });
  $('#ln-year').addEventListener('change', e=>{
    state.lnYear = parseInt(e.target.value,10);
    state.selBranch = ZW.getYearBranchIndex(state.lnYear);
    render();
  });
}

/* ───────── 星盘文字导出 ───────── */
function chartToText(){
  const c = state.chart;
  if(!c) return '';
  const bi = c.birthInfo, li = c.lunarInfo || {}, orig = c.__origDate || {};
  const p2 = n => String(n).padStart(2, '0');
  const L = [];

  const solar = `${orig.y || bi.year}-${p2(orig.m || bi.month)}-${p2(orig.d || bi.day)}`
    + ` ${p2(orig.ch ?? 0)}:${p2(orig.cm ?? 0)}`;
  const lunar = li.lunarYear
    ? `${li.lunarYear} 年${li.isLeapMonth ? '闰' : ''}${Math.abs(li.lunarMonth)} 月 ${li.lunarDay} 日`
    : '—';
  const shenP = c.palaces.find(x => x.branch === c.shenGongBranch);
  const corrected = (c.__notes || []).some(n => n.indexOf('真太阳时') >= 0);

  L.push('紫微斗数星盘');
  L.push('（排盘口径：主流《全书》派，农历年换年；'
    + (corrected ? '已按出生地做真太阳时校正' : '未做真太阳时校正') + '）');
  L.push('');
  L.push('【基本资料】');
  L.push(`性别：${bi.gender === 'male' ? '男' : '女'}　阴阳：${c.yinYangGender || '—'}`);
  L.push(`阳历：${solar}（${BR[c.__hourBranch]}时）`);
  L.push(`农历：${lunar}`);
  if (li.fourPillars) L.push(`四柱：${li.fourPillars.join(' ')}`);
  L.push(`五行局：${c.wuxingJuName || '—'}　命主：${c.mingZhu || '—'}　身主：${c.shenZhu || '—'}`);
  L.push(`命宫：${BR[c.mingGongBranch]}宫　身宫：${BR[c.shenGongBranch]}宫`
    + (shenP ? `（本命${shenP.name}宫）` : ''));
  L.push('');

  L.push('【十二宫】按宫序排列；括号内为地支、宫干与该宫所辖大限岁数；星曜后小括号为亮度，方括号为生年四化');
  const ORDER_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];
  for (const nm of ORDER_NAMES) {
    const p = c.palaces.find(x => x.name === nm);
    if (!p) continue;
    const stars = p.stars.map(x => {
      let t = x.name;
      if (x.brightnessRaw) t += `(${x.brightnessRaw})`;
      if (x.siHua) t += `[${x.siHua}]`;
      return t;
    }).join(' ');
    const head = `${nm}（${BR[p.branch]}·${ST[p.stem]}干`
      + (p.daXianAge ? `｜${p.daXianAge[0]}-${p.daXianAge[1]}岁` : '') + '）';
    let body = stars || '无主星';
    if (p.isEmpty && p.borrowedStars && p.borrowedStars.length) {
      body += `　空宫，借对宫${p.borrowedFromName || ''}：${p.borrowedStars.join('、')}`;
    }
    L.push(`${head}：${body}`);
  }
  L.push('');

  L.push('【生年四化】');
  for (const h of ['禄','权','科','忌']) {
    let done = false;
    for (const p of c.palaces) {
      const x = p.stars.find(y => y.siHua === h);
      if (x) { L.push(`化${h}：${x.name} → ${p.name}宫`); done = true; break; }
    }
    if (!done) L.push(`化${h}：—`);
  }
  L.push('');

  L.push('【大限】');
  c.daXians.forEach((dx, i) => {
    const sy = ZW.getDaXianStartYear(c, i);
    L.push(`第 ${i + 1} 限　${dx.startAge}–${dx.endAge} 岁`
      + (sy ? `（${sy}–${sy + dx.endAge - dx.startAge}）` : '')
      + `：${dx.palaceName === '命宫' ? '命宫' : dx.palaceName + '宫'}（${BR[dx.palaceBranch]}）`);
  });
  L.push('');

  let pats = [];
  try { pats = ZW.detectPatterns(c) || []; } catch (e) { /* 格局失败不影响导出 */ }
  if (pats.length) {
    L.push('【格局】');
    L.push(pats.slice(0, 8).map(x => x.name).join('、'));
    L.push('');
  }

  L.push('【解盘要求】');
  L.push('1. 请按紫微斗数主流体系解读：先看生年四化落宫与命宫三方四正（财帛、官禄、迁移），再逐宫展开。');
  L.push('2. 每宫要说明星曜组合在现实中呈现什么倾向，不要只堆术语。');
  L.push('3. 区分本命、大限、流年三个层次，不要混为一谈。');
  L.push('4. 不下吉凶定论，不写医疗、投资、婚配等具体建议。');
  return L.join('\n');
}

function openCopySheet(){
  if(!state.chart) return;
  const ta = $('#copy-area');
  ta.value = chartToText();
  $('#copy-msg').textContent = '';
  $('#copy-msg').className = '';
  $('#copy-sheet').hidden = false;
  ta.scrollTop = 0;
  ta.focus();
}

function closeCopySheet(){
  $('#copy-sheet').hidden = true;
}

/** file:// 下 navigator.clipboard 不可用，回退到 execCommand */
async function doCopy(){
  const ta = $('#copy-area');
  const msg = $('#copy-msg');
  const text = ta.value;
  let ok = false;
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  }catch(e){ ok = false; }
  if(!ok){
    try{
      ta.removeAttribute('readonly');
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy');
    }catch(e){ ok = false; }
    ta.setAttribute('readonly', 'readonly');
  }
  msg.textContent = ok ? '已复制到剪贴板' : '浏览器拦住了自动复制，请手动全选（⌘A）后复制';
  msg.className = ok ? 'ok' : 'bad';
}

/* ───────── 详细解读 ───────── */
const HUA_CLS = { '禄':'lu', '权':'quan', '科':'ke', '忌':'ji' };

/* ───────── AI 评语 ─────────
   默认走免 key 的公益接口（OpenAI 兼容格式），受「每 IP 每 30 秒 1 次」限制；
   可在设置里填任意 OpenAI 兼容接口 + 自己的 key（如 Gemini / Groq 免费额度）绕开限流。
   所有结果按命盘签名缓存在 localStorage，同盘不重复消耗额度。 */
const AI_CFG_KEY = 'zwds_ai_cfg_v1';
const AI_CACHE = 'zwds_ai_cache_v1_';
const AI_LAST = 'zwds_ai_last_v1';
const AI_FREE_URL = 'https://text.pollinations.ai/openai';

/** localStorage 在沙箱 iframe / 隐私模式下访问即抛异常，统一包一层，失败降级为内存 */
const LS = (() => {
  let mem = {};
  const ok = () => { try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; } catch(e){ return false; } };
  const usable = ok();
  return {
    get(k){ if(usable){ try { return localStorage.getItem(k); } catch(e){} } return (k in mem) ? mem[k] : null; },
    set(k,v){ if(usable){ try { localStorage.setItem(k,v); return; } catch(e){} } mem[k] = String(v); },
    del(k){ if(usable){ try { localStorage.removeItem(k); } catch(e){} } delete mem[k]; },
  };
})();
// 命中即删除该句：AI 容易越界给医疗 / 投资建议
const AI_BANNED = ['体检','就医','手术','服药','吃药','医院','诊疗','住院','投资','理财',
                   '炒股','股票','基金','买房','购房','贷款'];

function aiCfg(){
  try{ return JSON.parse(LS.get(AI_CFG_KEY) || '{}') || {}; }catch(e){ return {}; }
}
function aiIsCustom(){ const c = aiCfg(); return !!(c.baseUrl && c.apiKey); }

/** 当前解读视角的命宫地支 */
function frameMingBranch(){
  const c = state.chart; if(!c) return 0;
  const m = state.readMode || 'mingpan';
  if(m === 'daxian'){
    const dx = c.daXians[state.dxIndex];
    return dx ? dx.palaceBranch : c.mingGongBranch;
  }
  if(m === 'liunian') return ZW.getYearBranchIndex(state.lnYear);
  return c.mingGongBranch;
}

function aiSig(){
  const c = state.chart; if(!c) return '';
  const b = c.birthInfo;
  return `${b.year}-${b.month}-${b.day}-${c.__hourBranch}-${b.gender}-${state.readMode||'mingpan'}`;
}
function aiCacheGet(sig){
  try{ const r = LS.get(AI_CACHE + sig); return r ? JSON.parse(r) : null; }catch(e){ return null; }
}
function aiCacheSet(sig, map){
  LS.set(AI_CACHE + sig, JSON.stringify(map));
}
function aiCoolLeft(){
  if(aiIsCustom()) return 0;
  const last = parseInt(LS.get(AI_LAST) || '0', 10);
  return Math.max(0, 31000 - (Date.now() - last));
}

/** 把命盘压成紧凑文本喂给模型 */
function aiPrompt(chart){
  const b = chart.birthInfo;
  const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const mingStars = ming ? (ming.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫') : '';
  const mode = state.readMode || 'mingpan';
  const frameLine = mode === 'daxian'
    ? `本批按「大限」视角解读：以${BR[frameMingBranch()]}宫为大限命宫，十二宫名按大限重排，兼顾本命宫位。\n`
    : mode === 'liunian'
      ? `本批按「流年」视角解读：以${BR[frameMingBranch()]}宫为流年命宫，十二宫名按流年重排，兼顾本命宫位。\n`
      : '';
  const head = `命盘：${b.gender === 'male' ? '男' : '女'}，${b.year}年${b.month}月${b.day}日${BR[chart.__hourBranch]}时，`
    + `命宫在${BR[chart.mingGongBranch]}，${chart.wuxingJuName || ''}，${mingStars}坐命。（括号内为亮度，[ ]为生年四化）\n`
    + frameLine;

  const lines = chart.palaces.map(p => {
    const hasMajor = p.stars.some(s => s.type === 'major');
    const all = p.stars.map(s => {
      let t = s.name;
      if(s.brightnessRaw) t += `(${s.brightnessRaw})`;
      if(s.siHua) t += `[${s.siHua}]`;
      return t;
    }).join('、');
    let body;
    if(!hasMajor){
      const borrow = p.borrowedStars && p.borrowedStars.length ? `借对宫${p.borrowedStars.join('、')}` : '';
      const rest = p.stars.map(s => s.name).join('、');
      body = `空宫${borrow ? '，' + borrow : ''}${rest ? '；另有' + rest : ''}`;
    } else {
      body = all;
    }
    return `${p.name}(${BR[p.branch]})：${body}`;
  }).join('\n');

  return head + lines + `

请为上面十二宫各写一段评语：
1. 每宫 55-85 字，一段，不分点。
2. 必须点到这一宫最要紧的一两颗星（可以写星名），但不要罗列全部星曜。
3. 必须给出只有这张盘才成立的具体判断。严禁万能句，例如「注意休息」「保持积极心态」「善于协调」「偶尔有小摩擦」「身体状况一般」这类换谁都成立的空话。
4. 用日常口语，句子短，不堆四字成语，不要排比。
5. 只能使用上面给出的星曜，禁止引入木星、土星、星座、生肖、八字等紫微斗数以外的体系。
6. 不下吉凶定论，禁止出现体检、就医、手术、投资、理财、买房等建议性字眼。
7. 十二宫齐全：命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、仆役、官禄、田宅、福德、父母。

只输出一个 JSON 对象，键为宫名，值为评语正文。`;
}

async function aiCall(prompt){
  const cfg = aiCfg();
  const custom = !!(cfg.baseUrl && cfg.apiKey);
  const url = custom ? cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions' : AI_FREE_URL;
  const body = {
    model: custom ? (cfg.model || 'gpt-4o-mini') : 'openai',
    messages: [
      { role:'system', content:'你是紫微斗数解读者，用日常口语说人话。只输出 JSON 对象，不要代码块、不要解释。' },
      { role:'user', content: prompt },
    ],
    max_tokens: 2400,
    temperature: 0.55,
  };
  if(!custom) body.reasoning_effort = 'low';   // 不降推理强度会耗尽输出额度

  const headers = { 'Content-Type': 'application/json' };
  if(custom) headers['Authorization'] = 'Bearer ' + cfg.apiKey;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try{
    const r = await fetch(url, { method:'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    const txt = await r.text();
    if(!r.ok){
      let code = '';
      try{ const j = JSON.parse(txt); code = (j.error && (j.error.code || j.error.message)) || j.code || ''; }catch(e){}
      if(r.status === 402 || /FREE_LIMIT/.test(String(code))) throw new Error('免费接口限流（每 30 秒 1 次），稍后再试');
      if(r.status === 400 && /token/i.test(String(code) + txt)) throw new Error('模型输出额度不足，请重试');
      if(r.status === 503) throw new Error('接口繁忙，稍后再试');
      if(r.status === 401 || r.status === 403) throw new Error('接口拒绝访问，请检查设置里的 Key');
      throw new Error('接口返回 ' + r.status);
    }
    let j;
    try{ j = JSON.parse(txt); }catch(e){ throw new Error('接口返回的不是 JSON'); }
    const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if(!content) throw new Error('模型未返回内容');
    return content;
  } catch(e){
    if(e.name === 'AbortError') throw new Error('请求超时（120 秒）');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 解析 JSON，容忍 markdown 围栏与前后废话 */
function aiParse(content){
  const s = String(content).replace(/```(?:json)?/gi, '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  if(!m) throw new Error('模型未按格式返回');
  const o = JSON.parse(m[0]);
  const out = {};
  for(const k of Object.keys(o)){
    if(typeof o[k] === 'string' && o[k].trim()) out[k.trim()] = o[k].trim();
  }
  if(!Object.keys(out).length) throw new Error('模型未给出可用评语');
  return out;
}

/** 删掉含越界建议的句子 */
function aiFilter(text){
  const parts = text.split(/(?<=。)/).filter(Boolean);
  const kept = parts.filter(x => !AI_BANNED.some(w => x.includes(w)));
  return { text: kept.join('').trim(), flagged: kept.length !== parts.length };
}

let aiTicker = null;
function aiStartTicker(){
  if(aiTicker) return;
  aiTicker = setInterval(() => {
    if(aiCoolLeft() <= 0 || $('#view-reading').hidden){ clearInterval(aiTicker); aiTicker = null; renderReading(); return; }
    const btn = $('#ai-go'), st = $('#ai-st');
    if(st) st.textContent = `免费接口限流，还需等 ${Math.ceil(aiCoolLeft()/1000)} 秒`;
    if(btn) btn.disabled = true;
  }, 1000);
}

async function aiGenerate(){
  if(!state.chart) return;

  if(!aiIsCustom() && aiCoolLeft() > 0){
    state.ai = { status:'error', map:state.ai.map, err:`免费接口限流，还需等 ${Math.ceil(aiCoolLeft()/1000)} 秒`, flagged:0 };
    renderReading(); aiStartTicker(); return;
  }

  const sig = aiSig();
  state.ai = { status:'loading', map:{}, err:'', flagged:0, sig };
  renderReading();

  try{
    const content = await aiCall(aiPrompt(state.chart));
    if(!aiIsCustom()) LS.set(AI_LAST, String(Date.now()));
    const raw = aiParse(content);

    const map = {}; let flagged = 0;
    for(const [k, v] of Object.entries(raw)){
      const f = aiFilter(v);
      if(f.flagged) flagged++;
      if(f.text) map[k] = f.text;
    }
    if(!Object.keys(map).length) throw new Error('模型给出的内容均含越界建议，已全部省略');

    state.ai = { status:'done', map, err:'', flagged };
    aiCacheSet(sig, map);
  } catch(e){
    state.ai = { status:'error', map:{}, err:(e && e.message) || '生成失败', flagged:0 };
    if(!aiIsCustom()) aiStartTicker();
  }
  renderReading();
}

function aiCfgHtml(){
  const c = aiCfg();
  return `<div class="ai-cfg">
    <input id="ai-base" placeholder="接口地址，如 https://generativelanguage.googleapis.com/v1beta/openai" value="${esc(c.baseUrl||'')}">
    <input id="ai-key" placeholder="API Key（只存本机浏览器）" value="${esc(c.apiKey||'')}">
    <input id="ai-model" placeholder="模型名，如 gemini-2.0-flash" value="${esc(c.model||'')}">
    <button class="ai-btn" id="ai-save">保存</button>
    <p class="tip">留空三项即使用免 key 公益接口（每 30 秒只能请求 1 次）。填入任意 OpenAI 兼容接口可绕开该限制；Key 只保存在本机 localStorage，不会上传到别处。</p>
  </div>`;
}

function aiBarHtml(){
  const st = state.ai;
  const cool = aiCoolLeft();
  const loading = st.status === 'loading';
  const label = loading ? '生成中…'
    : cool > 0 ? `冷却 ${Math.ceil(cool/1000)}s`
    : (st.status === 'done' || st.status === 'cached') ? '重新生成'
    : '生成 AI 评语';

  let status;
  if(loading) status = '正在请求模型，约 10–40 秒…';
  else if(st.status === 'error') status = st.err;
  else if(st.status === 'done') status = `已生成 ${Object.keys(st.map).length} 宫` + (st.flagged ? ` · ${st.flagged} 宫含越界建议，已删句` : '');
  else if(st.status === 'cached') status = `本机缓存已载入 ${Object.keys(st.map).length} 宫`;
  else status = aiIsCustom() ? '使用你配置的接口' : '第三方免费模型 · 需联网';

  return `<div class="ai-bar">
    <button class="ai-btn" id="ai-go" ${(loading || cool > 0) ? 'disabled' : ''}>${esc(label)}</button>
    <span class="ai-st ${st.status === 'error' ? 'err' : ''}" id="ai-st">${esc(status)}</span>
    <button class="ai-gear" id="ai-gear" title="接口设置">⚙</button>
  </div>
  ${state.aiCfgOpen ? aiCfgHtml() : ''}
  <p class="ai-disc">AI 评语由第三方免费模型即时生成，未经人工校对，可能有误，<b>也可能与上方本地解读不一致</b>——两者取径不同，本地解读按星性逐条推，AI 是把整宫串起来说。仅供参考，不构成任何建议。点击生成会把命盘信息（不含姓名）发送到该接口。</p>`;
}

function viewBarHtml(mode, c){
  let cfg = '';
  if(mode === 'daxian'){
    const dx = c.daXians[state.dxIndex];
    const sy = ZW.getDaXianStartYear(c, state.dxIndex);
    cfg = `<div class="cfg">
      <button class="mini" id="rd-dxprev" ${state.dxIndex<=0?'disabled':''}>‹</button>
      <span class="pill">${dx ? `第 ${state.dxIndex+1} 大限 · ${dx.startAge}–${dx.endAge} 岁${sy?` · ${sy}–${sy+dx.endAge-dx.startAge}`:''} · ${esc(dx.palaceName)}` : '—'}</span>
      <button class="mini" id="rd-dxnext" ${state.dxIndex>=c.daXians.length-1?'disabled':''}>›</button>
    </div>`;
  } else if(mode === 'liunian'){
    const yb = ZW.getYearBranchIndex(state.lnYear);
    const birthY = c.birthInfo.year;
    const from = Math.min(birthY, state.lnYear);
    let opts = '';
    for(let y = from; y <= birthY + 110; y++){
      opts += `<option value="${y}" ${y===state.lnYear?'selected':''}>${y}</option>`;
    }
    cfg = `<div class="cfg"><span>流年</span><select id="rd-lnyear">${opts}</select>
      <span class="pill">${esc(ZW.getLiuNianSiHua(state.lnYear).stemName)}${BR[yb]}年 · 命宫在${BR[yb]}</span></div>`;
  }
  return `<div class="rd-viewbar">
    <div class="seg" id="rd-seg">
      <button data-m="mingpan" class="${mode==='mingpan'?'on':''}">本命</button>
      <button data-m="daxian" class="${mode==='daxian'?'on':''}">大限</button>
      <button data-m="liunian" class="${mode==='liunian'?'on':''}">流年</button>
    </div>
    ${cfg}
  </div>`;
}

function renderReading(){
  try{ renderReadingInner(); }
  catch(e){
    const box = $('#reading-body');
    if(box) box.innerHTML = `<div class="rd-empty"><p>解读渲染出错：${esc(String(e && e.message || e))}</p>
      <button class="btn btn-ghost" onclick="location.reload()">刷新重试</button></div>`;
  }
}

function renderReadingInner(){
  const box = $('#reading-body');
  const c = state.chart;

  if(!c){
    box.innerHTML = `<div class="rd-empty">
      <p>还没有命盘 —— 先到「排盘」填一份阳历生辰。</p>
      <button class="btn btn-primary" id="rd-goto">去排盘</button>
    </div>`;
    const g = $('#rd-goto');
    if(g) g.addEventListener('click', ()=> document.querySelector('.tab[data-tab="chart"]').click());
    return;
  }

  // 首次进入该盘的解读页：优先读本机缓存，避免重复消耗接口额度
  if(state.ai.status === 'idle' && state.ai.sig !== aiSig()){
    state.ai.sig = aiSig();
    const cached = aiCacheGet(state.ai.sig);
    if(cached && Object.keys(cached).length){
      state.ai = { status:'cached', map:cached, err:'', flagged:0, sig:state.ai.sig };
    }
  }

  let pats = [];
  try{ pats = ZW.detectPatterns(c) || []; }catch(e){ /* 格局失败不影响其余解读 */ }

  const mode = state.readMode || 'mingpan';
  const rd = ZW.buildReading(c, {
    mode,
    daxianIndex: state.dxIndex,
    liunianYear: state.lnYear,
    patterns: pats,
  });

  const nav = [
    ['rd-lead','命局总览'], ['rd-palaces','十二宫详解'], ['rd-sihua','生年四化'],
    ['rd-base','命局基础'], ['rd-pattern','格局'], ['rd-limit','运限'],
  ];

  let html = `<div class="rd-nav">${nav.map(([id,label])=>`<button data-rd="${id}">${label}</button>`).join('')}</div>`;

  html += viewBarHtml(mode, c);

  html += `<section class="rd-sec" id="rd-lead">
    <div class="rd-h">命局总览<small>${esc(c.wuxingJuName||'')} · ${esc(c.yinYangGender||'')}</small></div>
    <div class="lead">
      <div class="lt">${esc(rd.overview.title)}</div>
      <div class="tags">${rd.overview.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
      ${rd.overview.highlights && rd.overview.highlights.length ? `<div class="hl-grid">
        ${rd.overview.highlights.map(h=>`<div class="hl"><span class="hl-l">${esc(h.label)}</span><span class="hl-v">${esc(h.value)}</span></div>`).join('')}
      </div>` : ''}
      ${rd.overview.paragraphs.map(t=>`<p>${esc(t)}</p>`).join('')}
      ${rd.niRules.length ? `<div class="ni-rules">
        <span class="ni-badge">倪师《天纪》· 批命总则</span>
        <ul>${rd.niRules.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      </div>` : ''}
    </div>
  </section>`;

  let aiBar = '';
  try{ aiBar = aiBarHtml(); }
  catch(e){ aiBar = `<div class="ai-bar"><span class="ai-st err">AI 模块不可用（${esc(String(e && e.message || e))}）</span></div>`; }

  html += `<section class="rd-sec" id="rd-palaces">
    <div class="rd-h">十二宫详解<small>宫职 → 主星 → 吉煞 → 四化</small></div>
    ${aiBar}
    <div class="pgrid">${rd.palaces.map(p=>{
      const aiTxt = state.ai.map && state.ai.map[p.name];
      return `
      <div class="pcard${p.name==='命宫'?' ming':''}">
        <div class="pcard-h">
          <span class="nm">${esc(p.name)}</span>
          <span class="pos">${BR[p.branch]}宫 · ${esc(p.stemName)}干${p.nativeName!==p.name?` · 本命${esc(p.nativeName)}`:''}</span>
          ${p.daXian?`<span class="dxm">${p.daXian[0]}–${p.daXian[1]} 岁</span>`:''}
        </div>
        <div class="hd">${esc(p.head)}</div>
        ${p.paragraphs.map(t=>`<p>${esc(t)}</p>`).join('')}
        ${p.ni?`<div class="ni-note"><span class="ni-badge">倪师《天纪》</span><p>${esc(p.ni)}</p></div>`:''}
        ${aiTxt?`<div class="ai-note"><span class="ai-badge">AI 生成</span><p>${esc(aiTxt)}</p></div>`:''}
      </div>`;}).join('')}</div>
  </section>`;

  if(rd.sihua.length){
    html += `<section class="rd-sec" id="rd-sihua">
      <div class="rd-h">生年四化<small>禄权科忌 —— 一生的四个着力点</small></div>
      <div class="sihua-grid">${rd.sihua.map(x=>`
        <div class="shc">
          <div class="big ${HUA_CLS[x.hua]||''}">${esc(x.hua)}</div>
          <div class="bd"><b>${esc(x.star)}化${esc(x.hua)}，落${esc(x.palace)}宫</b><br>${esc(x.text.split('。').slice(1).join('。').trim())}</div>
        </div>`).join('')}</div>
    </section>`;
  }

  html += `<section class="rd-sec" id="rd-base">
    <div class="rd-h">命局基础<small>五行局 · 命主 · 身主 · 阴阳行限</small></div>
    <div class="base-grid">
      ${(rd.basics || []).map(b=>`<div class="basec">
        <div class="basec-h">${esc(b.label)}</div>
        <p>${esc(b.text)}</p>
      </div>`).join('')}
    </div>
  </section>`;

  if(rd.patterns.length){
    const LV = { excellent:'上格', good:'佳格', neutral:'平格', caution:'需留意' };
    html += `<section class="rd-sec" id="rd-pattern">
      <div class="rd-h">格局<small>命中 ${rd.patterns.length} 项</small></div>
      <div class="lead">
        <p class="pat-intro">格局讲的是「一张盘的结构长什么样」——同样的星，摆在一起成不成形，决定的是层次，不是吉凶。
          成格的人，做事有现成的势可以借；不成格也不必慌，格局定的是骨架，路还是靠自己走。</p>
        ${rd.patterns.map(pt=>`
        <div class="pat ${pt.level}">
          <span class="nm">${esc(pt.name)}<span class="plv ${pt.level}">${LV[pt.level]||''}</span></span>
          <span class="ds">${esc(pt.description||'')}
            ${pt.palaces && pt.palaces.length?`<span class="pmeta">涉及宫位：${esc(pt.palaces.join('、'))}</span>`:''}
            ${pt.conditions && pt.conditions.required && pt.conditions.required.length?`<span class="pmeta">成立条件：${esc(pt.conditions.required.join('；'))}</span>`:''}
            ${pt.conditions && pt.conditions.breaking && pt.conditions.breaking.length?`<span class="pmeta">破格因素：${esc(pt.conditions.breaking.join('；'))}</span>`:''}
            ${pt.source?`<span class="src">— ${esc(pt.source)}</span>`:''}
          </span>
        </div>`).join('')}
      </div>
    </section>`;
  }

  let lim = '';
  if(rd.daxian) lim += `<div class="shc"><div class="bd"><b>大限 · ${esc(rd.daxian.label)}</b><br>${esc(rd.daxian.text)}</div></div>`;
  if(rd.liunian) lim += `<div class="shc"><div class="bd"><b>流年 · ${esc(rd.liunian.label)}</b><br>${esc(rd.liunian.text)}</div></div>`;
  if(lim){
    html += `<section class="rd-sec" id="rd-limit">
      <div class="rd-h">运限<small>跟随「排盘」页所选的大限与流年</small></div>
      <div class="sihua-grid">${lim}</div>
    </section>`;
  }

  box.innerHTML = html;

  box.querySelectorAll('.rd-nav button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const el = document.getElementById(b.dataset.rd);
      if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    });
  });

  // AI 评语交互
  const go = $('#ai-go');
  if(go) go.addEventListener('click', aiGenerate);

  const rdSeg = $('#rd-seg');
  if(rdSeg) rdSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(state.readMode === b.dataset.m) return;
    state.readMode = b.dataset.m;
    state.ai = { status:'idle', map:{}, err:'', flagged:0, sig:'' };
    renderReading();
  });

  const dxp = $('#rd-dxprev');
  if(dxp) dxp.addEventListener('click', () => {
    if(state.dxIndex > 0){ state.dxIndex--; state.ai = { status:'idle', map:{}, err:'', flagged:0, sig:'' }; renderReading(); }
  });
  const dxn = $('#rd-dxnext');
  if(dxn) dxn.addEventListener('click', () => {
    if(state.dxIndex < state.chart.daXians.length-1){ state.dxIndex++; state.ai = { status:'idle', map:{}, err:'', flagged:0, sig:'' }; renderReading(); }
  });
  const lnSel = $('#rd-lnyear');
  if(lnSel) lnSel.addEventListener('change', e => {
    state.lnYear = parseInt(e.target.value, 10);
    state.ai = { status:'idle', map:{}, err:'', flagged:0, sig:'' };
    renderReading();
  });

  const gear = $('#ai-gear');
  if(gear) gear.addEventListener('click', ()=>{
    state.aiCfgOpen = !state.aiCfgOpen;
    renderReading();
  });

  const save = $('#ai-save');
  if(save) save.addEventListener('click', ()=>{
    const base = ($('#ai-base').value || '').trim();
    const key  = ($('#ai-key').value || '').trim();
    const model= ($('#ai-model').value || '').trim();
    if(base && !key){ state.ai.err = '填了接口地址还要填 Key'; renderReading(); return; }
    try{
      if(base || key || model) LS.set(AI_CFG_KEY, JSON.stringify({baseUrl:base, apiKey:key, model}));
      else LS.del(AI_CFG_KEY);
    }catch(e){}
    state.aiCfgOpen = false;
    state.ai = { status:'idle', map:{}, err:'', flagged:0, sig:'' };
    renderReading();
  });
}

/* ───────── 标签页 ───────── */
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on', x===t));
    const isChart = t.dataset.tab === 'chart';
    $('#view-chart').hidden = !isChart;
    $('#view-reading').hidden = isChart;
    if(!isChart) renderReading();
  });
});

initForm();

// 默认停在出生表单；URL 带 ?demo 时直接起示例盘（便于预览核对）
if(location.search.indexOf('demo') >= 0){
  const btn = document.getElementById('f-demo');
  if(btn) btn.click();
}
})();
