// ---- Storage Helpers ------------------------------------------------
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

// Deterministic "catalog tab" color per domain
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

// DOM Elements
const statsTotalEl = document.getElementById('statsTotal');
const statsFilteredEl = document.getElementById('statsFiltered');
const tagListEl = document.getElementById('tagList');
const searchEl = document.getElementById('dashboardSearch');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const fileInput = document.getElementById('importFileInput');
const filterStatusEl = document.getElementById('filterStatus');
const linkGridEl = document.getElementById('linkGrid');
const emptyStateEl = document.getElementById('emptyState');

// ---- Tag Calculations --------------------------------------------------
function getTagCounts() {
  const counts = {};
  links.forEach((l) => {
    l.tags.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  return counts;
}

// ---- Filter Logic ------------------------------------------------------
function getFilteredLinks() {
  const query = searchText.trim().toLowerCase();
  return links
    .filter((l) => !activeTag || l.tags.includes(activeTag))
    .filter((l) => {
      if (!query) return true;
      return (
        l.title.toLowerCase().includes(query) ||
        l.url.toLowerCase().includes(query) ||
        l.tags.some((t) => t.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Rendering Functions -----------------------------------------------

function renderSidebar() {
  tagListEl.innerHTML = '';
  const tagCounts = getTagCounts();
  const sortedTags = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));

  // "All" Tag Button
  const allBtn = document.createElement('button');
  allBtn.className = 'tag-btn' + (activeTag === null ? ' is-active' : '');
  
  const allLabel = document.createElement('span');
  allLabel.textContent = '📂 All Links';
  
  const allCount = document.createElement('span');
  allCount.className = 'tag-btn__count';
  allCount.textContent = links.length;
  
  allBtn.appendChild(allLabel);
  allBtn.appendChild(allCount);
  
  allBtn.addEventListener('click', () => {
    activeTag = null;
    render();
  });
  tagListEl.appendChild(allBtn);

  // Individual Tag Buttons
  sortedTags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn' + (activeTag === tag ? ' is-active' : '');
    
    const label = document.createElement('span');
    label.textContent = `# ${tag}`;
    
    const count = document.createElement('span');
    count.className = 'tag-btn__count';
    count.textContent = tagCounts[tag];
    
    btn.appendChild(label);
    btn.appendChild(count);
    
    btn.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      render();
    });
    tagListEl.appendChild(btn);
  });
}

function enterNoteEditMode(container, link) {
  container.innerHTML = '';
  
  const textarea = document.createElement('textarea');
  textarea.className = 'card__note-input';
  textarea.value = link.note || '';
  textarea.placeholder = 'Add a custom note...';
  textarea.rows = 2;
  
  container.appendChild(textarea);
  textarea.focus();
  
  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;
    link.note = textarea.value.trim();
    await saveLinks(links);
    render();
  };
  
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      committed = true;
      render();
    }
  });
  
  textarea.addEventListener('blur', commit);
}

function cardTemplate(link) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = link.id;

  // Domain Tab Color
  const tab = document.createElement('span');
  tab.className = 'card__tab';
  tab.style.background = domainColor(link.url);
  card.appendChild(tab);

  // Header (Favicon + Title/URL)
  const header = document.createElement('div');
  header.className = 'card__header';

  const favicon = document.createElement('img');
  favicon.className = 'card__favicon';
  favicon.src = link.favIconUrl || 'icons/icon16.png';
  favicon.onerror = () => { favicon.src = 'icons/icon16.png'; };
  header.appendChild(favicon);

  const titleContainer = document.createElement('div');
  titleContainer.className = 'card__title-container';

  const title = document.createElement('a');
  title.className = 'card__title';
  title.textContent = link.title || hostAndPath(link.url);
  title.href = link.url;
  title.target = '_blank';
  title.title = link.url;
  titleContainer.appendChild(title);

  const url = document.createElement('div');
  url.className = 'card__url';
  url.textContent = hostAndPath(link.url);
  titleContainer.appendChild(url);

  header.appendChild(titleContainer);
  card.appendChild(header);

  // Meta (Date Saved)
  const meta = document.createElement('div');
  meta.className = 'card__meta';
  
  const calendarIcon = document.createElement('span');
  calendarIcon.textContent = '📅 ';
  meta.appendChild(calendarIcon);
  
  const dateSpan = document.createElement('span');
  dateSpan.className = 'card__date';
  dateSpan.textContent = new Date(link.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  meta.appendChild(dateSpan);
  card.appendChild(meta);

  // Note block
  const noteContainer = document.createElement('div');
  noteContainer.className = 'card__note-container';
  const currentNote = link.note || '';
  if (currentNote) {
    const noteText = document.createElement('p');
    noteText.className = 'card__note-text';
    noteText.textContent = currentNote;
    noteText.title = 'Click to edit note';
    noteText.addEventListener('click', () => {
      enterNoteEditMode(noteContainer, link);
    });
    noteContainer.appendChild(noteText);
  }
  card.appendChild(noteContainer);

  // Tag list
  const tagsRow = document.createElement('div');
  tagsRow.className = 'card__tags';

  link.tags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.className = 'tag-chip';
    chip.title = 'Click to filter by tag. Alt-click to delete tag';
    chip.textContent = tag + ' ';
    
    const removeSpan = document.createElement('span');
    removeSpan.className = 'tag-chip__remove';
    removeSpan.textContent = ' \u00d7';
    chip.appendChild(removeSpan);
    
    chip.addEventListener('click', async (e) => {
      // If alt-clicked or if they specifically clicked the 'x', delete the tag
      if (e.altKey || e.target === removeSpan) {
        e.stopPropagation();
        e.preventDefault();
        link.tags = link.tags.filter((t) => t !== tag);
        await saveLinks(links);
        render();
      } else {
        // Otherwise, filter by this tag
        activeTag = activeTag === tag ? null : tag;
        render();
      }
    });
    tagsRow.appendChild(chip);
  });

  // "+ tag" button
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

  if (!link.note) {
    const addNoteBtn = document.createElement('button');
    addNoteBtn.className = 'note-add';
    addNoteBtn.textContent = '+ note';
    addNoteBtn.addEventListener('click', () => {
      enterNoteEditMode(noteContainer, link);
    });
    tagsRow.appendChild(addNoteBtn);
  }

  card.appendChild(tagsRow);

  // Footer Actions (Copy link, Delete)
  const actions = document.createElement('div');
  actions.className = 'card__actions';

  // Copy Link Button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'card-btn';
  copyBtn.title = 'Copy link to clipboard';
  copyBtn.textContent = '📋 Copy';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });
  actions.appendChild(copyBtn);

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'card-btn card-btn--danger';
  delBtn.title = 'Remove link';
  delBtn.textContent = '🗑️ Delete';
  delBtn.addEventListener('click', async () => {
    links = links.filter((l) => l.id !== link.id);
    await saveLinks(links);
    render();
  });
  actions.appendChild(delBtn);

  card.appendChild(actions);

  return card;
}

function render() {
  renderSidebar();
  
  const visible = getFilteredLinks();
  
  // Render stats
  statsTotalEl.textContent = String(links.length);
  statsFilteredEl.textContent = String(visible.length);

  // Render filter status text
  filterStatusEl.innerHTML = '';
  if (activeTag && searchText) {
    filterStatusEl.textContent = 'Filtered by tag ';
    const tagStrong = document.createElement('strong');
    tagStrong.textContent = `#${activeTag}`;
    filterStatusEl.appendChild(tagStrong);
    
    filterStatusEl.appendChild(document.createTextNode(' and search '));
    
    const searchStrong = document.createElement('strong');
    searchStrong.textContent = `"${searchText}"`;
    filterStatusEl.appendChild(searchStrong);
    
    filterStatusEl.appendChild(document.createTextNode(` (${visible.length} found)`));
  } else if (activeTag) {
    filterStatusEl.textContent = 'Filtered by tag ';
    const tagStrong = document.createElement('strong');
    tagStrong.textContent = `#${activeTag}`;
    filterStatusEl.appendChild(tagStrong);
    
    filterStatusEl.appendChild(document.createTextNode(` (${visible.length} found)`));
  } else if (searchText) {
    filterStatusEl.textContent = 'Search results for ';
    const searchStrong = document.createElement('strong');
    searchStrong.textContent = `"${searchText}"`;
    filterStatusEl.appendChild(searchStrong);
    
    filterStatusEl.appendChild(document.createTextNode(` (${visible.length} found)`));
  } else {
    filterStatusEl.textContent = 'Showing all links';
  }

  // Render cards
  linkGridEl.innerHTML = '';
  visible.forEach((link) => {
    linkGridEl.appendChild(cardTemplate(link));
  });

  // Empty state handling
  emptyStateEl.hidden = visible.length !== 0;
  linkGridEl.hidden = visible.length === 0;
}

// ---- Event Listeners ---------------------------------------------------

searchEl.addEventListener('input', (e) => {
  searchText = e.target.value;
  render();
});

// Import JSON database backup
importBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const importedData = JSON.parse(evt.target.result);
      let importedLinks = [];
      
      // Support database format either as raw array of links or as an object { links: [...] }
      if (Array.isArray(importedData)) {
        importedLinks = importedData;
      } else if (importedData && Array.isArray(importedData.links)) {
        importedLinks = importedData.links;
      } else {
        alert('Invalid backup file structure: could not locate links list.');
        return;
      }

      // De-duplicate URLs against current links and normalize object structure
      const currentUrls = new Set(links.map((l) => l.url));
      let addedCount = 0;
      
      importedLinks.forEach((item) => {
        if (!item.url) return;
        if (!currentUrls.has(item.url)) {
          links.push({
            id: item.id || uid(),
            url: item.url,
            title: item.title || hostAndPath(item.url),
            favIconUrl: item.favIconUrl || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            note: typeof item.note === 'string' ? item.note : '',
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
          });
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await saveLinks(links);
        alert(`Successfully imported ${addedCount} new links!`);
        render();
      } else {
        alert('All links in this backup file are already saved in Catalog.');
      }
    } catch (err) {
      alert('Error parsing JSON backup: ' + err.message);
    }
    fileInput.value = ''; // Reset input element
  };
  reader.readAsText(file);
});

// Export JSON database backup
exportBtn.addEventListener('click', () => {
  if (links.length === 0) {
    alert('No links saved yet to backup.');
    return;
  }
  
  const dataStr = JSON.stringify({ links }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split('T')[0];
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `catalog-backup-${dateStr}.json`;
  
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
});

// Clear all links
clearAllBtn.addEventListener('click', async () => {
  if (links.length === 0) return;
  const confirmed = confirm(
    '⚠️ Danger: Are you sure you want to permanently delete all your saved links in Catalog?\nThis action cannot be undone!'
  );
  if (confirmed) {
    links = [];
    await saveLinks(links);
    activeTag = null;
    render();
  }
});

// Live storage sync
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.links) {
    links = changes.links.newValue || [];
    render();
  }
});

// Initialization
(async function init() {
  links = await loadLinks();
  render();
})();
