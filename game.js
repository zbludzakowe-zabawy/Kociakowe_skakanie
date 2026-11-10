/* Kociakowe skakanie – gra dla 1–4 graczy na telefon i komputer. */
'use strict';

(() => {
  // ---------------------------------------------------------------------------
  // Stałe gry (jednostki świata: korytarz ma wysokość H)
  // ---------------------------------------------------------------------------
  const H = 400;            // wysokość korytarza (od sufitu do podłogi)
  const BAND = 46;          // grubość sufitu / podłogi rysowanych poza korytarzem
  const CAT_R = 15;         // promień „hitboxa” kotka
  const GRAVITY = 1500;
  const JUMP_V = -430;
  const MAX_FALL = 650;
  const SPIKE_H = 28;
  const STUN_TIME = 1.0;    // sekunda bez ruchu po zderzeniu
  const INVULN_TIME = 1.2;  // chwila ochrony po odzyskaniu ruchu
  const WIN_POINTS = 8;
  const COUNT_STEP = 0.8;   // czas jednej cyfry odliczania (s)
  const CELEBRATE_TIME = 1.6;
  const START_X = 80;

  // Znajdźki na mapie
  const MOUSE_FROM = 2;     // myszy od 2. levelu
  const FISH_FROM = 4;      // ryby od 4. levelu
  const CHEESE_FROM = 6;    // sery od 6. levelu
  const MOUSE_BOOST = 1.18; // mysz: kotek biegnie trochę szybciej…
  const MOUSE_TIME = 3;     // …przez 3 sekundy
  const SLOW_SPEED = 170;   // ser po myszy: wolniej niż na 1. levelu (215)…
  const SLOW_TIME = 4;      // …przez 4 sekundy
  const ITEM_R = { mouse: 8, fish: 10, cheese: 10 };

  const PLAYERS = [
    { name: 'Turkusowy', color: '#1fd1c1', dark: '#0d8a80' },
    { name: 'Różowy',    color: '#ff7eb9', dark: '#c9437f' },
    { name: 'Fioletowy', color: '#a66bff', dark: '#6a35c2' },
    { name: 'Czerwony',  color: '#ff4b4b', dark: '#b51f1f' },
  ];
  // Sterowanie (klawisz + róg ekranu z łapką)
  const CONTROLS = {
    q: { key: 'q', corner: 'tl', cornerName: 'lewy górny róg' },
    z: { key: 'z', corner: 'bl', cornerName: 'lewy dolny róg' },
    p: { key: 'p', corner: 'tr', cornerName: 'prawy górny róg' },
    m: { key: 'm', corner: 'br', cornerName: 'prawy dolny róg' },
  };
  // Przy dwóch graczach gracze są po skosie: lewy górny róg (Q) i prawy dolny róg (M).
  const CONTROL_LAYOUT = {
    1: ['q'],
    2: ['q', 'm'],
    3: ['q', 'z', 'p'],
    4: ['q', 'z', 'p', 'm'],
  };
  function ctrl(i) { return CONTROLS[(CONTROL_LAYOUT[numPlayers] || CONTROL_LAYOUT[4])[i]]; }
  function keyToPlayer(k) {
    const layout = CONTROL_LAYOUT[numPlayers] || CONTROL_LAYOUT[4];
    return layout.indexOf(k);
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const menuEl = $('menu');
  const pauseEl = $('pause');
  const gameoverEl = $('gameover');
  const pauseBtn = $('pauseBtn');
  const muteBtn = $('muteBtn');

  let W = 0, Hs = 0, DPR = 1, safeTop = 0;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    Hs = window.innerHeight;
    const probe = $('safeProbe');
    safeTop = probe ? parseFloat(getComputedStyle(probe).paddingTop) || 0 : 0;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(Hs * DPR);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ---------------------------------------------------------------------------
  // Dźwięk (WebAudio, proste bipnięcia)
  // ---------------------------------------------------------------------------
  let actx = null;
  let muted = false;
  try { muted = localStorage.getItem('kociaki-muted') === '1'; } catch (e) { /* brak dostępu */ }

  function ensureAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  function tone(freq, dur, type = 'square', vol = 0.06, slideTo = 0, delay = 0) {
    if (muted || !actx) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const sfx = {
    jump: (i) => tone(520 + i * 90, 0.09, 'triangle', 0.05, 820 + i * 90),
    hit: () => { tone(200, 0.25, 'sawtooth', 0.06, 70); tone(900, 0.08, 'square', 0.03, 400); },
    count: () => tone(660, 0.15, 'square', 0.05),
    go: () => tone(990, 0.35, 'square', 0.06, 1320),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, 0, i * 0.11)),
    mouse: () => { tone(1200, 0.06, 'square', 0.04, 1600); tone(1500, 0.08, 'square', 0.04, 2000, 0.06); },
    fish: () => [784, 988, 1318].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, 0, i * 0.07)),
    cheese: () => tone(500, 0.4, 'sawtooth', 0.05, 160),
    shield: () => { tone(1500, 0.15, 'triangle', 0.06, 700); tone(300, 0.12, 'sine', 0.05, 600); },
    bigWin: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, 0, i * 0.13)),
  };
  function updateMuteBtn() { muteBtn.textContent = muted ? '🔇 Dźwięk: wył.' : '🔊 Dźwięk: wł.'; }
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('kociaki-muted', muted ? '1' : '0'); } catch (e) { /* ignoruj */ }
    updateMuteBtn();
  });
  updateMuteBtn();

  // ---------------------------------------------------------------------------
  // Generator poziomów (deterministyczny – każdy gracz ma tę samą mapę)
  // ---------------------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function makeLevel(n, players = 1) {
    const rnd = mulberry32(n * 7919 + 1234);
    const range = (a, b) => a + rnd() * (b - a);
    const d = clamp((n - 1) / 9, 0, 1);          // trudność 0..1
    const length = 2600 + (n - 1) * 1100;        // mapa coraz dłuższa
    const speed = 215 + Math.min(n - 1, 12) * 8; // i coraz szybsza
    const spikes = [];
    const saws = [];

    const pool = [['floor', 3], ['ceil', 3], ['saw', 2]];
    if (n >= 2) pool.push(['both', 2], ['sawFloor', 2]);
    if (n >= 3) pool.push(['msaw', 2 + d * 2]);
    if (n >= 4) pool.push(['gate', 1 + d * 3]);
    if (n >= 6) pool.push(['tunnel', 1 + d * 2]);
    const total = pool.reduce((s, p) => s + p[1], 0);
    const pick = () => {
      let r = rnd() * total;
      for (const [name, w] of pool) { if ((r -= w) <= 0) return name; }
      return pool[0][0];
    };
    const sawR = () => range(28, 36) + d * 16;
    const stripW = () => range(80, 140 + d * 240);

    let x = 520;
    const gaps = [];  // wolne miejsca między przeszkodami – tam stawiamy znajdźki
    while (x < length - 380) {
      const type = pick();
      let w = 0;
      switch (type) {
        case 'floor': w = stripW(); spikes.push({ x, w, side: 'floor' }); break;
        case 'ceil': w = stripW(); spikes.push({ x, w, side: 'ceil' }); break;
        case 'both': w = stripW() * 0.8; spikes.push({ x, w, side: 'floor' }, { x, w, side: 'ceil' }); break;
        case 'saw': {
          const r = sawR();
          saws.push({ x: x + r, y: range(130, 270), r, amp: 0, freq: 0, phase: 0, spin: range(5, 8) });
          w = r * 2; break;
        }
        case 'sawFloor': {
          w = stripW() + 60;
          spikes.push({ x, w, side: 'floor' });
          const r = sawR();
          saws.push({ x: x + w / 2, y: range(110, 160), r, amp: 0, freq: 0, phase: 0, spin: range(5, 8) });
          break;
        }
        case 'msaw': {
          const r = sawR();
          saws.push({ x: x + r, y: H / 2, r, amp: range(70, 90) + d * 40, freq: range(1.3, 1.8) + d * 1.2, phase: range(0, 6.28), spin: range(6, 9) });
          w = r * 2; break;
        }
        case 'gate': {
          const r = range(38, 46);
          const gap = lerp(190, 135, d);
          const c = range(140, H - 140);
          saws.push({ x: x + r, y: c - gap / 2 - r, r, amp: 0, freq: 0, phase: 0, spin: 7 });
          saws.push({ x: x + r, y: c + gap / 2 + r, r, amp: 0, freq: 0, phase: 0, spin: -7 });
          w = r * 2; break;
        }
        case 'tunnel': {
          w = range(260, 420);
          spikes.push({ x, w, side: 'floor' }, { x, w, side: 'ceil' });
          const r = 30;
          saws.push({ x: x + w / 2, y: H / 2, r, amp: 85, freq: range(1.4, 2.0), phase: range(0, 6.28), spin: 8 });
          break;
        }
      }
      const space = range(lerp(330, 180, d), lerp(560, 330, d));
      gaps.push({ a: x + w, b: x + w + space });
      x += w + space;
    }

    // dekoracje tła
    const deco = [];
    for (let i = 0; i < length / 260; i++) {
      deco.push({ x: i * 260 + range(0, 140), kind: Math.floor(range(0, 5)), y: range(60, H - 120) });
    }
    return { n, length, speed, spikes, saws, deco, items: placeItems(n, players, length, gaps) };
  }

  // Myszy, ryby i sery rozrzucone po całej mapie. Osobny generator liczb,
  // żeby przeszkody wyglądały tak samo jak wcześniej.
  function placeItems(n, players, length, gaps) {
    const rnd = mulberry32(n * 104729 + 77);
    const range = (a, b) => a + rnd() * (b - a);
    const kinds = [];
    if (n >= MOUSE_FROM) for (let i = 0; i < 3 + Math.floor((n - MOUSE_FROM) / 2); i++) kinds.push('mouse');
    if (n >= FISH_FROM) for (let i = 0; i < players + 1; i++) kinds.push('fish');
    if (n >= CHEESE_FROM) for (let i = 0; i < 2 + Math.floor((n - CHEESE_FROM) / 3); i++) kinds.push('cheese');
    if (!kinds.length) return [];
    // przemieszaj rodzaje, żeby każdy był w innej części mapy
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const usable = gaps.filter((g) => g.b - g.a >= 120);
    if (!usable.length) usable.push({ a: 400, b: length - 200 });
    const used = new Array(usable.length).fill(0);
    const items = [];
    const T = kinds.length;
    const first = usable[0].a, lastB = usable[usable.length - 1].b;
    kinds.forEach((kind, i) => {
      // miejsce docelowe: równo rozłożone od początku do końca mapy
      const want = lerp(first, lastB, (i + 0.5) / T);
      let best = 0, bestScore = Infinity;
      usable.forEach((g, gi) => {
        const score = Math.abs((g.a + g.b) / 2 - want) + used[gi] * 100000;
        if (score < bestScore) { bestScore = score; best = gi; }
      });
      const g = usable[best];
      const k = used[best]++;
      const margin = 50;
      const span = Math.max(0, g.b - g.a - margin * 2);
      // jeśli w jednej przerwie jest kilka znajdziek, stoją obok siebie
      const ix = g.a + margin + (k === 0 ? range(0.25, 0.75) : (k % 2 ? 0.1 : 0.9)) * span;
      const iy = range(70, H - 50);
      items.push({ kind, x: ix, y: iy, r: ITEM_R[kind], taken: false, bob: range(0, 6.28) });
    });
    return items;
  }

  // ---------------------------------------------------------------------------
  // Stan gry
  // ---------------------------------------------------------------------------
  let numPlayers = 2;
  let cats = [];
  let scores = [0, 0, 0, 0];
  let levelNo = 1;
  let level = null;
  let state = 'menu';    // menu | countdown | play | celebrate | gameover
  let paused = false;
  let time = 0;          // czas poziomu (ruch pił)
  let countT = 0;
  let lastCount = -1;
  let goFlash = 0;
  let celebrateT = 0;
  let levelWinner = -1;
  let particles = [];
  let floaters = [];     // napisy nad kotkami („Szybciej!” itp.)
  let cam = { x: 0, scale: 1 };
  const pressFlash = [0, 0, 0, 0];

  // ---------------------------------------------------------------------------
  // Zapis stanu: telefon może zamknąć aplikację w tle, a „Odśwież” przeładowuje
  // stronę – zapamiętujemy liczbę graczy, wyniki i level, od którego grać dalej.
  // ---------------------------------------------------------------------------
  const SAVE_KEY = 'kociakowe-skakanie-gra';
  const RESUME_KEY = 'kociakowe-skakanie-wznow';
  const inMatch = () => state === 'countdown' || state === 'play' || state === 'celebrate';

  function saveGame() {
    if (!inMatch()) return;
    const data = {
      numPlayers,
      scores: scores.slice(0, 4),
      // po dobiegnięciu do mety gramy dalej od następnego levelu
      levelNo: state === 'celebrate' ? levelNo + 1 : levelNo,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* trudno */ }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* trudno */ }
  }
  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!d || !(d.numPlayers >= 1 && d.numPlayers <= 4) || !(d.levelNo >= 1) || !Array.isArray(d.scores)) return null;
      const sc = [0, 1, 2, 3].map((i) => clamp(Math.floor(Number(d.scores[i]) || 0), 0, WIN_POINTS - 1));
      return { numPlayers: d.numPlayers, levelNo: Math.floor(d.levelNo), scores: sc };
    } catch (e) { return null; }
  }
  function onLeave() {
    saveGame();
    try {
      if (inMatch()) sessionStorage.setItem(RESUME_KEY, '1');
      else sessionStorage.removeItem(RESUME_KEY);
    } catch (e) { /* trudno */ }
  }
  window.addEventListener('pagehide', onLeave);

  function resumeSaved(d) {
    numPlayers = d.numPlayers;
    scores = d.scores.slice();
    levelWinner = -1;
    paused = false;
    loadLevel(d.levelNo);
    startCountdown();
    showOnly(null);
    pauseBtn.classList.remove('hidden');
    setPlaying(true);
  }

  function updateResumeBtn() {
    const d = loadSave();
    const btn = $('resumeSavedBtn');
    btn.hidden = !d;
    if (d) {
      const pts = d.scores.slice(0, d.numPlayers).join(' : ');
      $('resumeSavedInfo').textContent =
        `Level ${d.levelNo} · ${d.numPlayers} ${d.numPlayers === 1 ? 'gracz' : 'graczy'} · wynik ${pts}`;
    }
  }

  function setPlaying(on) { document.body.classList.toggle('playing', on); }

  function newCat(id) {
    return {
      id,
      x: START_X,
      y: H - CAT_R - 40 - id * 70,
      vy: 0,
      stun: 0,
      invuln: 0,
      onGround: false,
      finished: false,
      run: Math.random() * 6,
      boost: 0,      // mysz: pozostały czas przyspieszenia
      slow: 0,       // ser po myszy: pozostały czas spowolnienia
      shields: 0,    // ryby: ile razy można dotknąć kolców / piły
      shieldPass: 0, // trwa przechodzenie przez przeszkodę dzięki rybie
      shieldClear: 0,
    };
  }

  function loadLevel(n) {
    levelNo = n;
    level = makeLevel(n, numPlayers);
    cats = [];
    for (let i = 0; i < numPlayers; i++) cats.push(newCat(i));
    time = 0;
    particles = particles.filter((p) => p.screen);
    floaters = [];
    const s = baseScale();
    cam.scale = s;
    cam.x = START_X - (W / s) * 0.3;
  }

  function startCountdown() {
    state = 'countdown';
    countT = 3 * COUNT_STEP;
    lastCount = -1;
    saveGame();
  }

  function startGame(n) {
    numPlayers = n;
    scores = [0, 0, 0, 0];
    levelWinner = -1;
    paused = false;
    loadLevel(1);
    startCountdown();
    showOnly(null);
    pauseBtn.classList.remove('hidden');
    setPlaying(true);
  }

  function showOnly(el) {
    [menuEl, pauseEl, gameoverEl].forEach((e) => e.classList.toggle('hidden', e !== el));
  }

  function goMenu() {
    saveGame();
    state = 'menu';
    paused = false;
    showOnly(menuEl);
    pauseBtn.classList.add('hidden');
    setPlaying(false);
    renderPlayerList();
    updateResumeBtn();
  }

  // ---------------------------------------------------------------------------
  // Sterowanie
  // ---------------------------------------------------------------------------
  function jump(id) {
    if (id >= numPlayers) return;
    pressFlash[id] = 1;
    if (state !== 'play' && state !== 'celebrate') return;
    if (paused) return;
    const c = cats[id];
    if (!c || c.stun > 0 || c.finished) return;
    c.vy = JUMP_V;
    c.onGround = false;
    sfx.jump(id);
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    const k = (e.key || '').toLowerCase();
    if (state === 'menu') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('startBtn').click(); }
      else if (['1', '2', '3', '4'].includes(k)) selectCount(Number(k));
      return;
    }
    if (e.key === 'Escape') { togglePause(); return; }
    const id = keyToPlayer(k);
    if (id >= 0) {
      e.preventDefault();
      if (e.repeat) return; // trzeba klikać, przytrzymanie nie działa
      jump(id);
    }
  });

  function cornerRadius() { return clamp(Math.min(W, Hs) * 0.24, 70, 170); }
  function cornerPos(corner) {
    return { x: corner[1] === 'l' ? 0 : W, y: corner[0] === 't' ? 0 : Hs };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ensureAudio();
    if (state === 'menu' || paused) return;
    const R = cornerRadius() * 1.25;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < numPlayers; i++) {
      const p = cornerPos(ctrl(i).corner);
      const dd = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (dd < R && dd < bestD) { best = i; bestD = dd; }
    }
    if (best >= 0) jump(best);
  }, { passive: false });
  // blokada gestów przewijania / powiększania na telefonie
  ['touchstart', 'touchmove', 'gesturestart', 'dblclick'].forEach((ev) =>
    canvas.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onLeave();
    if (document.hidden && !paused && (state === 'play' || state === 'countdown' || state === 'celebrate')) togglePause();
  });

  function togglePause() {
    if (state === 'menu' || state === 'gameover') return;
    paused = !paused;
    showOnly(paused ? pauseEl : null);
  }
  pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
  $('resumeBtn').addEventListener('click', togglePause);
  $('restartBtn').addEventListener('click', () => startGame(numPlayers));
  $('toMenuBtn').addEventListener('click', goMenu);
  $('newGameBtn').addEventListener('click', () => startGame(numPlayers));
  $('endBtn').addEventListener('click', goMenu);
  $('continueBtn').addEventListener('click', () => {
    // kolejne levele: nowa rozgrywka do 8 punktów, ale od następnego (trudniejszego) levelu
    scores = [0, 0, 0, 0];
    paused = false;
    showOnly(null);
    pauseBtn.classList.remove('hidden');
    setPlaying(true);
    loadLevel(levelNo + 1);
    startCountdown();
  });
  $('resumeSavedBtn').addEventListener('click', () => {
    ensureAudio();
    const d = loadSave();
    if (d) resumeSaved(d);
  });

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------
  function selectCount(n) {
    numPlayers = n;
    document.querySelectorAll('#playerCount button').forEach((b) =>
      b.classList.toggle('selected', Number(b.dataset.n) === n));
    renderPlayerList();
  }
  document.querySelectorAll('#playerCount button').forEach((b) =>
    b.addEventListener('click', () => { ensureAudio(); selectCount(Number(b.dataset.n)); }));

  function renderPlayerList() {
    const list = $('playerList');
    list.innerHTML = '';
    for (let i = 0; i < numPlayers; i++) {
      const p = PLAYERS[i];
      const card = document.createElement('div');
      card.className = 'player-card';
      const cv = document.createElement('canvas');
      cv.width = 180; cv.height = 126;
      const c2 = cv.getContext('2d');
      c2.scale(3, 3);
      drawCat(c2, 30, 24, i, { run: 1.2, scale: 1.25 });
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend',
        `<b style="color:${p.dark}">Gracz ${i + 1}: ${p.name}</b><br>` +
        `Klawisz <kbd>${ctrl(i).key.toUpperCase()}</kbd><br><small>${ctrl(i).cornerName}</small>`);
      list.appendChild(card);
    }
  }

  $('startBtn').addEventListener('click', () => {
    ensureAudio();
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      const de = document.documentElement;
      const req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (req) {
        try {
          const pr = req.call(de);
          if (pr && pr.then) {
            pr.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
              .catch(() => {});
          }
        } catch (e) { /* ignoruj */ }
      }
    }
    startGame(numPlayers);
  });

  // ---------------------------------------------------------------------------
  // Logika
  // ---------------------------------------------------------------------------
  function sawPos(s) {
    return { x: s.x, y: s.y + (s.amp ? Math.sin(time * s.freq + s.phase) * s.amp : 0) };
  }

  function hitsObstacle(c) {
    const r = CAT_R - 3; // odrobina wyrozumiałości
    for (const sp of level.spikes) {
      if (c.x + r < sp.x + 6 || c.x - r > sp.x + sp.w - 6) continue;
      if (sp.side === 'floor' && c.y + r > H - SPIKE_H + 8) return true;
      if (sp.side === 'ceil' && c.y - r < SPIKE_H - 8) return true;
    }
    for (const s of level.saws) {
      const p = sawPos(s);
      if (Math.hypot(c.x - p.x, c.y - p.y) < s.r * 0.88 + r) return true;
    }
    return false;
  }

  function catSpeed(c, lead) {
    if (c.slow > 0) return SLOW_SPEED; // po serze nie ma doganiania
    // kto zostaje w tyle, ten trochę przyspiesza i dogania innych
    const gap = lead - c.x;
    const catchUp = gap > 30 ? 1 + Math.min(0.35, gap / 900) : 1;
    return level.speed * catchUp * (c.boost > 0 ? MOUSE_BOOST : 1);
  }

  function floatText(c, text, color) {
    floaters.push({ x: c.x, y: c.y - 34, text, color, life: 1.2, max: 1.2 });
  }

  function collectItems(c) {
    for (const it of level.items) {
      if (it.taken) continue;
      if (Math.hypot(c.x - it.x, c.y - it.y) > CAT_R + it.r) continue;
      if (it.kind === 'mouse') {
        it.taken = true;
        c.boost = MOUSE_TIME;
        sfx.mouse();
        floatText(c, 'Szybciej!', '#1fd1c1');
        burst(it.x, it.y, '#b9b9c9', 8, 140);
      } else if (it.kind === 'fish') {
        it.taken = true;
        c.shields++;
        sfx.fish();
        floatText(c, 'Tarcza!', '#3aa7ff');
        burst(it.x, it.y, '#7fd6ff', 10, 160);
      } else if (it.kind === 'cheese' && c.boost > 0) {
        // ser działa tylko zaraz po myszy – inaczej zostaje na mapie
        it.taken = true;
        c.boost = 0;
        c.slow = SLOW_TIME;
        sfx.cheese();
        floatText(c, 'Wolniej…', '#e0a100');
        burst(it.x, it.y, '#ffd35a', 10, 140);
      }
    }
  }

  function leaderX() {
    let m = -Infinity;
    for (const c of cats) m = Math.max(m, c.x);
    return m;
  }

  function stepCat(c, dt, lead) {
    c.run += dt * 14;
    if (c.finished) {
      c.x += level.speed * dt * 0.6;
      c.vy += GRAVITY * dt; c.y = Math.min(H - CAT_R, c.y + c.vy * dt);
      if (c.y >= H - CAT_R) { c.vy = 0; c.onGround = true; }
      return;
    }
    if (c.boost > 0) c.boost = Math.max(0, c.boost - dt);
    if (c.slow > 0) c.slow = Math.max(0, c.slow - dt);
    if (c.stun > 0) {
      c.stun -= dt;
      if (c.stun <= 0) { c.stun = 0; c.invuln = INVULN_TIME; }
      return; // zamrożony
    }
    if (c.invuln > 0) c.invuln -= dt;

    c.x += catSpeed(c, lead) * dt;

    c.vy = Math.min(c.vy + GRAVITY * dt, MAX_FALL);
    c.y += c.vy * dt;
    c.onGround = false;
    if (c.y > H - CAT_R) { c.y = H - CAT_R; c.vy = 0; c.onGround = true; }
    if (c.y < CAT_R) { c.y = CAT_R; if (c.vy < 0) c.vy = 0; }

    collectItems(c);

    if (c.shieldPass > 0) {
      // ryba chroni, dopóki kotek nie wyjdzie z przeszkody, którą dotknął
      c.shieldPass -= dt;
      c.shieldClear = hitsObstacle(c) ? 0 : c.shieldClear + dt;
      if (c.shieldClear > 0.12 || c.shieldPass <= 0) c.shieldPass = 0;
    } else if (c.invuln <= 0 && c.shields > 0 && hitsObstacle(c)) {
      c.shields--;
      c.shieldPass = 2.5;
      c.shieldClear = 0;
      sfx.shield();
      floatText(c, 'Uff!', '#3aa7ff');
      burst(c.x, c.y, '#7fd6ff', 14, 200);
    } else if (c.invuln <= 0 && hitsObstacle(c)) {
      c.stun = STUN_TIME;
      c.vy = 0;
      sfx.hit();
      burst(c.x, c.y, '#ffe066', 14, 220);
      burst(c.x, c.y, PLAYERS[c.id].color, 8, 160);
    }

    if (c.x >= level.length) {
      c.finished = true;
      onFinish(c);
    }
  }

  function onFinish(c) {
    if (state !== 'play') return;
    levelWinner = c.id;
    scores[c.id]++;
    state = 'celebrate';
    celebrateT = CELEBRATE_TIME;
    sfx.win();
    if (scores[c.id] < WIN_POINTS) saveGame(); else clearSave();
    for (let i = 0; i < 70; i++) {
      particles.push({
        screen: true,
        x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 200, vy: 100 + Math.random() * 250,
        life: 2.5, max: 2.5, size: 5 + Math.random() * 5,
        color: [PLAYERS[c.id].color, '#ffd35a', '#fff', PLAYERS[c.id].dark][i % 4],
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, g: 220,
      });
    }
  }

  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.4 + Math.random() * 0.6);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, max: 0.6,
        size: 3 + Math.random() * 3, color, rot: 0, vr: 0, g: 300,
      });
    }
  }

  function update(dt) {
    for (let i = 0; i < 4; i++) pressFlash[i] = Math.max(0, pressFlash[i] - dt * 5);
    for (const p of particles) {
      p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) { f.life -= dt; f.y -= 30 * dt; }
    floaters = floaters.filter((f) => f.life > 0);
    if (goFlash > 0) goFlash -= dt;

    if (state === 'menu' || paused || !level) { updateCamera(dt, true); return; }

    if (state === 'countdown') {
      countT -= dt;
      const shown = Math.ceil(countT / COUNT_STEP);
      if (shown !== lastCount && shown > 0) { lastCount = shown; sfx.count(); }
      for (const c of cats) c.run += dt * 3;
      if (countT <= 0) { state = 'play'; goFlash = 0.9; sfx.go(); }
      updateCamera(dt);
      return;
    }

    if (state === 'play' || state === 'celebrate') {
      time += dt;
      const lead = leaderX();
      for (const c of cats) stepCat(c, dt, lead);
      if (state === 'celebrate') {
        celebrateT -= dt;
        if (celebrateT <= 0) {
          if (scores[levelWinner] >= WIN_POINTS) {
            endGame(levelWinner);
          } else {
            loadLevel(levelNo + 1);
            startCountdown();
          }
        }
      }
    }
    updateCamera(dt);
  }

  function endGame(winner) {
    state = 'gameover';
    clearSave();
    pauseBtn.classList.add('hidden');
    setPlaying(false);
    sfx.bigWin();
    const p = PLAYERS[winner];
    $('winnerText').innerHTML = `<span style="color:${p.dark}">${p.name} kotek</span> wygrywa grę! 🏆`;
    const wc = $('winnerCat').getContext('2d');
    wc.setTransform(1, 0, 0, 1, 0, 0);
    wc.clearRect(0, 0, 200, 140);
    wc.scale(3.2, 3.2);
    drawCat(wc, 31, 26, winner, { run: 0.5, scale: 1.3, happy: true });
    const fs = $('finalScores');
    fs.innerHTML = '';
    for (let i = 0; i < numPlayers; i++) {
      fs.insertAdjacentHTML('beforeend',
        `<span style="background:${PLAYERS[i].color}">${PLAYERS[i].name}: ${scores[i]}</span>`);
    }
    showOnly(gameoverEl);
  }

  // ---------------------------------------------------------------------------
  // Kamera: obejmuje wszystkie kotki, w razie potrzeby oddala widok
  // ---------------------------------------------------------------------------
  function baseScale() {
    return Math.min(Hs / (H + BAND * 2 + 70), W / 640);
  }

  function updateCamera(dt, idle) {
    const base = baseScale();
    if (!level) { cam.scale = base; return; }
    if (idle && state === 'menu') {
      cam.scale = base;
      cam.x += 60 * dt;
      if (cam.x > level.length) cam.x = -200;
      return;
    }
    let minX = Infinity, maxX = -Infinity;
    for (const c of cats) {
      if (c.finished && state !== 'celebrate') continue;
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    }
    if (minX === Infinity) { minX = maxX = START_X; }
    const spread = maxX - minX + 360;
    let target = base;
    if (spread > (W / base) * 0.85) target = Math.max(base * 0.6, W / (spread / 0.85));
    cam.scale += (target - cam.scale) * Math.min(1, dt * 3);
    const viewW = W / cam.scale;
    let tx = (minX + maxX) / 2 - viewW * 0.4;
    tx = Math.max(tx, maxX - viewW * 0.72); // lider zawsze widoczny
    tx = clamp(tx, -60, level.length + 260 - viewW);
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
  }

  // ---------------------------------------------------------------------------
  // Rysowanie
  // ---------------------------------------------------------------------------
  function corridorTop() {
    return (Hs - H * cam.scale) / 2 + Math.min(18, Hs * 0.03);
  }

  function drawCat(g, x, y, id, opt = {}) {
    const p = PLAYERS[id];
    const s = opt.scale || 1;
    const run = opt.run || 0;
    const air = opt.air || false;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    if (opt.tilt) g.rotate(opt.tilt);
    g.lineWidth = 1.6;
    g.strokeStyle = '#2b2d5c';
    g.lineJoin = 'round';
    g.lineCap = 'round';

    // ogon
    const tw = Math.sin(run * 0.8) * 4;
    g.beginPath();
    g.moveTo(-11, 1);
    g.quadraticCurveTo(-22, -2 + tw, -20, -13 + tw);
    g.strokeStyle = '#2b2d5c'; g.lineWidth = 5.5; g.stroke();
    g.strokeStyle = p.color; g.lineWidth = 3; g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = '#2b2d5c';

    // łapki
    const legs = air ? [[-7, 3], [-3, 3], [5, 3], [9, 3]] : [
      [-8, Math.sin(run) * 3], [-3, -Math.sin(run) * 3], [5, Math.sin(run) * 3], [9, -Math.sin(run) * 3],
    ];
    g.fillStyle = p.dark;
    for (const [lx, sw] of legs) {
      g.beginPath();
      g.ellipse(lx + sw * 0.5, air ? 8 : 9, 2.6, air ? 2.4 : 3.6, 0, 0, Math.PI * 2);
      g.fill(); g.stroke();
    }

    // tułów
    g.fillStyle = p.color;
    g.beginPath(); g.ellipse(0, 1, 13, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // brzuszek
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.ellipse(2, 5, 7, 3.5, 0, 0, Math.PI * 2); g.fill();

    // głowa
    const hx = 11, hy = -7;
    g.fillStyle = p.color;
    // uszy
    g.beginPath(); g.moveTo(hx - 8, hy - 3); g.lineTo(hx - 6, hy - 14); g.lineTo(hx - 1, hy - 7); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hx + 1, hy - 7); g.lineTo(hx + 7, hy - 14); g.lineTo(hx + 8, hy - 3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffc2dc';
    g.beginPath(); g.moveTo(hx - 6, hy - 5); g.lineTo(hx - 5.5, hy - 11); g.lineTo(hx - 3, hy - 7); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(hx + 3, hy - 7); g.lineTo(hx + 6.5, hy - 11); g.lineTo(hx + 6.5, hy - 5); g.closePath(); g.fill();
    g.fillStyle = p.color;
    g.beginPath(); g.arc(hx, hy, 9, 0, Math.PI * 2); g.fill(); g.stroke();

    // oczy
    if (opt.dizzy) {
      g.lineWidth = 1.4;
      for (const ex of [hx - 3, hx + 4]) {
        g.beginPath(); g.moveTo(ex - 1.8, hy - 2.8); g.lineTo(ex + 1.8, hy + 0.8);
        g.moveTo(ex + 1.8, hy - 2.8); g.lineTo(ex - 1.8, hy + 0.8); g.stroke();
      }
    } else if (opt.happy) {
      g.lineWidth = 1.5;
      for (const ex of [hx - 3, hx + 4]) { g.beginPath(); g.arc(ex, hy - 0.5, 2, Math.PI, 0); g.stroke(); }
    } else {
      g.fillStyle = '#2b2d5c';
      g.beginPath(); g.ellipse(hx - 3, hy - 1, 1.7, 2.4, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(hx + 4, hy - 1, 1.7, 2.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(hx - 2.5, hy - 2, 0.7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(hx + 4.5, hy - 2, 0.7, 0, Math.PI * 2); g.fill();
    }
    // nosek i pyszczek
    g.fillStyle = '#ff6f9f';
    g.beginPath(); g.moveTo(hx + 0, hy + 2); g.lineTo(hx + 2, hy + 2); g.lineTo(hx + 1, hy + 3.3); g.closePath(); g.fill();
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(hx + 1, hy + 3.3); g.quadraticCurveTo(hx - 0.5, hy + 5, hx - 1.5, hy + 4); g.stroke();
    g.beginPath(); g.moveTo(hx + 1, hy + 3.3); g.quadraticCurveTo(hx + 2.5, hy + 5, hx + 3.5, hy + 4); g.stroke();
    // wąsy
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(hx + 5, hy + 2); g.lineTo(hx + 12, hy + 1);
    g.moveTo(hx + 5, hy + 3); g.lineTo(hx + 12, hy + 4);
    g.moveTo(hx - 4, hy + 2); g.lineTo(hx - 10, hy + 1);
    g.stroke();
    g.restore();
  }

  function drawSpikes(g, sp, top, s) {
    const x0 = (sp.x - cam.x) * s;
    const wpx = sp.w * s;
    if (x0 > W || x0 + wpx < 0) return;
    const n = Math.max(1, Math.round(sp.w / 22));
    const tw = wpx / n;
    const hpx = SPIKE_H * s;
    const baseY = sp.side === 'floor' ? top + H * s : top;
    const dir = sp.side === 'floor' ? -1 : 1;
    g.fillStyle = '#c9d1e6';
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = Math.max(1, 2 * s);
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = x0 + i * tw;
      g.moveTo(a, baseY);
      g.lineTo(a + tw / 2, baseY + dir * hpx);
      g.lineTo(a + tw, baseY);
    }
    g.fill(); g.stroke();
    // połysk
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = Math.max(1, 1.5 * s);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = x0 + i * tw;
      g.moveTo(a + tw * 0.32, baseY + dir * hpx * 0.3);
      g.lineTo(a + tw * 0.46, baseY + dir * hpx * 0.75);
    }
    g.stroke();
  }

  function drawSaw(g, sw, top, s) {
    const p = sawPos(sw);
    const cx = (p.x - cam.x) * s;
    const cy = top + p.y * s;
    const r = sw.r * s;
    if (cx + r < 0 || cx - r > W) return;
    // linka dla ruchomej piły
    if (sw.amp) {
      g.strokeStyle = 'rgba(43,45,92,0.35)';
      g.lineWidth = Math.max(1, 3 * s);
      g.setLineDash([6 * s, 6 * s]);
      g.beginPath();
      g.moveTo(cx, top + (sw.y - sw.amp) * s);
      g.lineTo(cx, top + (sw.y + sw.amp) * s);
      g.stroke();
      g.setLineDash([]);
    }
    g.save();
    g.translate(cx, cy);
    g.rotate(time * sw.spin);
    const teeth = 14;
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.6) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      g.lineTo(Math.cos(a0) * r * 0.82, Math.sin(a0) * r * 0.82);
      g.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      g.lineTo(Math.cos(a2) * r * 0.82, Math.sin(a2) * r * 0.82);
    }
    g.closePath();
    g.fillStyle = '#d7dbe8';
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = Math.max(1, 2 * s);
    g.fill(); g.stroke();
    g.fillStyle = '#aeb5cc';
    g.beginPath(); g.arc(0, 0, r * 0.62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = Math.max(1, 2 * s);
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.arc(0, 0, r * 0.45, i * 2.1, i * 2.1 + 0.9); g.stroke();
    }
    g.fillStyle = '#ff4b4b';
    g.strokeStyle = '#2b2d5c';
    g.beginPath(); g.arc(0, 0, r * 0.2, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }

  // Mała szara mysz (dużo mniejsza od kotka)
  function drawMouse(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.strokeStyle = '#2b2d5c';
    g.lineJoin = 'round'; g.lineCap = 'round';
    // ogonek
    g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(-6, 2); g.quadraticCurveTo(-12, 2 + Math.sin(t * 6) * 3, -14, -3); g.stroke();
    // łapki
    g.fillStyle = '#ff9ec7';
    const st = Math.sin(t * 14) * 1.5;
    g.beginPath(); g.ellipse(-3 + st, 4.6, 1.6, 1.1, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(3 - st, 4.6, 1.6, 1.1, 0, 0, Math.PI * 2); g.fill();
    // ciałko
    g.fillStyle = '#a7a9bf';
    g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, 7, 4.8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // główka z uszkiem
    g.beginPath(); g.ellipse(6, -1.5, 3.8, 3, -0.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(4.5, -4.8, 2.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ffc2dc';
    g.beginPath(); g.arc(4.5, -4.8, 1.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2d5c';
    g.beginPath(); g.arc(7, -2.2, 0.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff6f9f';
    g.beginPath(); g.arc(9.8, -0.8, 0.9, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawFish(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.rotate(Math.sin(t * 3) * 0.12);
    // poświata – ryba daje tarczę
    g.fillStyle = 'rgba(127,214,255,0.35)';
    g.beginPath(); g.arc(0, 0, 15 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = 1.3;
    g.lineJoin = 'round';
    g.fillStyle = '#ff9f43';
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(-13, -6); g.lineTo(-13, 6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffb86b';
    g.beginPath(); g.ellipse(1, 0, 9, 5.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(43,45,92,0.5)';
    g.beginPath(); g.arc(-1, 0, 4, -1, 1); g.stroke();
    g.fillStyle = '#2b2d5c';
    g.beginPath(); g.arc(6, -1.2, 1.1, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawCheese(g, x, y, s, t) {
    g.save();
    g.translate(x, y + Math.sin(t * 2.5) * 1.5 * s);
    g.scale(s, s);
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = 1.3;
    g.lineJoin = 'round';
    g.fillStyle = '#ffd35a';
    g.beginPath(); g.moveTo(-10, 6); g.lineTo(10, 6); g.lineTo(10, -2); g.lineTo(-10, -7); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffe58f';
    g.beginPath(); g.moveTo(-10, -7); g.lineTo(10, -2); g.lineTo(6, -6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e0a100';
    for (const [hx, hy, hr] of [[-5, 1, 1.8], [2, 3, 1.4], [5, -0.5, 1.2], [-1, -1.5, 1]]) {
      g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawItems(g, top, s) {
    for (const it of level.items) {
      if (it.taken) continue;
      const x = (it.x - cam.x) * s;
      if (x < -30 * s || x > W + 30 * s) continue;
      const t = time + it.bob;
      const y = top + it.y * s;
      if (it.kind === 'mouse') drawMouse(g, x, y, s * 1.25, t);
      else if (it.kind === 'fish') drawFish(g, x, y + Math.sin(t * 2) * 2 * s, s * 1.1, t);
      else drawCheese(g, x, y, s * 1.1, t);
    }
  }

  function drawFinish(g, top, s) {
    const fx = (level.length - cam.x) * s;
    if (fx < -60 * s || fx > W + 60 * s) return;
    const cell = 20 * s;
    const rows = Math.ceil((H * s) / cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        g.fillStyle = (r + c) % 2 ? '#2b2d5c' : '#ffffff';
        g.fillRect(fx + c * cell, top + r * cell, cell, Math.min(cell, H * s - r * cell));
      }
    }
    // flaga
    g.fillStyle = '#ffd35a';
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = Math.max(1, 2 * s);
    g.beginPath();
    g.moveTo(fx + cell * 2, top + 30 * s);
    g.lineTo(fx + cell * 2 + 60 * s, top + 48 * s);
    g.lineTo(fx + cell * 2, top + 66 * s);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2b2d5c';
    g.font = `bold ${Math.round(16 * s)}px Trebuchet MS, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('META', fx + cell * 2 + 4 * s, top + 48 * s);
  }

  function drawStart(g, top, s) {
    const sx = (START_X + 30 - cam.x) * s;
    if (sx < -10 || sx > W + 10) return;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 4 * s;
    g.setLineDash([12 * s, 10 * s]);
    g.beginPath(); g.moveTo(sx, top); g.lineTo(sx, top + H * s); g.stroke();
    g.setLineDash([]);
  }

  function drawWorld(g) {
    const s = cam.scale;
    const top = corridorTop();

    // tło za korytarzem
    const grd = g.createLinearGradient(0, 0, 0, Hs);
    grd.addColorStop(0, '#3a3c7a');
    grd.addColorStop(1, '#2b2d5c');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, Hs);

    // ściana korytarza
    const wall = g.createLinearGradient(0, top, 0, top + H * s);
    wall.addColorStop(0, '#ffe9d1');
    wall.addColorStop(1, '#ffd6e5');
    g.fillStyle = wall;
    g.fillRect(0, top, W, H * s);

    // tapeta w paski (paralaksa)
    const stripe = 80 * s;
    const off = -((cam.x * s * 0.5) % (stripe * 2));
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = off - stripe * 2; x < W + stripe; x += stripe * 2) g.fillRect(x, top, stripe, H * s);

    // szlaczek pod sufitem: falbanka z serduszkami (przesuwa się razem z tapetą)
    const fw = 40 * s;
    const fy = top + 8 * s;
    const foff = -((cam.x * s * 0.5) % fw);
    g.fillStyle = '#ffb3d1';
    g.beginPath();
    g.moveTo(foff - fw, top);
    for (let x = foff - fw; x < W + fw; x += fw) {
      g.lineTo(x, fy);
      g.quadraticCurveTo(x + fw / 2, fy + 14 * s, x + fw, fy);
    }
    g.lineTo(W + fw, top);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff7eb9';
    for (let x = foff - fw; x < W + fw; x += fw) drawHeart(g, x + fw / 2, fy + 3 * s, 4 * s);
    g.strokeStyle = 'rgba(255,126,185,0.5)';
    g.lineWidth = Math.max(1, 1.5 * s);
    g.setLineDash([4 * s, 5 * s]);
    g.beginPath(); g.moveTo(0, fy + 22 * s); g.lineTo(W, fy + 22 * s); g.stroke();
    g.setLineDash([]);

    // dekoracje: okna, kłębki wełny, zegary, obrazki z łapką, kwiatki na półce
    for (const d of level ? level.deco : []) {
      const dx = (d.x - cam.x * 0.5) * s;
      if (dx < -100 * s || dx > W + 100 * s) continue;
      const dy = top + d.y * s;
      g.save();
      g.globalAlpha = 0.55;
      if (d.kind === 0) {
        g.fillStyle = '#9fd8ff';
        g.strokeStyle = '#c99a6b';
        g.lineWidth = 5 * s;
        g.fillRect(dx, dy, 70 * s, 60 * s);
        g.strokeRect(dx, dy, 70 * s, 60 * s);
        g.beginPath(); g.moveTo(dx + 35 * s, dy); g.lineTo(dx + 35 * s, dy + 60 * s);
        g.moveTo(dx, dy + 30 * s); g.lineTo(dx + 70 * s, dy + 30 * s); g.stroke();
      } else if (d.kind === 1) {
        g.fillStyle = '#ff9ec7';
        g.beginPath(); g.arc(dx, dy + 40 * s, 18 * s, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#e06a9e'; g.lineWidth = 2 * s;
        g.beginPath(); g.arc(dx, dy + 40 * s, 12 * s, 0.3, 2.5); g.stroke();
        g.beginPath(); g.arc(dx, dy + 40 * s, 6 * s, 3.5, 5.5); g.stroke();
      } else if (d.kind === 2) {
        // zegar ścienny – wskazówki naprawdę się kręcą
        const cx = dx + 25 * s, cy = dy + 30 * s, r = 22 * s;
        g.fillStyle = '#fff8ee';
        g.strokeStyle = '#c99a6b';
        g.lineWidth = 5 * s;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#c99a6b';
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, 1.4 * s, 0, Math.PI * 2); g.fill();
        }
        const tt = time + d.x * 0.01;
        g.strokeStyle = '#2b2d5c';
        g.lineCap = 'round';
        g.lineWidth = 3 * s;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(tt * 0.1 - 1.6) * r * 0.45, cy + Math.sin(tt * 0.1 - 1.6) * r * 0.45); g.stroke();
        g.lineWidth = 2 * s;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(tt * 1.2 - 1.6) * r * 0.7, cy + Math.sin(tt * 1.2 - 1.6) * r * 0.7); g.stroke();
      } else if (d.kind === 3) {
        // obrazek w ramce z kocią łapką
        g.fillStyle = '#ffd35a';
        g.fillRect(dx - 4 * s, dy - 4 * s, 58 * s, 68 * s);
        g.fillStyle = '#c3f0ea';
        g.fillRect(dx, dy, 50 * s, 60 * s);
        g.strokeStyle = '#c99a6b';
        g.lineWidth = 3 * s;
        g.beginPath(); g.moveTo(dx + 10 * s, dy - 4 * s); g.lineTo(dx + 25 * s, dy - 16 * s); g.lineTo(dx + 40 * s, dy - 4 * s); g.stroke();
        drawPaw(g, dx + 25 * s, dy + 33 * s, 18 * s, '#a66bff');
      } else {
        // półka z kwiatkiem w doniczce
        g.fillStyle = '#c99a6b';
        g.fillRect(dx - 10 * s, dy + 50 * s, 70 * s, 6 * s);
        g.fillStyle = '#4caf6e';
        g.beginPath(); g.ellipse(dx + 15 * s, dy + 22 * s, 6 * s, 11 * s, -0.5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(dx + 35 * s, dy + 22 * s, 6 * s, 11 * s, 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ff7eb9';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.beginPath(); g.arc(dx + 25 * s + Math.cos(a) * 7 * s, dy + 8 * s + Math.sin(a) * 7 * s, 5 * s, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#ffd35a';
        g.beginPath(); g.arc(dx + 25 * s, dy + 8 * s, 4.5 * s, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e0784a';
        g.beginPath();
        g.moveTo(dx + 12 * s, dy + 30 * s); g.lineTo(dx + 38 * s, dy + 30 * s);
        g.lineTo(dx + 34 * s, dy + 50 * s); g.lineTo(dx + 16 * s, dy + 50 * s); g.closePath(); g.fill();
      }
      g.restore();
    }

    if (level) {
      drawStart(g, top, s);
      drawFinish(g, top, s);
    }

    // sufit i podłoga
    const band = BAND * s;
    g.fillStyle = '#7a4b2a';
    g.fillRect(0, top - band, W, band);
    g.fillStyle = '#b5764a';
    g.fillRect(0, top + H * s, W, band);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2 * s;
    const plank = 90 * s;
    const poff = -((cam.x * s) % plank);
    g.beginPath();
    for (let x = poff; x < W + plank; x += plank) {
      g.moveTo(x, top + H * s); g.lineTo(x, top + H * s + band);
      g.moveTo(x + plank / 2, top - band); g.lineTo(x + plank / 2, top);
    }
    g.stroke();
    g.fillStyle = '#2b2d5c';
    g.fillRect(0, top - 3 * s, W, 3 * s);
    g.fillRect(0, top + H * s, W, 3 * s);

    if (!level) return;
    for (const sp of level.spikes) drawSpikes(g, sp, top, s);
    for (const sw of level.saws) drawSaw(g, sw, top, s);
    drawItems(g, top, s);

    // kotki (ostatni gracz na spodzie)
    for (let i = cats.length - 1; i >= 0; i--) {
      const c = cats[i];
      const sx = (c.x - cam.x) * s;
      const sy = top + c.y * s;
      if (sx < -40 * s || sx > W + 40 * s) continue;
      if (c.invuln > 0 && Math.floor(c.invuln * 12) % 2 === 0) continue; // miganie
      const tilt = c.stun > 0 ? Math.sin(time * 30) * 0.15 : clamp(c.vy / 1400, -0.35, 0.45);
      if (c.boost > 0 && !c.finished) {
        // smugi pędu po zjedzeniu myszy
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = Math.max(1, 2.5 * s);
        g.lineCap = 'round';
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const ly = sy + (k - 1) * 7 * s;
          const ox = ((time * 90 + k * 13) % 14) * s;
          g.moveTo(sx - (22 + ox) * s, ly); g.lineTo(sx - (34 + ox) * s, ly);
        }
        g.stroke();
      }
      g.save();
      if (c.stun > 0) g.globalAlpha = 0.85;
      drawCat(g, sx, sy - 2 * s, c.id, {
        scale: s * 1.2, run: c.run, air: !c.onGround, tilt,
        dizzy: c.stun > 0, happy: c.finished,
      });
      g.restore();
      if (c.shields > 0 || c.shieldPass > 0) {
        // bańka-tarcza od ryby
        g.save();
        g.globalAlpha = c.shieldPass > 0 ? 0.35 + 0.35 * Math.abs(Math.sin(time * 20)) : 0.55;
        g.strokeStyle = '#3aa7ff';
        g.fillStyle = 'rgba(127,214,255,0.18)';
        g.lineWidth = Math.max(1.5, 2.5 * s);
        g.beginPath(); g.arc(sx + 2 * s, sy - 4 * s, 26 * s, 0, Math.PI * 2); g.fill(); g.stroke();
        g.restore();
        if (c.shields > 1) {
          g.fillStyle = '#3aa7ff';
          g.font = `bold ${Math.max(9, Math.round(10 * s))}px Trebuchet MS, sans-serif`;
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          g.fillText(`×${c.shields}`, sx + 24 * s, sy - 22 * s);
        }
      }
      if (c.slow > 0 && !c.finished) {
        // po serze: senne „z” nad głową
        g.fillStyle = '#e0a100';
        g.font = `bold ${Math.max(9, Math.round(11 * s))}px Trebuchet MS, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (let k = 0; k < 2; k++) {
          const ph = (time * 0.9 + k * 0.5) % 1;
          g.globalAlpha = 1 - ph;
          g.fillText('z', sx - 14 * s - ph * 8 * s, sy - (28 + ph * 18) * s);
        }
        g.globalAlpha = 1;
      }
      if (c.stun > 0) {
        // gwiazdki nad głową
        for (let k = 0; k < 3; k++) {
          const a = time * 6 + k * 2.1;
          drawStar(g, sx + Math.cos(a) * 16 * s, sy - 26 * s + Math.sin(a) * 5 * s, 5 * s, '#ffd35a');
        }
      }
      // znacznik gracza
      g.fillStyle = PLAYERS[c.id].dark;
      g.font = `bold ${Math.max(10, Math.round(11 * s))}px Trebuchet MS, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(`${c.id + 1}`, sx + 2 * s, sy - 30 * s);
    }

    // napisy po zebraniu znajdźki
    for (const f of floaters) {
      g.save();
      g.globalAlpha = clamp(f.life / 0.4, 0, 1);
      g.font = `bold ${Math.max(11, Math.round(14 * s))}px Trebuchet MS, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.lineJoin = 'round';
      g.strokeStyle = '#fff';
      g.strokeText(f.text, (f.x - cam.x) * s, top + f.y * s);
      g.fillStyle = f.color;
      g.fillText(f.text, (f.x - cam.x) * s, top + f.y * s);
      g.restore();
    }

    // cząsteczki w świecie
    for (const p of particles) {
      if (p.screen) continue;
      g.globalAlpha = clamp(p.life / p.max, 0, 1);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc((p.x - cam.x) * s, top + p.y * s, p.size * s, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // wskaźniki kotków, które wypadły za lewą krawędź
    const R = cornerRadius();
    for (const c of cats) {
      const sx = (c.x - cam.x) * s;
      if (sx >= 0 || c.finished) continue;
      const sy = clamp(top + c.y * s, R + 16, Hs - R - 16);
      g.fillStyle = PLAYERS[c.id].color;
      g.strokeStyle = '#2b2d5c';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(4, sy); g.lineTo(22, sy - 12); g.lineTo(22, sy + 12); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#fff';
      g.font = 'bold 12px Trebuchet MS, sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.strokeText(`${c.id + 1}`, 26, sy);
      g.fillText(`${c.id + 1}`, 26, sy);
    }
  }

  function drawStar(g, x, y, r, color) {
    g.fillStyle = color;
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill(); g.stroke();
  }

  function drawHeart(g, x, y, r) {
    g.beginPath();
    g.moveTo(x, y + r);
    g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
    g.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
    g.fill();
  }

  function drawPaw(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x, y + r * 0.25, r * 0.5, r * 0.42, 0, 0, Math.PI * 2); g.fill();
    const toes = [[-0.55, -0.3], [-0.2, -0.62], [0.2, -0.62], [0.55, -0.3]];
    for (const [tx, ty] of toes) {
      g.beginPath(); g.ellipse(x + tx * r, y + ty * r, r * 0.17, r * 0.22, tx * 0.5, 0, Math.PI * 2); g.fill();
    }
  }

  function drawCorners(g) {
    const R = cornerRadius();
    const showKeys = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    for (let i = 0; i < numPlayers; i++) {
      const p = PLAYERS[i];
      const c = cornerPos(ctrl(i).corner);
      const f = pressFlash[i];
      const rr = R * (1 + f * 0.06);
      g.save();
      g.globalAlpha = 0.78 + f * 0.2;
      g.fillStyle = p.color;
      g.strokeStyle = '#2b2d5c';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(c.x, c.y);
      g.arc(c.x, c.y, rr, 0, Math.PI * 2);
      g.closePath();
      g.fill(); g.stroke();
      if (f > 0) {
        g.fillStyle = `rgba(255,255,255,${f * 0.5})`;
        g.fill();
      }
      g.globalAlpha = 1;
      // łapka przesunięta do środka ćwiartki
      const dx = c.x === 0 ? 1 : -1;
      const dy = c.y === 0 ? 1 : -1;
      const px = c.x + dx * rr * 0.45;
      const py = c.y + dy * rr * 0.45;
      drawPaw(g, px, py, rr * 0.32, 'rgba(255,255,255,0.92)');
      // numer gracza i klawisz
      g.font = `bold ${Math.round(rr * 0.15)}px Trebuchet MS, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = p.dark;
      const label = showKeys ? `${i + 1} · ${ctrl(i).key.toUpperCase()}` : `${i + 1}`;
      g.fillText(label, c.x + dx * rr * 0.78, c.y + dy * rr * 0.2);
      g.restore();
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawHUD(g) {
    if (!level || state === 'menu') return;
    const small = W < 600;
    const pill = small ? 30 : 36;
    const fs = small ? 13 : 15;
    g.font = `bold ${fs}px Trebuchet MS, sans-serif`;
    const lvlText = `Level ${levelNo}`;
    const lvlW = g.measureText(lvlText).width + 18;
    const scoreW = (small ? 46 : 54) * numPlayers;
    const totalW = lvlW + scoreW + 12;
    const x0 = W / 2 - totalW / 2;
    const y0 = 8 + safeTop;
    g.fillStyle = 'rgba(255,248,238,0.95)';
    g.strokeStyle = '#2b2d5c';
    g.lineWidth = 3;
    roundRect(g, x0, y0, totalW, pill, pill / 2);
    g.fill(); g.stroke();
    g.fillStyle = '#2b2d5c';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(lvlText, x0 + 12, y0 + pill / 2 + 1);
    const cell = scoreW / numPlayers;
    for (let i = 0; i < numPlayers; i++) {
      const cx = x0 + lvlW + 6 + cell * i + cell / 2;
      g.fillStyle = PLAYERS[i].color;
      g.beginPath(); g.arc(cx - 10, y0 + pill / 2, pill * 0.28, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2; g.stroke();
      g.fillStyle = '#2b2d5c';
      g.textAlign = 'left';
      g.fillText(`${scores[i]}`, cx + 2, y0 + pill / 2 + 1);
    }
    // przycisk pauzy obok
    pauseBtn.style.left = `${Math.round(x0 + totalW + 8)}px`;
    pauseBtn.style.top = `${y0 - 2}px`;
    pauseBtn.style.transform = 'none';
    pauseBtn.style.width = pauseBtn.style.height = `${pill + 4}px`;

    // pasek postępu
    const by = y0 + pill + 8;
    const bw = Math.min(totalW + 40, W - cornerRadius() * 2 - 20);
    const bx = W / 2 - bw / 2;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    roundRect(g, bx, by, bw, 8, 4);
    g.fill();
    g.strokeStyle = '#2b2d5c'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#2b2d5c';
    g.fillRect(bx + bw - 3, by - 3, 3, 14);
    for (let i = cats.length - 1; i >= 0; i--) {
      const c = cats[i];
      const t = clamp((c.x - START_X) / (level.length - START_X), 0, 1);
      g.fillStyle = PLAYERS[c.id].color;
      g.beginPath(); g.arc(bx + t * bw, by + 4, 6, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2; g.stroke();
    }
  }

  function bigText(g, text, y, size, color, sub) {
    g.save();
    g.font = `bold ${size}px Trebuchet MS, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = Math.max(4, size / 8);
    g.strokeStyle = '#2b2d5c';
    g.lineJoin = 'round';
    g.strokeText(text, W / 2, y);
    g.fillStyle = color;
    g.fillText(text, W / 2, y);
    if (sub) {
      const ss = Math.round(size * 0.3);
      g.font = `bold ${ss}px Trebuchet MS, sans-serif`;
      g.lineWidth = Math.max(3, ss / 6);
      g.strokeText(sub, W / 2, y + size * 0.7);
      g.fillStyle = '#fff';
      g.fillText(sub, W / 2, y + size * 0.7);
    }
    g.restore();
  }

  function drawMessages(g) {
    const base = Math.min(W, Hs);
    if (state === 'countdown') {
      const n = Math.ceil(countT / COUNT_STEP);
      const frac = (countT / COUNT_STEP) % 1;
      const size = Math.round(base * (0.22 + frac * 0.08));
      let sub = `Level ${levelNo}`;
      if (levelWinner >= 0 && levelNo > 1) sub = `${PLAYERS[levelWinner].name} wygrał poprzedni level! · Level ${levelNo}`;
      bigText(g, `${n}`, Hs * 0.45, size, '#ffd35a', sub);
    } else if (goFlash > 0 && state === 'play') {
      g.save();
      g.globalAlpha = clamp(goFlash / 0.5, 0, 1);
      bigText(g, '0 · START!', Hs * 0.45, Math.round(base * 0.16), '#1fd1c1');
      g.restore();
    } else if (state === 'celebrate' && levelWinner >= 0) {
      const p = PLAYERS[levelWinner];
      bigText(g, `${p.name} kotek na mecie!`, Hs * 0.42, Math.round(base * 0.1), p.color,
        `+1 punkt  (${scores[levelWinner]}/${WIN_POINTS})`);
    }
    // konfetti w przestrzeni ekranu
    for (const p of particles) {
      if (!p.screen) continue;
      g.save();
      g.globalAlpha = clamp(p.life / 0.6, 0, 1);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      g.restore();
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawWorld(ctx);
    if (state !== 'menu') {
      drawCorners(ctx);
      drawHUD(ctx);
      drawMessages(ctx);
    }
  }

  // ---------------------------------------------------------------------------
  // Pętla gry (stały krok dla stabilnych kolizji)
  // ---------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 120;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }

  // Tło menu: pierwszy level przewija się powoli
  level = makeLevel(1);
  cats = [];
  cam.x = -100;
  renderPlayerList();
  updateResumeBtn();
  // po „Odśwież” (nowa wersja) albo przeładowaniu w trakcie gry – wracamy od razu do rozgrywki
  try {
    const again = sessionStorage.getItem(RESUME_KEY) === '1';
    sessionStorage.removeItem(RESUME_KEY);
    const d = again && loadSave();
    if (d) resumeSaved(d);
  } catch (e) { /* trudno */ }
  requestAnimationFrame(frame);

  // drobne API do testów
  window.__kociaki = {
    get state() { return state; },
    get scores() { return scores.slice(); },
    get levelNo() { return levelNo; },
    get cats() { return cats; },
    get level() { return level; },
    makeLevel, loadLevel, jump, startGame,
  };
})();
