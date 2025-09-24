let chatHistory = [];
let selectedModel = ''; // Start with no model selected
let ollamaStatus = 'checking';
let aiProvider = 'ollama'; // 'ollama' or 'openai'
let apiKey = '';
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 1000; // 1 second between requests (faster for local)

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadChatHistory();
  await checkOllamaStatus();
  setupEventListeners();
});

function setupEventListeners() {
  // Tab switching
  document.getElementById('chatTabBtn').addEventListener('click', () => switchTab('chat'));
  document.getElementById('searchTabBtn').addEventListener('click', () => switchTab('search'));

  // Save current page
  document.getElementById('savePageBtn').addEventListener('click', saveCurrentPage);

  // Index existing bookmarks
  document.getElementById('indexBookmarksBtn').addEventListener('click', indexExistingBookmarks);

  // Model selection
  document.getElementById('modelSelect').addEventListener('change', changeModel);

  // AI provider toggle
  document.getElementById('ollamaToggle').addEventListener('click', () => switchAIProvider('ollama'));
  document.getElementById('openaiToggle').addEventListener('click', () => switchAIProvider('openai'));
  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);

  // Chat functionality
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('chatInput').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });
  document.getElementById('clearChatBtn').addEventListener('click', clearChat);

  // Status notification functionality
  document.getElementById('statusNotificationBtn').addEventListener('click', toggleStatusPanel);
  document.getElementById('closeStatusPanel').addEventListener('click', hideStatusPanel);

  // Search functionality
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document.getElementById('searchInput').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      performSearch();
    }
  });
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['selectedModel', 'aiProvider', 'openaiApiKey']);

    // Always start with "Select a model" as default
    selectedModel = '';
    document.getElementById('modelSelect').value = '';

    if (result.aiProvider) {
      aiProvider = result.aiProvider;
      switchAIProvider(aiProvider, false);
    }
    if (result.openaiApiKey) {
      apiKey = result.openaiApiKey;
      document.getElementById('apiKeyInput').value = '••••••••••••••••';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

function switchAIProvider(provider, save = true) {
  aiProvider = provider;

  // Update toggle buttons
  document.getElementById('ollamaToggle').classList.toggle('active', provider === 'ollama');
  document.getElementById('openaiToggle').classList.toggle('active', provider === 'openai');

  // Show/hide config panels
  document.getElementById('ollamaConfig').style.display = provider === 'ollama' ? 'block' : 'none';
  document.getElementById('openaiConfig').style.display = provider === 'openai' ? 'block' : 'none';

  if (save) {
    chrome.storage.local.set({ aiProvider });
    addStatusNotification(`Switched to ${provider === 'ollama' ? 'Local Ollama' : 'Cloud OpenAI'}`, 'success');
  }
}

async function saveApiKey() {
  const keyInput = document.getElementById('apiKeyInput');
  const newKey = keyInput.value.trim();

  if (newKey && newKey !== '••••••••••••••••') {
    if (!newKey.startsWith('sk-') || newKey.length < 20) {
      addStatusNotification('Invalid API key format. OpenAI keys start with "sk-" and are longer.', 'error');
      return;
    }

    try {
      addStatusNotification('Testing API key...', 'info');

      const testResponse = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${newKey}` }
      });

      if (testResponse.ok) {
        await chrome.storage.local.set({ openaiApiKey: newKey });
        apiKey = newKey;
        keyInput.value = '••••••••••••••••';
        addStatusNotification('API key saved and verified successfully!', 'success');
      } else {
        addStatusNotification('API key is invalid. Please check your key and try again.', 'error');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      addStatusNotification('Error testing API key. Please check your internet connection.', 'error');
    }
  }
}

async function showModelInformation() {
  const chatContainer = document.getElementById('chatContainer');

  // Remove any existing model selector cards to prevent duplicates
  const existingSelectors = chatContainer.querySelectorAll('.model-selector');
  existingSelectors.forEach(selector => selector.remove());

  // Get currently selected model to show specific info or all models
  const modelSelect = document.getElementById('modelSelect');
  const currentSelectedModel = modelSelect && modelSelect.value && modelSelect.value !== '' ? modelSelect.value : null;

  // Create model selection interface
  const modelSelectorDiv = document.createElement('div');
  modelSelectorDiv.className = 'message bot model-selector';
  modelSelectorDiv.innerHTML = `
    <div style="margin-bottom: 15px;">
      🚀 <strong>${currentSelectedModel ? 'Model Information' : 'Recommended Ollama Models'}</strong>
      <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">
        ${currentSelectedModel ? `Information about ${currentSelectedModel}` : 'Browse Recommended models and download options'}
      </div>
    </div>

    <div id="ollama-connection-status" style="margin-bottom: 15px;">
      <div class="loading-models">🔄 Checking Ollama connection...</div>
    </div>

    <div id="ollama-models-container">
      <div class="loading-models">🔄 Loading model information...</div>
    </div>

    <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
      💡 <strong>Don't have Ollama installed?</strong><br>
      Visit <a href="https://ollama.com" target="_blank">ollama.com</a> to download and install it first.
    </div>
  `;

  chatContainer.appendChild(modelSelectorDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Load model information based on selection
  await loadModelInformation(currentSelectedModel);
}

async function loadModelInformation(specificModel = null) {
  const container = document.getElementById('ollama-models-container');
  const statusContainer = document.getElementById('ollama-connection-status');

  // Define curated model list with detailed information
  const curatedModels = [
    {
      name: 'llama3.2:1b',
      displayName: 'Llama 3.2 1B',
      size: '1.3GB',
      description: 'Fastest and most lightweight model. Great for quick responses and testing.',
      useCase: 'Fast responses, low memory usage',
      pullCount: '50M+',
      tags: ['Fast', 'Lightweight'],
      recommended: false
    },
    {
      name: 'llama3.2:3b',
      displayName: 'Llama 3.2 3B',
      size: '2.0GB',
      description: 'Balanced performance and speed. Excellent for bookmark chat and general queries.',
      useCase: 'Balanced performance for most tasks',
      pullCount: '80M+',
      tags: ['Balanced', 'Recommended'],
      recommended: true
    },
    {
      name: 'phi3:mini',
      displayName: 'Phi-3 Mini',
      size: '2.3GB',
      description: 'Microsoft\'s efficient small model. Good reasoning abilities for its size.',
      useCase: 'Efficient reasoning and code understanding',
      pullCount: '10M+',
      tags: ['Efficient', 'Microsoft'],
      recommended: false
    },
    {
      name: 'gemma2:2b',
      displayName: 'Gemma 2B',
      size: '1.6GB',
      description: 'Google\'s lightweight model. Good balance of capability and efficiency.',
      useCase: 'Google AI technology, efficient',
      pullCount: '5M+',
      tags: ['Google', 'Efficient'],
      recommended: false
    },
    {
      name: 'qwen2.5:3b',
      displayName: 'Qwen2.5 3B',
      size: '1.9GB',
      description: 'Alibaba\'s latest model with strong multilingual capabilities.',
      useCase: 'Multilingual support, latest technology',
      pullCount: '14M+',
      tags: ['Multilingual', 'Latest'],
      recommended: false
    }
  ];

  try {
    // Check Ollama connection status and installed models
    let installedModels = [];
    let isOllamaConnected = false;

    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        installedModels = data.models || [];
        isOllamaConnected = true;
      }
    } catch (error) {
      console.log('Ollama not running, showing all models as available for download');
      isOllamaConnected = false;
    }

    // Update connection status display
    if (statusContainer) {
      if (isOllamaConnected) {
        statusContainer.innerHTML = `
          <div style="padding: 10px; background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); border: 1px solid #10b981; border-radius: 8px; font-size: 13px;">
            ✅ <strong>Ollama Connected</strong> - You can download and use models locally
            <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
              ${installedModels.length} model${installedModels.length === 1 ? '' : 's'} currently installed
            </div>
          </div>
        `;
      } else {
        statusContainer.innerHTML = `
          <div style="padding: 10px; background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%); border: 1px solid #ef4444; border-radius: 8px; font-size: 13px;">
            ❌ <strong>Ollama Not Connected</strong> - Install Ollama to use local models
            <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
              You can still browse model information and learn about available options
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = '';

    // Filter models based on specificModel parameter
    const modelsToShow = specificModel
      ? curatedModels.filter(model => model.name === specificModel)
      : curatedModels;

    if (specificModel && modelsToShow.length === 0) {
      // If specific model requested but not found in curated list, show basic info
      container.innerHTML = `
        <div class="model-card">
          <div class="model-header">
            <div class="model-name-section">
              <h4>${specificModel}</h4>
            </div>
            <div class="model-status">
              ${installedModels.some(installed => installed.name === specificModel || installed.name.startsWith(specificModel.split(':')[0])) ? '✅ Installed' : '📦 Available'}
            </div>
          </div>
          <div class="model-description">
            This model is available but detailed information is not available in our curated list.
          </div>
          <div class="model-actions">
            ${installedModels.some(installed => installed.name === specificModel || installed.name.startsWith(specificModel.split(':')[0]))
          ? `<button class="model-btn installed-btn" disabled>✅ Already Installed</button>`
          : `<div style="text-align: center;">
                  <div style="margin-bottom: 8px; font-size: 13px; color: #374151; font-weight: 500;">
                    📥 Download from Ollama:
                  </div>
                  <a href="https://ollama.com/library/${specificModel.split(':')[0]}"
                     target="_blank"
                     class="model-download-link"
                     style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                    🌐 ollama.com/library/${specificModel.split(':')[0]}
                  </a>
                 </div>`
        }
          </div>
        </div>
      `;
      return;
    }

    // Add a helpful message when showing all models
    // if (!specificModel) {
    //   const infoDiv = document.createElement('div');
    //   infoDiv.style.cssText = 'margin-bottom: 16px; padding: 12px; background: rgba(255,107,53,0.1); border-radius: 8px; font-size: 13px; color: #374151;';
    //   infoDiv.innerHTML = `
    //     💡 <strong>Browse Recommended models below</strong><br>
    //   `;
    //   container.appendChild(infoDiv);
    // }

    modelsToShow.forEach(model => {
      const isInstalled = installedModels.some(installed =>
        installed.name === model.name || installed.name.startsWith(model.name.split(':')[0])
      );

      const modelCard = document.createElement('div');
      modelCard.className = `model-card ${model.recommended ? 'recommended' : ''} ${isInstalled ? 'installed' : ''}`;

      modelCard.innerHTML = `
        <div class="model-header">
          <div class="model-name-section">
            <h4>${model.displayName}</h4>
            <div class="model-tags">
              ${model.tags.map(tag => `<span class="tag ${tag.toLowerCase()}">${tag}</span>`).join('')}
            </div>
          </div>
          <div class="model-status">
            ${isInstalled ? '✅ Installed' : `📦 ${model.size}`}
          </div>
        </div>

        <div class="model-description">
          ${model.description}
        </div>

        <div class="model-stats">
          <div class="stat">
            <span class="stat-label">Use Case:</span>
            <span class="stat-value">${model.useCase}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Downloads:</span>
            <span class="stat-value">${model.pullCount}</span>
          </div>
        </div>

        <div class="model-actions">
          ${isInstalled
          ? `<button class="model-btn installed-btn" disabled>✅ Already Installed</button>`
          : `<div style="text-align: center;">
                <div style="margin-bottom: 8px; font-size: 13px; color: #374151; font-weight: 500;">
                  📥 Download from Ollama:
                </div>
                <a href="https://ollama.com/library/${model.name.split(':')[0]}"
                   target="_blank"
                   class="model-download-link"
                   style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; transition: all 0.2s ease;">
                  🌐 ollama.com/library/${model.name.split(':')[0]}
                </a>
               </div>`
        }
        </div>
      `;

      container.appendChild(modelCard);
    });

  } catch (error) {
    console.error('Error loading models:', error);
    container.innerHTML = `
      <div class="error-message">
        ❌ Error loading models. Please check your internet connection.
      </div>
    `;
  }
}



async function changeModel() {
  const newModel = document.getElementById('modelSelect').value;
  selectedModel = newModel;

  try {
    await chrome.storage.local.set({ selectedModel });

    if (selectedModel) {
      addStatusNotification(`Switched to model: ${selectedModel}`, 'success');

      // Check if model is available
      await checkModelAvailability(selectedModel);

      // Automatically show model information for specific model
      await showModelInformation();

      // Remove suggestion pills since user now has a model selected
      removeSuggestionPills();
    } else {
      // User selected "Select a model" - show all available models
      await showModelInformation();
    }
  } catch (error) {
    console.error('Error changing model:', error);
  }
}

async function checkOllamaStatus() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      ollamaStatus = 'connected';
      console.log('Ollama connected. Available models:', data.models);
      updateOllamaStatusUI(true, data.models || []);

      // Show notification about available models
      if (data.models && data.models.length > 0) {
        const modelNames = data.models.map(m => m.name).join(', ');
        addStatusNotification(`Ollama connected with ${data.models.length} models: ${modelNames}`, 'success');
      } else {
        addStatusNotification('Ollama connected but no models found. You may need to pull some models first.', 'warning');
      }
    } else {
      ollamaStatus = 'disconnected';
      updateOllamaStatusUI(false, []);
    }
  } catch (error) {
    ollamaStatus = 'disconnected';
    updateOllamaStatusUI(false, []);
  }
}

async function checkModelAvailability(model) {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      const models = data.models || [];
      const modelExists = models.some(m => m.name === model || m.name.startsWith(model));

      console.log('Available models:', models.map(m => m.name));
      console.log('Looking for model:', model);
      console.log('Model exists:', modelExists);

      if (!modelExists) {
        const availableModels = models.map(m => m.name).join(', ');
        addStatusNotification(`Model "${model}" not found. Available models: ${availableModels}. Try running: ollama pull ${model}`, 'warning', true);
      } else {
        addStatusNotification(`Model "${model}" is available and ready to use!`, 'success');
      }
    }
  } catch (error) {
    console.error('Error checking model availability:', error);
  }
}

function updateOllamaStatusUI(connected, availableModels) {
  const statusElement = document.getElementById('ollamaStatus');
  const modelSelect = document.getElementById('modelSelect');

  if (connected) {
    statusElement.innerHTML = '🟢 Ollama Connected';
    statusElement.className = 'status-connected';

    // Update model dropdown with available models
    modelSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a model';
    if (selectedModel === '') defaultOption.selected = true;
    modelSelect.appendChild(defaultOption);

    // Use actually available models if provided, otherwise use recommended list
    const modelsToShow = availableModels && availableModels.length > 0
      ? availableModels.map(m => m.name)
      : [
        'llama3.2:3b',
        'llama3.2:1b',
        'phi3:mini',
        'gemma2:2b',
        'qwen2.5:3b'
      ];

    modelsToShow.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      if (model === selectedModel) option.selected = true;
      modelSelect.appendChild(option);
    });

    // Add status about available models
    if (availableModels && availableModels.length > 0) {
      console.log('Available Ollama models:', availableModels.map(m => m.name));
    }

  } else {
    statusElement.innerHTML = '🔴 Ollama Disconnected';
    statusElement.className = 'status-disconnected';
    addStatusNotification('Ollama not running. Please install and start Ollama from ollama.com', 'error', true);
  }
}

async function loadChatHistory() {
  try {
    const result = await chrome.storage.local.get(['chatHistory']);
    if (result.chatHistory && result.chatHistory.length > 0) {
      chatHistory = result.chatHistory;
      const chatContainer = document.getElementById('chatContainer');

      // Keep the welcome message, just add history after it
      const welcomeMessage = chatContainer.querySelector('.message.bot');
      chatContainer.innerHTML = '';

      if (welcomeMessage) {
        chatContainer.appendChild(welcomeMessage);
      }

      chatHistory.forEach(message => {
        addMessageToDOM(message.content, message.role === 'user' ? 'user' : 'bot');
      });
    } else {
      // Show suggestions for new users
      const chatContainer = document.getElementById('chatContainer');
      if (chatContainer.children.length <= 1) {
        setTimeout(() => {
          addSuggestionPills();
        }, 1000);
      }
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

async function saveChatHistory() {
  try {
    await chrome.storage.local.set({ chatHistory });
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

function switchTab(tabName) {
  const chatTab = document.getElementById('chatTab');
  const searchTab = document.getElementById('searchTab');
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(tab => tab.classList.remove('active'));

  if (tabName === 'chat') {
    chatTab.style.display = 'block';
    searchTab.style.display = 'none';
    tabs[0].classList.add('active');
  } else {
    chatTab.style.display = 'none';
    searchTab.style.display = 'block';
    tabs[1].classList.add('active');
  }
}


async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  console.log('Sending message:', message);

  if (!message) return;

  // Check AI provider availability
  if (aiProvider === 'ollama' && ollamaStatus !== 'connected') {
    addMessage('❌ Ollama not connected. Please start Ollama and try again.', 'bot');
    return;
  }

  if (aiProvider === 'ollama' && !selectedModel) {
    addMessage('❌ Please select a model first from the dropdown above.', 'bot');
    return;
  }

  if (aiProvider === 'openai' && !apiKey) {
    addMessage('❌ Please save your OpenAI API key first!', 'bot');
    return;
  }

  // Rate limiting check
  const now = Date.now();
  if (now - lastRequestTime < REQUEST_COOLDOWN) {
    const waitTime = Math.ceil((REQUEST_COOLDOWN - (now - lastRequestTime)) / 1000);
    addMessage(`⏱️ Please wait ${waitTime} more seconds before sending another message.`, 'bot');
    return;
  }

  lastRequestTime = now;
  input.value = '';
  addMessage(message, 'user');

  try {
    console.log('Getting bookmarks...');
    const bookmarks = await chrome.runtime.sendMessage({ action: 'getAllBookmarks' });
    console.log('Bookmarks received:', bookmarks);

    if (!bookmarks || bookmarks.length === 0) {
      addMessage('No bookmarks found. Please save some pages first by clicking the "📚 Save Current Page" button above.', 'bot');
      return;
    }

    showTypingIndicator();

    console.log('Preparing context...');
    const context = prepareBookmarkContext(bookmarks, message);
    console.log('Context prepared:', context);

    console.log(`Querying ${aiProvider}...`);
    const response = aiProvider === 'ollama'
      ? await queryOllama(message, context)
      : await queryOpenAI(message, context);
    console.log(`${aiProvider} response:`, response);

    hideTypingIndicator();
    addMessage(response, 'bot');

  } catch (error) {
    console.error('Error sending message:', error);
    hideTypingIndicator();

    // Provide appropriate error message based on AI provider
    let errorMessage = `Sorry, there was an error: ${error.message}`;

    if (aiProvider === 'ollama') {
      errorMessage += '. Please make sure Ollama is running and the selected model is available.';
    } else {
      errorMessage += '. Please check your API key and try again.';
    }

    addMessage(errorMessage, 'bot');
  }
}

function prepareBookmarkContext(bookmarks, query) {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);

  const relevantBookmarks = bookmarks
    .map(bookmark => {
      const title = (bookmark.title || '').toLowerCase();
      const metaDescription = (bookmark.content?.metaDescription || '').toLowerCase();
      const fullText = (bookmark.content?.fullText || '').toLowerCase();
      const headings = (bookmark.content?.headings || []).join(' ').toLowerCase();

      let score = 0;

      queryWords.forEach(word => {
        if (title.includes(word)) score += 10;
        if (metaDescription.includes(word)) score += 5;
        if (headings.includes(word)) score += 3;
        if (fullText.includes(word)) score += 1;
      });

      return { ...bookmark, relevanceScore: score };
    })
    .filter(bookmark => bookmark.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);

  if (relevantBookmarks.length === 0) {
    relevantBookmarks.push(...bookmarks.slice(0, 3).map(b => ({ ...b, relevanceScore: 0 })));
  }

  return relevantBookmarks.map(bookmark => ({
    title: bookmark.title || 'Untitled',
    url: bookmark.url || '',
    description: bookmark.content?.metaDescription || '',
    headings: (bookmark.content?.headings || []).slice(0, 5),
    content: (bookmark.content?.fullText || bookmark.title || '').substring(0, 1000)
  }));
}

async function queryOllama(message, context) {
  const systemPrompt = `You are a personal AI assistant that helps users understand and explore their bookmarked content. You have access to all their saved web pages and can answer questions about them conversationally.

Here are the user's bookmarks:
${context.map(bookmark => `
📄 **${bookmark.title}**
🔗 ${bookmark.url}
📝 ${bookmark.description}
🏷️ Key topics: ${bookmark.headings.join(', ')}
📖 Content: ${bookmark.content}
---`).join('\n')}

Instructions:
- Answer naturally and conversationally using proper markdown formatting
- Use **bold** for emphasis and \`code\` for technical terms
- Reference specific bookmarks by title when relevant
- Only mention bookmarks that are actually relevant to the user's question
- If asking about a specific topic (like "CSS"), only show bookmarks that contain that topic
- Summarize, compare, or find patterns across bookmarks when asked
- Keep responses focused and concise
- Format lists with bullet points or numbered lists when appropriate`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-6), // Keep fewer messages for local models
    { role: 'user', content: message }
  ];

  console.log('Ollama request:', {
    model: selectedModel,
    messagesCount: messages.length,
    url: 'http://localhost:11434/api/chat'
  });


  const result = await chrome.runtime.sendMessage({
    action: 'ollamaChat',
    model: selectedModel,
    messages: messages
  });

  if (!result.success) {
    addMessage(`🔧 Debug: Ollama error: ${result.error}`, 'bot');
    throw new Error(result.error);
  }

  const data = result.data;
  return data.message.content;
}

async function queryOpenAI(message, context) {
  const systemPrompt = `You are a personal AI assistant that helps users understand and explore their bookmarked content. You have access to all their saved web pages and can answer questions about them conversationally.

Here are the user's bookmarks:
${context.map(bookmark => `
📄 **${bookmark.title}**
🔗 ${bookmark.url}
📝 ${bookmark.description}
🏷️ Key topics: ${bookmark.headings.join(', ')}
📖 Content: ${bookmark.content}
---`).join('\n')}

Instructions:
- Answer naturally and conversationally
- Reference specific bookmarks by title when relevant
- Summarize, compare, or find patterns across bookmarks when asked
- If you can't find relevant information, suggest related topics from their bookmarks
- Be helpful and engaging in your responses
- Keep responses concise but informative`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-10),
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let errorMessage;

    switch (response.status) {
      case 429:
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        break;
      case 401:
        errorMessage = "Invalid API key. Please check your OpenAI API key.";
        break;
      case 403:
        errorMessage = "Access forbidden. Your API key may not have the required permissions.";
        break;
      default:
        errorMessage = `OpenAI API error: ${response.status}. ${errorData.error?.message || 'Please try again.'}`;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function addMessage(content, sender) {
  addMessageToDOM(content, sender);

  chatHistory.push({
    role: sender === 'user' ? 'user' : 'assistant',
    content: content
  });

  saveChatHistory();
}

function addMessageToDOM(content, sender) {
  const chatContainer = document.getElementById('chatContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;

  if (sender === 'bot') {
    messageDiv.innerHTML = formatMarkdown(content);
  } else {
    messageDiv.textContent = content;
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\n/g, '<br>');
}

function removeLastMessage() {
  const chatContainer = document.getElementById('chatContainer');
  const lastMessage = chatContainer.lastElementChild;
  if (lastMessage) {
    chatContainer.removeChild(lastMessage);
  }
}

function showTypingIndicator() {
  const chatContainer = document.getElementById('chatContainer');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <span>🤖 Assistant is typing</span>
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

function addSuggestionPills() {
  // Don't show suggestion pills if a model is selected and connected
  const modelSelect = document.getElementById('modelSelect');
  const selectedModel = modelSelect && modelSelect.value && modelSelect.value !== '';
  const ollamaConnected = ollamaStatus === 'connected';

  if (selectedModel && ollamaConnected) {
    return; // Don't show suggestions when model is ready
  }

  const chatContainer = document.getElementById('chatContainer');
  const suggestionsDiv = document.createElement('div');
  suggestionsDiv.className = 'message bot';
  suggestionsDiv.innerHTML = `
    💭 <strong>Quick suggestions:</strong>
    <div class="suggestion-pills">
      <button class="suggestion-pill" data-suggestion="What topics do I have bookmarks about?">What topics do I have?</button>
      <button class="suggestion-pill" data-suggestion="Summarize my most recent bookmarks">Recent summaries</button>
      <button class="suggestion-pill" data-suggestion="Find bookmarks about programming">Programming content</button>
      <button class="suggestion-pill" data-suggestion="What tutorials did I save?">Tutorials</button>
    </div>
  `;

  // Add event listeners to suggestion pills
  const pills = suggestionsDiv.querySelectorAll('.suggestion-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const suggestion = pill.getAttribute('data-suggestion');
      document.getElementById('chatInput').value = suggestion;
      sendMessage();
    });
  });

  chatContainer.appendChild(suggestionsDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeSuggestionPills() {
  const chatContainer = document.getElementById('chatContainer');
  const suggestionMessages = chatContainer.querySelectorAll('.message.bot');

  suggestionMessages.forEach(message => {
    // Check if this message contains suggestion pills
    if (message.querySelector('.suggestion-pills')) {
      message.remove();
    }
  });
}

async function performSearch() {
  const input = document.getElementById('searchInput');
  const query = input.value.trim();

  if (!query) return;

  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = '<div class="loading">Searching your bookmarks...</div>';

  try {
    const results = await chrome.runtime.sendMessage({
      action: 'searchBookmarks',
      query: query
    });

    displaySearchResults(results, query);
  } catch (error) {
    console.error('Error searching:', error);
    resultsContainer.innerHTML = '<div class="error">Error performing search. Please try again.</div>';
  }
}

function displaySearchResults(results, query) {
  const resultsContainer = document.getElementById('searchResults');

  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="message bot">
        🔍 No results found for "<strong>${escapeHtml(query)}</strong>"
        <br><br>
        💡 Try:
        <br>• Using different keywords
        <br>• Checking spelling
        <br>• Using shorter search terms
        <br>• Saving more pages first
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = `
    <div style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
      📊 Found <strong>${results.length}</strong> relevant result${results.length === 1 ? '' : 's'} for "<strong>${escapeHtml(query)}</strong>"
    </div>
  `;

  results.forEach(result => {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    resultDiv.onclick = () => chrome.tabs.create({ url: result.url });

    const snippet = extractSnippet(result, query);

    resultDiv.innerHTML = `
      <div class="result-title">${escapeHtml(result.title)}</div>
      <div class="result-url">${escapeHtml(result.url)}</div>
      <div class="result-snippet">${escapeHtml(snippet)}</div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">Relevance: ${result.relevanceScore}</div>
    `;

    resultsContainer.appendChild(resultDiv);
  });
}

function extractSnippet(bookmark, query) {
  const queryLower = query.toLowerCase();
  const sources = [
    bookmark.content.metaDescription,
    ...bookmark.content.paragraphs,
    bookmark.content.fullText
  ];

  for (const source of sources) {
    if (source && source.toLowerCase().includes(queryLower)) {
      const index = source.toLowerCase().indexOf(queryLower);
      const start = Math.max(0, index - 50);
      const end = Math.min(source.length, index + query.length + 50);
      return '...' + source.substring(start, end) + '...';
    }
  }

  return bookmark.content.metaDescription ||
    bookmark.content.paragraphs[0] ||
    bookmark.content.fullText.substring(0, 100) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function saveCurrentPage() {
  try {
    const saveBtn = document.getElementById('savePageBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '⏳ Saving...';
    saveBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ action: 'saveCurrentPage' });

    if (response.success) {
      saveBtn.textContent = '✅ Saved!';
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);
    } else {
      saveBtn.textContent = '❌ Error';
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);
      console.error('Failed to save page:', response.error);
    }
  } catch (error) {
    console.error('Error saving current page:', error);
    const saveBtn = document.getElementById('savePageBtn');
    saveBtn.textContent = '❌ Error';
    setTimeout(() => {
      saveBtn.textContent = '📚 Save Current Page';
      saveBtn.disabled = false;
    }, 2000);
  }
}

let isIndexing = false;
let indexingCancelled = false;

async function indexExistingBookmarks() {
  try {
    const indexBtn = document.getElementById('indexBookmarksBtn');

    if (isIndexing) {
      // Stop indexing
      indexingCancelled = true;
      await chrome.runtime.sendMessage({ action: 'cancelIndexing' });
      indexBtn.innerHTML = '<span class="btn-icon">⏹️</span><span>Stopping...</span>';
      indexBtn.disabled = true;
      addMessage('⏹️ Stopping indexing process...', 'bot');
      return;
    }

    isIndexing = true;
    indexingCancelled = false;
    indexBtn.innerHTML = '<span class="btn-icon">⏹️</span><span>Stop Indexing</span>';

    addMessage('🔍 Starting to index your existing Chrome bookmarks. This may take a while...', 'bot');

    const response = await chrome.runtime.sendMessage({ action: 'indexExistingBookmarks' });

    isIndexing = false;

    if (indexingCancelled) {
      indexBtn.innerHTML = '<span class="btn-icon">🔄</span><span>Index Bookmarks</span>';
      indexBtn.disabled = false;
      addMessage('⏹️ Indexing stopped by user.', 'bot');
      return;
    }

    if (response.success) {
      indexBtn.innerHTML = '<span class="btn-icon">✅</span><span>Indexed!</span>';
      console.log('Indexing response:', response); // Debug log

      if (response.total === 0) {
        addMessage('📚 No bookmarks found! Please save some pages by clicking the "📚 Save Current Page" button above, then try indexing again.', 'bot');
      } else if (response.indexed === 0) {
        addMessage('✅ All your bookmarks are already indexed! You can now chat about all your bookmarks.', 'bot');
      } else if (response.indexed === 1) {
        addMessage('✅ Successfully indexed 1 new bookmark! You can now chat about all your bookmarks.', 'bot');
      } else {
        addMessage(`✅ Successfully indexed ${response.indexed} new bookmarks! You can now chat about all your bookmarks.`, 'bot');
      }
      setTimeout(() => {
        indexBtn.innerHTML = '<span class="btn-icon">🔄</span><span>Index Bookmarks</span>';
        indexBtn.disabled = false;
      }, 3000);
    } else {
      indexBtn.innerHTML = '<span class="btn-icon">❌</span><span>Error</span>';
      addMessage(`❌ Error indexing bookmarks: ${response.error}`, 'bot');
      setTimeout(() => {
        indexBtn.innerHTML = '<span class="btn-icon">🔄</span><span>Index Bookmarks</span>';
        indexBtn.disabled = false;
      }, 3000);
    }
  } catch (error) {
    console.error('Error indexing bookmarks:', error);
    isIndexing = false;
    const indexBtn = document.getElementById('indexBookmarksBtn');
    indexBtn.innerHTML = '<span class="btn-icon">❌</span><span>Error</span>';
    addMessage(`❌ Error indexing bookmarks: ${error.message}`, 'bot');
    setTimeout(() => {
      indexBtn.innerHTML = '<span class="btn-icon">🔄</span><span>Index Bookmarks</span>';
      indexBtn.disabled = false;
    }, 3000);
  }
}

async function clearChat() {
  try {
    // Clear chat history from storage
    chatHistory = [];
    await chrome.storage.local.remove(['chatHistory']);

    // Reset chat container to show only welcome message
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = `
      <div class="message bot">
        👋 Hi! Ask me anything about your bookmarks.
      </div>
    `;

    // Add suggestion pills after a delay
    setTimeout(() => {
      addSuggestionPills();
    }, 500);

  } catch (error) {
    console.error('Error clearing chat:', error);
  }
}

// Status notification system
let notificationCount = 0;
const statusNotifications = [];

function addStatusNotification(message, type = 'info', persistent = false) {
  const notification = {
    id: Date.now(),
    message,
    type, // 'success', 'warning', 'error', 'info'
    timestamp: new Date(),
    persistent
  };

  statusNotifications.unshift(notification);

  // Limit to 20 notifications
  if (statusNotifications.length > 20) {
    statusNotifications.splice(20);
  }

  // Update notification count and show button
  notificationCount++;
  updateNotificationButton();

  // Auto-remove non-persistent notifications after 30 seconds
  if (!persistent) {
    setTimeout(() => {
      removeStatusNotification(notification.id);
    }, 30000);
  }
}

function removeStatusNotification(id) {
  const index = statusNotifications.findIndex(n => n.id === id);
  if (index > -1) {
    statusNotifications.splice(index, 1);
    notificationCount = Math.max(0, notificationCount - 1);
    updateNotificationButton();
    updateStatusPanel();
  }
}

function updateNotificationButton() {
  const btn = document.getElementById('statusNotificationBtn');
  const countSpan = document.getElementById('notificationCount');

  if (notificationCount > 0) {
    btn.style.display = 'flex';
    countSpan.textContent = notificationCount;
    btn.style.background = 'linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%)';
    btn.style.color = 'white';
  } else {
    btn.style.display = 'none';
  }
}

function toggleStatusPanel() {
  const panel = document.getElementById('statusNotificationPanel');
  if (panel.style.display === 'none') {
    showStatusPanel();
  } else {
    hideStatusPanel();
  }
}

function showStatusPanel() {
  const panel = document.getElementById('statusNotificationPanel');
  panel.style.display = 'flex';
  updateStatusPanel();

  // Mark notifications as read
  notificationCount = 0;
  updateNotificationButton();
}

function hideStatusPanel() {
  const panel = document.getElementById('statusNotificationPanel');
  panel.style.display = 'none';
}

function updateStatusPanel() {
  const content = document.getElementById('statusPanelContent');

  if (statusNotifications.length === 0) {
    content.innerHTML = `
      <div class="status-notification info">
        <div style="font-weight: 600; margin-bottom: 4px;">📝 No notifications</div>
        <div style="font-size: 12px; opacity: 0.8;">System status messages will appear here</div>
      </div>
    `;
    return;
  }

  content.innerHTML = statusNotifications.map(notification => {
    const timeAgo = getTimeAgo(notification.timestamp);
    const icon = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    }[notification.type] || 'ℹ️';

    return `
      <div class="status-notification ${notification.type}">
        <div style="font-weight: 600; margin-bottom: 4px;">
          ${icon} ${notification.message}
        </div>
        <div style="font-size: 11px; opacity: 0.7;">${timeAgo}</div>
      </div>
    `;
  }).join('');
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return timestamp.toLocaleDateString();
}