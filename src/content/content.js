// Content script for AI Reply Assistant
let currentInput = null;
let suggestionsPopup = null;
let debounceTimer = null;
let isGenerating = false;

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
      color: #374151;
      transition: all 0.2s ease;
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

      .ai-reply-item {
        background: #374151;
        color: #e5e7eb;
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
    }
  `;
  document.head.appendChild(style);
}

// Detect input fields and text areas
function detectInputFields() {
  const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea, [contenteditable="true"]');
  
  inputs.forEach(input => {
    if (!input.hasAttribute('data-ai-reply-enabled')) {
      input.setAttribute('data-ai-reply-enabled', 'true');
      
      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);
      input.addEventListener('input', handleInputChange);
      input.addEventListener('keydown', handleKeyDown);
    }
  });
}

// Handle input focus
function handleInputFocus(event) {
  currentInput = event.target;
  extractConversationContext();
  showSuggestionsPopup();
}

// Handle input blur
function handleInputBlur(event) {
  // Delay to allow clicking on suggestions
  setTimeout(() => {
    if (!suggestionsPopup?.contains(document.activeElement)) {
      hideSuggestionsPopup();
      currentInput = null;
    }
  }, 200);
}

// Handle input changes with debounce
function handleInputChange(event) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (currentInput && !isGenerating) {
      generateSuggestions();
    }
  }, 500);
}

// Handle keyboard shortcuts
function handleKeyDown(event) {
  if (event.ctrlKey && event.key === ' ') {
    event.preventDefault();
    generateSuggestions();
  }
}

// Extract conversation context from the page
function extractConversationContext() {
  const context = [];
  const hostname = window.location.hostname;
  
  // Platform-specific selectors
  const selectors = {
    'web.whatsapp.com': {
      messages: '.message-in, .message-out',
      sender: (el) => el.classList.contains('message-out') ? 'You' : 'Other',
      text: '.selectable-text'
    },
    'www.jeevansathi.com': {
      extract: () => {
        // Let's grab all message containers in order to maintain sequence
        const messageContainers = [...document.querySelectorAll('div.flex.flex-col')];
        
        const combined = [];
        
        messageContainers.forEach(container => {
          // Right side message (you)
          const rightMsg = container.querySelector('div.mt-3\\.5.ml-auto');
          if (rightMsg) {
            const text = rightMsg.innerText.trim();
            // Skip system messages
            if (!text.includes('You sent interest') && !text.includes('They accepted your interest')) {
              combined.push({ sender: 'You', text });
            }
          }
          
          // Left side message (other)
          const leftMsg = container.querySelector('div.flex.space-x-2 > div.mt-3\\.5:not(.ml-auto)');
          if (leftMsg) {
            const text = leftMsg.innerText.trim();
            // Skip system messages
            if (!text.includes('You sent interest') && !text.includes('They accepted your interest')) {
              combined.push({ sender: 'Other', text });
            }
          }
        });
        
        return combined;
      }
    },
    'slack.com': {
      messages: '.c-message_kit__message',
      sender: '.c-message__sender',
      text: '.c-message__body'
    },
    'linkedin.com': {
      messages: '.msg-s-message-list__event',
      sender: '.msg-s-message-list__name',
      text: '.msg-s-event__content'
    },
    // Default for unknown sites
    default: {
      messages: '[class*="message"], [class*="chat"], [class*="msg"]',
      sender: '[class*="sender"], [class*="author"], [class*="name"]',
      text: '[class*="text"], [class*="content"], [class*="body"]'
    }
  };
  
  const config = selectors[hostname] || selectors.default;
  
  if (hostname === 'www.jeevansathi.com') {
    // Use the custom extractor for Jeevansathi
    context.push(...config.extract());
  } else {
    // Use the standard selector-based approach for other platforms
    const messages = document.querySelectorAll(config.messages);
    
    messages.forEach(msg => {
      try {
        let sender, text;
        
        if (typeof config.sender === 'function') {
          sender = config.sender(msg);
        } else {
          const senderEl = msg.querySelector(config.sender);
          sender = senderEl?.textContent?.trim() || 'Unknown';
        }
        
        if (typeof config.text === 'function') {
          text = config.text(msg);
        } else {
          const textEl = msg.querySelector(config.text) || msg;
          text = textEl.textContent?.trim();
        }
        
        if (text) {
          context.push({ sender, text });
        }
      } catch (e) {
        console.error('Error extracting message:', e);
      }
    });
  }
  
  // Update context in background
  chrome.runtime.sendMessage({
    action: 'updateContext',
    context: context.slice(-20) // Keep last 20 messages
  });
}

// Create suggestions popup
function createSuggestionsPopup() {
  const popup = document.createElement('div');
  popup.className = 'ai-reply-suggestions';
  popup.innerHTML = `
    <div class="ai-reply-header">
      <span class="ai-reply-title">AI Suggestions</span>
      <span class="ai-reply-status"></span>
    </div>
    <div class="ai-reply-list"></div>
    <div class="ai-reply-footer">
      <span class="ai-reply-hint">Ctrl+Space to regenerate</span>
    </div>
  `;
  
  document.body.appendChild(popup);
  return popup;
}

// Show suggestions popup near input
function showSuggestionsPopup() {
  if (!suggestionsPopup) {
    suggestionsPopup = createSuggestionsPopup();
  }
  
  const rect = currentInput.getBoundingClientRect();
  const popup = suggestionsPopup;
  
  // Position popup above or below input
  if (rect.top > window.innerHeight / 2) {
    popup.style.bottom = `${window.innerHeight - rect.top + 5}px`;
    popup.style.top = 'auto';
  } else {
    popup.style.top = `${rect.bottom + 5}px`;
    popup.style.bottom = 'auto';
  }
  
  popup.style.left = `${rect.left}px`;
  popup.style.width = `${Math.min(rect.width, 400)}px`;
  popup.style.display = 'block';
  popup.classList.add('visible');
  
  generateSuggestions();
}

// Hide suggestions popup
function hideSuggestionsPopup() {
  if (suggestionsPopup) {
    suggestionsPopup.classList.remove('visible');
    setTimeout(() => {
      suggestionsPopup.style.display = 'none';
    }, 300);
  }
}

// Generate suggestions from AI
async function generateSuggestions() {
  if (isGenerating) return;
  
  isGenerating = true;
  const statusEl = suggestionsPopup.querySelector('.ai-reply-status');
  const listEl = suggestionsPopup.querySelector('.ai-reply-list');
  
  statusEl.textContent = 'Generating...';
  statusEl.className = 'ai-reply-status loading';
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateReplies',
      currentInput: currentInput.value || currentInput.textContent,
      hostname: window.location.hostname
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    displaySuggestions(response.replies || []);
    statusEl.textContent = 'Ready';
    statusEl.className = 'ai-reply-status ready';
  } catch (error) {
    console.error('Error generating suggestions:', error);
    statusEl.textContent = error.message;
    statusEl.className = 'ai-reply-status error';
    listEl.innerHTML = `<div class="ai-reply-error">${error.message}</div>`;
  } finally {
    isGenerating = false;
  }
}

// Display suggestions in popup
function displaySuggestions(suggestions) {
  const listEl = suggestionsPopup.querySelector('.ai-reply-list');
  listEl.innerHTML = '';
  
  if (suggestions.length === 0) {
    listEl.innerHTML = '<div class="ai-reply-empty">No suggestions available</div>';
    return;
  }
  
  suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.className = 'ai-reply-item';
    item.textContent = suggestion;
    item.tabIndex = 0;
    
    item.addEventListener('click', () => insertSuggestion(suggestion));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') insertSuggestion(suggestion);
    });
    
    listEl.appendChild(item);
    
    // Animate in
    setTimeout(() => item.classList.add('visible'), index * 50);
  });
}

// Insert suggestion into input
function insertSuggestion(suggestion) {
  const hostname = window.location.hostname;
  
  if (hostname === 'web.whatsapp.com') {
    // WhatsApp specific implementation
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text', suggestion);
    const event = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true
    });
    const el = document.querySelector('#main .copyable-area [contenteditable="true"][role="textbox"]');
    if (el) {
      el.dispatchEvent(event);
    }
  } else {
    // For other platforms
    const activeElement = document.activeElement;
    
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const text = activeElement.value;
      
      activeElement.value = text.substring(0, start) + suggestion + text.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + suggestion.length;
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (activeElement.isContentEditable) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(suggestion);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      activeElement.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: suggestion
      }));
    }
  }
  
  hideSuggestionsPopup();
}

// Initialize
function initialize() {
  injectStyles();
  detectInputFields();
  
  // Re-detect inputs periodically for dynamic content
  setInterval(detectInputFields, 2000);
  
  // Observe DOM changes
  const observer = new MutationObserver(() => {
    detectInputFields();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 