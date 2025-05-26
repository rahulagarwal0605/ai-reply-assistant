// Content script for AI Reply Assistant
let currentInput = null;
let suggestionsPopup = null;
let debounceTimer = null;
let isGenerating = false;

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
      
      const textEl = msg.querySelector(config.text) || msg;
      text = textEl.textContent?.trim();
      
      if (text) {
        context.push({ sender, text });
      }
    } catch (e) {
      console.error('Error extracting message:', e);
    }
  });
  
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
  popup.classList.add('visible');
  
  generateSuggestions();
}

// Hide suggestions popup
function hideSuggestionsPopup() {
  if (suggestionsPopup) {
    suggestionsPopup.classList.remove('visible');
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
    statusEl.textContent = error.message.includes('not configured') ? 'Not configured' : 'Error';
    statusEl.className = 'ai-reply-status error';
    listEl.innerHTML = '<div class="ai-reply-error">Please configure the extension in settings</div>';
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
  if (!currentInput) return;
  
  if (currentInput.tagName === 'INPUT' || currentInput.tagName === 'TEXTAREA') {
    currentInput.value = suggestion;
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    currentInput.textContent = suggestion;
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  currentInput.focus();
  hideSuggestionsPopup();
}

// Initialize
function initialize() {
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