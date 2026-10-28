(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 解锁滚动（多重兜底） ---------- */
  var unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    document.body.classList.remove('locked');
  }
  window.addEventListener('load', unlock, { once: true });
  window.addEventListener('error', unlock);
  setTimeout(unlock, 3200);

  /* ---------- 序幕：自动开场 ---------- */
  var prelude = document.getElementById('prelude');
  var preludeDone = false;
  function endPrelude() {
    if (preludeDone) return;
    preludeDone = true;
    if (prelude && prelude.parentNode) prelude.parentNode.removeChild(prelude);
    unlock();
    startTour();
  }
  if (reduce) {
    endPrelude();
  } else {
    setTimeout(unlock, 2100);
    setTimeout(endPrelude, 2950);
    prelude.addEventListener('click', endPrelude);
    setTimeout(endPrelude, 4200);
  }

  /* ============================================================
     自动浏览：按板块拆分多个停靠点，逐屏停留
     ============================================================ */
  var hint = document.getElementById('tourHint');
  var tourStops = [], idx = 0, running = false, raf = 0, lastY = 0, tookOver = false, started = false;

  function topOf(el) { return el.getBoundingClientRect().top + window.pageYOffset; }
  function buildTour() {
    tourStops = [{ y: 0, hold: 2600 }];
    var vh = window.innerHeight;
    var secs = document.querySelectorAll('main .sec, main #route');
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      var isRoute = sec.id === 'route';
      var step = isRoute ? Math.max(vh * 0.5, 320) : Math.max(vh * 0.85, 380);
      var hold = isRoute ? 1800 : 3000;
      var top = Math.max(0, topOf(sec) - 8);
      var endY = Math.max(top, topOf(sec) + sec.offsetHeight - vh * 0.55);
      var y = top, last = top - 1;
      while (y < endY - 30) {
        if (y > last + 30) { tourStops.push({ y: y, hold: hold }); last = y; }
        y += step;
      }
      if (endY > last + 30) tourStops.push({ y: endY, hold: hold + 600 });
    }
    var f = document.querySelector('.footer');
    if (f) tourStops.push({ y: Math.max(0, topOf(f) - 8), hold: 5200 });
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function goTo(i, done) {
    var from = window.pageYOffset, to = tourStops[i].y;
    var dist = Math.abs(to - from);
    var dur = Math.max(1400, Math.min(3600, 800 + dist * 0.40));
    if (reduce) { window.scrollTo(0, to); lastY = to; done(); return; }
    var t0 = performance.now();
    (function frame(t) {
      if (!running) return;
      var p = Math.min(1, (t - t0) / dur);
      var y = from + (to - from) * easeInOut(p);
      lastY = y;
      window.scrollTo(0, y);
      if (p < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        lastY = to;
        window.scrollTo(0, to);
        setTimeout(function () { if (running) done(); }, tourStops[i].hold);
      }
    })(t0);
  }
  function run() {
    if (idx >= tourStops.length) { stopTour(false); return; }
    goTo(idx, function () { idx++; run(); });
  }
  function startTour() {
    if (started || tookOver) return;
    started = true;
    buildTour();
    running = true;
    if (hint) hint.classList.add('show');
    setTimeout(function () { if (running) run(); }, 900);
  }
  function stopTour(byUser) {
    running = false;
    if (byUser) tookOver = true;
    cancelAnimationFrame(raf);
    if (hint) hint.classList.add('hide');
  }
  function takeOver() { if (!running) return; stopTour(true); }
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, takeOver, { passive: true });
  });
  window.addEventListener('scroll', function () {
    if (!running) return;
    if (Math.abs(window.pageYOffset - lastY) > 10) stopTour(true);
  }, { passive: true });

  /* ---------- 进场揭示 + 数字滚动 ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (reduce) { el.textContent = target.toLocaleString('en-US'); return; }
    var t0 = performance.now(), dur = 1500;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        if (e.target.hasAttribute('data-count')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.classList && c.classList.contains('reveal');
      });
      el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 0.09 + 's';
      io.observe(el);
    });
    document.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    document.querySelectorAll('[data-count]').forEach(countUp);
  }

  /* ============================================================
     长征路线：真实经纬度点位 + 插值样条 + 滚动时间线
     ============================================================ */
  var JB = { label: '延伸影像 · 军博数字展厅', url: 'http://www.jb.mil.cn' };
  var GB = { label: '延伸影像 · 国博数字展厅', url: 'https://www.chnmuseum.cn/Portals/0/web/vr/index.html' };

var WAY_IMGS = ['assets/img/way-01.jpg', 'assets/img/way-02.jpg', 'assets/img/way-03.jpg', 'assets/img/way-04.jpg', 'assets/img/way-05.jpg', 'assets/img/way-06.jpg', 'assets/img/way-07.jpg', 'assets/img/way-08.jpg', 'assets/img/way-09.jpg', 'assets/img/way-10.jpg'];

  /* ---------- 预加载：进入页面即加载全部图片素材，避免滚动到节点时才拉图 ---------- */
  (function preloadImages() {
    var urls = WAY_IMGS.slice();
    var imgs = document.querySelectorAll('img[src^="assets/img/"]');
    for (var i = 0; i < imgs.length; i++) {
      var s = imgs[i].getAttribute('src');
      if (s && urls.indexOf(s) === -1) urls.push(s);
    }
    for (var j = 0; j < urls.length; j++) { var pre = new Image(); pre.src = urls[j]; }
  })();

  var WAY = [
    { lon: 115.41, lat: 25.95, date: '1934.10', title: '于都河畔 · 长征出发',
      desc: '中央红军主力 8.6 万余人夜渡于都河，踏上战略转移之路。',
      more: '渡河多在夜间秘密进行。于都百姓拆下门板、床板搭起浮桥，有的老人献出寿材架桥；乡亲们十里相送，从此开始了艰苦卓绝的战略转移。',
      key: true, label: '于都', side: 'right', dy: 2, link: GB },
    { lon: 110.80, lat: 25.60, date: '1934.11—12', title: '血战湘江',
      desc: '红军在广西兴安、全州一线强渡湘江，突破敌军第四道封锁线。',
      more: '此役中央红军由出发时的 8.6 万余人锐减至 3 万余人，代价极其惨烈。当地至今流传“三年不饮湘江水，十年不食湘江鱼”，血的教训促使党内强烈要求总结教训、改变军事路线。',
      key: false, label: '湘江', side: 'left', dy: 5, link: JB },
    { lon: 106.93, lat: 27.73, date: '1935.01', title: '遵义会议',
      desc: '中共中央在遵义召开政治局扩大会议，集中解决当时具有决定意义的军事和组织问题。',
      more: '会议结束了“左”倾教条主义错误在中央的统治，开始确立以毛泽东同志为主要代表的马克思主义正确路线在党中央的领导地位，在极其危急的关头挽救了党、挽救了红军、挽救了中国革命。',
      key: true, label: '遵义', side: 'right', dy: 9, link: GB },
    { lon: 106.20, lat: 28.10, date: '1935.02—03', title: '四渡赤水',
      desc: '红军在川黔滇边纵横穿插，四渡赤水河。',
      more: '在几十万敌军围追堵截中，红军声东击西、避实击虚，往来穿插于赤水河两岸，随后南渡乌江、威逼贵阳，跳出敌人的包围圈，被誉为战争史上的“得意之笔”。',
      key: false, label: '赤水', side: 'left', dy: -9, link: JB },
    { lon: 102.20, lat: 26.40, date: '1935.05', title: '巧渡金沙江',
      desc: '红军主力在皎平渡等地渡过金沙江，摆脱追兵。',
      more: '干部团奇袭皎平渡口，找到船只、发动船工昼夜摆渡，数万大军悄然过江；等敌军赶到江边，只剩下几只空船——红军从此跳出数十万敌军的围追堵截。',
      key: false, label: '金沙江', side: 'left', dy: 3, link: JB },
    { lon: 102.23, lat: 29.91, date: '1935.05', title: '强渡大渡河 · 飞夺泸定桥',
      desc: '红军先在安顺场强渡大渡河，随后昼夜奔袭夺下泸定桥，打开北上通道。',
      more: '22 名勇士冒着对岸火力，攀着 13 根铁链冲过桥面，后续部队边铺桥板边跟进，一举夺桥，创造了长征中的经典战例。',
      key: true, label: '泸定桥', side: 'right', dy: 3, link: JB },
    { lon: 102.80, lat: 30.80, date: '1935.06', title: '翻越夹金山 · 爬雪山',
      desc: '红军翻越夹金山等终年积雪的高山。',
      more: '空气稀薄、风雪交加，许多战士衣衫单薄、饥寒交迫，坐下休息就再也没能站起来。红军先后翻越梦笔山、达古山等多座雪山，靠着信念与互助一步步翻过山口。',
      key: false, label: '雪山', side: 'left', dy: -4, link: JB },
    { lon: 102.95, lat: 33.50, date: '1935.08', title: '穿过若尔盖草地',
      desc: '红军踏入荒无人烟的水草地，向陕北方向北上。',
      more: '草地气候恶劣、沼泽遍布、没有道路，部队缺粮，以野菜、草根甚至皮带充饥；战士们互相搀扶、把生的希望留给战友，在泥沼中走出一条北上之路。',
      key: true, label: '草地', side: 'right', dy: 1, link: JB },
    { lon: 108.18, lat: 36.92, date: '1935.10', title: '到达陕北 · 吴起镇',
      desc: '中央红军到达陕北吴起镇（今吴起县），与陕北红军会师。',
      more: '中央红军的长征至此胜利结束。红军在吴起镇一带切掉了尾追的“尾巴”，随后与陕北红军并肩作战，把中国革命的大本营安放在了西北。',
      key: false, label: '吴起镇', side: 'right', dy: -5, link: JB },
    { lon: 105.05, lat: 35.70, date: '1936.10', title: '会宁会师 · 长征胜利',
      desc: '红一、红二、红四方面军在甘肃会宁地区会师，长征胜利结束。',
      more: '两年间，红军纵横十余省、长驱二万五千里，实现了战略大转移。三大主力会师，宣告长征胜利结束，中国革命的大本营安放在了西北，开启了新的局面。',
      key: true, label: '会宁', side: 'left', dy: 5, link: GB }
  ];

  /* 每个路线节点的累计行军数据（中央红军口径）。
     河/山/战斗按重大事件累计；累计里程为按行程进度的示意值——
     实际路线迂回曲折、各段里程统计口径不一，仅用于直观呈现。 */
  var ROUTE_DATA = [
    { mile:0,     river:1,  mtn:0,  snow:0, battle:0,   troop:86000 }, // 0 于都 · 出发
    { mile:2000,  river:5,  mtn:2,  snow:0, battle:40,  troop:30000 }, // 1 湘江
    { mile:4500,  river:7,  mtn:5,  snow:0, battle:60,  troop:30000 }, // 2 遵义
    { mile:8000,  river:11, mtn:7,  snow:0, battle:130, troop:28000 }, // 3 四渡赤水
    { mile:12000, river:14, mtn:9,  snow:0, battle:170, troop:20000 }, // 4 金沙江
    { mile:15000, river:17, mtn:11, snow:0, battle:210, troop:20000 }, // 5 大渡河·泸定桥
    { mile:17500, river:19, mtn:13, snow:1, battle:230, troop:20000 }, // 6 夹金山·雪山
    { mile:21000, river:22, mtn:18, snow:5, battle:250, troop:14000 }, // 7 草地
    { mile:25000, river:24, mtn:18, snow:5, battle:380, troop:7000  }, // 8 吴起镇
    { mile:25000, river:24, mtn:18, snow:5, battle:380, troop:7000  }  // 9 会宁会师
  ];

  /* 长征典型故事：按路线进度（at, 0—1）插入路线之中，到达即自动展开。
     部分故事（军需处长、金色的鱼钩等）为根据真实事迹创作的经典革命文学。 */
  var STORIES = [
    { at:0.07, span:0.05, title:'半条被子 · 军民情深',
      body:'1934 年 11 月，3 名女红军在湖南汝城借宿徐解秀家，见她连御寒的被子都没有，临走时把仅有的一床被子剪下半条留下。徐解秀后来说：“什么是共产党？共产党就是自己有一条被子，也要剪下半条给老百姓的人。”' },
    { at:0.13, span:0.05, title:'陈树湘 · 断肠铭志',
      body:'湘江战役中，红 34 师师长陈树湘率部担任总后卫，血战到弹尽粮绝、腹部负伤被俘。被押解途中，他毅然从伤口绞断肠子，壮烈牺牲，年仅 29 岁，用生命践行了“为苏维埃新中国流尽最后一滴血”的誓言。' },
    { at:0.22, span:0.05, title:'“红军菩萨”龙思泉',
      body:'红军卫生员龙思泉在遵义桑木垭日夜为乡亲治病送药。部队转移时，他因救治病人未能跟上，被敌人杀害，年仅 19 岁。乡亲们含泪安葬他、立起“红军坟”，长年祭拜，把他当作救苦救难的“红军菩萨”。' },
    { at:0.40, span:0.05, title:'一袋干粮 · 谁也不舍下谁',
      body:'13 岁的小红军小兰扶伤员过桥时，自己的干粮袋掉进河里冲走。她瞒着大家，只煮些野草充饥；被发现后，战友们纷纷把自己的干粮分进她的袋子。长征路上，再难，也没有一个人被丢下。' },
    { at:0.56, span:0.05, title:'一昼夜奔袭 240 里',
      body:'为抢在敌人援兵前夺下泸定桥，红四团沿崎岖山路一昼夜奔袭 240 里，饥饿疲惫时就嚼辣椒提神，冒雨摸黑疾行，终于在次日清晨赶到桥头，为 22 名勇士飞夺铁索赢得了关键时间。' },
    { at:0.63, span:0.05, title:'军需处长 · 一座丰碑',
      body:'翻越雪山时，部队发现一位老战士冻僵在路旁，身上只穿着单薄破旧的衣服。将军怒吼：“为什么不给他发棉衣？把军需处长叫来！”——而这位冻僵的老人，正是把棉衣都让给战友的军需处长。（根据真实事迹）' },
    { at:0.72, span:0.055, title:'金色的鱼钩',
      body:'过草地时，一位炊事班长用缝衣针弯成鱼钩，钓来小鱼熬汤给三名生病的小战士补身体，自己却偷偷嚼草根、咽鱼骨。走出草地前夕他牺牲了，那枚鱼钩被珍藏下来——在战士们心中，它闪烁着灿烂的金色光芒。' },
    { at:0.85, span:0.05, title:'一张报纸 · 定了去向',
      body:'1935 年 9 月到达哈达铺，侦察连从缴获的报纸上看到陕北有刘志丹红军和根据地的消息。毛泽东据此在干部会上明确：“到陕北去，那里有刘志丹的红军！”长征的最终落脚点，就此确定。' }
  ];

  /* 仅作相对定位使用：真实经纬度 → 画布坐标 */
  var NS = 'http://www.w3.org/2000/svg';
  var VBX = 252, VBY = 146, VBW = 218, VBH = 190;
  function proj(lon, lat) { return [(lon - 72) * 10, (55 - lat) * 10]; }
  function svgEl(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  /* Catmull-Rom → 三次贝塞尔：曲线精确穿过每一个点位 */
  function splinePath(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i], p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' +
           c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ', ' +
           p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  /* 五角星路径：故事标记，区别于事件点位的圆点 */
  function starPath(cx, cy, R) {
    var r = R * 0.45, d = '';
    for (var i = 0; i < 5; i++) {
      var a1 = (-90 + i * 72) * Math.PI / 180;
      var a2 = (-90 + i * 72 + 36) * Math.PI / 180;
      var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      d += (i === 0 ? 'M' : 'L') + x1.toFixed(1) + ' ' + y1.toFixed(1) +
           'L' + x2.toFixed(1) + ' ' + y2.toFixed(1);
    }
    return d + 'Z';
  }

  var mapSvg = document.getElementById('mapSvg');
  var canvas = document.getElementById('routeCanvas');
  var routeScroll = document.getElementById('routeScroll');
  var callout = document.getElementById('routeCallout');
  var rcDate = document.getElementById('rcDate');
  var rcKey = document.getElementById('rcKey');
  var rcTitle = document.getElementById('rcTitle');
  var rcDesc = document.getElementById('rcDesc');
  var rcMore = document.getElementById('rcMore');
  var rcImg = document.getElementById('rcImg');
  var rcLinks = document.getElementById('rcLinks');
  var rsFill = document.getElementById('rsFill');
  var rsDot = document.getElementById('rsDot');
  var rsTrack = document.getElementById('rsTrack');
  var rsNow = document.getElementById('rsNow');
  var routeMain, routeJoin, markers = [], ticks = [], storyMarks = [];
  var lens = { main: 0, join: 0 };

  /* 故事卡片元素 */
  var rstEl = document.getElementById('routeStory');
  var rstTitle = document.getElementById('rstTitle');
  var rstBody = document.getElementById('rstBody');
  var rstIdx = document.getElementById('rstIdx');
  var storyActive = -1;

  /* 行军数据面板元素 */
  var rdMile = document.getElementById('rdMile'),
      rdRiver = document.getElementById('rdRiver'),
      rdMtn = document.getElementById('rdMtn'),
      rdSnow = document.getElementById('rdSnow'),
      rdBattle = document.getElementById('rdBattle'),
      rdMileBar = document.getElementById('rdMileBar'),
      rdDate = document.getElementById('rdDate'),
      rdTroop = document.getElementById('rdTroop'),
      rdTroopM = document.getElementById('rdTroopM'),
      troopSvg = document.getElementById('troopSvg');
  var troopCurDot = null, troopClipRect = null, tweenRaf = {};

  function buildRoute() {
    if (!mapSvg) return;

    var mainPts = [], joinPts = [];
    WAY.forEach(function (w, i) {
      var p = proj(w.lon, w.lat);
      if (i <= 8) mainPts.push(p);
      if (i >= 8) joinPts.push(p);
    });
    routeJoin = svgEl('path', {
      d: splinePath(joinPts), fill: 'none', stroke: 'var(--gold)',
      'stroke-width': 2.2, 'stroke-dasharray': '7 7', 'stroke-linecap': 'round'
    });
    routeMain = svgEl('path', {
      d: splinePath(mainPts), fill: 'none', stroke: 'var(--red)',
      'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      filter: 'drop-shadow(0 0 6px rgba(180,36,27,.55))'
    });
    mapSvg.appendChild(routeJoin);
    mapSvg.appendChild(routeMain);
    lens.main = routeMain.getTotalLength ? routeMain.getTotalLength() : 0;
    lens.join = routeJoin.getTotalLength ? routeJoin.getTotalLength() : 0;
    if (!reduce && lens.main) {
      routeMain.style.strokeDasharray = lens.main;
      routeMain.style.strokeDashoffset = lens.main;
    }
    if (!reduce) routeJoin.style.opacity = 0;

    WAY.forEach(function (w, i) {
      var p = proj(w.lon, w.lat);
      var g = svgEl('g', { class: 'mk' });
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', w.date + ' ' + w.title);

      var halo = svgEl('circle', { cx: p[0], cy: p[1], r: 10, fill: 'var(--red)', opacity: 0 });
      g.appendChild(halo);
      var c = svgEl('circle', {
        cx: p[0], cy: p[1], r: 5.4, fill: 'rgba(243,234,218,.4)',
        stroke: 'rgba(199,154,59,.5)', 'stroke-width': 1.4
      });
      g.appendChild(c);

      var lb = svgEl('text', {
        'dominant-baseline': 'middle', class: 'mk-label',
        'font-size': 8.5, fill: 'rgba(243,234,218,.72)'
      });
      lb.textContent = w.label;
      g.appendChild(lb);

      var hit = svgEl('circle', { cx: p[0], cy: p[1], r: 15, fill: 'transparent' });
      g.appendChild(hit);

      g.addEventListener('click', function () { jumpTo(i); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpTo(i); }
      });

      mapSvg.appendChild(g);
      markers.push({ g: g, circle: c, halo: halo, label: lb });
    });

    layoutLabels();

    WAY.forEach(function (w, i) {
      var t = document.createElement('div');
      t.className = 'rs-tick';
      t.style.left = (i / (WAY.length - 1) * 100) + '%';
      t.setAttribute('title', w.date + ' ' + w.title);
      t.addEventListener('click', function () { jumpTo(i); });
      rsTrack.appendChild(t);
      ticks.push(t);
    });

    setActive(0);
  }

  /* ---------- 路线上的故事标记 ---------- */
  function buildStories() {
    if (!mapSvg || !routeMain || !lens.main) return;
    storyMarks.forEach(function (m) {
      if (m.g.parentNode) m.g.parentNode.removeChild(m.g);
    });
    storyMarks = [];

    STORIES.forEach(function (s) {
      var pt = routeMain.getPointAtLength(lens.main * Math.min(1, s.at));
      var g = svgEl('g', { class: 'st' });
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', '长征故事：' + s.title);
      var star = svgEl('path', {
        d: starPath(pt.x, pt.y, 6),
        fill: 'var(--gold)', stroke: 'var(--red-deep)', 'stroke-width': 1
      });
      g.appendChild(star);
      g.appendChild(svgEl('circle', { cx: pt.x, cy: pt.y, r: 12, fill: 'transparent' }));
      g.addEventListener('click', function () { scrollToProgress(s.at); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); scrollToProgress(s.at);
        }
      });
      mapSvg.appendChild(g);
      storyMarks.push({ g: g, star: star });
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 到达故事位置：自动展开卡片；离开则收起 */
  function updateStory(p) {
    if (!rstEl) return;
    var shown = -1;
    for (var i = 0; i < STORIES.length; i++) {
      if (p >= STORIES[i].at - 0.02 && p <= STORIES[i].at + STORIES[i].span) {
        shown = i; break;
      }
    }
    storyMarks.forEach(function (m, k) {
      m.star.classList.toggle('lit', k === shown);
    });
    if (shown === storyActive) return;
    storyActive = shown;
    if (shown === -1) {
      rstEl.classList.remove('show');
      return;
    }
    var s = STORIES[shown];
    rstTitle.textContent = s.title;
    rstBody.textContent = s.body;
    rstIdx.textContent = pad2(shown + 1) + ' / ' + pad2(STORIES.length);
    rstEl.classList.remove('show');
    void rstEl.offsetWidth;
    rstEl.classList.add('show');
  }

  /* ---------- 行军数据面板：数字平滑 + 兵力变化图 ---------- */
  function fmtTroop(v) {
    if (v >= 10000) return (v / 10000) + '万';
    return v + '';
  }
  function tweenNum(el, to, fmt) {
    if (!el) return;
    var from = parseFloat(el.getAttribute('data-cur')) || 0;
    el.setAttribute('data-cur', to);
    if (reduce) { el.textContent = fmt ? fmt(to) : to; return; }
    var t0 = performance.now(), dur = 750;
    if (tweenRaf[el.id]) cancelAnimationFrame(tweenRaf[el.id]);
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      var v = Math.round(from + (to - from) * e);
      el.textContent = fmt ? fmt(v) : v;
      if (p < 1) tweenRaf[el.id] = requestAnimationFrame(step);
    })(t0);
  }

  /* 兵力变化：中央红军 8.6万 → 约7000 */
  var TROOP = [86000, 30000, 30000, 28000, 20000, 20000, 20000, 14000, 7000];
  var TW = 320, TH = 132, TPL = 18, TPR = 18, TPT = 20, TPB = 24;
  function tX(i) { return TPL + i * (TW - TPL - TPR) / (TROOP.length - 1); }
  function tY(v) { return TPT + (1 - v / 86000) * (TH - TPT - TPB); }

  function buildTroop() {
    if (!troopSvg) return;
    var lineD = 'M' + tX(0) + ' ' + tY(TROOP[0]);
    for (var i = 1; i < TROOP.length; i++) lineD += 'L' + tX(i) + ' ' + tY(TROOP[i]);
    var areaD = lineD + 'L' + tX(8) + ' ' + (TH - TPB) + 'L' + tX(0) + ' ' + (TH - TPB) + 'Z';

    var defs = svgEl('defs', {});
    var grad = svgEl('linearGradient', { id: 'troopGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#B4241B', 'stop-opacity': .55 }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#B4241B', 'stop-opacity': .04 }));
    defs.appendChild(grad);
    var clip = svgEl('clipPath', { id: 'troopClip' });
    troopClipRect = svgEl('rect', { x: 0, y: 0, width: 0, height: TH });
    clip.appendChild(troopClipRect);
    defs.appendChild(clip);
    troopSvg.appendChild(defs);

    /* 淡底：完整趋势，初始即可读 */
    troopSvg.appendChild(svgEl('path', { d: areaD, fill: 'rgba(180,36,27,.10)' }));
    troopSvg.appendChild(svgEl('path', { d: lineD, fill: 'none', stroke: 'rgba(199,154,59,.35)', 'stroke-width': 1.4 }));
    /* 高亮：随行程展开 */
    troopSvg.appendChild(svgEl('path', { d: areaD, fill: 'url(#troopGrad)', 'clip-path': 'url(#troopClip)' }));
    troopSvg.appendChild(svgEl('path', { d: lineD, fill: 'none', stroke: '#E2542C', 'stroke-width': 2, 'stroke-linejoin': 'round', 'clip-path': 'url(#troopClip)' }));
    troopSvg.appendChild(svgEl('line', { x1: TPL, y1: TH - TPB, x2: TW - TPR, y2: TH - TPB, stroke: 'rgba(199,154,59,.3)', 'stroke-width': 1 }));

    /* 关键兵力标注 */
    [{ i: 0, t: '8.6万', a: 'start', dy: -7 }, { i: 1, t: '3万', a: 'middle', dy: -7 }, { i: 8, t: '7000', a: 'end', dy: -8 }].forEach(function (m) {
      var lab = svgEl('text', { x: tX(m.i), y: tY(TROOP[m.i]) + m.dy, 'text-anchor': m.a, 'font-size': 9.5, fill: '#F3EADA' });
      lab.textContent = m.t;
      troopSvg.appendChild(lab);
    });
    /* 时间轴标签 */
    [{ i: 0, t: '1934.10', a: 'start' }, { i: 8, t: '1935.10', a: 'end' }].forEach(function (m) {
      var lab = svgEl('text', { x: tX(m.i), y: TH - 8, 'text-anchor': m.a, 'font-size': 8.5, fill: 'rgba(243,234,218,.5)' });
      lab.textContent = m.t;
      troopSvg.appendChild(lab);
    });

    troopCurDot = svgEl('circle', { r: 4, fill: '#F3EADA', stroke: '#E2542C', 'stroke-width': 1.6 });
    troopSvg.appendChild(troopCurDot);
  }

  function updateTroop(i) {
    if (!troopSvg || !troopCurDot) return;
    var k = Math.min(i, TROOP.length - 1);
    var cw = k === 0 ? tX(0) + 6 : tX(k) + 6;
    if (k === TROOP.length - 1) cw = TW;
    if (troopClipRect) troopClipRect.setAttribute('width', cw);
    troopCurDot.setAttribute('cx', tX(k));
    troopCurDot.setAttribute('cy', tY(TROOP[k]));
  }

  function updatePanel(i) {
    var d = ROUTE_DATA[Math.min(i, ROUTE_DATA.length - 1)];
    var w = WAY[i];
    if (!d) return;
    tweenNum(rdMile, d.mile, function (v) { return v.toLocaleString('en-US'); });
    tweenNum(rdRiver, d.river, null);
    tweenNum(rdMtn, d.mtn, null);
    tweenNum(rdSnow, d.snow, null);
    tweenNum(rdBattle, d.battle, null);
    if (rdMileBar) rdMileBar.style.width = (d.mile / 25000 * 100) + '%';
    if (rdDate && w) rdDate.textContent = w.date + ' · ' + w.label;
    var join = i === 9;
    if (rdTroop) rdTroop.textContent = join ? '会师' : fmtTroop(d.troop);
    if (rdTroopM) rdTroopM.textContent = join ? '会师' : fmtTroop(d.troop);
    updateTroop(i);
  }

  /* 地名标签自动避让：重叠时上下推开，必要时加引线连回点位 */
  function layoutLabels() {
    if (!mapSvg || !markers.length) return;
    var items = WAY.map(function (w, i) {
      var p = proj(w.lon, w.lat);
      var est = w.label.length * 8.4 + 2.5;
      var side = w.side;
      if (side === 'left' && p[0] - 12 - est < VBX + 3) side = 'right';
      if (side === 'right' && p[0] + 12 + est > VBX + VBW - 3) side = 'left';
      return { i: i, p: p, side: side, w: est, h: 10.5,
               x: side === 'left' ? p[0] - 12 : p[0] + 12, y: p[1] + w.dy };
    });

    var pad = 3.2;
    function box(it) {
      var x1 = it.side === 'left' ? it.x - it.w : it.x;
      return { x1: x1, x2: x1 + it.w, y1: it.y - it.h / 2, y2: it.y + it.h / 2 };
    }
    for (var iter = 0; iter < 90; iter++) {
      var moved = false;
      for (var a = 0; a < items.length; a++) {
        for (var b = a + 1; b < items.length; b++) {
          var A = box(items[a]), B = box(items[b]);
          if (A.x1 < B.x2 + pad && B.x1 < A.x2 + pad && A.y1 < B.y2 + pad && B.y1 < A.y2 + pad) {
            var overlapY = Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1);
            var push = (overlapY + pad) / 2 + 0.5;
            if (items[a].y <= items[b].y) { items[a].y -= push; items[b].y += push; }
            else { items[a].y += push; items[b].y -= push; }
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    var leaders = [];
    items.forEach(function (it) {
      it.y = Math.max(VBY + 7, Math.min(VBY + VBH - 7, it.y));
      var m = markers[it.i];
      m.label.setAttribute('x', it.x.toFixed(1));
      m.label.setAttribute('y', it.y.toFixed(1));
      m.label.setAttribute('text-anchor', it.side === 'left' ? 'end' : 'start');
      if (Math.abs(it.y - it.p[1]) > 6.5) {
        leaders.push(svgEl('line', {
          x1: (it.p[0] + (it.side === 'left' ? -7 : 7)).toFixed(1),
          y1: it.p[1].toFixed(1),
          x2: (it.x + (it.side === 'left' ? 1.6 : -1.6)).toFixed(1),
          y2: it.y.toFixed(1),
          stroke: 'rgba(199,154,59,.42)', 'stroke-width': 0.8, 'stroke-dasharray': '2 2'
        }));
      }
    });
    if (leaders.length && markers[0]) {
      leaders.forEach(function (ln) { mapSvg.insertBefore(ln, markers[0].g); });
    }
  }

  var active = -1;
  function setActive(i) {
    if (active === i) return;
    active = i;
    var w = WAY[i];
    rcDate.textContent = w.date;
    rcKey.textContent = w.key ? '关键节点' : '';
    rcTitle.textContent = w.title;
    rcDesc.textContent = w.desc;
    rcMore.textContent = w.more;
    if (rcImg) {
      rcImg.src = WAY_IMGS[i];
      rcImg.alt = w.title;
      rcImg.setAttribute('data-lb-cap', w.title + '（历史场景想象图）');
    }

    while (rcLinks.firstChild) rcLinks.removeChild(rcLinks.firstChild);
    if (w.link) {
      var a = document.createElement('a');
      a.className = 'rc-link';
      a.href = w.link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = w.link.label + ' <i>↗</i>';
      rcLinks.appendChild(a);
    }

    callout.classList.remove('show');
    void callout.offsetWidth;
    callout.classList.add('show');
    if (rsNow) rsNow.textContent = w.date + ' · ' + w.label;
    positionCallout(i);
    updatePanel(i);
  }

  /* 平滑滚动到路线的某个进度（0—1）；点位/刻度/故事标记共用 */
  function scrollToProgress(p) {
    takeOver();
    if (!routeScroll) return;
    var total = routeScroll.offsetHeight - window.innerHeight;
    var top = routeScroll.getBoundingClientRect().top + window.pageYOffset;
    var target = total > 0 ? top + total * p + 2 : top;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    target = Math.max(0, Math.min(max, target));
    try {
      window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    } catch (e) {
      window.scrollTo(0, target);
    }
  }

  /* 点击点位 / 刻度：时间线平滑跳转至该节点 */
  function jumpTo(i) {
    setActive(i);
    scrollToProgress(i / (WAY.length - 1));
  }

  function positionCallout(i) {
    if (!mapSvg || !canvas) return;
    var w = WAY[i], p = proj(w.lon, w.lat);
    var svgRect = mapSvg.getBoundingClientRect();
    var cvRect = canvas.getBoundingClientRect();
    if (!svgRect.width || !cvRect.width) return;

    if (window.innerWidth < 720) {
      callout.style.left=''; callout.style.top='';
      callout.style.right=''; callout.style.bottom='';
      return;
    }

    var scale = Math.min(svgRect.width / VBW, svgRect.height / VBH);
    var offX = (svgRect.width - VBW * scale) / 2;
    var offY = (svgRect.height - VBH * scale) / 2;
    var x = (svgRect.left - cvRect.left) + offX + (p[0] - VBX) * scale;
    var y = (svgRect.top - cvRect.top) + offY + (p[1] - VBY) * scale;

    var cw = callout.offsetWidth || 330, ch = callout.offsetHeight || 190;
    var left, top;
    if (x > cvRect.width * 0.52) {
      left = x - cw - 22;
      if (left < 10) left = x + 22;
    } else {
      left = x + 22;
      if (left + cw > cvRect.width - 10) left = x - cw - 22;
    }
    top = y - ch / 2;
    top = Math.max(10, Math.min(cvRect.height - ch - 10, top));
    callout.style.left = left + 'px';
    callout.style.top = top + 'px';
  }

  function updateRoute() {
    if (!routeScroll || !lens.main) return;
    var rect = routeScroll.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    var p = total > 0 ? (-rect.top) / total : 0;
    p = Math.max(0, Math.min(1, p));

    if (!reduce) {
      routeMain.style.strokeDashoffset = lens.main * (1 - Math.min(1, p / 0.82));
      routeJoin.style.opacity = p > 0.82 ? Math.min(1, (p - 0.82) / 0.14) : 0;
    }

    var N = WAY.length;
    markers.forEach(function (m, i) {
      var lit = p >= i / (N - 1) - 0.03;
      m.circle.setAttribute('fill', lit ? '#F3EADA' : 'rgba(243,234,218,.35)');
      m.circle.setAttribute('stroke', lit ? 'var(--vermilion)' : 'rgba(199,154,59,.4)');
      m.label.setAttribute('fill', lit ? 'rgba(243,234,218,.92)' : 'rgba(243,234,218,.45)');
      if (WAY[i].key && lit) m.halo.setAttribute('opacity', 0.18);
      else m.halo.setAttribute('opacity', 0);
    });

    if (rsFill) rsFill.style.width = (p * 100) + '%';
    if (rsDot) rsDot.style.left = (p * 100) + '%';
    ticks.forEach(function (t, i) {
      t.classList.toggle('on', p >= i / (N - 1) - 0.03);
    });

    var act = Math.round(p * (N - 1));
    act = Math.max(0, Math.min(N - 1, act));
    setActive(act);
    positionCallout(act);
    updateStory(p);
  }

  if (mapSvg) {
    try {
      buildTroop();
      buildRoute();
      buildStories();
      updateRoute();
    } catch (err) { /* 路线图异常不影响全站 */ }
  }

  /* ---------- 跨时空对话：自动轮播 ---------- */
  var ECHO = [
    { q: '何为信仰？',
      old: '哪怕只剩一个人，也要把红旗插到目的地——因为他们相信，这条路的尽头是中国的光明。',
      now: '把一篇论文改到极致、把一个实验重复百次，是我对“把不可能变成可能”最朴素的注解。' },
    { q: '何为坚持？',
      old: '雪山草地之间，没有路就踩出路来；草根皮带咽下去，脚步依然向前。',
      now: '实验室的深夜、图书馆的清晨，把“再试一次”变成肌肉记忆，就是我的爬雪山、过草地。' },
    { q: '何为青年？',
      old: '这支队伍里，许多人不过二十岁上下，却扛起了一个民族的走向。',
      now: '青年的选择，就是时代的答案。走好脚下的每一步，便是最好的纪念。' },
    { q: '何为人民？',
      old: '于都河畔的门板、老乡递上的半袋青稞，军民之间是生死相依、患难与共。',
      now: '从乡村振兴到社区志愿，把个人的成长写进更多人的生活里，让“为人民服务”落在实处。' }
  ];
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.echo-tab'));
  var echoOld = document.getElementById('echoOld');
  var echoNow = document.getElementById('echoNow');
  var echoIndex = -1, autoTimer = null, echoStarted = false;

  function playEcho(i) {
    if (i === echoIndex) return;
    echoIndex = i;
    tabs.forEach(function (t, j) {
      t.classList.toggle('on', j === i);
      t.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    echoOld.classList.remove('play');
    echoNow.classList.remove('play');
    void echoOld.offsetWidth;
    echoOld.textContent = ECHO[i].old;
    echoNow.textContent = ECHO[i].now;
    echoOld.classList.add('play');
    echoNow.classList.add('play');
  }
  function startEcho() {
    if (echoStarted) return;
    echoStarted = true;
    playEcho(0);
    if (!reduce) {
      autoTimer = setInterval(function () {
        playEcho((echoIndex + 1) % ECHO.length);
      }, 6500);
    }
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () {
      playEcho(i);
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) startEcho();
    }, { threshold: 0.25 }).observe(document.querySelector('.echo-stage'));
  } else {
    startEcho();
  }

  /* ---------- 顶部进度条 + 统一滚动调度 ---------- */
  var bar = document.getElementById('progressBar');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.pageYOffset / max : 0;
      bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)) + ')';
      updateRoute();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', function () { buildTour(); updateRoute(); });
  window.addEventListener('resize', function () { buildTour(); updateRoute(); positionCallout(Math.max(0, active)); });
})();