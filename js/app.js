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

  let catalog = null;
  let carouselIdx = 0;
  let beePhrases = [];

  const tagMap = {
    grimy: "Grimy", grunge: "Grimy", rap: "Rap", throwdown: "Rap", street: "Rap",
    anthem: "Anthem", bee: "Bee", rave: "Rave", glitch: "Glitch", drop: "Glitch",
    butter: "Smooth", groove: "Groove", friday: "Friday", club: "Club", disco: "Disco",
    night: "Night", walker: "Night", breakdance: "Break", "get out": "Defiant", control: "Anthem"
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

  function renderFilters(tracks) {
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
  }

  function renderGrid(tracks, mood) {
    gridN.innerHTML = '';
    const list = mood && mood !== 'All' ? tracks.filter(t => t.mood.includes(mood)) : tracks;
    if (!list.length) { gridN.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">Nothing here yet — buzz back soon. 🐝</p>'; return; }
    list.forEach(t => {
      const card = document.createElement('article');
      card.className = 'card'; card.tabIndex = 0; card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Play ' + t.title);
      const art = document.createElement('div'); art.className = 'art';
      if (t.cover) { const img = document.createElement('img'); img.src = t.cover; img.alt = ''; img.loading = 'lazy'; art.appendChild(img); }
      else { const ph = document.createElement('span'); ph.className = 'placeholder'; ph.textContent = '🐝'; art.appendChild(ph); }
      const name = document.createElement('div'); name.className = 'name'; name.textContent = t.title;
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = t.mood.join(' · ');
      card.appendChild(art); card.appendChild(name); card.appendChild(meta);
      card.addEventListener('click', () => play(t));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t); } });
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
      const playBtn = document.createElement('button'); playBtn.className = 'slide-play'; playBtn.textContent = '▶ Buzz it';
      playBtn.addEventListener('click', () => play(t));
      slide.appendChild(cover); slide.appendChild(title); slide.appendChild(mood); slide.appendChild(playBtn);
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
    audioEl.play().catch(() => {});
    player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  prevBtn.addEventListener('click', () => { carouselIdx = (carouselIdx - 1 + catalog.tracks.length) % catalog.tracks.length; updateCarousel(); });
  nextBtn.addEventListener('click', () => { carouselIdx = (carouselIdx + 1) % catalog.tracks.length; updateCarousel(); });
  audioEl.addEventListener('play', () => nowWax.setAttribute('data-playing', 'true'));
  audioEl.addEventListener('pause', () => nowWax.setAttribute('data-playing', 'false'));
  audioEl.addEventListener('ended', () => nowWax.setAttribute('data-playing', 'false'));

  spawnPollen(24);
  buildBee();

  fetch('catalog.json')
    .then(r => r.json())
    .then(data => {
      catalog = data;
      document.title = data.name;
      assignMoods(data.tracks);
      renderFilters(data.tracks);
      renderGrid(data.tracks, 'All');
      renderCarousel(data.tracks);
      if (footCount) footCount.textContent = data.tracks.length + ' tracks in the comb';
    })
    .catch(() => { gridN.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">Could not load the library catalog. 🐝</p>'; });
})();
