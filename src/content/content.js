// Content script for AI Reply Assistant
let currentInput = null;
let suggestionsPopup = null;
let debounceTimer = null;
let isGenerating = false;
let isEnabled = true;

// Site-specific configurations
const siteConfig = {
    'web.whatsapp.com': {
        insertText: (text) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text', text);
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true
            });
            const el = document.querySelector('#main .copyable-area [contenteditable="true"][role="textbox"]');
            if (el) {
                el.dispatchEvent(event);
            }
        },
        extractMessages: () => {
            const context = [];
            const messageContainers = document.querySelectorAll('div.message-in, div.message-out');
            
            messageContainers.forEach(container => {
                const messageText = container.querySelector('div.copyable-text span.selectable-text');
                if (messageText) {
                    const text = messageText.innerText.trim();
                    const sender = container.classList.contains('message-out') ? 'You' : 'Other';
                    context.push({ sender, text });
                }
            });
            return context;
        }
    },
    'gew3.bumble.com': {
        insertText: (text) => {
            const textarea = document.querySelector('.textarea__input');
            if (textarea) {
                textarea.focus();
                document.execCommand('insertText', false, text);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            }
        },
        extractMessages: () => {
            const context = [];
            const messages = document.querySelectorAll('.message');
            
            messages.forEach(msg => {
                const sender = msg.classList.contains('message--in') ? 'Other' : 
                             msg.classList.contains('message--out') ? 'You' : 'Unknown';
                const textSpan = msg.querySelector('.message-bubble__text > div > span');
                if (textSpan) {
                    const text = textSpan.innerText.trim();
                    if (text) {
                        context.push({ sender, text });
                    }
                }
            });
            return context;
        }
    },
    'www.jeevansathi.com': {
        insertText: (text) => {
            if (currentInput.isContentEditable) {
                currentInput.innerText = text;
            } else {
                currentInput.value = text;
            }
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        },
        extractMessages: () => {
            const context = [];
            const messageContainers = document.querySelectorAll('div.flex.flex-col');
            
            messageContainers.forEach(container => {
                const rightMsg = container.querySelector('div.mt-3\\.5.ml-auto');
                if (rightMsg) {
                    const text = rightMsg.innerText.trim();
                    if (!text.includes('You sent interest') && !text.includes('They accepted your interest')) {
                        context.push({ sender: 'You', text });
                    }
                }
                
                const leftMsg = container.querySelector('div.flex.space-x-2 > div.mt-3\\.5:not(.ml-auto)');
                if (leftMsg) {
                    const text = leftMsg.innerText.trim();
                    if (!text.includes('You sent interest') && !text.includes('They accepted your interest')) {
                        context.push({ sender: 'Other', text });
                    }
                }
            });
            return context;
        }
    },
    'www.linkedin.com': {
        insertText: (text) => {
            const inputBox = document.querySelector('.msg-form__contenteditable[contenteditable="true"]');
            if (!inputBox) return;
            
            inputBox.focus();
            inputBox.innerHTML = `<p>${text}</p>`;
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        },
        extractMessages: () => {
            const messages = [];
            const nodes = document.querySelectorAll('li.msg-s-message-list__event .msg-s-event-listitem');
            
            nodes.forEach(node => {
                const container = node.closest('li.msg-s-message-list__event');
                const nameEl = container.querySelector('.msg-s-message-group__name');
                const bodyEl = container.querySelector('.msg-s-event-listitem__body');
                
                if (nameEl && bodyEl) {
                    messages.push({
                        sender: nameEl.innerText.trim(),
                        text: bodyEl.innerText.trim().replace(/\n/g, ' ')
                    });
                }
            });
            
            return messages;
        }
    },
    default: {
        insertText: (text) => {
            if (currentInput.isContentEditable) {
                currentInput.innerText = text;
            } else {
                currentInput.value = text;
            }
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        },
        extractMessages: () => {
            const context = [];
            const messageElements = document.querySelectorAll('[role="listitem"], .message, .chat-message, .conversation-message');
            
            messageElements.forEach(element => {
                const isSent = element.classList.contains('sent') || 
                             element.classList.contains('outgoing') || 
                             element.classList.contains('message-out') ||
                             element.getAttribute('data-sent') === 'true';
                
                const text = element.innerText.trim();
                if (text) {
                    context.push({
                        sender: isSent ? 'You' : 'Other',
                        text
                    });
                }
            });
            return context;
        }
    }
};

// Inject styles
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .ai-reply-suggestions {
            position: fixed;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            border: 1px solid rgba(0, 0, 0, 0.08);
            z-index: 999999;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            max-height: 400px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .ai-reply-suggestions.visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }

        .ai-reply-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            background: linear-gradient(to bottom, #fafafa, #f8f8f8);
            flex-shrink: 0;
        }

        .ai-reply-title {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: #333;
        }

        .ai-reply-status {
            font-size: 11px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 12px;
        }

        .ai-reply-status.loading {
            background: #fef3c7;
            color: #92400e;
        }

        .ai-reply-status.ready {
            background: #d1fae5;
            color: #065f46;
        }

        .ai-reply-status.error {
            background: #fee2e2;
            color: #991b1b;
        }

        .ai-reply-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            min-height: 0;
            max-height: 300px;
            background: #ffffff;
        }

        .ai-reply-item {
            padding: 12px 14px;
            margin: 4px 0;
            background: #f9fafb;
            border: 1px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            line-height: 1.5;
            color: #000000 !important;
            transition: all 0.2s ease;
            position: relative;
            z-index: 1;
            opacity: 0;
            transform: translateY(10px);
        }

        .ai-reply-item.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .ai-reply-item:hover {
            background: #e5e7eb;
            border-color: #d1d5db;
        }

        .ai-reply-footer {
            padding: 8px 16px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
            background: #f9fafb;
            flex-shrink: 0;
        }

        .ai-reply-hint {
            font-size: 11px;
            color: #6b7280;
        }

        .ai-reply-error {
            color: #991b1b;
            padding: 12px;
            text-align: center;
        }

        .ai-reply-empty {
            color: #6b7280;
            padding: 12px;
            text-align: center;
            font-size: 13px;
        }

        @media (prefers-color-scheme: dark) {
            .ai-reply-suggestions {
                background: #1f2937;
                border-color: rgba(255, 255, 255, 0.1);
            }

            .ai-reply-header {
                background: linear-gradient(to bottom, #1f2937, #111827);
                border-bottom-color: rgba(255, 255, 255, 0.1);
            }

            .ai-reply-title {
                color: #f3f4f6;
            }

            .ai-reply-list {
                background: #1f2937;
            }

            .ai-reply-item {
                background: #374151;
                color: #ffffff !important;
            }

            .ai-reply-item:hover {
                background: #4b5563;
                border-color: #6b7280;
            }

            .ai-reply-footer {
                background: #111827;
                border-top-color: rgba(255, 255, 255, 0.1);
            }

            .ai-reply-hint {
                color: #9ca3af;
            }

            .ai-reply-error {
                color: #fecaca;
            }

            .ai-reply-empty {
                color: #9ca3af;
            }
        }
    `;
    document.head.appendChild(style);
}

// Handle text insertion based on hostname
function insertText(text) {
    const hostname = window.location.hostname;
    const config = siteConfig[hostname] || siteConfig.default;
    config.insertText(text);
}

// Extract conversation context
function extractConversationContext() {
    const hostname = window.location.hostname;
    const config = siteConfig[hostname] || siteConfig.default;
    const context = config.extractMessages();
    
    // Update context in background
    chrome.runtime.sendMessage({
        action: 'updateContext',
        context: context.slice(-20) // Keep last 20 messages
    });
}

// Detect input fields
function detectInputFields() {
    const inputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    
    inputs.forEach(input => {
        if (!input.hasAttribute('data-ai-reply-enabled')) {
            input.setAttribute('data-ai-reply-enabled', 'true');
            
            input.addEventListener('click', () => {
                if (!isEnabled) return;
                currentInput = input;
                extractConversationContext();
                showSuggestionsPopup();
            });
            
            input.addEventListener('focus', () => {
                if (!isEnabled) return;
                currentInput = input;
                extractConversationContext();
                if (input.value || input.innerText) {
                    showSuggestionsPopup();
                }
            });
            
            input.addEventListener('input', () => {
                if (!isEnabled) return;
                currentInput = input;
                extractConversationContext();
                if (input.value || input.innerText) {
                    showSuggestionsPopup();
                }
            });

            // Add keydown event listener for Escape key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    hideSuggestionsPopup();
                }
            });
        }
    });
}

// Create suggestions popup
function createSuggestionsPopup() {
    if (suggestionsPopup) return;
    
    suggestionsPopup = document.createElement('div');
    suggestionsPopup.className = 'ai-reply-suggestions';
    suggestionsPopup.innerHTML = `
        <div class="ai-reply-header">
            <div class="ai-reply-title">AI Reply Suggestions</div>
            <div class="ai-reply-status">Ready</div>
        </div>
        <div class="ai-reply-list"></div>
        <div class="ai-reply-footer">
            <div class="ai-reply-hint">Press Esc to hide • Ctrl+Space to regenerate</div>
        </div>
    `;
    
    document.body.appendChild(suggestionsPopup);
}

// Show suggestions popup
function showSuggestionsPopup() {
    if (!isEnabled || !suggestionsPopup) {
        createSuggestionsPopup();
    }
    
    if (currentInput && isEnabled) {
        const rect = currentInput.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (spaceBelow < 300 && spaceAbove > spaceBelow) {
            suggestionsPopup.style.bottom = `${viewportHeight - rect.top + 8}px`;
            suggestionsPopup.style.top = 'auto';
        } else {
            suggestionsPopup.style.top = `${rect.bottom + window.scrollY + 8}px`;
            suggestionsPopup.style.bottom = 'auto';
        }
        
        suggestionsPopup.style.left = `${rect.left + window.scrollX}px`;
        suggestionsPopup.style.width = `${Math.min(rect.width, 400)}px`;
        suggestionsPopup.classList.add('visible');
        generateSuggestions();
    }
}

// Hide suggestions popup
function hideSuggestionsPopup() {
    if (suggestionsPopup) {
        suggestionsPopup.classList.remove('visible');
    }
}

// Display suggestions
function displaySuggestions(suggestions) {
    if (!suggestionsPopup) {
        createSuggestionsPopup();
    }
    
    const listEl = suggestionsPopup.querySelector('.ai-reply-list');
    listEl.innerHTML = '';
    
    if (!suggestions || suggestions.length === 0) {
        listEl.innerHTML = '<div class="ai-reply-empty">No suggestions available</div>';
        return;
    }
    
    suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.className = 'ai-reply-item';
        item.textContent = suggestion;
        item.tabIndex = 0;
        
        const handleSuggestion = () => {
            if (currentInput) {
                insertText(suggestion);
                hideSuggestionsPopup();
            }
        };
        
        item.addEventListener('click', handleSuggestion);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSuggestion();
            }
        });
        
        listEl.appendChild(item);
        
        // Animate in
        setTimeout(() => item.classList.add('visible'), index * 50);
    });
}

// Generate suggestions from AI
async function generateSuggestions() {
    if (!isEnabled || isGenerating) return;
    
    isGenerating = true;
    const statusEl = suggestionsPopup.querySelector('.ai-reply-status');
    const listEl = suggestionsPopup.querySelector('.ai-reply-list');
    
    statusEl.textContent = 'Generating...';
    statusEl.className = 'ai-reply-status loading';
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'generateReplies',
            currentInput: currentInput.value || currentInput.innerText,
            hostname: window.location.hostname
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        if (!response.replies || response.replies.length === 0) {
            throw new Error('No suggestions generated');
        }
        
        displaySuggestions(response.replies);
        statusEl.textContent = 'Ready';
        statusEl.className = 'ai-reply-status ready';
    } catch (error) {
        statusEl.textContent = error.message;
        statusEl.className = 'ai-reply-status error';
        listEl.innerHTML = `<div class="ai-reply-error">${error.message}</div>`;
    } finally {
        isGenerating = false;
    }
}

// Initialize
async function initialize() {
    // Check if site is enabled
    const hostname = window.location.hostname;
    const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
    isEnabled = !disabledSites.includes(hostname);

    if (isEnabled) {
        injectStyles();
        detectInputFields();
        
        setInterval(detectInputFields, 2000);
        
        const observer = new MutationObserver(() => {
            detectInputFields();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Listen for toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleEnabled') {
        isEnabled = message.enabled;
        
        if (isEnabled) {
            // Enable extension
            injectStyles();
            detectInputFields();
        } else {
            // Disable extension
            if (suggestionsPopup) {
                suggestionsPopup.remove();
                suggestionsPopup = null;
            }
            // Remove all event listeners
            const inputs = document.querySelectorAll('[data-ai-reply-enabled]');
            inputs.forEach(input => {
                input.removeAttribute('data-ai-reply-enabled');
            });
        }
    }
});

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}