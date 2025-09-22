console.log('Bookmark GPT content script loaded');

function extractPageContent() {
  try {
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => h.textContent.trim())
      .filter(text => text.length > 0);

    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 20);

    const lists = Array.from(document.querySelectorAll('li'))
      .map(li => li.textContent.trim())
      .filter(text => text.length > 10);

    const articles = Array.from(document.querySelectorAll('article'))
      .map(article => article.textContent.trim())
      .filter(text => text.length > 50);

    const mains = Array.from(document.querySelectorAll('main'))
      .map(main => main.textContent.trim())
      .filter(text => text.length > 50);

    let bodyText = '';
    if (articles.length > 0) {
      bodyText = articles.join(' ');
    } else if (mains.length > 0) {
      bodyText = mains.join(' ');
    } else {
      bodyText = document.body.innerText || document.body.textContent || '';
    }

    const cleanText = bodyText.replace(/\s+/g, ' ').trim();

    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
    const author = document.querySelector('meta[name="author"]')?.content || '';

    return {
      title,
      url: window.location.href,
      metaDescription,
      keywords,
      author,
      headings: headings.slice(0, 20),
      paragraphs: paragraphs.slice(0, 50),
      lists: lists.slice(0, 30),
      fullText: cleanText.substring(0, 15000),
      wordCount: cleanText.split(' ').length,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error extracting page content:', error);
    return {
      title: document.title || 'Unknown',
      url: window.location.href,
      metaDescription: '',
      keywords: '',
      author: '',
      headings: [],
      paragraphs: [],
      lists: [],
      fullText: '',
      wordCount: 0,
      timestamp: Date.now()
    };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const content = extractPageContent();
    sendResponse(content);
  }
  return true;
});

window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({
    action: 'pageUnload',
    url: window.location.href
  });
});