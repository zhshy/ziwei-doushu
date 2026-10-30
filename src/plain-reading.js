/**
 * 白话解读生成器
 *
 * 为什么不改引擎：解码文字由 engine.js 里的 buildReading 产出，那是压缩产物。
 * 这里改用引擎已经算好的命盘数据（chart），在展示层重新组织成「说人话」的七段式，
 * 不动引擎、不改变任何排盘结果。原有六分区专业版仍保留，两者可切换。
 *
 * 七个分类：性格 / 事业 / 财运 / 婚姻 / 健康 / 六亲速览 / 大限节奏
 * 用词原则：不出现「三方四正、庙旺得利平不陷、化禄化权」等术语。
 */
(function () {
  'use strict';

  /** 十四主星：六个领域各一句大白话 */
  var STAR = {
    紫微: {
      self: '自带气场，不太喜欢被人管，做事讲体面',
      career: '适合当那个拿主意、带团队的人，或者在一个行当里做到让人仰视',
      money: '对钱有掌控欲，挣得起也花得起，但容易被场面上的开销拖住',
      love: '挑人眼光高，希望对方尊重你，但也容易以自己为中心',
      health: '操心多，心脑血管和血压要留意',
      kin: '多半有身份感、要面子，相处时给足尊重就好'
    },
    天机: {
      self: '脑子转得快，凡事爱想三步，但也容易想太多、自己耗自己',
      career: '适合动脑子的活——企划、研究、技术、咨询，最怕一成不变',
      money: '靠点子、靠信息赚钱，来得活，但不稳',
      love: '得找个聊得来的人，对方太闷你会受不了',
      health: '神经紧、睡不深，肠胃容易跟着情绪乱',
      kin: '想得多、话也多，关系有起有落'
    },
    太阳: {
      self: '热络、直爽、爱帮忙，藏不住话，也容易把自己累着',
      career: '适合站在人前——教育、传播、公职、对外接触',
      money: '钱常常花在别人身上，自己有面子，但不一定存得下',
      love: '是付出型，但容易忽略对方真正要什么',
      health: '心脏、眼睛、血压要留意，别硬撑',
      kin: '热心、爱张罗，但也容易操心过度'
    },
    武曲: {
      self: '干脆、务实、认死理，不太会说软话，但靠得住',
      career: '适合跟钱、跟技术、跟执行打交道——金融、工程、实业',
      money: '正财强，会挣也会守，是十四颗里最会理财的之一',
      love: '表达太直接，容易显得冷，要多练「好好说话」',
      health: '注意呼吸系统，还有磕碰外伤',
      kin: '务实、话直，情分要靠做事来体现'
    },
    天同: {
      self: '脾气好、随和、爱享受，不太爱跟人争',
      career: '适合稳定、服务型、要和人打交道的软性工作',
      money: '不愁吃穿，但进取心一般，容易「够用就好」',
      love: '好相处，但需要有人推着往前走',
      health: '注意水肿、泌尿和体重',
      kin: '随和好相处，是能让你轻松的关系'
    },
    廉贞: {
      self: '外冷内热，有原则也有脾气，认准的事很倔',
      career: '适合讲规则、讲纪律的地方——公职、法务、管理',
      money: '钱有起伏，靠专业和制度挣，别碰灰色地带',
      love: '感情浓烈，但波折不少，需要彼此留空间',
      health: '血液、心血管要注意',
      kin: '有原则也有脾气，容易因坚持而疏远'
    },
    天府: {
      self: '稳当、厚道、能包容，喜欢有秩序的生活',
      career: '适合管理、财务、后勤这类「守得住」的位置',
      money: '会存钱，喜欢置产，是十四颗里最稳的财库',
      love: '顾家，但偏保守，不太会制造浪漫',
      health: '脾胃、消化和体重容易出问题',
      kin: '稳当厚道，是能依靠的关系'
    },
    太阴: {
      self: '细腻、敏感、想得多，表面温和，心里有主见',
      career: '适合幕后、策划、财务、文化这类不站在最前面的位置',
      money: '细水长流型，会攒、适合置产，不适合快进快出',
      love: '需要安全感和陪伴，情绪起伏得有人接住',
      health: '内分泌、睡眠要顾，容易因为情绪睡不好',
      kin: '细腻敏感，需要多照顾情绪'
    },
    贪狼: {
      self: '兴趣广、会来事、人缘好，欲望也强',
      career: '适合需要应酬和多才多艺的领域——市场、娱乐、做生意',
      money: '会挣也会花，靠人脉和机会挣钱',
      love: '桃花不少，要自律；伴侣多半也有魅力',
      health: '肝胆和生殖系统要留意，别过度应酬',
      kin: '有魅力、会来事，界限感要拿捏'
    },
    巨门: {
      self: '会说话、爱琢磨，但也容易多疑、爱挑剔',
      career: '靠嘴吃饭——教学、销售、法律、传媒、分析',
      money: '靠专业和口才挣，也容易因为口舌破财',
      love: '沟通是把双刃剑，说得好是情趣，说不好就是伤害',
      health: '口腔、肠胃和呼吸道容易出问题',
      kin: '爱讲道理，容易有误会，话要说明白'
    },
    天相: {
      self: '热心、讲情面、爱帮忙，是那种靠谱的中间人',
      career: '适合辅佐、行政、法务、服务这类位置',
      money: '稳定，靠职位和信誉，不擅长冒险',
      love: '重感情，但容易没主见，被人牵着走',
      health: '皮肤和泌尿要留意，饮食容易不规律',
      kin: '热心讲情面，是能帮上忙的'
    },
    天梁: {
      self: '稳、爱照顾人、讲原则，有长者风范，但容易管太多、爱说教',
      career: '适合教育、医疗、法律、研究、咨询这类「被人信得过」的行当',
      money: '钱来得稳，靠专业和名声，不靠投机',
      love: '像个照顾者，但容易把伴侣当成学生',
      health: '脾胃和慢性小毛病，注意别硬扛',
      kin: '像长辈，爱照顾人，也爱管事'
    },
    七杀: {
      self: '干脆、敢闯、有魄力，脾气急，讨厌拖泥带水',
      career: '适合开疆拓土——创业、军警、销售这类要冲的活',
      money: '大进大出，能挣但不容易守住，最好有制度约束自己',
      love: '感情直接，容易聚少离多',
      health: '容易有外伤或手术，呼吸系统也要顾',
      kin: '个性刚硬，相处要有分寸'
    },
    破军: {
      self: '不安分、爱折腾、敢推翻重来，讨厌一成不变',
      career: '适合变动大、需要破局的行当——创业、改革、技术更新',
      money: '起伏大，钱容易花在「重新开始」上',
      love: '感情变化多，需要新鲜感',
      health: '意外磕碰，容易消耗过度',
      kin: '个性强、变化多，缘分深浅起伏大'
    }
  };

  /** 辅星煞星的提醒，只在特定宫位才拿出来说 */
  var MINOR = {
    擎羊: '一股硬气，话说重了容易得罪人，用对地方是魄力',
    陀罗: '事情容易拖，不是解决不了，是一直耗着',
    火星: '性子急，做事一阵风',
    铃星: '有火憋在心里，容易闷出问题',
    地空: '容易有「落空」的感觉，别做太满的承诺',
    地劫: '计划常赶不上变化，留点余地',
    天空: '想法容易飘，落地要多想一步',
    旬空: '有些事容易半途断掉，要有备份方案',
    天魁: '关键时刻有人拉你一把',
    天钺: '关键时候有长辈或贵人出面',
    左辅: '身边有能帮你的人',
    右弼: '容易得到旁人协助',
    禄存: '带一点财缘，比较稳',
    天马: '跑动多、变动多，坐不住',
    红鸾: '有喜事与桃花的机会',
    天喜: '容易遇到让人开心的事'
  };

  /** 吉星落陷时的说法：不能先说好、再说别指望，自相矛盾 */
  var MINOR_WEAK = {
    左辅: '帮手不太给力，事最好自己盯',
    右弼: '旁人帮衬有限，还是自己上手稳妥',
    天魁: '贵人出手有限，关键还得靠自己',
    天钺: '长辈助力有限，别等着被安排',
    禄存: '财缘一般，稳扎稳打更实在',
    红鸾: '缘分来得慢一些，急不得',
    天喜: '开心事有，但别指望它解决什么'
  };

  /** 取一颗辅星的说法：落陷的吉星用弱化版 */
  function minorTip(s) {
    var isSha = /擎羊|陀罗|火星|铃星|地空|地劫|天空|旬空/.test(s.name);
    if (!isSha && WEAK[s.brightnessRaw] && MINOR_WEAK[s.name]) return MINOR_WEAK[s.name];
    return MINOR[s.name];
  }

  /** 宫位说人话的主题 */
  var PALACE_TITLE = {
    命宫: '你自己', 兄弟: '兄弟姐妹和同辈', 夫妻: '伴侣', 子女: '子女',
    财帛: '钱', 疾厄: '身体', 迁移: '出门在外', 仆役: '朋友和下属',
    官禄: '事业', 田宅: '家和不动产', 福德: '精神生活', 父母: '长辈'
  };

  /** 大限走到某宫，主题是什么 */
  var DX_THEME = {
    命宫: '以自己为主，立身定型的一段',
    兄弟: '靠同辈、靠人手的阶段',
    夫妻: '感情与合伙是主题',
    子女: '投入产出、带人带团队的阶段',
    财帛: '钱是主题，收支起伏会明显',
    疾厄: '身体和根基要顾的一段',
    迁移: '外出、跑动、换环境',
    仆役: '人际圈子大换血',
    官禄: '事业定形、位置往上走',
    田宅: '家宅、置产、安顿',
    福德: '心态和精神状态是主线',
    父母: '长辈、贵人、上层关系'
  };

  var STRONG = { 庙: 1, 旺: 1 };
  var WEAK = { 平: 1, 不: 1, 陷: 1 };

  function majorsOf(chart, branch) {
    var p = null;
    for (var i = 0; i < chart.palaces.length; i++) {
      if (chart.palaces[i].branch === branch) { p = chart.palaces[i]; break; }
    }
    if (!p) return { palace: null, stars: [], borrowed: false };
    var majors = (p.stars || []).filter(function (s) { return s.type === 'major'; });
    if (majors.length) return { palace: p, stars: majors, borrowed: false };
    // 空宫借对宫
    var op = null;
    for (var j = 0; j < chart.palaces.length; j++) {
      if (chart.palaces[j].branch === p.oppositeBranch) { op = chart.palaces[j]; break; }
    }
    var bo = op ? (op.stars || []).filter(function (s) { return s.type === 'major'; }) : [];
    return { palace: p, stars: bo, borrowed: true, oppositeName: op ? op.name : '' };
  }

  /** 把一组主星在某个领域的句子拼起来 */
  function joinStars(stars, field) {
    var parts = [];
    for (var i = 0; i < stars.length; i++) {
      var d = STAR[stars[i].name];
      if (d && d[field]) parts.push(d[field]);
    }
    if (!parts.length) return '';
    return parts.length === 1 ? parts[0] : parts.join('；同时');
  }

  /** 亮度说人话 */
  function brightnessNote(stars) {
    if (!stars.length) return '';
    var strong = 0, weak = 0;
    for (var i = 0; i < stars.length; i++) {
      var b = stars[i].brightnessRaw;
      if (STRONG[b]) strong++;
      if (WEAK[b]) weak++;
    }
    if (weak > strong) return '这组特质在你身上力量偏弱，长处要靠后天练出来，别指望天生就顺。';
    if (strong > weak) return '这组特质在你身上力量足，长处是能直接拿来用的。';
    return '';
  }

  /** 找某宫的四化 */
  function sihuaOf(chart, branch) {
    var out = [];
    for (var i = 0; i < chart.palaces.length; i++) {
      var p = chart.palaces[i];
      if (p.branch !== branch) continue;
      (p.stars || []).forEach(function (s) {
        if (s.siHua) out.push({ hua: s.siHua, star: s.name });
      });
    }
    return out;
  }

  var HUA_WORD = {
    禄: '有底气、有缘分，是你能顺手拿到的东西',
    权: '要你去争、去扛，争到了就是你的位置',
    科: '给你名声，让你被人看得起、被信得过',
    忌: '是要反复还的账，容易在这上面耗神'
  };

  function build(ZW, chart) {
    var BR = ZW.BRANCHES;
    var ming = majorsOf(chart, chart.mingGongBranch);
    var shen = majorsOf(chart, chart.shenGongBranch);
    var career = majorsOf(chart, chart.palaces.filter(function (p) { return p.name === '官禄'; })[0].branch);
    var money = majorsOf(chart, chart.palaces.filter(function (p) { return p.name === '财帛'; })[0].branch);
    var love = majorsOf(chart, chart.palaces.filter(function (p) { return p.name === '夫妻'; })[0].branch);
    var health = majorsOf(chart, chart.palaces.filter(function (p) { return p.name === '疾厄'; })[0].branch);
    var home = majorsOf(chart, chart.palaces.filter(function (p) { return p.name === '田宅'; })[0].branch);

    var sections = [];

    // ── 一、性格 ──
    var p1 = [];
    var mingLine = joinStars(ming.stars, 'self');
    p1.push('你的命宫坐在' + BR[chart.mingGongBranch] + '宫' +
      (ming.stars.length ? '，主星是' + ming.stars.map(function (s) { return s.name; }).join('、') + '——' : '，这一宫本身没有主星，借对宫来看：') +
      (mingLine ? mingLine + '。' : ''));
    var bn = brightnessNote(ming.stars);
    if (bn) p1.push(bn);

    // 命宫辅煞挑一条最有辨识度的
    var mingPalace = ming.palace;
    if (mingPalace) {
      var tips = [];
      (mingPalace.stars || []).forEach(function (s) {
        if (s.type !== 'major' && MINOR[s.name]) tips.push(minorTip(s));
      });
      if (tips.length) p1.push('性格上还有一点——' + tips.slice(0, 2).join('；') + '。');
    }

    if (chart.shenGongBranch === chart.mingGongBranch) {
      p1.push('你的身宫和命宫是同一个位置，意思是越往后你越以自己为准，不太愿意再为别人让位。');
    } else {
      var shenName = '';
      for (var i = 0; i < chart.palaces.length; i++) {
        if (chart.palaces[i].branch === chart.shenGongBranch) shenName = chart.palaces[i].name;
      }
      p1.push('你的身宫落在' + BR[chart.shenGongBranch] + '宫（' + shenName + '），后半生的重心会往「' +
        (PALACE_TITLE[shenName] || shenName) + '」这件事上靠。');
    }
    sections.push({ id: 'character', title: '性格', paras: p1 });

    // ── 二、事业 ──
    var p2 = [];
    var careerPalace = chart.palaces.filter(function (p) { return p.name === '官禄'; })[0];
    p2.push('事业看官禄宫，落在' + BR[careerPalace.branch] + '宫' +
      (career.borrowed ? '没有主星，借对宫来看：' : '，主星是' + career.stars.map(function (s) { return s.name; }).join('、') + '：') +
      joinStars(career.stars, 'career') + '。');
    var careerHua = sihuaOf(chart, careerPalace.branch);
    if (careerHua.length) {
      p2.push(careerHua.map(function (x) {
        return x.star + '化' + x.hua + '在事业上——' + HUA_WORD[x.hua];
      }).join('；') + '。');
    }
    var careerTips = [];
    (careerPalace.stars || []).forEach(function (s) {
      if (s.name === '天马') careerTips.push('工作跑动多、变动多，一成不变坐办公室反而憋屈');
    });
    if (careerTips.length) p2.push(careerTips[0] + '。');
    var curDx = (chart.daXians || [])[chart.currentDaXianIndex];
    if (curDx) {
      var cm = majorsOf(chart, curDx.palaceBranch);
      p2.push('现在这个十年（' + curDx.startAge + '–' + curDx.endAge + '，走到' + curDx.palaceName + '）' +
        (cm.stars.length ? '，主题星是' + cm.stars.map(function (x) { return x.name; }).join('、') + '，节奏跟着它走。' : '，先把根扎稳。'));
    }
    sections.push({ id: 'career', title: '事业', paras: p2 });

    // ── 三、财运 ──
    var p3 = [];
    var moneyPalace = chart.palaces.filter(function (p) { return p.name === '财帛'; })[0];
    p3.push('钱看财帛宫，落在' + BR[moneyPalace.branch] + '宫' +
      (money.borrowed ? '没有主星，借对宫来看：' : '，主星是' + money.stars.map(function (s) { return s.name; }).join('、') + '：') +
      joinStars(money.stars, 'money') + '。');
    var homePalace = chart.palaces.filter(function (p) { return p.name === '田宅'; })[0];
    var homeHua = sihuaOf(chart, homePalace.branch);
    var homeLine = joinStars(home.stars, 'money');
    if (homeLine) p3.push('你的田宅宫（管房子和家底）坐在' + BR[homePalace.branch] + '宫：' + homeLine + '。');
    if (homeHua.length) {
      p3.push(homeHua.map(function (x) { return x.star + '化' + x.hua + '在田宅——' + HUA_WORD[x.hua]; }).join('；') + '。');
    }
    var moneyTips = [];
    (moneyPalace.stars || []).forEach(function (s) {
      if (MINOR[s.name]) moneyTips.push(minorTip(s));
    });
    if (moneyTips.length) p3.push('另外，' + moneyTips[0] + '。');
    sections.push({ id: 'money', title: '财运', paras: p3 });

    // ── 四、婚姻 ──
    var p4 = [];
    var lovePalace = chart.palaces.filter(function (p) { return p.name === '夫妻'; })[0];
    p4.push('感情看夫妻宫，落在' + BR[lovePalace.branch] + '宫' +
      (love.borrowed ? '没有主星，借对宫来看：' : '，主星是' + love.stars.map(function (s) { return s.name; }).join('、') + '：') +
      joinStars(love.stars, 'love') + '。');
    var loveTips = [];
    (lovePalace.stars || []).forEach(function (s) {
      if (s.type !== 'major' && MINOR[s.name]) loveTips.push(minorTip(s));
    });
    if (loveTips.length) p4.push('这一宫还有：' + loveTips.slice(0, 3).join('；') + '。');
    var loveHua = sihuaOf(chart, lovePalace.branch);
    if (loveHua.length) p4.push(loveHua.map(function (x) { return x.star + '化' + x.hua + '——' + HUA_WORD[x.hua]; }).join('；') + '。');
    if (loveTips.length) p4.push('有煞星不等于不好，只是提醒你：这一宫的话要当时说完，别攒着。');
    sections.push({ id: 'love', title: '婚姻', paras: p4 });

    // ── 五、健康 ──
    var p5 = [];
    var healthPalace = chart.palaces.filter(function (p) { return p.name === '疾厄'; })[0];
    p5.push('身体看疾厄宫，落在' + BR[healthPalace.branch] + '宫' +
      (health.borrowed ? '没有主星，借对宫来看：' : '，主星是' + health.stars.map(function (s) { return s.name; }).join('、') + '：') +
      joinStars(health.stars, 'health') + '。');
    var healthTips = [];
    (healthPalace.stars || []).forEach(function (s) {
      if (s.type !== 'major' && MINOR[s.name]) healthTips.push(minorTip(s));
    });
    if (healthTips.length) p5.push('还要注意：' + healthTips.slice(0, 2).join('；') + '。');
    p5.push('底子好坏看这一宫的星，但真正决定的是作息——这一段只是提醒你别硬扛。');
    sections.push({ id: 'health', title: '健康', paras: p5 });

    // ── 六、六亲速览 ──
    var kinNames = ['父母', '兄弟', '子女', '仆役'];
    var kin = [];
    kinNames.forEach(function (nm) {
      var pp = chart.palaces.filter(function (p) { return p.name === nm; })[0];
      if (!pp) return;
      var mm = majorsOf(chart, pp.branch);
      var line = joinStars(mm.stars, 'kin');
      var body = line ? '这一宫的人' + line : '这一宫没有明显的主星力量，随缘即可';
      kin.push({
        label: nm === '仆役' ? '朋友与下属' : PALACE_TITLE[nm],
        text: (mm.borrowed ? '这一宫无主星，借对宫来看——' : '') + body + '。'
      });
    });
    sections.push({ id: 'kin', title: '六亲速览', items: kin });

    // ── 七、大限节奏 ──
    var luck = [];
    (chart.daXians || []).forEach(function (dx, idx) {
      var mm = majorsOf(chart, dx.palaceBranch);
      var brief = joinStars(mm.stars, 'career');
      luck.push({
        age: dx.startAge + '–' + dx.endAge,
        palace: dx.palaceName,
        text: (DX_THEME[dx.palaceName] || '') + (mm.stars.length ? '，主题星是' + mm.stars.map(function (s) { return s.name; }).join('、') : ''),
        current: idx === chart.currentDaXianIndex
      });
    });
    sections.push({ id: 'luck', title: '大限节奏', rows: luck });

    return { sections: sections };
  }

  window.PLAIN_READING = build;
})();
