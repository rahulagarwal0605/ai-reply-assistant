import { storage } from '../utils/storage.js';
import { SuggestionsPopup } from './suggestions-popup.js';

// Content script for AI Reply Assistant
let debounceTimer = null;
let isEnabled = true;
let suggestionsPopup = new SuggestionsPopup();
let lastFocusedInput = null;

// Site-specific configurations
const siteConfig = {
    'web.whatsapp.com': {
        insertText: (inputEl, text) => {
            if (!inputEl) return;
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text', text);
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true
            });
            inputEl.dispatchEvent(event);
        },
        extractMessages: (inputEl) => {
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
        insertText: (inputEl, text) => {
            if (!inputEl) return;
            inputEl.focus();
            document.execCommand('insertText', false, text);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        },
        extractMessages: (inputEl) => {
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
        insertText: (inputEl, text) => {
            if (!inputEl) return;
            if (inputEl.isContentEditable) {
                inputEl.innerText = text;
            } else {
                inputEl.value = text;
            }
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        },
        extractMessages: (inputEl) => {
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
        insertText: (inputEl, text) => {
            if (!inputEl) return;
            inputEl.focus();
            if (inputEl.isContentEditable) {
                 inputEl.innerHTML = `<p>${text}</p>`;
            } else {
                 inputEl.value = text;
            }
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        },
        extractMessages: (inputEl) => {
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
        insertText: (inputEl, text) => {
            if (!inputEl) return;
            if (inputEl.isContentEditable) {
                inputEl.innerText = text;
            } else {
                inputEl.value = text;
            }
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        },
        extractMessages: (inputEl) => {
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

function insertText(inputElement, text) {
    if (!inputElement) return;
    const currentHostname = inputElement.closest('[data-aireply-hostname]')?.dataset.aireplyHostname || window.location.hostname;
    const config = siteConfig[currentHostname] || siteConfig.default;
    config.insertText(inputElement, text);
    const event = new Event('input', { bubbles: true, cancelable: true });
    inputElement.dispatchEvent(event);
}

function extractConversationContext(inputElement) {
    if (!inputElement) return [];
    const currentHostname = inputElement.closest('[data-aireply-hostname]')?.dataset.aireplyHostname || window.location.hostname;
    const config = siteConfig[currentHostname] || siteConfig.default;
    try {
        return config.extractMessages(inputElement);
    } catch (error) {
        console.error('Error extracting conversation context:', error);
        return [];
    }
}

async function actualGenerateSuggestions() {
    if (!suggestionsPopup.currentInputElement) {
        throw new Error('Input element not available for suggestions.');
    }
    const currentInput = suggestionsPopup.currentInputElement;
    const currentText = currentInput.value || currentInput.innerText;
    const hostname = currentInput.closest('[data-aireply-hostname]')?.dataset.aireplyHostname || window.location.hostname;
    const context = extractConversationContext(currentInput);

    const response = await chrome.runtime.sendMessage({
        action: 'generateReplies',
        currentInput: currentText,
        hostname: hostname,
        context: context,
        style: await storage.getStyleForSite(hostname)
    });

    if (response.error) {
        throw new Error(response.error);
    }
    return response.replies || [];
}

async function actualInsertSuggestion(suggestionText) {
    if (suggestionsPopup.currentInputElement) {
        insertText(suggestionsPopup.currentInputElement, suggestionText);
    }
}

function detectInputFields() {
    const inputs = document.querySelectorAll(
        'textarea, input[type="text"], input[type="search"], [contenteditable="true"]');

    inputs.forEach(input => {
        if (input.dataset.aireplyListenersAttached) return;
        input.dataset.aireplyListenersAttached = 'true';
        input.dataset.aireplyHostname = window.location.hostname;

        const showPopupForInput = async (eventTargetInput) => {
            if (!isEnabled) return;
            lastFocusedInput = eventTargetInput;
            suggestionsPopup.show(eventTargetInput);
            suggestionsPopup.generateSuggestions(actualGenerateSuggestions, actualInsertSuggestion);
        };

        input.addEventListener('focus', (event) => {
            showPopupForInput(event.target);
        });

        input.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            if (!isEnabled) return;
            
            const eventTargetInput = event.target;
            showPopupForInput(eventTargetInput); // Show popup immediately on input

            debounceTimer = setTimeout(async () => {
                if (isEnabled && suggestionsPopup.currentInputElement === eventTargetInput) {
                    suggestionsPopup.generateSuggestions(actualGenerateSuggestions, actualInsertSuggestion);
                }
            }, 500);
        });

        input.addEventListener('blur', async (event) => {
            setTimeout(() => {
                if (suggestionsPopup.popupElement && !suggestionsPopup.popupElement.contains(document.activeElement)) {
                    suggestionsPopup.hide();
                }
            }, 200); 
        });
    });
}

async function initialize() {
    const { disabledSites = [] } = await storage.getDisabledSites();
    isEnabled = !disabledSites.includes(window.location.hostname);

    if (!isEnabled) {
        console.log('AI Reply Assistant disabled for this site.');
        if (suggestionsPopup) suggestionsPopup.setEnabled(false);
        return;
    }
    
    detectInputFields();

    const observer = new MutationObserver((mutationsList) => {
        for(let mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'subtree') {
                detectInputFields();
                break; 
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        if (request.action === 'toggleEnabled') {
            isEnabled = request.enabled;
            if (suggestionsPopup) {
                suggestionsPopup.setEnabled(isEnabled);
                if (!isEnabled) {
                    suggestionsPopup.hide();
                }
            }
            console.log(`AI Reply Assistant ${isEnabled ? 'enabled' : 'disabled'} for this site.`);
            sendResponse({status: "done"}); 
        } else if (request.action === 'regenerateSuggestions') {
            if (!isEnabled) {
                sendResponse({status: "failed", reason: "Extension disabled on this site."});
                return true; 
            }
            const targetInput = suggestionsPopup.currentInputElement || lastFocusedInput;
            if (targetInput) {
                suggestionsPopup.show(targetInput);
                await suggestionsPopup.generateSuggestions(actualGenerateSuggestions, actualInsertSuggestion);
                sendResponse({status: "regenerating"});
            } else {
                sendResponse({status: "failed", reason: "No active input for suggestions."});
            }
        }
    })(); 
    return true; 
});

initialize();
