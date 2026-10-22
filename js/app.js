(function () {
  const gridN = document.getElementById('grid');
  const filtersN = document.getElementById('filters');
  const player = document.getElementById('now-playing');
  const audioEl = document.getElementById('audio');
  const npCover = document.getElementById('np-cover');
  const npTitle = document.getElementById('np-title');
  const npMood = document.getElementById('np-mood');
  const nowWax = document.getElementById('now-wax');
  const stage = document.getElementById('carousel-stage');
  const dots = document.getElementById('carousel-dots');
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  const marquee = document.getElementById('hive-marquee');
  const footCount = document.getElementById('foot-count');
  const pollen = document.getElementById('pollen');
  const eqEl = document.getElementById('eq');
  const tpPlay = document.getElementById('tp-play');
  const tpPrev = document.getElementById('tp-prev');
  const tpNext = document.getElementById('tp-next');
  const tpShuffle = document.getElementById('tp-shuffle');
  const tpStop = document.getElementById('tp-stop');

  let catalog = null;
  let carouselIdx = 0;
  let beePhrases = [];
  let currentSort = 'newest';
  let currentMood = 'All';
  let autoplay = true;
  let shuffleOn = false;
  let currentTitle = null;

  const tagMap = {
    grimy: "Grimy", grunge: "Grimy", rap: "Rap", throwdown: "Rap", street: "Rap",
    anthem: "Anthem", bee: "Bee", rave: "Rave", glitch: "Glitch", drop: "Glitch",
    butter: "Smooth", groove: "Groove", friday: "Friday", club: "Club", disco: "Disco",
    night: "Night", walker: "Night", breakdance: "Break", "get out": "Defiant", control: "Anthem",
    chiptune: "Chiptune", ym2612: "Chiptune", mix: "Mix", dj: "Mix", "after dark": "Mix", dark: "Mix"
  };

  function assignMoods(tracks) {
    tracks.forEach(t => {
      t.mood = [];
      const tt = t.title.toLowerCase();
      Object.keys(tagMap).forEach(k => {
        if (tt.includes(k)) { const m = tagMap[k]; if (!t.mood.includes(m)) t.mood.push(m); }
      });
      if (!t.mood.length) t.mood.push('Vibe');
    });
  }

  function spawnPollen(n) {
    for (let i = 0; i < n; i++) {
      const mote = document.createElement('span');
      mote.className = 'mote';
      mote.style.left = Math.random() * 100 + '%';
      mote.style.animationDuration = (12 + Math.random() * 16) + 's';
      mote.style.animationDelay = (Math.random() * 12) + 's';
      mote.style.width = mote.style.height = (2 + Math.random() * 4) + 'px';
      pollen.appendChild(mote);
    }
  }

  function buildBee() {
    beePhrases = [
      'buzzing...', 'tightening a bolt', 'found a loose wire', 'polishing the wax',
      'the kettle is on', 'dancing harder', 'carrying something heavy', 'checking the honey levels',
      'the wrench still fits', 'everything is fastened', 'you look like you need a song',
      'the hive never sleeps', 'warm wax, warm hearts', 'tiny bee, serious grip'
    ];
    let i = 0;
    setInterval(() => { marquee.textContent = '🐝 ' + beePhrases[i % beePhrases.length]; i++; }, 2600);
  }

  function applySort(list, mode) {
    const copy = list.slice();
    if (mode === 'newest') return copy.reverse();
    if (mode === 'oldest') return copy;
    if (mode === 'a-z') return copy.sort((a, b) => a.title.localeCompare(b.title));
    if (mode === 'shuffle') {
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
    return copy;
  }

  function renderFilters(tracks) {
    const favPill = document.createElement('button');
    favPill.textContent = '♥ Favourites (0)'; favPill.dataset.mood = 'Favourites';
    favPill.addEventListener('click', () => {
      filtersN.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      favPill.classList.add('active');
      renderGrid(tracks, 'Favourites');
    });
    filtersN.appendChild(favPill);
    const set = new Set(['All']);
    tracks.forEach(t => t.mood.forEach(m => set.add(m)));
    [...set].forEach(m => {
      const b = document.createElement('button');
      b.textContent = m; b.dataset.mood = m;
      b.addEventListener('click', () => {
        filtersN.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderGrid(tracks, m);
      });
      filtersN.appendChild(b);
    });
    filtersN.querySelector('button').classList.add('active');
    updateFavPill();
  }

  function renderGrid(tracks, mood) {
    gridN.innerHTML = '';
    currentMood = mood || 'All';
    let list;
  if (mood === 'Favourites') {
    list = tracks.filter(t => favs.has(t.title));
  } else if (mood && mood !== 'All') {
    list = tracks.filter(t => t.mood.includes(mood));
  } else {
    list = tracks.slice();
  }
    list = applySort(list, currentSort);
    if (!list.length) { gridN.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">Nothing here yet — buzz back soon. 🐝</p>'; return; }
    list.forEach(t => {
      const card = document.createElement('article');
      card.className = 'card'; card.tabIndex = 0; card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Play ' + t.title);
      const art = document.createElement('div'); art.className = 'art';
      if (t.cover) { const img = document.createElement('img'); img.src = t.cover; img.alt = ''; img.loading = 'lazy'; art.appendChild(img); }
      else { const ph = document.createElement('span'); ph.className = 'placeholder'; ph.textContent = '🐝'; art.appendChild(ph); }
      const name = document.createElement('div'); name.className = 'name'; name.textContent = t.title;
      if (t.isNew) { const nb = document.createElement('span'); nb.className = 'new-badge'; nb.textContent = 'NEW'; name.appendChild(nb); }
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = t.mood.join(' · ');
      card.appendChild(art); card.appendChild(name); card.appendChild(meta);
      card.appendChild(favButton(t));
      card.addEventListener('click', () => openDetail(t, card));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(t, card); } });
      gridN.appendChild(card);
    });
  }

  function renderCarousel(tracks) {
    stage.innerHTML = ''; dots.innerHTML = '';
    tracks.forEach((t, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide'; slide.dataset.idx = i;
      const cover = document.createElement('div'); cover.className = 'slide-cover';
      if (t.cover) { const img = document.createElement('img'); img.src = t.cover; img.alt = t.title; img.loading = 'lazy'; cover.appendChild(img); }
      else { const ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = '🐝'; cover.appendChild(ph); }
      cover.addEventListener('click', () => play(t));
      const title = document.createElement('div'); title.className = 'slide-title'; title.textContent = t.title;
      const mood = document.createElement('div'); mood.className = 'slide-mood'; mood.textContent = t.mood.join(' · ');
      if (t.isNew) { const nb = document.createElement('span'); nb.className = 'new-badge'; nb.textContent = 'NEW'; mood.appendChild(nb); }
      const playBtn = document.createElement('button'); playBtn.className = 'slide-play'; playBtn.textContent = '▶ Buzz it';
      playBtn.addEventListener('click', () => play(t));
      slide.appendChild(cover); slide.appendChild(title); slide.appendChild(mood); slide.appendChild(playBtn);
      slide.appendChild(favButton(t));
      stage.appendChild(slide);
      const d = document.createElement('button'); d.setAttribute('aria-label', 'Go to ' + t.title);
      d.addEventListener('click', () => { carouselIdx = i; updateCarousel(); });
      dots.appendChild(d);
    });
    updateCarousel();
  }

  function updateCarousel() {
    const slides = [...stage.children];
    slides.forEach((s, i) => {
      s.classList.remove('active', 'prev', 'next', 'far');
      if (i === carouselIdx) s.classList.add('active');
      else if (i === (carouselIdx - 1 + slides.length) % slides.length) s.classList.add('prev');
      else if (i === (carouselIdx + 1) % slides.length) s.classList.add('next');
      else s.classList.add('far');
    });
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === carouselIdx));
  }

  function play(t) {
    player.hidden = false;
    npTitle.textContent = t.title;
    npMood.textContent = t.mood.join(' · ');
    if (t.cover) npCover.style.backgroundImage = 'url(' + t.cover + ')';
    else npCover.style.backgroundImage = '';
    audioEl.src = t.audio;
    currentTitle = t.title;
    audioEl.play().catch(() => {});
    player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    centerCarouselOn(t);
  }

  function centerCarouselOn(t) {
    if (!catalog || !catalog.tracks || !catalog.tracks.length) return;
    const idx = catalog.tracks.findIndex(x => x.title === t.title);
    if (idx === -1) return;
    carouselIdx = idx;
    updateCarousel();
  }

  function playNext() {
    if (!catalog || !catalog.tracks || !catalog.tracks.length) return;
    if (!currentTitle) return;
    const list = applySort(catalog.tracks.slice(), currentSort);
    let idx = -1;
    for (let i = 0; i < list.length; i++) { if (list[i].title === currentTitle) { idx = i; break; } }
    if (idx === -1) return;
    let next;
    if (shuffleOn) {
      let pick = idx;
      while (pick === idx && list.length > 1) pick = Math.floor(Math.random() * list.length);
      next = list[pick];
    } else {
      next = list[(idx + 1) % list.length];
    }
    play(next);
  }

  function playPrev() {
    if (!catalog || !catalog.tracks || !catalog.tracks.length) return;
    if (!currentTitle) return;
    const list = applySort(catalog.tracks.slice(), currentSort);
    let idx = -1;
    for (let i = 0; i < list.length; i++) { if (list[i].title === currentTitle) { idx = i; break; } }
    if (idx === -1) return;
    const prev = list[(idx - 1 + list.length) % list.length];
    play(prev);
  }

  prevBtn.addEventListener('click', () => { carouselIdx = (carouselIdx - 1 + catalog.tracks.length) % catalog.tracks.length; updateCarousel(); });
  nextBtn.addEventListener('click', () => { carouselIdx = (carouselIdx + 1) % catalog.tracks.length; updateCarousel(); });
  audioEl.addEventListener('play', () => { nowWax.setAttribute('data-playing', 'true'); setPlayBtnState(); });
  audioEl.addEventListener('pause', () => { nowWax.setAttribute('data-playing', 'false'); setPlayBtnState(); });
  audioEl.addEventListener('ended', () => { nowWax.setAttribute('data-playing', 'false'); playNext(); });

  function setPlayBtnState() {
    if (tpPlay) {
      tpPlay.textContent = audioEl.paused ? '\u25B6' : '\u275A\u275A';
      tpPlay.setAttribute('title', audioEl.paused ? 'Play' : 'Pause');
      tpPlay.setAttribute('aria-label', audioEl.paused ? 'Play' : 'Pause');
      tpPlay.setAttribute('aria-pressed', audioEl.paused ? 'false' : 'true');
    }
  }

  function buildTransportControls() {
    if (tpPlay && !tpPlay.dataset.wired) {
      tpPlay.dataset.wired = '1';
      tpPlay.addEventListener('click', () => {
        if (audioEl.paused) { audioEl.play().catch(() => {}); }
        else { audioEl.pause(); }
        setPlayBtnState();
      });
    }
    if (tpPrev && !tpPrev.dataset.wired) {
      tpPrev.dataset.wired = '1';
      tpPrev.addEventListener('click', () => playPrev());
    }
    if (tpNext && !tpNext.dataset.wired) {
      tpNext.dataset.wired = '1';
      tpNext.addEventListener('click', () => playNext());
    }
    if (tpShuffle && !tpShuffle.dataset.wired) {
      tpShuffle.dataset.wired = '1';
      tpShuffle.addEventListener('click', () => {
        shuffleOn = !shuffleOn;
        tpShuffle.setAttribute('aria-pressed', shuffleOn ? 'true' : 'false');
      });
    }
    if (tpStop && !tpStop.dataset.wired) {
      tpStop.dataset.wired = '1';
      tpStop.addEventListener('click', () => {
        audioEl.pause();
        audioEl.currentTime = 0;
        setEqFlat();
        setPlayBtnState();
      });
    }
    setPlayBtnState();
  }

  function buildAutoplayToggle() {
    if (document.getElementById('autoplay-toggle')) return;
    if (!player) return;
    const btn = document.createElement('button');
    btn.id = 'autoplay-toggle';
    btn.className = 'autoplay-toggle';
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = 'Autoplay: on';
    btn.addEventListener('click', () => {
      autoplay = !autoplay;
      btn.setAttribute('aria-pressed', autoplay ? 'true' : 'false');
      btn.textContent = 'Autoplay: ' + (autoplay ? 'on' : 'off');
    });
    player.appendChild(btn);
  }

  spawnPollen(24);
  buildBee();

  fetch('catalog.json')
    .then(r => r.json())
    .then(data => {
      catalog = data;
      document.title = data.name;
      assignMoods(data.tracks);
      const n = data.tracks.length;
      data.tracks.forEach((t, i) => { t.isNew = (i >= n - 4) && (i < n); });
      renderFilters(data.tracks);
      renderGrid(data.tracks, 'All');
      renderCarousel(data.tracks);
      buildSortControl();
      if (footCount) footCount.textContent = data.tracks.length + ' tracks in the comb';
    })
    .catch(() => { gridN.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">Could not load the library catalog. 🐝</p>'; });


  function buildSortControl() {
    if (document.getElementById('sort-select')) return;
    const row = document.createElement('div');
    row.className = 'sort-row';
    const sel = document.createElement('select');
    sel.id = 'sort-select';
    const opts = [['newest','Newest'],['oldest','Oldest'],['a-z','A–Z'],['shuffle','Shuffle']];
    opts.forEach(([val, label]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = label;
      if (val === currentSort) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      currentSort = sel.value;
      const active = filtersN.querySelector('button.active');
      const mood = active && active.dataset.mood ? active.dataset.mood : currentMood;
      renderGrid(catalog.tracks, mood);
    });
    row.appendChild(sel);
    filtersN.parentNode.insertBefore(row, filtersN);
  }

  /* ===== FERAL FLEX EFFECTS ===== */

  function initCursorPollen() {
    const cvs = document.getElementById('cursor-canvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let particles = [];
    function resize() { cvs.width = innerWidth; cvs.height = innerHeight; }
    resize(); addEventListener('resize', resize);
    let lx = -100, ly = -100;
    addEventListener('mousemove', e => {
      if (Math.hypot(e.clientX-lx, e.clientY-ly) > 12) {
        particles.push({ x:e.clientX, y:e.clientY, vx:(Math.random()-.5)*.4, vy:-Math.random()*.5, life:1, r:1+Math.random()*2.5 });
        if (particles.length > 120) particles.shift();
        lx = e.clientX; ly = e.clientY;
      }
    });
    (function draw() {
      ctx.clearRect(0,0,cvs.width,cvs.height);
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= .018; p.vy -= .004;
        ctx.globalAlpha = Math.max(0,p.life); ctx.fillStyle = '#f5b82e';
        ctx.shadowBlur = 8; ctx.shadowColor = '#f5b82e';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      requestAnimationFrame(draw);
    })();
  }

  function needleDrop() { npCover.classList.remove('drop'); void npCover.offsetWidth; npCover.classList.add('drop'); setTimeout(() => npCover.classList.remove('drop'), 500); }

  let analyser=null, audioCtx=null, rafId=null, audioSrcCreated=false;
  let eqBars = [];
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let data = null;
  let tickFn = null;
  function ensureAudioReact() {
    // Create the Web Audio graph ONCE (createMediaElementSource can only be called per element).
    if (!audioSrcCreated) {
      try {
        audioCtx = new (window.AudioContext||window.webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 128;
        src.connect(analyser); analyser.connect(audioCtx.destination);
        if (eqEl) eqBars = [...eqEl.querySelectorAll('.eq-bar')];
        data = new Uint8Array(analyser.frequencyBinCount);
        audioSrcCreated = true;
      } catch(e) { return; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    // (Re)start the rAF loop if it isn't already running.
    if (!rafId) {
      tickFn = () => {
        if (analyser && data) analyser.getByteFrequencyData(data);
        if (data) {
          let s = 0; for (let i = 0; i < data.length; i++) s += data[i];
          const inten = Math.min(1, (s / data.length) / 90);
          player.style.boxShadow = '0 0 ' + Math.round(10 + inten * 50) + 'px rgba(245,184,46,' + (0.14 + inten * .5) + '), 0 12px 40px rgba(0,0,0,0.4)';
          if (eqBars.length && !reducedMotion) {
            const n = eqBars.length;
            for (let b = 0; b < n; b++) {
              const bin = 2 + Math.floor((data.length - 2) * (b / n));
              const v = data[bin] || 0;
              const h = Math.max(4, Math.min(30, Math.round((v / 255) * 30)));
              eqBars[b].style.height = h + 'px';
            }
          }
        }
        rafId = requestAnimationFrame(tickFn);
      };
      rafId = requestAnimationFrame(tickFn);
    }
  }
  function resetGlow() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } player.style.boxShadow = ''; }
  function setEqFlat() {
    if (eqEl) eqEl.classList.remove('playing');
    eqBars.forEach(bar => { bar.style.height = '4px'; });
  }
  audioEl.addEventListener('play', () => { ensureAudioReact(); needleDrop(); if (eqEl) eqEl.classList.add('playing'); });
  audioEl.addEventListener('pause', () => { resetGlow(); setEqFlat(); });
  audioEl.addEventListener('ended', () => { resetGlow(); setEqFlat(); });

  function initBeeEyes() {
    setInterval(() => {
      const cards = gridN.querySelectorAll('.card');
      if (Math.random()>.35 || !cards.length) return;
      const card = cards[Math.floor(Math.random()*cards.length)];
      if (!card.getAttribute('data-has-eyes')) {
        card.setAttribute('data-has-eyes','1');
        const eyes = document.createElement('span'); eyes.className='bee-eyes';
        eyes.innerHTML = '<span class="eye l"></span><span class="eye r"></span>';
        eyes.style.left = (Math.random()*60+15)+'%'; eyes.style.top = (Math.random()*60+15)+'%';
        card.appendChild(eyes);
        setTimeout(() => eyes.classList.add('on'), 60);
        setTimeout(() => { eyes.classList.remove('on'); setTimeout(() => eyes.remove(), 500); }, 1300);
      }
    }, 4200);
  }

  let clickCount=0, clickTimer=null;
  const logo = document.querySelector('.bee-logo');
  function goFeral() {
    document.body.classList.add('feral');
    const fp = ['F E R A L','off the leash!!','DANCE HARDER','the wrench is MINE','buzz buzz mother-','NO ADULT SUPERVISION','ANTICS JUICE','SPIN TO WIN'];
    let i=0;
    const fi = setInterval(() => { marquee.textContent = '🐝 ' + fp[i++ % fp.length]; }, 220);
    setTimeout(() => { clearInterval(fi); document.body.classList.remove('feral'); }, 3200);
  }
  if (logo) logo.addEventListener('click', () => { clickCount++; clearTimeout(clickTimer); clickTimer=setTimeout(()=>{clickCount=0;},900); if(clickCount>=3){ clickCount=0; goFeral(); } });
  addEventListener('keydown', e => { if (e.key==='f'||e.key==='F') goFeral(); });

  initCursorPollen();
  initBeeEyes();
  buildAutoplayToggle();
  buildTransportControls();



  /* ===== MOBILE SWIPE CAROUSEL ===== */
  let touchStartX = 0, touchStartY = 0, touchMoved = false;
  const cwrap = document.getElementById('carousel-wrap');
  if (cwrap) {
    cwrap.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      touchMoved = false;
    }, { passive: true });
    cwrap.addEventListener('touchmove', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 12) touchMoved = true;
    }, { passive: true });
    cwrap.addEventListener('touchend', e => {
      if (!touchMoved || !catalog || !catalog.tracks.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < Math.abs(dy)) return;
      if (dx < -40) { carouselIdx = (carouselIdx + 1) % catalog.tracks.length; updateCarousel(); }
      else if (dx > 40) { carouselIdx = (carouselIdx - 1 + catalog.tracks.length) % catalog.tracks.length; updateCarousel(); }
    }, { passive: true });
  }

  /* ===== FAVOURITES ===== */
  let favs = new Set();
  try { favs = new Set((localStorage.getItem('grommet_favs') || '').split(',').filter(Boolean)); } catch(e) {}
  function persistFavs() { try { localStorage.setItem('grommet_favs', [...favs].join(',')); } catch(e) {} }
  function isFav(title) { return favs.has(title); }
  function toggleFav(title) {
    if (favs.has(title)) favs.delete(title); else favs.add(title);
    persistFavs();
    const active = filtersN.querySelector('button.active');
    if (active && active.dataset.mood === 'Favourites') renderGrid(catalog.tracks, 'Favourites');
    else renderGrid(catalog.tracks, active ? active.dataset.mood : 'All');
    updateFavPill();
  }
  function updateFavPill() {
    const p = filtersN.querySelector('button[data-mood="Favourites"]');
    if (p) p.textContent = '♥ Favourites (' + favs.size + ')';
  }
  function favButton(t) {
    const b = document.createElement('button');
    b.className = 'fav-btn' + (isFav(t.title) ? ' on' : '');
    b.textContent = isFav(t.title) ? '♥' : '♡';
    b.setAttribute('aria-label', 'Favourite ' + t.title);
    b.addEventListener('click', e => { e.stopPropagation(); toggleFav(t.title); });
    return b;
  }

  /* ===== DETAIL CARD LIGHTBOX ===== */
  let detailEl = null;
  let detailTrack = null;
  let detailBack = null;
  let lastFocused = null;

  function buildDetail() {
    if (detailEl) return;
    detailEl = document.createElement('div');
    detailEl.className = 'detail';
    detailEl.setAttribute('role', 'dialog');
    detailEl.setAttribute('aria-modal', 'true');
    detailEl.setAttribute('aria-label', 'Track details');
    detailEl.hidden = true;

    detailBack = document.createElement('div');
    detailBack.className = 'detail-backdrop';
    detailBack.setAttribute('aria-hidden', 'true');

    const card = document.createElement('div');
    card.className = 'detail-card';

    const close = document.createElement('button');
    close.className = 'detail-close';
    close.type = 'button';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', closeDetail);

    const art = document.createElement('div');
    art.className = 'detail-art';

    const title = document.createElement('div');
    title.className = 'detail-title';

    const mood = document.createElement('div');
    mood.className = 'detail-mood';

    const actions = document.createElement('div');
    actions.className = 'detail-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'detail-play';
    playBtn.type = 'button';
    playBtn.textContent = '▶ Buzz it';
    playBtn.addEventListener('click', () => { if (detailTrack) play(detailTrack); });

    const favBtn = document.createElement('button');
    favBtn.className = 'detail-fav';
    favBtn.type = 'button';
    favBtn.addEventListener('click', () => { if (detailTrack) { toggleFav(detailTrack.title); refreshDetailFav(); } });

    actions.appendChild(playBtn);
    actions.appendChild(favBtn);

    card.appendChild(close);
    card.appendChild(art);
    card.appendChild(title);
    card.appendChild(mood);
    card.appendChild(actions);

    detailEl.appendChild(detailBack);
    detailEl.appendChild(card);
    document.body.appendChild(detailEl);

    detailBack.addEventListener('click', closeDetail);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && detailEl && !detailEl.hidden) closeDetail();
    });
  }

  function refreshDetailFav() {
    if (!detailEl || !detailTrack) return;
    const favBtn = detailEl.querySelector('.detail-fav');
    if (favBtn) {
      favBtn.classList.toggle('on', isFav(detailTrack.title));
      favBtn.textContent = isFav(detailTrack.title) ? '♥ Favourited' : '♡ Favourite';
      favBtn.setAttribute('aria-pressed', isFav(detailTrack.title) ? 'true' : 'false');
    }
  }

  function openDetail(t, originCard) {
    buildDetail();
    detailTrack = t;
    if (originCard) lastFocused = originCard;

    const art = detailEl.querySelector('.detail-art');
    art.innerHTML = '';
    if (t.cover) {
      const img = document.createElement('img');
      img.src = t.cover;
      img.alt = t.title;
      art.appendChild(img);
    } else {
      const ph = document.createElement('span');
      ph.className = 'detail-ph';
      ph.textContent = '🐝';
      art.appendChild(ph);
    }

    detailEl.querySelector('.detail-title').textContent = t.title;

    const mood = detailEl.querySelector('.detail-mood');
    mood.innerHTML = '';
    t.mood.forEach(m => {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = m;
      mood.appendChild(pill);
    });

    const favBtn = detailEl.querySelector('.detail-fav');
    favBtn.classList.toggle('on', isFav(t.title));
    favBtn.textContent = isFav(t.title) ? '♥ Favourited' : '♡ Favourite';
    favBtn.setAttribute('aria-pressed', isFav(t.title) ? 'true' : 'false');

    detailEl.hidden = false;
    document.body.style.overflow = 'hidden';
    detailEl.querySelector('.detail-close').focus();
  }

  function closeDetail() {
    if (!detailEl) return;
    detailEl.hidden = true;
    document.body.style.overflow = '';
    detailTrack = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }
})();