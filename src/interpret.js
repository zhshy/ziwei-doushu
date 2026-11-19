/**
 * 四化层次与宫干飞化
 *
 * 排盘仍以引擎为准。这里只读命盘，按「先生年，再大限，再流年」整理叠加，
 * 并列出会改变判断的宫干飞化。格局不在这里起名。
 *
 * 白话版、专业版共用这一份判断，避免两套说法各讲各的。
 */
(function () {
  'use strict';

  var HUAS = ['禄', '权', '科', '忌'];
  var CORE = ['命宫', '官禄', '财帛', '夫妻', '迁移', '福德'];
  var DOMAIN = {
    命宫: '你自己', 兄弟: '同辈', 夫妻: '感情', 子女: '子女和创作',
    财帛: '钱', 疾厄: '身体', 迁移: '出门在外', 仆役: '朋友和下属',
    官禄: '事业', 田宅: '家和房子', 福德: '心情', 父母: '长辈'
  };

  function palaceLabel(name) {
    if (!name) return '';
    return name === '命宫' || /宫$/.test(name) ? name : name + '宫';
  }

  function domainOf(name) {
    return DOMAIN[name] || palaceLabel(name);
  }

  function starAt(chart, starName) {
    var palaces = chart.palaces || [];
    for (var i = 0; i < palaces.length; i++) {
      var stars = palaces[i].stars || [];
      for (var j = 0; j < stars.length; j++) {
        if (stars[j].name === starName) return palaces[i];
      }
    }
    return null;
  }

  function fromMap(map, layer) {
    var out = [];
    for (var i = 0; i < HUAS.length; i++) {
      var hua = HUAS[i];
      var star = map[hua];
      if (!star) continue;
      out.push({ layer: layer, hua: hua, star: star });
    }
    return out;
  }

  function locate(chart, items) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var pal = starAt(chart, items[i].star);
      if (!pal) continue;
      out.push({
        layer: items[i].layer,
        hua: items[i].hua,
        star: items[i].star,
        palace: pal.name,
        branch: pal.branch
      });
    }
    return out;
  }

  function natalList(chart) {
    var raw = [];
    var palaces = chart.palaces || [];
    for (var i = 0; i < palaces.length; i++) {
      var stars = palaces[i].stars || [];
      for (var j = 0; j < stars.length; j++) {
        if (stars[j].siHua) raw.push({ layer: 'natal', hua: stars[j].siHua, star: stars[j].name });
      }
    }
    return locate(chart, raw);
  }

  function lineOf(list) {
    var parts = [];
    for (var i = 0; i < HUAS.length; i++) {
      var hua = HUAS[i];
      var hit = null;
      for (var j = 0; j < list.length; j++) {
        if (list[j].hua === hua) { hit = list[j]; break; }
      }
      if (hit) parts.push('化' + hua + ' ' + hit.star + ' → ' + palaceLabel(hit.palace));
    }
    return parts.join('；');
  }

  function byStar(list) {
    var map = {};
    for (var i = 0; i < list.length; i++) map[list[i].star] = list[i];
    return map;
  }

  function byPalace(list) {
    var map = {};
    for (var i = 0; i < list.length; i++) {
      var key = list[i].palace;
      if (!map[key]) map[key] = {};
      map[key][list[i].hua] = list[i];
    }
    return map;
  }

  var PAIR = {
    '禄|禄': '双禄',
    '禄|忌': '禄忌交战',
    '忌|忌': '双忌',
    '忌|禄': '忌处逢禄',
    '权|权': '双权',
    '科|科': '双科'
  };

  function overlayCopy(title, whenPlain, whenPro, where, domain) {
    var plain = '';
    var pro = '';
    if (title === '双禄') {
      plain = whenPlain + '，「' + domain + '」天生就有底，这一段也顺，是能放开做的。';
      pro = whenPro + '双禄叠在' + where + '，资源更容易兑现，也容易舍不得放手。';
    } else if (title === '禄忌交战') {
      plain = whenPlain + '，「' + domain + '」先有甜头，后面要还。有得也有失，别把顺的时候当成会一直顺。';
      pro = whenPro + '禄忌交战，落在' + where + '。先得后失，或有得有失，不宜看成单向利好。';
    } else if (title === '双忌') {
      plain = whenPlain + '，「' + domain + '」先天就耗，这一段更耗。压力叠在一起，宜守，不宜同时开新战线。';
      pro = whenPro + '双忌叠在' + where + '。这是最在意、也最容易卡住的地方，宜先处理这一处。';
    } else if (title === '忌处逢禄') {
      plain = whenPlain + '，「' + domain + '」原来卡住的地方有了转机，但得自己去接，不会自动变顺。';
      pro = whenPro + '忌处逢禄，落在' + where + '。困境里有资源，转机要自己接。';
    } else if (title === '双权') {
      plain = whenPlain + '，「' + domain + '」要你出面做主，位置加重，也容易跟人抢。';
      pro = whenPro + '双权叠在' + where + '。主导权加重，也容易有争夺。';
    } else if (title === '双科') {
      plain = whenPlain + '，「' + domain + '」更容易被人看见、被信得过。';
      pro = whenPro + '双科叠在' + where + '。名声和信誉更显，也更在意别人怎么看。';
    }
    return { title: title, plain: plain, pro: pro };
  }

  function pairLayers(base, over, whenPlain, whenPro) {
    var out = [];
    var seen = {};
    var overStar = byStar(over);
    for (var i = 0; i < base.length; i++) {
      var a = base[i];
      var b = overStar[a.star];
      if (!b) continue;
      var key = a.hua + '|' + b.hua;
      var title = PAIR[key];
      if (!title) continue;
      var id = 'star:' + a.star + ':' + key + ':' + whenPro;
      if (seen[id]) continue;
      seen[id] = 1;
      seen['pal:' + a.palace + ':' + key + ':' + whenPro] = 1;
      out.push(overlayCopy(
        title, whenPlain, whenPro,
        a.star + '（' + palaceLabel(a.palace) + '）',
        domainOf(a.palace)
      ));
    }
    var gA = byPalace(base);
    var gB = byPalace(over);
    for (var palace in gA) {
      if (!gB[palace]) continue;
      for (var pk in PAIR) {
        var bits = pk.split('|');
        if (!gA[palace][bits[0]] || !gB[palace][bits[1]]) continue;
        var pid = 'pal:' + palace + ':' + pk + ':' + whenPro;
        if (seen[pid]) continue;
        seen[pid] = 1;
        var sa = gA[palace][bits[0]];
        var sb = gB[palace][bits[1]];
        out.push(overlayCopy(
          PAIR[pk], whenPlain, whenPro,
          palaceLabel(palace) + '（' + sa.star + '与' + sb.star + '）',
          domainOf(palace)
        ));
      }
    }
    return out;
  }

  function oneOf(list, hua) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].hua === hua) return list[i];
    }
    return null;
  }

  function isOpposite(chart, a, b) {
    if (!a || !b) return false;
    var palaces = chart.palaces || [];
    for (var i = 0; i < palaces.length; i++) {
      if (palaces[i].branch === a.branch) return palaces[i].oppositeBranch === b.branch;
    }
    return false;
  }

  function axisCopy(chart, list, whoPlain, whoPro) {
    var lu = oneOf(list, '禄');
    var ji = oneOf(list, '忌');
    if (!isOpposite(chart, lu, ji)) return null;
    return {
      plain: whoPlain + '，' + domainOf(lu.palace) + '顺的时候，' + domainOf(ji.palace) + '容易拧着，两边在对拉。别用一头的顺去补另一头。',
      pro: whoPro + '化禄在' + palaceLabel(lu.palace) + '、化忌在' + palaceLabel(ji.palace) + '，两宫相对，禄忌对冲：' +
        domainOf(lu.palace) + '和' + domainOf(ji.palace) + '互相拉扯。'
    };
  }

  function focusLines(natal, daxian, liunian) {
    var bag = {};
    function add(list, layer) {
      for (var i = 0; i < list.length; i++) {
        var name = list[i].palace;
        if (!bag[name]) bag[name] = {};
        bag[name][layer] = 1;
      }
    }
    add(natal, 'natal');
    add(daxian, 'daxian');
    add(liunian, 'liunian');
    var rows = [];
    for (var name in bag) {
      var n = 0;
      if (bag[name].natal) n++;
      if (bag[name].daxian) n++;
      if (bag[name].liunian) n++;
      if (n >= 2) rows.push({ name: name, n: n, bag: bag[name] });
    }
    rows.sort(function (a, b) { return b.n - a.n; });
    var out = [];
    for (var i = 0; i < rows.length && i < 2; i++) {
      var row = rows[i];
      var bits = [];
      if (row.bag.natal) bits.push('生年');
      if (row.bag.daxian) bits.push('大限');
      if (row.bag.liunian) bits.push('流年');
      var joined = bits.join('、');
      out.push({
        plain: '「' + domainOf(row.name) + '」这件事，' + (row.n === 3 ? '先天、这十年和今年都撞在一起' : '有两层叠在一起') + '，先看这里。',
        pro: palaceLabel(row.name) + '同时接住了' + joined + '的四化，是当前最集中的宫位。'
      });
    }
    return out;
  }

  function oppositePalace(chart, branch) {
    var palaces = chart.palaces || [];
    for (var i = 0; i < palaces.length; i++) {
      if (palaces[i].branch === branch) {
        var opp = palaces[i].oppositeBranch;
        for (var j = 0; j < palaces.length; j++) {
          if (palaces[j].branch === opp) return palaces[j];
        }
      }
    }
    return null;
  }

  function flyingOf(ZW, chart) {
    var ranked = [];
    for (var i = 0; i < CORE.length; i++) {
      var srcName = CORE[i];
      var src = null;
      var palaces = chart.palaces || [];
      for (var p = 0; p < palaces.length; p++) {
        if (palaces[p].name === srcName) { src = palaces[p]; break; }
      }
      if (!src) continue;
      var map = ZW.getSiHuaByStem(src.stem);
      var items = locate(chart, fromMap(map, 'fly'));
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var self = it.palace === src.name;
        var coreTarget = false;
        for (var c = 0; c < CORE.length; c++) {
          if (CORE[c] === it.palace) coreTarget = true;
        }
        var rank = -1;
        if (self && it.hua === '忌') rank = 0;
        else if (self && it.hua === '禄') rank = 1;
        else if (!self && it.hua === '忌') rank = 2;
        else if (!self && it.hua === '禄' && coreTarget) rank = 3;
        else if (self && it.hua === '权') rank = 4;
        else if (self && it.hua === '科') rank = 5;
        if (rank < 0) continue;
        ranked.push({ rank: rank, src: src, it: it, self: self });
      }
    }
    ranked.sort(function (a, b) { return a.rank - b.rank; });
    var out = [];
    var seen = {};
    for (var n = 0; n < ranked.length && out.length < 8; n++) {
      var row = ranked[n];
      var id = row.src.name + '|' + row.it.hua + '|' + row.it.palace;
      if (seen[id]) continue;
      seen[id] = 1;
      var srcLab = palaceLabel(row.src.name);
      var dstLab = palaceLabel(row.it.palace);
      var srcDom = domainOf(row.src.name);
      var dstDom = domainOf(row.it.palace);
      var opp = oppositePalace(chart, row.it.branch);
      var oppClause = '';
      if (!row.self && opp && opp.name !== row.src.name) {
        oppClause = '，对宫「' + domainOf(opp.name) + '」也会被牵动';
      }
      var plain = '';
      var pro = '';
      if (row.self && row.it.hua === '忌') {
        plain = '「' + srcDom + '」是自己跟自己较劲，别人劝用处不大。';
        pro = srcLab + '自化忌（' + row.it.star + '）：这一宫自己消耗自己，外人很难替你解开。';
      } else if (row.self && row.it.hua === '禄') {
        plain = '「' + srcDom + '」不用等别人给，自己就能生出机会。';
        pro = srcLab + '自化禄（' + row.it.star + '）：这一宫自己能生出资源。';
      } else if (row.self && row.it.hua === '权') {
        plain = '「' + srcDom + '」的位置要自己争，别人让不出来。';
        pro = srcLab + '自化权（' + row.it.star + '）：主导权要这一宫自己扛。';
      } else if (row.self && row.it.hua === '科') {
        plain = '「' + srcDom + '」的名声得自己做出来。';
        pro = srcLab + '自化科（' + row.it.star + '）：信誉来自这一宫自己，不是别人封的。';
      } else if (row.it.hua === '忌') {
        plain = '「' + srcDom + '」会把消耗带进「' + dstDom + '」' + oppClause + '。';
        pro = srcLab + '飞忌入' + dstLab + '（' + row.it.star + '）：消耗从' + srcLab + '进入' + dstLab +
          (opp && opp.name !== row.src.name ? '，并牵动对宫' + palaceLabel(opp.name) : '') + '。';
      } else if (row.it.hua === '禄') {
        plain = '「' + srcDom + '」上的好处，会落到「' + dstDom + '」。';
        pro = srcLab + '飞禄入' + dstLab + '（' + row.it.star + '）：资源从' + srcLab + '落到' + dstLab + '。';
      }
      if (plain) out.push({ plain: plain, pro: pro });
    }
    return out;
  }

  function jiCopy(natal, daxian, liunian) {
    var a = oneOf(natal, '忌');
    var b = oneOf(daxian, '忌');
    var c = oneOf(liunian, '忌');
    if (!a && !b && !c) return null;
    var plainBits = ['化忌是「最在意、也最耗神」的标记，不是宣判。'];
    var proBits = ['化忌是课题，不是宣判。'];
    if (a) {
      plainBits.push('先天最耗神的是「' + domainOf(a.palace) + '」（' + a.star + '）。');
      proBits.push('生年化忌在' + palaceLabel(a.palace) + '（' + a.star + '），这是先天课题。');
    }
    if (b) {
      plainBits.push('这十年耗在「' + domainOf(b.palace) + '」（' + b.star + '）。');
      proBits.push('大限化忌在' + palaceLabel(b.palace) + '（' + b.star + '），这十年的课题在这。');
    }
    if (c) {
      plainBits.push('今年耗在「' + domainOf(c.palace) + '」（' + c.star + '）。');
      proBits.push('流年化忌在' + palaceLabel(c.palace) + '（' + c.star + '），今年的触发在这。');
    }
    if (a && b && c && a.palace === b.palace && b.palace === c.palace) {
      plainBits.push('三层都落在同一件事上，今年这里最沉，先处理这一处。');
      proBits.push('三层化忌都在' + palaceLabel(a.palace) + '，这一处今年压力最大。');
    } else if (a && b && a.palace === b.palace) {
      plainBits.push('先天和这十年卡在同一处，今年还在还同一笔账。');
      proBits.push('生年和大限的化忌落在同一宫，这十年还在还同一笔账。');
    } else if (b && c && b.palace === c.palace) {
      plainBits.push('今年把这十年的课题挑明了。');
      proBits.push('大限和流年的化忌落在同一宫，今年把这十年的课题挑明了。');
    }
    return { plain: plainBits.join(''), pro: proBits.join('') };
  }

  function analyze(ZW, chart, opts) {
    opts = opts || {};
    var dxIndex = typeof opts.daxianIndex === 'number' ? opts.daxianIndex : (chart.currentDaXianIndex || 0);
    var year = opts.liunianYear || new Date().getFullYear();
    var dx = (chart.daXians || [])[dxIndex] || null;
    var dxPalace = null;
    if (dx) {
      var palaces = chart.palaces || [];
      for (var i = 0; i < palaces.length; i++) {
        if (palaces[i].branch === dx.palaceBranch) { dxPalace = palaces[i]; break; }
      }
    }
    var natal = natalList(chart);
    var daxian = [];
    if (dxPalace) daxian = locate(chart, fromMap(ZW.getSiHuaByStem(dxPalace.stem), 'daxian'));
    var ln = ZW.getLiuNianSiHua(year);
    var liunian = locate(chart, fromMap(ln.transforms || {}, 'liunian'));
    var yb = ZW.getYearBranchIndex(year);

    var overlays = []
      .concat(pairLayers(natal, daxian, '这十年', '本命与大限：'))
      .concat(pairLayers(natal, liunian, '今年', '本命与流年：'))
      .concat(pairLayers(daxian, liunian, '今年对着这十年', '大限与流年：'));
    if (overlays.length > 6) overlays = overlays.slice(0, 6);

    var axes = [];
    var natalAxis = axisCopy(chart, natal, '先天这两头', '生年');
    var dxAxis = axisCopy(chart, daxian, '这十年这两头', '大限');
    var lnAxis = axisCopy(chart, liunian, '今年这两头', '流年');
    if (natalAxis) axes.push(natalAxis);
    if (dxAxis && (!natalAxis || dxAxis.pro !== natalAxis.pro)) axes.push(dxAxis);
    if (lnAxis && (!natalAxis || lnAxis.pro !== natalAxis.pro) && (!dxAxis || lnAxis.pro !== dxAxis.pro)) axes.push(lnAxis);

    var dxNote = '';
    if (dx && dxPalace) {
      dxNote = '第' + (dxIndex + 1) + '限 ' + dx.startAge + '–' + dx.endAge + '岁 · ' +
        palaceLabel(dx.palaceName) + '（' + ZW.STEMS[dxPalace.stem] + '干）';
    }

    return {
      blocks: [
        { label: '生年', note: '先天课题', text: lineOf(natal) },
        { label: '大限', note: dxNote, text: lineOf(daxian) },
        { label: '流年', note: year + ' ' + (ln.stemName || '') + (ZW.BRANCHES[yb] || '') + '年', text: lineOf(liunian) }
      ],
      overlays: overlays,
      ji: jiCopy(natal, daxian, liunian),
      axes: axes,
      focus: focusLines(natal, daxian, liunian),
      flying: flyingOf(ZW, chart)
    };
  }

  window.ZW_READ = { analyze: analyze };
})();
