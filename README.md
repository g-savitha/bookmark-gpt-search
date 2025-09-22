# 📚 Bookmark GPT

A powerful Chrome extension that lets you chat with your bookmark content using AI and perform deep searches across all your saved pages.

## ✨ Features

### 🤖 AI Chat
- **Chat with your bookmarks**: Ask questions about the content you've saved
- **Intelligent responses**: Uses OpenAI's GPT models to understand and respond to your queries
- **Context-aware**: Automatically finds relevant bookmarks to answer your questions
- **Chat history**: Maintains conversation history for continuous discussions

### 🔍 Deep Search
- **Advanced search**: Find specific information across all your bookmark content
- **Full-text indexing**: Searches through titles, descriptions, headings, and full page content
- **Instant results**: Fast, local search through your indexed bookmark data
- **Relevance scoring**: Results ranked by relevance to your search query

### 📊 Smart Content Extraction
- **Automatic content capture**: Extracts meaningful content from web pages
- **Structured data**: Saves titles, descriptions, headings, paragraphs, and full text
- **Metadata preservation**: Keeps track of URLs, timestamps, and page structure
- **Efficient storage**: Optimized content storage and indexing

## 🚀 Installation

1. **Download the extension files** to a local directory
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in the top right)
4. **Click "Load unpacked"** and select the extension directory
5. **The extension is now installed** and ready to use!

## ⚙️ Setup

### 1. Configure OpenAI API Key
1. Click the Bookmark GPT extension icon
2. Enter your OpenAI API key in the provided field
3. Click "Save API Key"

### 2. Save Your First Bookmark
1. Navigate to any webpage
2. Right-click and select **"Add to Bookmark GPT"**
3. The page content will be extracted and saved automatically
4. You'll see a notification confirming the save

## 📖 Usage Guide

### Chatting with Bookmarks
1. **Open the extension popup** by clicking the icon
2. **Switch to Chat tab** (default view)
3. **Ask questions** about your saved content:
   - "What articles do I have about machine learning?"
   - "Summarize the main points from the React documentation I saved"
   - "Find information about Python data structures"
4. **Get AI-powered responses** based on your bookmark content

### Deep Search
1. **Switch to Search tab** in the extension popup
2. **Enter search terms** in the search box
3. **Click "Deep Search"** or press Enter
4. **Browse results** with relevance scoring
5. **Click any result** to open the original page

### Managing Bookmarks
1. **Right-click on extension icon** → Options
2. **View statistics** about your bookmark collection
3. **Export/Import** bookmark data for backup
4. **Delete individual bookmarks** or clear all data
5. **Rebuild search index** if needed

## 🔧 Advanced Configuration

### AI Model Selection
- **GPT-3.5 Turbo**: Faster and cheaper responses
- **GPT-4**: Higher quality understanding and responses
- **GPT-4 Turbo**: Best balance of speed and quality

### Search Settings
- **Maximum Results**: Control how many search results to display
- **Minimum Word Length**: Set minimum word length for indexing
- **Custom System Prompt**: Customize how the AI responds to queries

### Data Management
- **Export**: Save your bookmarks as JSON for backup
- **Import**: Restore bookmarks from exported JSON files
- **Storage Stats**: Monitor how much data you've stored
- **Index Rebuild**: Refresh search index for better performance

## 🏗️ Technical Architecture

### Content Extraction
- Uses content scripts to extract meaningful page content
- Focuses on headings, paragraphs, and structured text
- Filters out navigation and advertising content
- Preserves document structure and metadata

### Search Indexing
- Creates inverted index for fast full-text search
- Stores word-to-document mappings locally
- Supports relevance scoring and ranking
- Automatically updates index when bookmarks are added/removed

### Data Storage
- Uses Chrome's local storage API for data persistence
- Efficient JSON-based storage format
- Automatic cleanup and optimization
- Privacy-focused: all data stays local

## 🔒 Privacy & Security

- **Local-only storage**: All bookmark data stays on your device
- **No tracking**: Extension doesn't collect or transmit user data
- **OpenAI integration**: Only sends bookmark content to OpenAI when you chat
- **API key protection**: Your OpenAI key is stored locally and encrypted

## 🛠️ Development

### File Structure
```
bookmark-gpt-search/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for bookmark management
├── popup.html/js          # Main extension interface
├── content.js             # Content extraction script
├── options.html/js        # Settings and management page
└── icons/                 # Extension icons
```

### Key Components
- **Background Script**: Handles bookmark saving and search indexing
- **Content Script**: Extracts page content from websites
- **Popup Interface**: Main chat and search functionality
- **Options Page**: Settings and bookmark management

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section below
2. Open an issue on the project repository
3. Make sure your OpenAI API key is valid and has sufficient credits

## 🔧 Troubleshooting

### Common Issues

**Q: The extension isn't saving bookmarks**
- A: Make sure you've granted all necessary permissions during installation
- Check that you're right-clicking and selecting "Add to Bookmark GPT"

**Q: Chat responses are empty or show errors**
- A: Verify your OpenAI API key is correct and has available credits
- Check that you have bookmarks saved to chat about

**Q: Search isn't finding results**
- A: Try rebuilding the search index in the options page
- Make sure you've saved bookmarks that contain your search terms

**Q: Extension performance is slow**
- A: Consider clearing old bookmarks you no longer need
- Rebuild the search index to optimize performance

### Getting Help
- Review the console logs for error messages
- Check Chrome's extension management page for permission issues
- Ensure you're using a supported Chrome version (88+)