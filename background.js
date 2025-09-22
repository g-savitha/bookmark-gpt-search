chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark GPT extension installed');
});

async function saveCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageContent
    });

    const content = result[0].result;

    const bookmarkData = {
      url: tab.url,
      title: tab.title,
      content: content,
      timestamp: Date.now(),
      favicon: tab.favIconUrl
    };

    await saveBookmarkContent(bookmarkData);

    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.svg',
        title: 'Bookmark GPT',
        message: 'Page content saved for chat and search!'
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving bookmark content:', error);
    return { success: false, error: error.message };
  }
}

function extractPageContent() {
  const title = document.title;
  const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent.trim());
  const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()).filter(text => text.length > 20);
  const lists = Array.from(document.querySelectorAll('li')).map(li => li.textContent.trim()).filter(text => text.length > 10);

  const bodyText = document.body.innerText || document.body.textContent || '';
  const cleanText = bodyText.replace(/\s+/g, ' ').trim();

  return {
    title,
    metaDescription,
    headings,
    paragraphs: paragraphs.slice(0, 50),
    lists: lists.slice(0, 30),
    fullText: cleanText.substring(0, 10000)
  };
}

async function saveBookmarkContent(bookmarkData) {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};

    const urlKey = encodeURIComponent(bookmarkData.url);
    bookmarkContents[urlKey] = bookmarkData;

    await chrome.storage.local.set({ bookmarkContents });

    await updateSearchIndex(bookmarkData);
  } catch (error) {
    console.error('Error saving bookmark content:', error);
  }
}

async function updateSearchIndex(bookmarkData) {
  try {
    const result = await chrome.storage.local.get(['searchIndex']);
    const searchIndex = result.searchIndex || {};

    const words = extractSearchableWords(bookmarkData);
    const urlKey = encodeURIComponent(bookmarkData.url);

    words.forEach(word => {
      if (!searchIndex[word]) {
        searchIndex[word] = [];
      }

      const existingIndex = searchIndex[word].findIndex(item => item.url === bookmarkData.url);
      if (existingIndex >= 0) {
        searchIndex[word][existingIndex] = {
          url: bookmarkData.url,
          title: bookmarkData.title,
          timestamp: bookmarkData.timestamp
        };
      } else {
        searchIndex[word].push({
          url: bookmarkData.url,
          title: bookmarkData.title,
          timestamp: bookmarkData.timestamp
        });
      }
    });

    await chrome.storage.local.set({ searchIndex });
  } catch (error) {
    console.error('Error updating search index:', error);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchBookmarks') {
    searchBookmarks(request.query).then(sendResponse);
    return true;
  } else if (request.action === 'getAllBookmarks') {
    getAllBookmarksWithContent().then(sendResponse);
    return true;
  } else if (request.action === 'getBookmarkContent') {
    getBookmarkContent(request.url).then(sendResponse);
    return true;
  } else if (request.action === 'saveCurrentPage') {
    saveCurrentPage().then(sendResponse);
    return true;
  } else if (request.action === 'indexExistingBookmarks') {
    indexExistingBookmarks().then(sendResponse);
    return true;
  }
});

async function searchBookmarks(query) {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};

    const queryLower = query.toLowerCase().trim();
    const results = [];

    // Direct search through all bookmarks for more accurate results
    Object.values(bookmarkContents).forEach(bookmark => {
      const relevanceScore = calculateRelevance(bookmark, queryLower);

      // Only include results with a meaningful relevance score
      if (relevanceScore > 0) {
        results.push({ ...bookmark, relevanceScore });
      }
    });

    // Sort by relevance and return only top results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20); // Limit to top 20 results
  } catch (error) {
    console.error('Error searching bookmarks:', error);
    return [];
  }
}

function calculateRelevance(bookmark, query) {
  if (!bookmark || !bookmark.content) return 0;

  const queryLower = query.toLowerCase();
  let score = 0;

  // Ensure content fields exist
  const title = bookmark.title || '';
  const metaDescription = bookmark.content.metaDescription || '';
  const headings = bookmark.content.headings || [];
  const paragraphs = bookmark.content.paragraphs || [];
  const fullText = bookmark.content.fullText || '';

  // Exact phrase matching gets highest score
  if (title.toLowerCase().includes(queryLower)) score += 50;
  if (metaDescription.toLowerCase().includes(queryLower)) score += 30;

  // Check headings for exact phrase
  headings.forEach(heading => {
    if (heading.toLowerCase().includes(queryLower)) score += 25;
  });

  // Check paragraphs for exact phrase
  paragraphs.forEach(paragraph => {
    if (paragraph.toLowerCase().includes(queryLower)) score += 15;
  });

  // Check full text for exact phrase
  if (fullText.toLowerCase().includes(queryLower)) score += 10;

  // For multi-word queries, check if all words are present
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
  if (queryWords.length > 1) {
    const allContent = (title + ' ' + metaDescription + ' ' + headings.join(' ') + ' ' + paragraphs.join(' ') + ' ' + fullText).toLowerCase();

    const allWordsPresent = queryWords.every(word => allContent.includes(word));
    if (!allWordsPresent) {
      score = 0; // If not all words are present, score is 0
    }
  }

  return score;
}

async function getAllBookmarks() {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};
    return Object.values(bookmarkContents);
  } catch (error) {
    console.error('Error getting all bookmarks:', error);
    return [];
  }
}

async function getAllBookmarksWithContent() {
  try {
    // Get stored bookmark content
    const storedResult = await chrome.storage.local.get(['bookmarkContents']);
    const storedBookmarks = storedResult.bookmarkContents || {};

    // Get Chrome's native bookmarks
    const chromeBookmarks = await chrome.bookmarks.getTree();
    const flatBookmarks = flattenBookmarkTree(chromeBookmarks);

    // Combine stored content with Chrome bookmarks
    const combinedBookmarks = [];

    // Add bookmarks with stored content
    Object.values(storedBookmarks).forEach(bookmark => {
      combinedBookmarks.push(bookmark);
    });

    // Add Chrome bookmarks that don't have stored content yet
    flatBookmarks.forEach(chromeBookmark => {
      const urlKey = encodeURIComponent(chromeBookmark.url);
      if (!storedBookmarks[urlKey]) {
        combinedBookmarks.push({
          url: chromeBookmark.url,
          title: chromeBookmark.title,
          content: {
            title: chromeBookmark.title,
            metaDescription: '',
            headings: [],
            paragraphs: [],
            lists: [],
            fullText: `Bookmark: ${chromeBookmark.title}`
          },
          timestamp: chromeBookmark.dateAdded || Date.now(),
          favicon: `chrome://favicon/${chromeBookmark.url}`,
          isFromChrome: true
        });
      }
    });

    return combinedBookmarks;
  } catch (error) {
    console.error('Error getting all bookmarks with content:', error);
    return await getAllBookmarks(); // Fallback to stored only
  }
}

function flattenBookmarkTree(bookmarkNodes) {
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(bookmarkNodes);
  return bookmarks;
}

async function indexExistingBookmarks() {
  try {
    const chromeBookmarks = await chrome.bookmarks.getTree();
    const flatBookmarks = flattenBookmarkTree(chromeBookmarks);

    let indexed = 0;
    for (const bookmark of flatBookmarks) {
      const urlKey = encodeURIComponent(bookmark.url);

      // Check if we already have content for this bookmark
      const result = await chrome.storage.local.get(['bookmarkContents']);
      const bookmarkContents = result.bookmarkContents || {};

      if (!bookmarkContents[urlKey]) {
        // Try to fetch and index this bookmark
        try {
          const tab = await chrome.tabs.create({ url: bookmark.url, active: false });
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page load

          const contentResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractPageContent
          });

          if (contentResult && contentResult[0]) {
            const bookmarkData = {
              url: bookmark.url,
              title: bookmark.title,
              content: contentResult[0].result,
              timestamp: bookmark.dateAdded || Date.now(),
              favicon: `chrome://favicon/${bookmark.url}`,
              isFromChrome: true
            };

            await saveBookmarkContent(bookmarkData);
            indexed++;
          }

          await chrome.tabs.remove(tab.id);
        } catch (error) {
          console.error('Error indexing bookmark:', bookmark.url, error);
        }
      }
    }

    return { success: true, indexed };
  } catch (error) {
    console.error('Error indexing existing bookmarks:', error);
    return { success: false, error: error.message };
  }
}

async function getBookmarkContent(url) {
  try {
    const result = await chrome.storage.local.get(['bookmarkContents']);
    const bookmarkContents = result.bookmarkContents || {};
    const urlKey = encodeURIComponent(url);
    return bookmarkContents[urlKey] || null;
  } catch (error) {
    console.error('Error getting bookmark content:', error);
    return null;
  }
}

