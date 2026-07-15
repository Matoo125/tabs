function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
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

async function addLink({ url, title, favIconUrl }) {
  if (!url || !/^https?:/.test(url)) return;
  const data = await chrome.storage.local.get({ links: [] });
  const links = data.links;
  if (links.some((l) => l.url === url)) return; // already saved
  links.unshift({
    id: uid(),
    url,
    title: title || hostAndPath(url),
    favIconUrl: favIconUrl || '',
    tags: [],
    note: '',
    createdAt: Date.now(),
  });
  await chrome.storage.local.set({ links });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'catalog-save-page',
    title: 'Save page to Catalog',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'catalog-save-link',
    title: 'Save link to Catalog',
    contexts: ['link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'catalog-save-page' && tab) {
    await addLink({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
  } else if (info.menuItemId === 'catalog-save-link' && info.linkUrl) {
    await addLink({ url: info.linkUrl, title: info.linkUrl });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await addLink({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
  }
});
