class SuggestionsPopup {
    constructor() {
        this.popupElement = null;
        this.currentInputElement = null;
        this.isGenerating = false;
        this.isEnabled = true; // Added to control visibility based on extension state
    }

    create() {
        if (this.popupElement) return;

        this.popupElement = document.createElement('div');
        this.popupElement.className = 'ai-reply-suggestions';
        this.popupElement.innerHTML = `
            <div class="ai-reply-header">
                <div class="ai-reply-title">AI Reply Suggestions</div>
                <div class="ai-reply-status">Ready</div>
            </div>
            <div class="ai-reply-list"></div>
            <div class="ai-reply-footer">
                <div class="ai-reply-hint">Press Esc to hide • Ctrl+Space to regenerate</div>
            </div>
        `;
        document.body.appendChild(this.popupElement);

        // Add event listener for escape key to hide the popup
        // This needs to be managed carefully if multiple instances exist or if it's global
        // For now, assuming one active popup context at a time.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.popupElement && this.popupElement.classList.contains('visible')) {
                this.hide();
            }
        });
    }

    show(inputElement) {
        this.currentInputElement = inputElement;
        if (!this.isEnabled || !this.currentInputElement) {
            this.hide(); // Ensure it's hidden if not enabled or no input
            return;
        }

        if (!this.popupElement) {
            this.create();
        }

        const rect = this.currentInputElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Heuristic for positioning: try to show above if not enough space below and more space above
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const popupMinHeight = 200; // Approximate height of the popup

        if (spaceBelow < popupMinHeight && spaceAbove > spaceBelow) {
            this.popupElement.style.bottom = `${viewportHeight - rect.top + 8}px`;
            this.popupElement.style.top = 'auto';
        } else {
            this.popupElement.style.top = `${rect.bottom + window.scrollY + 8}px`;
            this.popupElement.style.bottom = 'auto';
        }

        this.popupElement.style.left = `${rect.left + window.scrollX}px`;
        // Set a max-width for the popup, but allow it to be smaller if the input is narrower
        this.popupElement.style.width = `${Math.min(rect.width, 400)}px`; 
        this.popupElement.classList.add('visible');
        // Optionally trigger generation here, or let the caller do it.
        // For content.js, it makes sense to trigger here. For playground, maybe not.
        // Let's keep it simple and let the caller decide when to call generateSuggestions.
    }

    hide() {
        if (this.popupElement) {
            this.popupElement.classList.remove('visible');
            // Consider a CSS transition for hiding, then set display:none if needed
            // For now, just removing visible class should be handled by CSS.
        }
    }

    display(suggestions, insertCallback) {
        if (!this.popupElement) {
            console.warn('SuggestionsPopup.display() called before popupElement was created.');
            return;
        }
        const listEl = this.popupElement.querySelector('.ai-reply-list');
        listEl.innerHTML = ''; // Clear previous suggestions

        if (!suggestions || suggestions.length === 0) {
            listEl.innerHTML = '<div class="ai-reply-empty">No suggestions available</div>';
            this.updateStatus('ready', 'No suggestions'); // Update status if empty
            return;
        }

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'ai-reply-item';
            item.textContent = suggestion;
            item.tabIndex = 0; // Make it focusable

            const handleSuggestionClick = () => {
                if (typeof insertCallback === 'function') {
                    insertCallback(suggestion); 
                }
                this.hide();
            };

            item.addEventListener('click', handleSuggestionClick);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission or other default actions
                    handleSuggestionClick();
                }
            });
            listEl.appendChild(item);
            // Animate in (optional, manage via CSS or remove if not needed here)
            setTimeout(() => item.classList.add('visible'), index * 50);
        });
        this.updateStatus('ready'); // Back to ready after displaying
    }

    updateStatus(newStatus, message = '') {
        if (!this.popupElement) return;
        const statusEl = this.popupElement.querySelector('.ai-reply-status');
        const listEl = this.popupElement.querySelector('.ai-reply-list');

        statusEl.className = 'ai-reply-status'; // Reset classes

        switch (newStatus) {
            case 'loading':
                statusEl.textContent = message || 'Generating...';
                statusEl.classList.add('loading');
                listEl.innerHTML = ''; // Clear list while loading
                break;
            case 'error':
                statusEl.textContent = message || 'Error';
                statusEl.classList.add('error');
                // Optionally, you can display the error message in listEl too
                listEl.innerHTML = `<div class="ai-reply-error">${message || 'Failed to get suggestions.'}</div>`;
                break;
            case 'ready':
                statusEl.textContent = message || 'Ready';
                statusEl.classList.add('ready');
                break;
            default:
                statusEl.textContent = newStatus; // For any other custom status
        }
    }

    // Method to update enabled state, useful for playground.js to toggle functionality
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.hide();
        }
    }

    destroy() {
        if (this.popupElement) {
            this.popupElement.remove();
            this.popupElement = null;
        }
        this.currentInputElement = null;
        // Remove global event listeners if they were added by this instance
    }

    // generateSuggestions method was part of the original content.js logic for this class.
    // It needs access to `chrome.runtime.sendMessage` and site-specific context extraction.
    // It's better if the caller (content.js or playground.js) handles the actual generation
    // and then calls `popup.display(suggestions)` or `popup.updateStatus('error', ...)`,
    // because the popup itself shouldn't be responsible for API calls or knowing the hostname/scenario.
    // However, for convenience and encapsulation, the original logic is kept here but made more generic.
    // The `generateFn` parameter will be a function passed by the caller to actually get suggestions.
    async generateSuggestions(generateFn, insertSuggestionCallback) {
        if (!this.isEnabled || !this.currentInputElement || this.isGenerating) {
            return;
        }

        this.isGenerating = true;
        this.updateStatus('loading');

        try {
            if (typeof generateFn !== 'function') {
                throw new Error('generateFn is not a function for generating suggestions.');
            }
            if (typeof insertSuggestionCallback !== 'function') {
                throw new Error('insertSuggestionCallback is not a function for inserting suggestions.');
            }
            const suggestions = await generateFn();
            this.display(suggestions, insertSuggestionCallback);
        } catch (error) {
            console.error('Error generating suggestions via popup:', error);
            this.updateStatus('error', error.message);
        } finally {
            this.isGenerating = false;
        }
    }
}

// Make it exportable if this file is treated as a module
export { SuggestionsPopup }; 