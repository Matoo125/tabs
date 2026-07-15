// ---- Storage helpers ------------------------------------------------

function loadLinks() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ links: [] }, (data) => resolve(data.links));
  });
}

function saveLinks(links) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ links }, resolve);
  });
}

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
}

// Deterministic "catalog tab" color per domain, drawn from a small palette
// that stays inside the ink/amber theme rather than clashing with it.
const TAB_PALETTE = ['#E3A857', '#8FA6A3', '#B98A73', '#7C93B0', '#B08AA8'];
function domainColor(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { host = url; }
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
  return TAB_PALETTE[hash % TAB_PALETTE.length];
}

function hostAndPath(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return u.hostname.replace(/^www\./, '') + path;
  } catch (e) {
    return url;
  }
}

// ---- State ------------------------------------------------------------

let links = [];
let activeTag = null;
let searchText = '';

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const countEl = document.getElementById('count');
const tagRailEl = document.getElementById('tagRail');
const searchEl = document.getElementById('search');
const saveBtn = document.getElementById('saveTab');
const dashboardBtn = document.getElementById('openDashboard');

// ---- Rendering ----------------------------------------------------------

function allTags() {
  const set = new Set();
  links.forEach((l) => l.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function filteredLinks() {
  const q = searchText.trim().toLowerCase();
  return links
    .filter((l) => !activeTag || l.tags.includes(activeTag))
    .filter((l) => {
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function renderTagRail() {
  const tags = allTags();
  if (tags.length === 0) {
    tagRailEl.hidden = true;
    tagRailEl.innerHTML = '';
    return;
  }
  tagRailEl.hidden = false;
  tagRailEl.innerHTML = '';

  const allPill = document.createElement('button');
  allPill.className = 'tag-pill' + (activeTag === null ? ' is-active' : '');
  allPill.textContent = 'All';
  allPill.addEventListener('click', () => { activeTag = null; render(); });
  tagRailEl.appendChild(allPill);

  tags.forEach((tag) => {
    const pill = document.createElement('button');
    pill.className = 'tag-pill' + (activeTag === tag ? ' is-active' : '');
    pill.textContent = tag;
    pill.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      render();
    });
    tagRailEl.appendChild(pill);
  });
}

function cardTemplate(link) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = link.id;

  const tab = document.createElement('span');
  tab.className = 'card__tab';
  tab.style.background = domainColor(link.url);
  card.appendChild(tab);

  const favicon = document.createElement('img');
  favicon.className = 'card__favicon';
  favicon.src = link.favIconUrl || 'icons/icon16.png';
  favicon.onerror = () => { favicon.src = 'icons/icon16.png'; };
  card.appendChild(favicon);

  const body = document.createElement('div');
  body.className = 'card__body';

  const title = document.createElement('a');
  title.className = 'card__title';
  title.textContent = link.title || hostAndPath(link.url);
  title.title = link.url;
  title.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: link.url });
  });
  body.appendChild(title);

  const url = document.createElement('div');
  url.className = 'card__url';
  url.textContent = hostAndPath(link.url);
  body.appendChild(url);

  const tagsRow = document.createElement('div');
  tagsRow.className = 'card__tags';

  link.tags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.className = 'tag-chip';
    chip.title = 'Remove tag';
    chip.textContent = tag + ' ';
    const removeSpan = document.createElement('span');
    removeSpan.className = 'tag-chip__remove';
    removeSpan.textContent = '\u00d7';
    chip.appendChild(removeSpan);
    chip.addEventListener('click', async () => {
      link.tags = link.tags.filter((t) => t !== tag);
      await saveLinks(links);
      render();
    });
    tagsRow.appendChild(chip);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'tag-add';
  addBtn.textContent = '+ tag';
  addBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.className = 'tag-input';
    input.placeholder = 'tag, tag';
    tagsRow.replaceChild(input, addBtn);
    input.focus();

    const commit = async () => {
      const raw = input.value.trim();
      if (raw) {
        const newTags = raw.split(',').map((t) => t.trim()).filter(Boolean);
        newTags.forEach((t) => {
          if (!link.tags.includes(t)) link.tags.push(t);
        });
        await saveLinks(links);
      }
      render();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') render();
    });
    input.addEventListener('blur', commit);
  });
  tagsRow.appendChild(addBtn);

  body.appendChild(tagsRow);
  card.appendChild(body);

  const del = document.createElement('button');
  del.className = 'card__delete';
  del.textContent = '\u00d7';
  del.title = 'Remove link';
  del.addEventListener('click', async () => {
    links = links.filter((l) => l.id !== link.id);
    await saveLinks(links);
    render();
  });
  card.appendChild(del);

  return card;
}

function render() {
  renderTagRail();
  const visible = filteredLinks();

  listEl.innerHTML = '';
  visible.forEach((link) => listEl.appendChild(cardTemplate(link)));

  countEl.textContent = String(links.length);
  emptyEl.hidden = links.length !== 0;
  listEl.hidden = links.length === 0;
}

// ---- Actions ------------------------------------------------------------

async function saveCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
    flashSaveBtn('Can\u2019t save this page');
    return;
  }
  if (links.some((l) => l.url === tab.url)) {
    flashSaveBtn('Already saved');
    return;
  }
  links.unshift({
    id: uid(),
    url: tab.url,
    title: tab.title || hostAndPath(tab.url),
    favIconUrl: tab.favIconUrl || '',
    tags: [],
    createdAt: Date.now(),
  });
  await saveLinks(links);
  flashSaveBtn('Saved');
  render();
}

function flashSaveBtn(label) {
  const original = saveBtn.textContent;
  saveBtn.textContent = label;
  saveBtn.classList.add('is-saved');
  setTimeout(() => {
    saveBtn.textContent = original;
    saveBtn.classList.remove('is-saved');
  }, 1100);
}

// ---- Wiring ------------------------------------------------------------

searchEl.addEventListener('input', (e) => {
  searchText = e.target.value;
  render();
});

saveBtn.addEventListener('click', saveCurrentTab);
dashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'dashboard.html' });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.links) {
    links = changes.links.newValue || [];
    render();
  }
});

(async function init() {
  links = await loadLinks();
  render();
})();
