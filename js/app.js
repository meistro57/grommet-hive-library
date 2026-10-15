(function () {
  const grid = document.getElementById('grid');
  const filters = document.getElementById('filters');
  const player = document.getElementById('player');
  const audioEl = document.getElementById('audio');
  const playerCover = document.getElementById('player-cover');
  const playerTitle = document.getElementById('player-title');

  let catalog = null;

  const titleCase = s => s.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join(' ');

  function renderFilters(tracks) {
    const moods = ['All'];
    // derive simple "mood" tags from filename keywords
    const tagMap = {
      'grimy': 'Grimy', 'grunge': 'Grimy', 'rap': 'Rap', 'throwdown': 'Rap', 'street': 'Rap',
      'anthem': 'Anthem', 'bee': 'Bee', 'rave': 'Rave', 'glitch': 'Glitch', 'drop': 'Glitch',
      'butter': 'Smooth', 'groove': 'Groove', 'friday': 'Friday', 'club': 'Club', 'disco': 'Disco',
      'night': 'Night', 'walker': 'Night', 'disco': 'Disco', 'folk': 'Folk'
    };
    tracks.forEach(t => {
      t.mood = [];
      Object.keys(tagMap).forEach(k => {
        if (t.title.toLowerCase().includes(k)) { const m = tagMap[k]; if (!t.mood.includes(m)) t.mood.push(m); }
      });
      if (!t.mood.length) t.mood.push('Vibe');
    });
    const set = new Set(['All']);
    tracks.forEach(t => t.mood.forEach(m => set.add(m)));
    [...set].forEach(m => {
      const b = document.createElement('button');
      b.textContent = m;
      b.dataset.mood = m;
      b.addEventListener('click', () => {
        filters.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderGrid(tracks, m);
      });
      filters.appendChild(b);
    });
    filters.querySelector('button').classList.add('active');
  }

  function renderGrid(tracks, mood) {
    grid.innerHTML = '';
    const list = mood && mood !== 'All' ? tracks.filter(t => t.mood.includes(mood)) : tracks;
    if (!list.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">Nothing here yet — buzz back soon. 🐝</p>';
      return;
    }
    list.forEach(t => {
      const card = document.createElement('article');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Play ' + t.title);

      const art = document.createElement('div');
      art.className = 'art';
      if (t.cover) {
        const img = document.createElement('img');
        img.src = t.cover;
        img.alt = '';
        img.loading = 'lazy';
        art.appendChild(img);
      } else {
        const ph = document.createElement('span');
        ph.className = 'placeholder';
        ph.textContent = '🐝';
        art.appendChild(ph);
      }

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = t.title;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = t.mood.join(' · ');

      card.appendChild(art);
      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener('click', () => play(t));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t); } });

      grid.appendChild(card);
    });
  }

  function play(t) {
    player.hidden = false;
    playerTitle.textContent = t.title;
    if (t.cover) { playerCover.src = t.cover; playerCover.hidden = false; }
    else { playerCover.hidden = true; }
    audioEl.src = t.audio;
    audioEl.play().catch(() => {});
    player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  fetch('catalog.json')
    .then(r => r.json())
    .then(data => {
      catalog = data;
      document.title = data.name;
      renderFilters(data.tracks);
      renderGrid(data.tracks, 'All');
    })
    .catch(err => {
      grid.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">Could not load the library catalog. 🐝</p>';
    });
})();
