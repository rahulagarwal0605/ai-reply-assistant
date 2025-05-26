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

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/rahulagarwal0605/ai-reply-assistant.git
   cd ai-reply-assistant
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

## Configuration ⚙️

1. Click the extension icon in your browser toolbar
2. Go to Settings (gear icon)
3. Configure your preferred LLM:
   - Select provider (OpenAI, Anthropic, etc.)
   - Enter your API key
   - Choose model
   - Set temperature and other parameters

## Usage 💬

1. Navigate to any website with a conversation interface
2. Click on a text input field
3. The AI assistant will automatically detect the context
4. As you type, you'll see 3-4 suggested replies
5. Click on a suggestion to use it
6. Customize the style in settings for specific websites

## Testing Playground 🎮

Visit the included playground at `/src/playground/index.html` to test the extension:
- Simulates various conversation scenarios
- Test different reply styles
- Debug context detection

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

1. Add provider configuration in `src/utils/llm-providers.js`
2. Implement API client in `src/utils/api-clients/`
3. Update options page to include new provider

## Privacy & Security 🔒

- All API keys are stored locally using Chrome's secure storage
- No telemetry or usage data is collected
- Conversations are only processed when you actively request suggestions
- API calls are made directly from your browser to the LLM provider

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Support 💖

If you find this extension helpful, please:
- ⭐ Star the repository
- 🐛 Report bugs via GitHub issues
- 💡 Suggest features
- 📣 Share with others

## Acknowledgments 🙏

- Built with modern web technologies
- Inspired by the need for better conversation assistance
- Thanks to all contributors and users 