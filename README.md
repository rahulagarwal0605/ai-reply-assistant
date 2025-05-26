# AI Reply Assistant 🤖

An intelligent browser extension that suggests contextual replies for your conversations on any website. Works seamlessly with WhatsApp Web, Slack, LinkedIn, and any other messaging platform.

## Features ✨

- **Universal Compatibility**: Works on any website with text input fields
- **Context-Aware Suggestions**: Analyzes existing conversation context to provide relevant replies
- **Multiple LLM Support**: Configure any LLM API (OpenAI, Anthropic, Google AI, etc.)
- **Per-Site Styling**: Customize reply styles for different websites
- **Real-time Suggestions**: Get 3-4 reply options as you type
- **Modern UI**: Beautiful animations and responsive design
- **Privacy-First**: All API keys stored locally, no data sent to third parties

## Installation 🚀

### From Source (for Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/rahulagarwal0605/ai-reply-assistant.git
   cd ai-reply-assistant
   ```

2. Load the extension in Chrome (or Chromium-based browser):
   - Open your browser and navigate to `chrome://extensions/`
   - Enable "Developer mode" (usually a toggle in the top right).
   - Click "Load unpacked".
   - Select the `ai-reply-assistant` project directory (the one containing `manifest.json`).

### From a Packed File (`.crx`) (for Testing/Distribution)

If you have a `.crx` file (e.g., `ai-reply-assistant.crx`):

1. Open your browser and navigate to `chrome://extensions/`.
2. Ensure "Developer mode" is enabled (usually a toggle in the top right).
3. Drag and drop the `.crx` file onto the `chrome://extensions/` page.
4. Chrome will ask for confirmation to add the extension. Click "Add extension".

**Note:** If you packed the `.crx` file yourself locally, Chrome might show a warning about installing extensions from unknown sources or that it's not from the Chrome Web Store. This is normal for locally packed `.crx` files.

## Configuration ⚙️

1. Click the extension icon in your browser toolbar.
2. If it's your first time, or the extension is not configured, the popup will guide you.
3. Go to Settings (gear icon in the popup or via the options page).
4. Configure your preferred LLM:
   - Select provider (OpenAI, Anthropic, etc.).
   - Enter your API key.
   - Choose a model (if applicable for the provider).
   - Optionally, adjust default reply style (temperature, tone, etc.).

## Usage 💬

1. Navigate to any website with a conversation interface (e.g., WhatsApp Web, LinkedIn messages, forums).
2. Click on a text input field.
3. The AI assistant popup should appear nearby, or suggestions will load as you type (depending on configuration).
4. If suggestions don't appear or you want new ones, press `Ctrl+Space`.
5. Click on a suggestion to use it.
6. You can customize the reply style (tone, temperature) for specific websites via the extension popup.

## Development 🛠️

### Project Structure
```
ai-reply-assistant/
├── manifest.json          # Extension configuration
├── src/
│   ├── background/       # Background service worker
│   ├── content/          # Content scripts
│   ├── popup/            # Extension popup
│   ├── options/          # Settings page
│   ├── playground/       # Testing environment
│   ├── utils/            # Shared utilities
│   └── styles/           # CSS files
└── README.md
```

### Adding New LLM Providers

1. Add provider configuration in `src/utils/llm-providers.js`.
2. If the API interaction is unique, implement a new API client in `src/utils/api-client.js` or add a method to `LLMApiClient`.
3. Update the options page (`src/options/options.html` and `src/options/options.js`) to include the new provider and any specific model/URL inputs it requires.

## Privacy & Security 🔒

- All API keys are stored locally using Chrome's secure storage (`chrome.storage.local`).
- No telemetry or usage data is collected by the extension itself.
- Conversations are only processed to generate suggestions when you actively interact with an input field or use the regenerate shortcut.
- API calls are made directly from your browser to the configured LLM provider.

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request against the `master` branch of the original repository.

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Support 💖

If you find this extension helpful, please:
- ⭐ Star the repository on GitHub.
- 🐛 Report bugs or issues via GitHub Issues.
- 💡 Suggest features or improvements.
- 📣 Share with others who might find it useful.

## Acknowledgments 🙏

- Built with modern web technologies (JavaScript, HTML, CSS).
- Inspired by the need for better and more efficient communication assistance.
- Thanks to all potential contributors and users for their interest and support. 