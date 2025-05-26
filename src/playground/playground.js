// Playground script
const elements = {
  scenarioSelect: document.getElementById('scenarioSelect'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  charCount: document.getElementById('charCount'),
  emojiBtn: document.getElementById('emojiBtn'),
  attachBtn: document.getElementById('attachBtn'),
  emojiPicker: document.getElementById('emojiPicker'),
  extensionState: document.getElementById('extensionState'),
  apiState: document.getElementById('apiState'),
  settingsLink: document.getElementById('settingsLink')
};

// Scenario data
const scenarios = {
  professional: {
    title: 'Professional Email',
    messages: [
      { sender: 'colleague', text: 'Hi, could you please review the quarterly report and provide your feedback by EOD?' },
      { sender: 'you', text: 'Sure, I\'ll review it and get back to you with my comments.' },
      { sender: 'colleague', text: 'Great! Also, are you available for a quick sync tomorrow at 2 PM?' }
    ]
  },
  slack: {
    title: 'Slack Conversation',
    messages: [
      { sender: 'teammate', text: 'Hey! Did you see the latest design mockups?' },
      { sender: 'you', text: 'Not yet, where can I find them?' },
      { sender: 'teammate', text: 'Just posted in #design channel. Let me know what you think!' }
    ]
  },
  dating: {
    title: 'Dating App Chat',
    messages: [
      { sender: 'match', text: 'Hi! I noticed we both love hiking. What\'s your favorite trail?' },
      { sender: 'you', text: 'Hey! I love the Pacific Crest Trail. Have you been?' },
      { sender: 'match', text: 'Not yet, but it\'s on my bucket list! Any weekend hiking spots you\'d recommend?' }
    ]
  },
  customer: {
    title: 'Customer Support',
    messages: [
      { sender: 'customer', text: 'Hello, I\'m having trouble accessing my account. Can you help?' },
      { sender: 'you', text: 'I\'d be happy to help! Can you tell me what error message you\'re seeing?' },
      { sender: 'customer', text: 'It says "Invalid credentials" but I\'m sure my password is correct.' }
    ]
  },
  social: {
    title: 'Social Media DM',
    messages: [
      { sender: 'friend', text: 'OMG did you see what just happened?? 😱' },
      { sender: 'you', text: 'No! What happened?' },
      { sender: 'friend', text: 'Check my story right now! You won\'t believe it!' }
    ]
  },
  custom: {
    title: 'Custom Scenario',
    messages: []
  }
};

let currentMessages = [];
let suggestionsPopup = null;
let debounceTimer = null;
let isGenerating = false;

// Initialize
function init() {
  checkExtensionStatus();
  setupEventListeners();
  updateCharCount();
  createSuggestionsPopup();
}

// Create suggestions popup (similar to content script)
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
  popup.style.display = 'none';
  document.body.appendChild(popup);
  suggestionsPopup = popup;
}

// Show suggestions popup
function showSuggestionsPopup() {
  if (!suggestionsPopup || !elements.chatInput) return;
  
  const rect = elements.chatInput.getBoundingClientRect();
  
  // Position popup above input
  suggestionsPopup.style.position = 'fixed';
  suggestionsPopup.style.bottom = `${window.innerHeight - rect.top + 5}px`;
  suggestionsPopup.style.left = `${rect.left}px`;
  suggestionsPopup.style.width = `${Math.min(rect.width, 400)}px`;
  suggestionsPopup.style.display = 'block';
  suggestionsPopup.classList.add('visible');
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

// Generate suggestions
async function generateSuggestions() {
  if (isGenerating || !suggestionsPopup) return;
  
  isGenerating = true;
  const statusEl = suggestionsPopup.querySelector('.ai-reply-status');
  const listEl = suggestionsPopup.querySelector('.ai-reply-list');
  
  statusEl.textContent = 'Generating...';
  statusEl.className = 'ai-reply-status loading';
  
  try {
    // Prepare context for API
    const context = currentMessages.map(msg => ({
      sender: msg.sender === 'you' ? 'You' : 'Other',
      text: msg.text
    }));
    
    const response = await chrome.runtime.sendMessage({
      action: 'generateReplies',
      currentInput: elements.chatInput.value,
      hostname: 'playground.test',
      context: context,
      scenario: elements.scenarioSelect.value
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

// Display suggestions
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

// Insert suggestion
function insertSuggestion(suggestion) {
  elements.chatInput.value = suggestion;
  elements.chatInput.focus();
  updateCharCount();
  hideSuggestionsPopup();
}

// Check extension status
async function checkExtensionStatus() {
  try {
    // Try to communicate with the extension
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    
    if (response && response.config) {
      elements.extensionState.textContent = 'Active';
      elements.extensionState.className = 'status-value active';
      
      if (response.config.isConfigured) {
        elements.apiState.textContent = 'Configured';
        elements.apiState.className = 'status-value active';
      } else {
        elements.apiState.textContent = 'Not Configured';
        elements.apiState.className = 'status-value inactive';
      }
    }
  } catch (error) {
    elements.extensionState.textContent = 'Not Detected';
    elements.extensionState.className = 'status-value inactive';
    elements.apiState.textContent = 'N/A';
    elements.apiState.className = 'status-value inactive';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Scenario selector
  elements.scenarioSelect.addEventListener('change', loadScenario);
  
  // Clear chat
  elements.clearChatBtn.addEventListener('click', clearChat);
  
  // Send message
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Handle Ctrl+Space for regenerating suggestions
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      showSuggestionsPopup();
      generateSuggestions();
    }
  });
  
  // Character count and input changes
  elements.chatInput.addEventListener('input', () => {
    updateCharCount();
    
    // Show suggestions on input with debounce
    clearTimeout(debounceTimer);
    
    if (elements.chatInput.value.trim()) {
      showSuggestionsPopup();
      debounceTimer = setTimeout(() => {
        if (!isGenerating && document.getElementById('autoSuggest').checked) {
          generateSuggestions();
        }
      }, 500);
    } else {
      hideSuggestionsPopup();
    }
  });
  
  // Focus/blur events for suggestions
  elements.chatInput.addEventListener('focus', () => {
    if (elements.chatInput.value.trim()) {
      showSuggestionsPopup();
      if (!isGenerating && document.getElementById('autoSuggest').checked) {
        generateSuggestions();
      }
    }
  });
  
  elements.chatInput.addEventListener('blur', (e) => {
    // Delay to allow clicking on suggestions
    setTimeout(() => {
      if (!suggestionsPopup?.contains(document.activeElement)) {
        hideSuggestionsPopup();
      }
    }, 200);
  });
  
  // Emoji picker
  elements.emojiBtn.addEventListener('click', toggleEmojiPicker);
  document.querySelectorAll('.emoji-item').forEach(emoji => {
    emoji.addEventListener('click', () => insertEmoji(emoji.textContent));
  });
  
  // Click outside to close emoji picker
  document.addEventListener('click', (e) => {
    if (!elements.emojiBtn.contains(e.target) && !elements.emojiPicker.contains(e.target)) {
      elements.emojiPicker.style.display = 'none';
    }
  });
  
  // Settings link
  elements.settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Attach button (placeholder)
  elements.attachBtn.addEventListener('click', () => {
    alert('File attachment is a placeholder feature for this demo.');
  });
}

// Load scenario
function loadScenario() {
  const scenarioId = elements.scenarioSelect.value;
  const scenario = scenarios[scenarioId];
  
  if (!scenario) return;
  
  clearChat(false);
  
  if (scenario.messages.length > 0) {
    currentMessages = [...scenario.messages];
    
    // Add messages with delay for animation
    scenario.messages.forEach((msg, index) => {
      setTimeout(() => {
        addMessage(msg.text, msg.sender === 'you');
      }, index * 300);
    });
  }
}

// Clear chat
function clearChat(showWelcome = true) {
  currentMessages = [];
  elements.chatMessages.innerHTML = '';
  
  if (showWelcome) {
    elements.chatMessages.innerHTML = `
      <div class="chat-welcome">
        <h2>Welcome to the AI Reply Assistant Playground!</h2>
        <p>Select a scenario above or start typing to test the extension.</p>
        <p class="hint">💡 The AI assistant will suggest replies as you type in the input field below.</p>
      </div>
    `;
  }
}

// Add message to chat
function addMessage(text, isSent = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.innerHTML = `
    <div class="message-content">
      ${text}
      <div class="message-time">${time}</div>
    </div>
  `;
  
  // Remove welcome message if exists
  const welcome = elements.chatMessages.querySelector('.chat-welcome');
  if (welcome) {
    welcome.remove();
  }
  
  elements.chatMessages.appendChild(messageDiv);
  
  // Animate if enabled
  const animateMessages = document.getElementById('animateMessages').checked;
  if (animateMessages) {
    messageDiv.style.animation = 'slideIn 0.3s ease';
  }
  
  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  
  // Update current messages for context
  currentMessages.push({
    sender: isSent ? 'you' : 'other',
    text: text
  });
}

// Send message
function sendMessage() {
  const text = elements.chatInput.value.trim();
  if (!text) return;
  
  addMessage(text, true);
  elements.chatInput.value = '';
  updateCharCount();
  hideSuggestionsPopup();
  
  // Simulate response after delay
  if (elements.scenarioSelect.value !== 'custom') {
    setTimeout(() => {
      simulateResponse();
    }, 1000 + Math.random() * 2000);
  }
}

// Simulate response based on scenario
function simulateResponse() {
  const scenarioId = elements.scenarioSelect.value;
  const responses = {
    professional: [
      'Thank you for your prompt response. I appreciate your help with this.',
      'That sounds great. Looking forward to our discussion.',
      'I\'ll make sure to have everything ready by then.'
    ],
    slack: [
      'Awesome! Thanks for checking it out 🙌',
      'Let me know if you need any clarification!',
      'Cool, I\'ll ping you when I have updates.'
    ],
    dating: [
      'That sounds amazing! I\'d love to hear about your experience.',
      'Definitely! Have you tried any local trails recently?',
      'We should plan a hike together sometime! 🏔️'
    ],
    customer: [
      'I understand your frustration. Let me help you resolve this.',
      'Can you try resetting your password using the forgot password link?',
      'I\'ve escalated this to our technical team for immediate assistance.'
    ],
    social: [
      'WHAT?! I\'m checking right now!! 😱',
      'No way!! Is this for real??? 🤯',
      'OMG I can\'t believe this happened! 💀'
    ]
  };
  
  const scenarioResponses = responses[scenarioId] || responses.professional;
  const randomResponse = scenarioResponses[Math.floor(Math.random() * scenarioResponses.length)];
  
  addMessage(randomResponse, false);
}

// Update character count
function updateCharCount() {
  const count = elements.chatInput.value.length;
  elements.charCount.textContent = count;
  
  if (count > 280) {
    elements.charCount.style.color = '#ef4444';
  } else if (count > 200) {
    elements.charCount.style.color = '#f59e0b';
  } else {
    elements.charCount.style.color = '#6b7280';
  }
}

// Toggle emoji picker
function toggleEmojiPicker() {
  const picker = elements.emojiPicker;
  const btn = elements.emojiBtn;
  
  if (picker.style.display === 'none' || !picker.style.display) {
    const rect = btn.getBoundingClientRect();
    picker.style.bottom = `${window.innerHeight - rect.top + 5}px`;
    picker.style.left = `${rect.left}px`;
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

// Insert emoji
function insertEmoji(emoji) {
  const input = elements.chatInput;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const text = input.value;
  
  input.value = text.substring(0, start) + emoji + text.substring(end);
  input.selectionStart = input.selectionEnd = start + emoji.length;
  input.focus();
  
  updateCharCount();
  elements.emojiPicker.style.display = 'none';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Re-check extension status periodically
setInterval(checkExtensionStatus, 5000); 