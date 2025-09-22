document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStats();
  await loadBookmarks();
});

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      'openaiApiKey',
      'aiModel',
      'systemPrompt',
      'maxResults',
      'minWordLength'
    ]);

    if (result.openaiApiKey) {
      document.getElementById('apiKey').value = '••••••••••••••••';
    }

    document.getElementById('model').value = result.aiModel || 'gpt-3.5-turbo';
    document.getElementById('systemPrompt').value = result.systemPrompt || '';
    document.getElementById('maxResults').value = result.maxResults || 20;
    document.getElementById('minWordLength').value = result.minWordLength || 3;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    const apiKeyInput = document.getElementById('apiKey');
    const newApiKey = apiKeyInput.value.trim();

    const settings = {
      aiModel: document.getElementById('model').value,
      systemPrompt: document.getElementById('systemPrompt').value,
    };

    if (newApiKey && newApiKey !== '••••••••••••••••') {
      settings.openaiApiKey = newApiKey;
      apiKeyInput.value = '••••••••••••••••';
    }

    await chrome.storage.local.set(settings);
    showMessage('AI settings saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showMessage('Error saving settings. Please try again.', 'error');
  }
}

async function saveSearchSettings() {
  try {
    const settings = {
      maxResults: parseInt(document.getElementById('maxResults').value),
      minWordLength: parseInt(document.getElementById('minWordLength').value)
    };

    await chrome.storage.local.set(settings);
    showMessage('Search settings saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving search settings:', error);
    showMessage('Error saving search settings. Please try again.', 'error');
  }
}

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents', 'searchIndex']);
    const bookmarkContents = result.bookmarkContents || {};
    const searchIndex = result.searchIndex || {};

    const totalBookmarks = Object.keys(bookmarkContents).length;
    const searchTerms = Object.keys(searchIndex).length;

    let totalWords = 0;
    Object.values(bookmarkContents).forEach(bookmark => {
      if (bookmark.content && bookmark.content.wordCount) {
        totalWords += bookmark.content.wordCount;
      }
    });

    const storageUsed = await getStorageUsage();

    document.getElementById('totalBookmarks').textContent = totalBookmarks;
    document.getElementById('totalWords').textContent = totalWords.toLocaleString();
    document.getElementById('searchTerms').textContent = searchTerms.toLocaleString();
    document.getElementById('storageUsed').textContent = (storageUsed / (1024 * 1024)).toFixed(2);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function getStorageUsage() {
  try {
    const result = await chrome.storage.local.get(null);
    const jsonString = JSON.stringify(result);
    return new Blob([jsonString]).size;
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return 0;
  }
}

async function loadBookmarks() {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};
    const bookmarks = Object.values(bookmarkContents);

    const bookmarkList = document.getElementById('bookmarkList');

    if (bookmarks.length === 0) {
      bookmarkList.innerHTML = `
        <div style="text-align: center; padding: 20px; opacity: 0.7;">
          No bookmarks saved yet. Right-click on any webpage and select "Add to Bookmark GPT" to get started!
        </div>
      `;
      return;
    }

    bookmarkList.innerHTML = '';

    bookmarks
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(bookmark => {
        const bookmarkDiv = document.createElement('div');
        bookmarkDiv.className = 'bookmark-item';

        const date = new Date(bookmark.timestamp).toLocaleDateString();

        bookmarkDiv.innerHTML = `
          <div class="bookmark-info">
            <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
            <div class="bookmark-url">${escapeHtml(bookmark.url)} • ${date}</div>
          </div>
          <div class="bookmark-actions">
            <button class="btn btn-small" onclick="openBookmark('${encodeURIComponent(bookmark.url)}')">Open</button>
            <button class="btn btn-small" onclick="deleteBookmark('${encodeURIComponent(bookmark.url)}')">Delete</button>
          </div>
        `;

        bookmarkList.appendChild(bookmarkDiv);
      });
  } catch (error) {
    console.error('Error loading bookmarks:', error);
  }
}

async function deleteBookmark(encodedUrl) {
  if (!confirm('Are you sure you want to delete this bookmark?')) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(['bookmarkContents', 'searchIndex']);
    const bookmarkContents = result.bookmarkContents || {};
    const searchIndex = result.searchIndex || {};

    const url = decodeURIComponent(encodedUrl);
    const urlKey = encodeURIComponent(url);

    delete bookmarkContents[urlKey];

    Object.keys(searchIndex).forEach(word => {
      searchIndex[word] = searchIndex[word].filter(item => item.url !== url);
      if (searchIndex[word].length === 0) {
        delete searchIndex[word];
      }
    });

    await chrome.storage.local.set({ bookmarkContents, searchIndex });

    showMessage('Bookmark deleted successfully!', 'success');
    await loadStats();
    await loadBookmarks();
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    showMessage('Error deleting bookmark. Please try again.', 'error');
  }
}

function openBookmark(encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  chrome.tabs.create({ url: url });
}

async function exportBookmarks() {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      bookmarks: Object.values(bookmarkContents)
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmark-gpt-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage('Bookmarks exported successfully!', 'success');
  } catch (error) {
    console.error('Error exporting bookmarks:', error);
    showMessage('Error exporting bookmarks. Please try again.', 'error');
  }
}

async function importBookmarks(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData.bookmarks || !Array.isArray(importData.bookmarks)) {
      throw new Error('Invalid bookmark file format');
    }

    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};

    let importedCount = 0;
    for (const bookmark of importData.bookmarks) {
      if (bookmark.url && bookmark.title) {
        const urlKey = encodeURIComponent(bookmark.url);
        bookmarkContents[urlKey] = bookmark;
        importedCount++;
      }
    }

    await chrome.storage.local.set({ bookmarkContents });

    await rebuildIndex();

    showMessage(`Successfully imported ${importedCount} bookmarks!`, 'success');
    await loadStats();
    await loadBookmarks();
  } catch (error) {
    console.error('Error importing bookmarks:', error);
    showMessage('Error importing bookmarks. Please check the file format.', 'error');
  } finally {
    event.target.value = '';
  }
}

async function clearAllBookmarks() {
  if (!confirm('Are you sure you want to delete ALL bookmarks and chat history? This action cannot be undone.')) {
    return;
  }

  if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) {
    return;
  }

  try {
    await chrome.storage.local.remove(['bookmarkContents', 'searchIndex', 'chatHistory']);
    showMessage('All data cleared successfully!', 'success');
    await loadStats();
    await loadBookmarks();
  } catch (error) {
    console.error('Error clearing data:', error);
    showMessage('Error clearing data. Please try again.', 'error');
  }
}

async function rebuildIndex() {
  try {
    showMessage('Rebuilding search index...', 'success');

    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};

    const searchIndex = {};

    Object.values(bookmarkContents).forEach(bookmark => {
      const words = extractSearchableWords(bookmark);
      words.forEach(word => {
        if (!searchIndex[word]) {
          searchIndex[word] = [];
        }

        const existingIndex = searchIndex[word].findIndex(item => item.url === bookmark.url);
        if (existingIndex >= 0) {
          searchIndex[word][existingIndex] = {
            url: bookmark.url,
            title: bookmark.title,
            timestamp: bookmark.timestamp
          };
        } else {
          searchIndex[word].push({
            url: bookmark.url,
            title: bookmark.title,
            timestamp: bookmark.timestamp
          });
        }
      });
    });

    await chrome.storage.local.set({ searchIndex });

    showMessage('Search index rebuilt successfully!', 'success');
    await loadStats();
  } catch (error) {
    console.error('Error rebuilding index:', error);
    showMessage('Error rebuilding search index. Please try again.', 'error');
  }
}

function extractSearchableWords(bookmarkData) {
  const text = [
    bookmarkData.title,
    bookmarkData.content.metaDescription,
    ...bookmarkData.content.headings,
    ...bookmarkData.content.paragraphs,
    ...bookmarkData.content.lists,
    bookmarkData.content.fullText
  ].join(' ').toLowerCase();

  const words = text.match(/\b\w{3,}\b/g) || [];
  return [...new Set(words)];
}

function showMessage(message, type) {
  const messageContainer = document.getElementById('messageContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = `${type}-message`;
  messageDiv.textContent = message;

  messageContainer.appendChild(messageDiv);

  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}