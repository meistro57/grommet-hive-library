/* =====================================================================
   Grommet's Hive Library — player
   One module, no dependencies. Highlights:
   - queue = whatever you're looking at (filter + search + sort)
   - seek / volume / shuffle / repeat (all · one · off)
   - Media Session (lock screen, headphones, OS media keys)
   - deep links (#t=slug), Web Share, resume where you left off
   - audio-reactive hive, kinetic headline, immersive mode
   - View Transitions, scroll-driven reveals, cursor tilt
   - Grommet's flex: feral mode, bee eyes, cursor pollen, needle drop
   ===================================================================== */
(() => {
  'use strict';

  /* ---------------- helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  const vt = (fn) => (document.startViewTransition && !reduceMotion) ? document.startViewTransition(fn) : (fn(), null);

  /* ---------------- DOM ---------------- */
  const audio = $('audio');
  const gridN = $('grid'), filtersN = $('filters'), searchN = $('search'), sortN = $('sort-select');
  const dock = $('dock'), seek = $('seek'), seekTip = $('seek-tip'), vol = $('vol');
  const npCover = $('np-cover'), npTitle = $('np-title'), npMood = $('np-mood'), npContext = $('np-context');
  const tpPlay = $('tp-play'), tpPrev = $('tp-prev'), tpNext = $('tp-next'), tpShuffle = $('tp-shuffle'), tpRepeat = $('tp-repeat');
  const volBtn = $('vol-btn'), dockFav = $('dock-fav'), tCur = $('t-cur'), tDur = $('t-dur');
  const marquee = $('hive-marquee'), toastN = $('toast');
  const eqN = $('eq');

  /* ---------------- state ---------------- */
  const S = {
    tracks: [], bySlug: new Map(),
    mood: 'All', sort: 'newest', q: '',
    view: [],                  // what the shelf shows right now
    queue: [], qi: -1, queueLabel: '',
    order: [],                 // play order over queue (shuffled or straight)
    current: null,
    shuffle: store.get('grommet_shuffle', '0') === '1',
    repeat: store.get('grommet_repeat', 'all'),
    favs: new Set(store.get('grommet_favs', '').split(',').filter(Boolean)),
    featured: [], fi: 0
  };

  /* ---------------- catalog ---------------- */
  const tagMap = {
    grimy: 'Grimy', grunge: 'Grimy', rap: 'Rap', throwdown: 'Rap', street: 'Rap',
    anthem: 'Anthem', bee: 'Bee', rave: 'Rave', glitch: 'Glitch', drop: 'Glitch',
    butter: 'Smooth', groove: 'Groove', friday: 'Friday', club: 'Club', disco: 'Disco',
    night: 'Night', walker: 'Night', breakdance: 'Break', 'get out': 'Defiant', control: 'Anthem',
    chiptune: 'Chiptune', ym2612: 'Chiptune', mix: 'Mix', dj: 'Mix', 'after dark': 'Mix', dark: 'Mix',
    report: 'Report', blues: 'Blues'
  };
  // Display-only fixes for slug-generated titles (catalog titles stay the keys).
  const prettyFix = [[/\bLlc\b/g, 'LLC'], [/\bDj\b/g, 'DJ'], [/\bQmu\b/g, 'QMU'], [/\bBrendas\b/g, "Brenda's"], [/\bRomys\b/g, "Romy's"], [/\bLifes\b/g, "Life's"]];
  const pretty = (t) => prettyFix.reduce((s, [re, r]) => s.replace(re, r), t);

  function prepare(data) {
    const n = data.tracks.length;
    S.tracks = data.tracks.map((t, i) => {
      const lower = t.title.toLowerCase();
      const mood = [];
      Object.keys(tagMap).forEach((k) => { if (lower.includes(k) && !mood.includes(tagMap[k])) mood.push(tagMap[k]); });
      if (!mood.length) mood.push('Vibe');
      const slug = (t.audio.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '') || 'track-' + i;
      return { ...t, name: pretty(t.title), slug, no: i + 1, mood, isNew: i >= n - 4, hay: (t.title + ' ' + mood.join(' ')).toLowerCase() };
    });
    S.tracks.forEach((t) => S.bySlug.set(t.slug, t));
    S.featured = S.tracks.slice(-8).reverse();
  }
  const newestFirst = () => S.tracks.slice().reverse();

  /* =====================================================================
     SHELF — filters, search, sort, grid
     ===================================================================== */
  function computeView() {
    let list = S.tracks.slice();
    if (S.mood === 'Favourites') list = list.filter((t) => S.favs.has(t.title));
    else if (S.mood !== 'All') list = list.filter((t) => t.mood.includes(S.mood));
    if (S.q) { const terms = S.q.toLowerCase().split(/\s+/).filter(Boolean); list = list.filter((t) => terms.every((w) => t.hay.includes(w))); }
    if (S.sort === 'newest') list.reverse();
    else if (S.sort === 'a-z') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (S.sort === 'z-a') list.sort((a, b) => b.name.localeCompare(a.name));
    S.view = list;
  }

  function renderFilters() {
    const counts = new Map([['All', S.tracks.length]]);
    S.tracks.forEach((t) => t.mood.forEach((m) => counts.set(m, (counts.get(m) || 0) + 1)));
    const moods = [...counts.keys()].filter((m) => m !== 'All').sort((a, b) => counts.get(b) - counts.get(a));
    filtersN.innerHTML = '';
    const fav = el('button', 'chip fav', `${icon('i-heart-fill')}Favourites <small id="fav-count">${S.favs.size}</small>`);
    fav.dataset.mood = 'Favourites'; fav.type = 'button';
    filtersN.appendChild(fav);
    ['All', ...moods].forEach((m) => {
      const b = el('button', 'chip', `${esc(m)} <small>${counts.get(m)}</small>`);
      b.dataset.mood = m; b.type = 'button';
      filtersN.appendChild(b);
    });
    syncFilterPressed();
  }
  function syncFilterPressed() { filtersN.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === S.mood))); }
  filtersN.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    S.mood = b.dataset.mood; syncFilterPressed(); vt(renderGrid);
  });

  function highlight(name) {
    if (!S.q) return esc(name);
    let out = esc(name);
    S.q.split(/\s+/).filter(Boolean).forEach((w) => {
      const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(re, '<mark>$1</mark>'));
    });
    return out;
  }

  function cardHTML(t, i) {
    const fav = S.favs.has(t.title);
    return `
      <div class="art">
        ${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy" decoding="async" width="300" height="300" />` : '<span class="ph">🐝</span>'}
        <span class="glare" aria-hidden="true"></span>
        <button class="hexplay" type="button" data-act="play" aria-label="Play ${esc(t.name)}">${icon('i-play')}</button>
        <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
        <div class="acts">
          <button class="icon-btn dl" type="button" data-act="dl" aria-label="Download ${esc(t.name)}" title="Download">${icon('i-download')}</button>
          <button class="icon-btn fav${fav ? ' on' : ''}" type="button" data-act="fav" aria-pressed="${fav}" aria-label="Favourite ${esc(t.name)}" title="Favourite">${icon(fav ? 'i-heart-fill' : 'i-heart')}</button>
        </div>
      </div>
      <div class="body">
        <h3>${highlight(t.name)}</h3>
        <div class="meta">${esc(t.mood.join(' · '))}${t.isNew ? '<span class="new-badge">NEW</span>' : ''}</div>
      </div>`;
  }

  function renderGrid() {
    computeView();
    gridN.setAttribute('aria-busy', 'false');
    const total = S.tracks.length, shown = S.view.length;
    $('shelf-count').textContent = shown === total ? `${total} tracks in the comb` : `${shown} of ${total} tracks`;
    if (!shown) {
      gridN.innerHTML = S.mood === 'Favourites' && !S.q
        ? '<div class="empty"><strong>No favourites yet</strong>Tap the heart on any record and it lands here.</div>'
        : `<div class="empty"><strong>Nothing buzzing for “${esc(S.q || S.mood)}”</strong>Try another word, or clear the filter.</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    S.view.forEach((t, i) => {
      const card = el('article', 'card' + (finePointer && !reduceMotion ? ' tilt' : ''), cardHTML(t, i));
      card.tabIndex = 0;
      card.dataset.slug = t.slug;
      card.style.setProperty('--n', i);
      card.setAttribute('aria-label', `${t.name}. ${t.mood.join(', ')}. Open details`);
      frag.appendChild(card);
    });
    gridN.replaceChildren(frag);
    markCurrent();
  }

  gridN.addEventListener('click', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    const t = S.bySlug.get(card.dataset.slug); if (!t) return;
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      if (act.dataset.act === 'play') { if (S.current === t) togglePlay(); else playFrom(t, S.view, shelfLabel()); }
      else if (act.dataset.act === 'fav') toggleFav(t);
      else if (act.dataset.act === 'dl') download(t);
      return;
    }
    openDetail(t, card);
  });
  gridN.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card'); if (!card || e.target !== card) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(S.bySlug.get(card.dataset.slug), card); }
  });
  const shelfLabel = () => S.q ? `search “${S.q}”` : (S.mood === 'All' ? 'the shelf' : S.mood);

  let qT;
  searchN.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { S.q = searchN.value.trim(); renderGrid(); }, 90); });
  searchN.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchN.value = ''; S.q = ''; renderGrid(); searchN.blur(); }
    if (e.key === 'Enter' && S.view[0]) { playFrom(S.view[0], S.view, shelfLabel()); searchN.blur(); }
  });
  sortN.addEventListener('change', () => { S.sort = sortN.value; vt(renderGrid); });

  /* ---------------- cursor tilt + glare ---------------- */
  function bindTilt(root, selector) {
    if (!finePointer || reduceMotion) return;
    let raf = 0, lastEl = null;
    root.addEventListener('pointermove', (e) => {
      const t = e.target.closest(selector); if (!t) return;
      if (lastEl && lastEl !== t) resetTilt(lastEl);
      lastEl = t;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        t.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
        t.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        t.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        t.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        t.style.setProperty('--ga', '1');
      });
    });
    root.addEventListener('pointerleave', () => { if (lastEl) resetTilt(lastEl); lastEl = null; });
    root.addEventListener('pointerout', (e) => { const t = e.target.closest(selector); if (t && !t.contains(e.relatedTarget)) { resetTilt(t); if (lastEl === t) lastEl = null; } });
  }
  function resetTilt(t) { ['--rx', '--ry'].forEach((p) => t.style.setProperty(p, '0deg')); t.style.setProperty('--ga', '0'); }

  /* =====================================================================
     HONEYCOMB OF COVERS (hero)
     ===================================================================== */
  const combSlots = [[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]];
  function renderComb() {
    const comb = $('comb');
    comb.querySelectorAll('.cell:not(.core)').forEach((n) => n.remove());
    newestFirst().slice(0, 6).forEach((t, i) => {
      const [q, r] = combSlots[i];
      const b = el('button', 'cell' + (i === 1 || i === 4 ? ' violet' : ''),
        `<span class="cell-face">${t.cover ? `<img src="${esc(t.cover)}" alt="" decoding="async" />` : ''}</span>
         <span class="cell-label"><b>${esc(t.name)}</b><small>${t.isNew ? 'new' : esc(t.mood[0])}</small></span>`);
      b.type = 'button';
      b.style.cssText = `--q:${q};--r:${r};--n:${i + 1}`;
      b.dataset.slug = t.slug;
      b.setAttribute('aria-label', `Play ${t.name}`);
      b.addEventListener('click', () => { if (S.current === t) togglePlay(); else playFrom(t, newestFirst(), 'the newest'); });
      comb.appendChild(b);
    });
  }

  /* =====================================================================
     FEATURED RECORD (BookForge-style panel)
     ===================================================================== */
  const ft = $('ft'), ftRecord = $('ft-record'), ftBar = $('ft-bar'), ftPause = $('ft-pause');
  const colorCache = new Map();
  const ROTATE_MS = 7500;
  let ftPaused = reduceMotion, ftHover = false, ftT0 = performance.now(), ftElapsed = 0, ftRaf = 0;

  function dominantColor(src) {
    if (colorCache.has(src)) return Promise.resolve(colorCache.get(src));
    return new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 24;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 24, 24);
          const d = x.getImageData(0, 0, 24, 24).data;
          let best = null, bestScore = -1;
          // pick the most saturated, reasonably bright pixel bucket, not the muddy average
          const buckets = new Map();
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
            if (l < 0.18 || l > 0.9) continue;
            const key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
            const bk = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, s: 0 };
            bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.s += s; buckets.set(key, bk);
          }
          buckets.forEach((bk) => { const score = bk.n * (0.4 + bk.s / bk.n); if (score > bestScore) { bestScore = score; best = bk; } });
          const col = best ? `rgb(${Math.round(best.r / best.n)}, ${Math.round(best.g / best.n)}, ${Math.round(best.b / best.n)})` : '#9b7bea';
          colorCache.set(src, col); res(col);
        } catch (e) { colorCache.set(src, '#9b7bea'); res('#9b7bea'); }
      };
      img.onerror = () => res('#9b7bea');
      img.src = src;
    });
  }

  function renderFeatured() {
    const dots = $('ft-dots'); dots.innerHTML = '';
    S.featured.forEach((t, i) => {
      const d = el('button', 'ft-dot'); d.type = 'button'; d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', t.name);
      d.addEventListener('click', () => { setFeatured(i); restartRotation(); });
      dots.appendChild(d);
      if (t.cover) dominantColor(t.cover).then((c) => d.style.setProperty('--c', c));
    });
    setFeatured(0, true);
  }

  function setFeatured(i, instant) {
    const n = S.featured.length; if (!n) return;
    S.fi = (i + n) % n;
    const t = S.featured[S.fi];
    const apply = () => {
      $('ft-cover').src = t.cover || '';
      $('ft-cover').alt = t.name;
      $('ft-label').style.backgroundImage = t.cover ? `url("${t.cover}")` : '';
      $('ft-title').textContent = t.name;
      $('ft-sub').textContent = t.mood.join(' · ') + ' — from the hive';
      $('ft-no').textContent = `TRACK No. ${String(t.no).padStart(3, '0')} · GROMMET'S HIVE`;
      $('ft-badge').textContent = t.isNew ? 'NEW PRESS' : t.mood[0].toUpperCase();
      $('ft-meta').innerHTML = t.mood.map((m) => `<span>${esc(m)}</span>`).join('') + '<span>🐝 Grommet</span>';
      $('ft-count').textContent = `${String(S.fi + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
      [...$('ft-dots').children].forEach((d, k) => d.setAttribute('aria-selected', String(k === S.fi)));
      syncFeaturedState();
      if (t.cover) dominantColor(t.cover).then((c) => { if (S.featured[S.fi] === t) ft.style.setProperty('--bk', c); });
    };
    if (instant || reduceMotion) { apply(); return; }
    ft.classList.add('swapping');
    setTimeout(() => { apply(); requestAnimationFrame(() => ft.classList.remove('swapping')); }, 300);
  }
  function syncFeaturedState() {
    const t = S.featured[S.fi]; if (!t) return;
    const on = S.current === t;
    ft.classList.toggle('is-playing', on);
    ft.classList.toggle('is-paused', on && audio.paused);
    $('ft-play').querySelector('use').setAttribute('href', on && !audio.paused ? '#i-pause' : '#i-play');
    $('ft-play').querySelector('span').textContent = on && !audio.paused ? 'Pause' : (on ? 'Resume' : 'Buzz it');
    const fav = S.favs.has(t.title);
    $('ft-fav').setAttribute('aria-pressed', String(fav));
    $('ft-fav').querySelector('use').setAttribute('href', fav ? '#i-heart-fill' : '#i-heart');
  }
  function restartRotation() { ftElapsed = 0; ftT0 = performance.now(); }
  function rotationTick(now) {
    const holding = ftPaused || ftHover || document.hidden || (S.current === S.featured[S.fi] && !audio.paused);
    if (holding) ftT0 = now - ftElapsed; else ftElapsed = now - ftT0;
    ftBar.style.width = Math.min(100, (ftElapsed / ROTATE_MS) * 100) + '%';
    if (ftElapsed >= ROTATE_MS) { setFeatured(S.fi + 1); restartRotation(); }
    ftRaf = requestAnimationFrame(rotationTick);
  }
  const ftPlay = () => { const t = S.featured[S.fi]; if (S.current === t) togglePlay(); else playFrom(t, S.featured, 'fresh off the press'); };
  ftRecord.addEventListener('click', ftPlay);
  $('ft-play').addEventListener('click', ftPlay);
  $('ft-details').addEventListener('click', () => openDetail(S.featured[S.fi], null, $('ft-cover')));
  $('ft-fav').addEventListener('click', () => toggleFav(S.featured[S.fi]));
  $('ft-prev').addEventListener('click', () => { setFeatured(S.fi - 1); restartRotation(); });
  $('ft-next').addEventListener('click', () => { setFeatured(S.fi + 1); restartRotation(); });
  ftPause.addEventListener('click', () => {
    ftPaused = !ftPaused;
    ftPause.setAttribute('aria-pressed', String(ftPaused));
    ftPause.setAttribute('aria-label', ftPaused ? 'Resume rotation' : 'Pause rotation');
    ftPause.querySelector('use').setAttribute('href', ftPaused ? '#i-play' : '#i-pause');
  });
  ft.addEventListener('pointerenter', () => { ftHover = true; });
  ft.addEventListener('pointerleave', () => { ftHover = false; });
  ft.addEventListener('focusin', () => { ftHover = true; });
  ft.addEventListener('focusout', (e) => { if (!ft.contains(e.relatedTarget)) ftHover = false; });
  ft.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setFeatured(S.fi - 1); restartRotation(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setFeatured(S.fi + 1); restartRotation(); }
  });
  // swipe on touch
  let sx = 0, sy = 0;
  ft.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  ft.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { setFeatured(S.fi + (dx < 0 ? 1 : -1)); restartRotation(); }
  }, { passive: true });
  if (reduceMotion) { ftPause.setAttribute('aria-pressed', 'true'); ftPause.querySelector('use').setAttribute('href', '#i-play'); }

  /* =====================================================================
     PLAYER
     ===================================================================== */
  function buildOrder(startIdx) {
    const idx = S.queue.map((_, i) => i);
    if (S.shuffle) {
      const rest = idx.filter((i) => i !== startIdx);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      S.order = [startIdx, ...rest];
    } else S.order = idx;
  }

  function playFrom(t, list, label) {
    S.queue = (list && list.length ? list : S.tracks).slice();
    S.queueLabel = label || 'the hive';
    S.qi = Math.max(0, S.queue.indexOf(t));
    buildOrder(S.qi);
    load(t, true);
  }

  function load(t, autoplay, startAt = 0) {
    const fromCover = document.querySelector(`.card[data-slug="${t.slug}"] .art img, .cell[data-slug="${t.slug}"] .cell-face img`);
    const first = dock.hidden;
    const swap = () => {
      S.current = t;
      if (first) { dock.hidden = false; document.body.classList.add('has-dock'); }
      npCover.style.backgroundImage = t.cover ? `url("${t.cover}")` : '';
      npTitle.textContent = t.name;
      npMood.textContent = t.mood.join(' · ');
      npContext.textContent = 'from ' + (S.queueLabel || 'the hive');
      if (fromCover) fromCover.style.viewTransitionName = '';
      npCover.style.viewTransitionName = '';
      markCurrent(); syncFeaturedState(); syncFavUI(); syncImmersive();
    };
    // morph the clicked cover into the dock on first play
    if (first && fromCover && document.startViewTransition && !reduceMotion) {
      fromCover.style.viewTransitionName = 'cover-morph';
      const tr = document.startViewTransition(() => { swap(); npCover.style.viewTransitionName = 'cover-morph'; });
      tr.finished.finally(() => { npCover.style.viewTransitionName = ''; });
    } else swap();

    audio.src = t.audio;
    audio.load();
    if (startAt) audio.addEventListener('loadedmetadata', () => { audio.currentTime = Math.min(startAt, Math.max(0, audio.duration - 2)); }, { once: true });
    if (autoplay) audio.play().catch(() => { /* blocked until a gesture */ });
    history.replaceState(null, '', '#t=' + t.slug);
    updateMediaSession(t);
    persist(true);
    needleDrop();
  }

  function step(dir, userInitiated = true) {
    if (!S.current || !S.queue.length) return;
    if (dir < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
    let pos = S.order.indexOf(S.qi);
    pos += dir;
    if (pos >= S.order.length) {
      if (S.repeat === 'off' && !userInitiated) { audio.pause(); audio.currentTime = 0; return; }
      if (S.shuffle) buildOrder(S.order[S.order.length - 1]), pos = 1 % S.order.length; else pos = 0;
    }
    if (pos < 0) pos = S.order.length - 1;
    S.qi = S.order[pos];
    load(S.queue[S.qi], true);
  }
  const next = () => step(1), prev = () => step(-1);

  function togglePlay() {
    if (!S.current) { playFrom(newestFirst()[0], newestFirst(), 'the newest'); return; }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  audio.addEventListener('ended', () => {
    if (S.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    step(1, false);
  });
  audio.addEventListener('play', () => { syncPlayUI(); ensureAudioGraph(); startLoop(); });
  audio.addEventListener('pause', syncPlayUI);
  audio.addEventListener('loadedmetadata', () => { tDur.textContent = fmt(audio.duration); positionState(); syncSeek(); });
  audio.addEventListener('timeupdate', () => { if (!scrubbing) syncSeek(); persist(); });
  audio.addEventListener('progress', syncSeek);
  audio.addEventListener('error', () => { if (S.current) toast(`Couldn't load “${S.current.name}” — skipping`); setTimeout(() => step(1, false), 900); });

  function syncPlayUI() {
    const playing = !audio.paused;
    tpPlay.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    tpPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('imm-play').querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('imm-play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    dock.classList.toggle('is-playing', playing);
    $('immersive').classList.toggle('is-playing', playing);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    markCurrent(); syncFeaturedState();
  }

  function markCurrent() {
    const slug = S.current && S.current.slug;
    document.querySelectorAll('.card.is-current, .cell.is-playing').forEach((n) => n.classList.remove('is-current', 'is-paused', 'is-playing'));
    if (!slug) return;
    const card = gridN.querySelector(`.card[data-slug="${slug}"]`);
    if (card) {
      card.classList.add('is-current'); card.classList.toggle('is-paused', audio.paused);
      const hp = card.querySelector('.hexplay use'); if (hp) hp.setAttribute('href', audio.paused ? '#i-play' : '#i-pause');
    }
    gridN.querySelectorAll('.card:not(.is-current) .hexplay use').forEach((u) => u.setAttribute('href', '#i-play'));
    const cell = document.querySelector(`.cell[data-slug="${slug}"]`);
    if (cell && !audio.paused) cell.classList.add('is-playing');
  }

  /* ---------------- seek ---------------- */
  let scrubbing = false;
  function syncSeek() {
    const d = audio.duration || 0, c = audio.currentTime || 0;
    let b = 0;
    try { if (audio.buffered.length) b = audio.buffered.end(audio.buffered.length - 1); } catch (e) { /* noop */ }
    const p = d ? (c / d) * 100 : 0, bp = d ? (b / d) * 100 : 0;
    [seek, $('imm-range')].forEach((r) => { r.value = Math.round(p * 10); r.style.setProperty('--p', p + '%'); r.style.setProperty('--b', Math.max(p, bp) + '%'); });
    seek.setAttribute('aria-valuetext', `${fmt(c)} of ${fmt(d)}`);
    tCur.textContent = fmt(c); $('imm-cur').textContent = fmt(c); $('imm-dur').textContent = fmt(d);
  }
  [seek, $('imm-range')].forEach((r) => {
    r.addEventListener('input', () => {
      scrubbing = true;
      const p = r.value / 10;
      r.style.setProperty('--p', p + '%');
      tCur.textContent = fmt((p / 100) * (audio.duration || 0));
    });
    r.addEventListener('change', () => {
      if (audio.duration) audio.currentTime = (r.value / 1000) * audio.duration;
      scrubbing = false; positionState();
    });
  });
  $('seek').parentElement.addEventListener('pointermove', (e) => {
    const r = seek.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    seekTip.textContent = fmt(p * (audio.duration || 0));
    seekTip.style.left = Math.min(r.width - 24, Math.max(24, p * r.width)) + 'px';
  });

  /* ---------------- volume ---------------- */
  function setVolume(v, silent) {
    v = Math.min(1, Math.max(0, v));
    audio.volume = v; audio.muted = v === 0 ? true : audio.muted && v === 0;
    vol.value = Math.round(v * 100);
    vol.style.setProperty('--p', v * 100 + '%'); vol.style.setProperty('--b', v * 100 + '%');
    syncVolUI();
    store.set('grommet_vol', String(v));
    if (!silent) toast('Volume ' + Math.round(v * 100) + '%');
  }
  function syncVolUI() {
    const muted = audio.muted || audio.volume === 0;
    volBtn.querySelector('use').setAttribute('href', muted ? '#i-mute' : '#i-volume');
    volBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }
  function toggleMute() { audio.muted = !audio.muted; if (!audio.muted && audio.volume === 0) setVolume(0.6, true); syncVolUI(); toast(audio.muted ? 'Muted' : 'Sound on'); }
  vol.addEventListener('input', () => { audio.muted = false; setVolume(vol.value / 100, true); });
  volBtn.addEventListener('click', toggleMute);

  /* ---------------- shuffle / repeat ---------------- */
  function setShuffle(on, say = true) {
    S.shuffle = on;
    tpShuffle.setAttribute('aria-pressed', String(on));
    store.set('grommet_shuffle', on ? '1' : '0');
    if (S.current) buildOrder(S.qi);
    if (say) toast(on ? 'Shuffle on' : 'Shuffle off');
  }
  function setRepeat(mode, say = true) {
    S.repeat = mode;
    tpRepeat.dataset.mode = mode;
    tpRepeat.setAttribute('aria-label', 'Repeat: ' + mode);
    store.set('grommet_repeat', mode);
    if (say) toast({ all: 'Repeat all', one: 'Repeat this one', off: 'Repeat off' }[mode]);
  }
  tpShuffle.addEventListener('click', () => setShuffle(!S.shuffle));
  tpRepeat.addEventListener('click', () => setRepeat({ all: 'one', one: 'off', off: 'all' }[S.repeat]));
  tpPlay.addEventListener('click', togglePlay);
  tpNext.addEventListener('click', next);
  tpPrev.addEventListener('click', prev);
  $('imm-play').addEventListener('click', togglePlay);
  $('imm-next').addEventListener('click', next);
  $('imm-prev').addEventListener('click', prev);

  /* ---------------- favourites ---------------- */
  function toggleFav(t) {
    if (!t) return;
    const on = !S.favs.has(t.title);
    on ? S.favs.add(t.title) : S.favs.delete(t.title);
    store.set('grommet_favs', [...S.favs].join(','));
    toast(on ? `♥ Saved “${t.name}”` : `Removed “${t.name}”`);
    syncFavUI();
    if (S.mood === 'Favourites') vt(renderGrid);
  }
  function syncFavUI() {
    gridN.querySelectorAll('.card').forEach((c) => {
      const t = S.bySlug.get(c.dataset.slug), b = c.querySelector('.fav'); if (!t || !b) return;
      const on = S.favs.has(t.title);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
      b.querySelector('use').setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
    });
    const fc = $('fav-count'); if (fc) fc.textContent = S.favs.size;
    if (S.current) {
      const on = S.favs.has(S.current.title);
      dockFav.setAttribute('aria-pressed', String(on));
      dockFav.querySelector('use').setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
    }
    if (detail.track) syncDetailFav();
    syncFeaturedState();
  }
  dockFav.addEventListener('click', () => toggleFav(S.current));

  /* ---------------- share / download ---------------- */
  const trackUrl = (t) => location.origin + location.pathname + (t ? '#t=' + t.slug : '');
  async function share(t) {
    const url = trackUrl(t);
    const data = { title: t ? `${t.name} — Grommet's Hive Library` : "Grommet's Hive Library", text: t ? `🐝 ${t.name} — spinning in Grommet's Hive Library` : '🐝 Grommet\'s Hive Library', url };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('Link copied — paste it anywhere'); }
    catch (e) { prompt('Copy this link:', url); }
  }
  $('dock-share').addEventListener('click', () => share(S.current));
  function download(t) {
    const a = el('a'); a.href = t.audio; a.download = t.name.replace(/[^a-z0-9]+/gi, '_') + '.mp3';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Downloading “' + t.name + '”');
  }

  /* ---------------- Media Session (lock screen, headphones, media keys) ---------------- */
  function updateMediaSession(t) {
    if (!('mediaSession' in navigator)) return;
    const art = t.cover ? new URL(t.cover, location.href).href : new URL('media/grommet-emoji.png', location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.name, artist: 'Grommet', album: "Grommet's Hive Library",
      artwork: [96, 192, 256, 512].map((s) => ({ src: art, sizes: `${s}x${s}`, type: t.cover ? 'image/jpeg' : 'image/png' }))
    });
  }
  function positionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !isFinite(audio.duration)) return;
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch (e) { /* noop */ }
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch (e) { /* unsupported action */ } };
    set('play', () => audio.play());
    set('pause', () => audio.pause());
    set('previoustrack', prev);
    set('nexttrack', next);
    set('seekbackward', (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); positionState(); });
    set('seekforward', (d) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (d.seekOffset || 10)); positionState(); });
    set('seekto', (d) => { if (d.fastSeek && audio.fastSeek) audio.fastSeek(d.seekTime); else audio.currentTime = d.seekTime; positionState(); });
    set('stop', () => { audio.pause(); audio.currentTime = 0; });
  }

  /* ---------------- resume ---------------- */
  let lastSave = 0;
  function persist(force) {
    const now = Date.now();
    if (!force && now - lastSave < 4000) return;
    lastSave = now;
    if (S.current) store.set('grommet_state', JSON.stringify({ slug: S.current.slug, t: Math.floor(audio.currentTime || 0), label: S.queueLabel }));
  }
  addEventListener('pagehide', () => persist(true));

  /* =====================================================================
     AUDIO REACTIVITY — analyser drives EQ, glow, kinetic type, hive, viz
     ===================================================================== */
  let actx = null, analyser = null, freq = null, loopOn = false;
  const A = (window.HiveAudio = { energy: 0, bass: 0, kick: false });
  let bassAvg = 0, lastKick = 0;
  const EQ_BARS = 24;
  eqN.innerHTML = '<i></i>'.repeat(EQ_BARS);
  const eqBars = [...eqN.children];
  const kineticN = $('kinetic');
  let kChars = [];
  if (kineticN) {
    const text = kineticN.textContent;
    kineticN.setAttribute('aria-label', text);
    kineticN.innerHTML = [...text].map((c) => c === ' ' ? '<span class="sp" aria-hidden="true"> </span>' : `<span class="ch" aria-hidden="true">${esc(c)}</span>`).join('');
    kChars = [...kineticN.querySelectorAll('.ch')];
  }

  function ensureAudioGraph() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        const src = actx.createMediaElementSource(audio);
        analyser = actx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser); analyser.connect(actx.destination);
        freq = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) { actx = null; analyser = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  }

  function startLoop() { if (!loopOn) { loopOn = true; requestAnimationFrame(loop); } }
  function loop(now) {
    const playing = !audio.paused;
    if (analyser && playing) {
      analyser.getByteFrequencyData(freq);
      let sum = 0; for (let i = 0; i < freq.length; i++) sum += freq[i];
      const energy = Math.min(1, sum / freq.length / 95);
      const bass = Math.min(1, (freq[1] + freq[2] + freq[3] + freq[4]) / 4 / 230);
      A.energy += (energy - A.energy) * 0.35;
      A.bass += (bass - A.bass) * 0.5;
      bassAvg = bassAvg * 0.94 + bass * 0.06;
      if (bass > 0.55 && bass > bassAvg * 1.25 && now - lastKick > 220) { A.kick = true; lastKick = now; }
    } else {
      A.energy *= 0.9; A.bass *= 0.9;
    }

    // dock + immersive glow
    document.documentElement.style.setProperty('--energy', A.energy.toFixed(3));
    dock.style.setProperty('--energy', A.energy.toFixed(3));

    // EQ
    if (!reduceMotion) {
      for (let b = 0; b < EQ_BARS; b++) {
        const v = analyser && playing ? freq[2 + Math.floor((freq.length * 0.7 - 2) * (b / EQ_BARS))] / 255 : 0;
        eqBars[b].style.height = Math.max(3, Math.round(v * 26)) + 'px';
      }
      // kinetic headline — each letter rides a band
      kChars.forEach((c, i) => {
        const v = analyser && playing ? freq[3 + i * 3] / 255 : 0;
        const w = 700 + Math.round((v - 0.35) * 380);
        c.style.setProperty('--w', Math.max(420, Math.min(900, w)));
        c.style.setProperty('--lift', (v * v * 9).toFixed(2));
      });
      if (immOpen) drawViz();
    }

    if (playing || A.energy > 0.01) requestAnimationFrame(loop);
    else { loopOn = false; kChars.forEach((c) => { c.style.removeProperty('--w'); c.style.removeProperty('--lift'); }); }
  }

  /* =====================================================================
     IMMERSIVE MODE
     ===================================================================== */
  const imm = $('immersive'), immViz = $('imm-viz'), vctx = immViz.getContext('2d');
  let immOpen = false, immReturn = null;
  function syncImmersive() {
    const t = S.current; if (!t) return;
    $('imm-bg').style.backgroundImage = t.cover ? `url("${t.cover}")` : '';
    $('imm-label').style.backgroundImage = t.cover ? `url("${t.cover}")` : '';
    $('imm-title').textContent = t.name;
    $('imm-mood').textContent = t.mood.join(' · ');
    $('imm-context').textContent = 'Now buzzing · from ' + (S.queueLabel || 'the hive');
    const pos = S.order.indexOf(S.qi);
    const nxt = S.queue[S.order[(pos + 1) % S.order.length]];
    $('imm-upnext').textContent = nxt && nxt !== t ? 'Up next → ' + nxt.name : '';
  }
  function openImmersive() {
    if (!S.current) return;
    immReturn = document.activeElement;
    syncImmersive();
    const show = () => {
      npCover.style.viewTransitionName = '';
      imm.hidden = false; immOpen = true; document.body.style.overflow = 'hidden';
      $('imm-label').style.viewTransitionName = 'cover-morph';
      sizeViz(); startLoop();
    };
    if (document.startViewTransition && !reduceMotion) {
      npCover.style.viewTransitionName = 'cover-morph';
      document.startViewTransition(show).finished.finally(() => { $('imm-label').style.viewTransitionName = ''; });
    } else show();
    imm.classList.add('entering'); setTimeout(() => imm.classList.remove('entering'), 1000);
    $('imm-close').focus();
  }
  function closeImmersive() {
    if (!immOpen) return;
    const hide = () => { imm.hidden = true; immOpen = false; document.body.style.overflow = ''; $('imm-label').style.viewTransitionName = ''; npCover.style.viewTransitionName = 'cover-morph'; };
    if (document.startViewTransition && !reduceMotion) {
      $('imm-label').style.viewTransitionName = 'cover-morph';
      document.startViewTransition(hide).finished.finally(() => { npCover.style.viewTransitionName = ''; });
    } else { hide(); npCover.style.viewTransitionName = ''; }
    if (immReturn && immReturn.focus) immReturn.focus();
  }
  $('dock-track').addEventListener('click', openImmersive);
  $('dock-expand').addEventListener('click', openImmersive);
  $('imm-close').addEventListener('click', closeImmersive);

  let VW = 0, VH = 0;
  function sizeViz() {
    const d = Math.min(devicePixelRatio || 1, 2);
    VW = innerWidth; VH = innerHeight;
    immViz.width = VW * d; immViz.height = VH * d; vctx.setTransform(d, 0, 0, d, 0, 0);
  }
  addEventListener('resize', () => { if (immOpen) sizeViz(); });
  function drawViz() {
    vctx.clearRect(0, 0, VW, VH);
    const disc = $('imm-disc').getBoundingClientRect();
    const cx = disc.left + disc.width / 2, cy = disc.top + disc.height / 2, R = disc.width / 2 + 18;
    const N = 72;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const bin = 2 + Math.floor(((i < N / 2 ? i : N - i) / (N / 2)) * (freq ? freq.length * 0.6 : 1));
      const v = freq && !audio.paused ? freq[bin] / 255 : 0;
      const len = 6 + v * v * Math.min(160, R * 0.6);
      const x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R;
      const x2 = cx + Math.cos(a) * (R + len), y2 = cy + Math.sin(a) * (R + len);
      vctx.strokeStyle = i % 4 === 0 ? `rgba(185,160,245,${0.35 + v * 0.6})` : `rgba(255,210,122,${0.3 + v * 0.7})`;
      vctx.lineWidth = 3; vctx.lineCap = 'round';
      vctx.beginPath(); vctx.moveTo(x1, y1); vctx.lineTo(x2, y2); vctx.stroke();
    }
    // bass hexagon halo
    const hr = R + 40 + A.bass * 90;
    vctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k + performance.now() / 6000; const x = cx + hr * Math.cos(a), y = cy + hr * Math.sin(a); k ? vctx.lineTo(x, y) : vctx.moveTo(x, y); }
    vctx.closePath();
    vctx.strokeStyle = `rgba(242,169,59,${0.08 + A.bass * 0.32})`; vctx.lineWidth = 1 + A.bass * 2; vctx.stroke();
  }

  /* =====================================================================
     DETAIL SHEET (with cover morph)
     ===================================================================== */
  const detail = { node: null, track: null, origin: null, ret: null };
  function buildDetail() {
    if (detail.node) return;
    const m = el('div', 'modal detail');
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'detail-title');
    m.hidden = true;
    m.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-card">
        <button class="icon-btn modal-x" type="button" data-close aria-label="Close">${icon('i-close')}</button>
        <div class="detail-art" id="detail-art"></div>
        <div class="eyebrow" id="detail-no"></div>
        <h3 class="detail-title" id="detail-title"></h3>
        <div class="detail-mood" id="detail-mood"></div>
        <div class="detail-actions">
          <button class="btn btn-honey" id="detail-play" type="button">${icon('i-play', 'ic')}<span>Buzz it</span></button>
          <button class="btn btn-ghost btn-square" id="detail-fav" type="button" aria-label="Favourite">${icon('i-heart', 'ic')}</button>
          <button class="btn btn-ghost btn-square" id="detail-dl" type="button" aria-label="Download">${icon('i-download', 'ic')}</button>
          <button class="btn btn-ghost btn-square" id="detail-share" type="button" aria-label="Share">${icon('i-share', 'ic')}</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    detail.node = m;
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDetail(); });
    $('detail-play').addEventListener('click', () => {
      const t = detail.track; if (!t) return;
      if (S.current === t) togglePlay(); else playFrom(t, S.view.includes(t) ? S.view : S.tracks, S.view.includes(t) ? shelfLabel() : 'the hive');
      closeDetail();
    });
    $('detail-fav').addEventListener('click', () => toggleFav(detail.track));
    $('detail-dl').addEventListener('click', () => download(detail.track));
    $('detail-share').addEventListener('click', () => share(detail.track));
    trapFocus(m);
  }
  function syncDetailFav() {
    const on = S.favs.has(detail.track.title);
    $('detail-fav').setAttribute('aria-pressed', String(on));
    $('detail-fav').querySelector('use').setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
  }
  function openDetail(t, card, originImg) {
    if (!t) return;
    buildDetail();
    detail.track = t; detail.ret = document.activeElement;
    const src = originImg || (card && card.querySelector('.art img'));
    detail.origin = src || null;
    const fill = () => {
      $('detail-art').innerHTML = t.cover ? `<img src="${esc(t.cover)}" alt="${esc(t.name)}" />` : '<span class="ph">🐝</span>';
      $('detail-no').textContent = `Track No. ${String(t.no).padStart(3, '0')}${t.isNew ? ' · new press' : ''}`;
      $('detail-title').textContent = t.name;
      $('detail-mood').innerHTML = t.mood.map((m) => `<span>${esc(m)}</span>`).join('');
      const on = S.current === t && !audio.paused;
      $('detail-play').querySelector('use').setAttribute('href', on ? '#i-pause' : '#i-play');
      $('detail-play').querySelector('span').textContent = on ? 'Pause' : 'Buzz it';
      syncDetailFav();
      detail.node.hidden = false; document.body.style.overflow = 'hidden';
      if (src) src.style.viewTransitionName = '';
      const img = $('detail-art').querySelector('img'); if (img && src) img.style.viewTransitionName = 'cover-morph';
    };
    if (src && document.startViewTransition && !reduceMotion) {
      src.style.viewTransitionName = 'cover-morph';
      document.startViewTransition(fill).finished.finally(() => { const img = $('detail-art').querySelector('img'); if (img) img.style.viewTransitionName = ''; });
    } else fill();
    history.replaceState(null, '', '#t=' + t.slug);
    setTimeout(() => detail.node.querySelector('.modal-x').focus(), 30);
  }
  function closeDetail() {
    if (!detail.node || detail.node.hidden) return;
    const src = detail.origin && document.contains(detail.origin) ? detail.origin : null;
    const img = $('detail-art').querySelector('img');
    const hide = () => { detail.node.hidden = true; document.body.style.overflow = ''; if (img) img.style.viewTransitionName = ''; if (src) src.style.viewTransitionName = 'cover-morph'; };
    if (src && img && document.startViewTransition && !reduceMotion) {
      img.style.viewTransitionName = 'cover-morph';
      document.startViewTransition(hide).finished.finally(() => { src.style.viewTransitionName = ''; });
    } else { hide(); if (src) src.style.viewTransitionName = ''; }
    if (S.current) history.replaceState(null, '', '#t=' + S.current.slug); else history.replaceState(null, '', location.pathname);
    detail.track = null;
    if (detail.ret && detail.ret.focus) detail.ret.focus();
  }

  /* ---------------- generic modals ---------------- */
  function trapFocus(m) {
    m.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...m.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  let modalReturn = null;
  function openModal(id) { modalReturn = document.activeElement; const m = $(id); m.hidden = false; m.querySelector('.modal-x').focus(); }
  function closeModal(m) { m.hidden = true; if (modalReturn && modalReturn.focus) modalReturn.focus(); }
  ['qr-modal', 'keys-modal'].forEach((id) => {
    const m = $(id); trapFocus(m);
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(m); });
  });
  $('qr-btn').addEventListener('click', () => {
    const url = location.origin + location.pathname;
    $('qr-url').textContent = url;
    $('qr-img').src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&color=1a1008&data=' + encodeURIComponent(url);
    openModal('qr-modal');
  });
  $('keys-open').addEventListener('click', () => openModal('keys-modal'));
  trapFocus(imm);

  /* ---------------- toast ---------------- */
  let toastT;
  function toast(msg) {
    toastN.textContent = msg; toastN.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastN.classList.remove('show'), 1800);
  }

  /* =====================================================================
     KEYBOARD
     ===================================================================== */
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target, tag = tg.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tg.isContentEditable;
    if (e.key === 'Escape') {
      if (detail.node && !detail.node.hidden) return closeDetail();
      const open = ['qr-modal', 'keys-modal'].map($).find((m) => !m.hidden); if (open) return closeModal(open);
      if (immOpen) return closeImmersive();
      return;
    }
    if (typing) return;
    const onButton = tag === 'BUTTON' || tag === 'A' || tg.classList.contains('card');
    const k = e.key;
    if ((k === ' ' && !onButton) || k === 'k' || k === 'K') { e.preventDefault(); togglePlay(); }
    else if (k === 'ArrowRight' && S.current) { e.preventDefault(); if (e.shiftKey) next(); else { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); positionState(); } }
    else if (k === 'ArrowLeft' && S.current) { e.preventDefault(); if (e.shiftKey) prev(); else { audio.currentTime = Math.max(0, audio.currentTime - 10); positionState(); } }
    else if ((k === 'ArrowUp' || k === 'ArrowDown') && immOpen) { e.preventDefault(); setVolume(audio.volume + (k === 'ArrowUp' ? 0.05 : -0.05)); }
    else if (k === '+' || k === '=') setVolume(audio.volume + 0.05);
    else if (k === '-' || k === '_') setVolume(audio.volume - 0.05);
    else if (k === 'm' || k === 'M') toggleMute();
    else if (k === 's' || k === 'S') setShuffle(!S.shuffle);
    else if (k === 'r' || k === 'R') setRepeat({ all: 'one', one: 'off', off: 'all' }[S.repeat]);
    else if (k === 'i' || k === 'I') { immOpen ? closeImmersive() : openImmersive(); }
    else if (k === '/') { e.preventDefault(); searchN.focus(); searchN.select(); }
    else if (k === '?') openModal('keys-modal');
    else if (k === 'f' || k === 'F') goFeral();
  });

  /* =====================================================================
     GROMMET'S FLEX — marquee, feral mode, bee eyes, cursor pollen, needle drop
     ===================================================================== */
  const phrases = ['buzzing', 'tightening a bolt', 'found a loose wire', 'polishing the wax', 'the kettle is on', 'dancing harder',
    'carrying something heavy', 'checking the honey levels', 'the wrench still fits', 'everything is fastened',
    'you look like you need a song', 'the hive never sleeps', 'warm wax, warm hearts', 'tiny bee, serious grip'];
  let pi = 0, marqueeT = setInterval(rollMarquee, 3200);
  function rollMarquee() {
    pi = (pi + 1) % phrases.length;
    if (reduceMotion) { marquee.textContent = phrases[pi]; return; }
    marquee.style.opacity = '0';
    setTimeout(() => { marquee.textContent = phrases[pi]; marquee.style.opacity = '1'; }, 300);
  }

  let feralOn = false;
  function goFeral() {
    if (feralOn) return; feralOn = true;
    document.body.classList.add('feral');
    clearInterval(marqueeT);
    const fp = ['F E R A L', 'off the leash!!', 'DANCE HARDER', 'the wrench is MINE', 'NO ADULT SUPERVISION', 'ANTICS JUICE', 'SPIN TO WIN'];
    let i = 0;
    const fi = setInterval(() => { marquee.textContent = fp[i++ % fp.length]; A.kick = true; }, 220);
    setTimeout(() => { clearInterval(fi); document.body.classList.remove('feral'); feralOn = false; marqueeT = setInterval(rollMarquee, 3200); }, 3200);
  }
  let clicks = 0, clickT;
  $('bee-logo').addEventListener('click', () => {
    clicks++; clearTimeout(clickT); clickT = setTimeout(() => { if (clicks < 3) togglePlay(); clicks = 0; }, 380);
    if (clicks >= 3) { clicks = 0; clearTimeout(clickT); goFeral(); }
  });

  function needleDrop() {
    if (reduceMotion) return;
    npCover.classList.remove('drop'); void npCover.offsetWidth; npCover.classList.add('drop');
    setTimeout(() => npCover.classList.remove('drop'), 500);
  }

  function beeEyes() {
    if (reduceMotion) return;
    setInterval(() => {
      if (Math.random() > 0.35 || document.hidden) return;
      const cards = [...gridN.querySelectorAll('.card')].filter((c) => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      const card = cards[Math.floor(Math.random() * cards.length)];
      if (!card || card.querySelector('.bee-eyes')) return;
      const eyes = el('span', 'bee-eyes', '<span class="eye l"></span><span class="eye r"></span>');
      eyes.style.left = (Math.random() * 55 + 15) + '%'; eyes.style.top = (Math.random() * 40 + 15) + '%';
      card.querySelector('.art').appendChild(eyes);
      setTimeout(() => eyes.classList.add('on'), 60);
      setTimeout(() => { eyes.classList.remove('on'); setTimeout(() => eyes.remove(), 500); }, 1300);
    }, 4200);
  }

  function cursorPollen() {
    const cvs = $('cursor-canvas');
    if (!cvs || !finePointer || reduceMotion) return;
    const ctx = cvs.getContext('2d');
    let parts = [], lx = -100, ly = -100, running = false;
    const resize = () => { cvs.width = innerWidth; cvs.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - lx, e.clientY - ly) > 14) {
        parts.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 0.4, vy: -Math.random() * 0.5, life: 1, r: 1 + Math.random() * 2.2, v: Math.random() < 0.25 });
        if (parts.length > 100) parts.shift();
        lx = e.clientX; ly = e.clientY;
        if (!running) { running = true; requestAnimationFrame(draw); }
      }
    }, { passive: true });
    function draw() {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      parts = parts.filter((p) => p.life > 0);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02; p.vy -= 0.004;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.v ? '#b9a0f5' : '#f2a93b';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(draw); else running = false;
    }
  }

  /* =====================================================================
     BOOT
     ===================================================================== */
  $('hero-play').addEventListener('click', () => { const l = newestFirst(); if (l[0]) playFrom(l[0], l, 'the newest'); });
  $('hero-shuffle').addEventListener('click', () => {
    setShuffle(true, false);
    const l = S.tracks.slice(); const t = l[Math.floor(Math.random() * l.length)];
    if (t) playFrom(t, l, 'the whole hive (shuffled)');
  });

  setShuffle(S.shuffle, false);
  setRepeat(['all', 'one', 'off'].includes(S.repeat) ? S.repeat : 'all', false);
  audio.muted = false;
  setVolume(parseFloat(store.get('grommet_vol', '0.9')), true);

  fetch('catalog.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      prepare(data);
      const n = S.tracks.length;
      $('status-count').textContent = n + ' tracks';
      $('foot-count').textContent = n + ' tracks in the comb';
      renderComb();
      renderFeatured();
      renderFilters();
      renderGrid();
      bindTilt(gridN, '.card.tilt');
      if (finePointer && !reduceMotion) { ftRecord.classList.add('tilt'); bindTilt(ft, '.ft-record'); }
      requestAnimationFrame(rotationTick);

      // deep link (#t=slug) beats resume
      const hash = new URLSearchParams(location.hash.slice(1)).get('t');
      const linked = hash && S.bySlug.get(hash);
      let saved = null; try { saved = JSON.parse(store.get('grommet_state', 'null')); } catch (e) { /* noop */ }
      if (linked) {
        S.queue = newestFirst(); S.qi = S.queue.indexOf(linked); S.queueLabel = 'a shared link'; buildOrder(S.qi);
        load(linked, false);
        openDetail(linked, null);
      } else if (saved && S.bySlug.get(saved.slug)) {
        const t = S.bySlug.get(saved.slug);
        S.queue = newestFirst(); S.qi = S.queue.indexOf(t); S.queueLabel = saved.label || 'the hive'; buildOrder(S.qi);
        load(t, false, saved.t || 0);
        npContext.textContent = saved.t > 5 ? `resume from ${fmt(saved.t)}` : 'ready when you are';
        history.replaceState(null, '', location.pathname);
      }
    })
    .catch(() => {
      gridN.setAttribute('aria-busy', 'false');
      gridN.innerHTML = '<div class="empty"><strong>The comb is jammed</strong>Couldn’t load the catalog. Give it a refresh. 🐝</div>';
    });

  beeEyes();
  cursorPollen();
})();
