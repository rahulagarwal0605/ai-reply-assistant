// Storage utility for Chrome extension
export const storage = {
  // Get configuration
  async getConfig() {
    const result = await chrome.storage.local.get(['config']);
    return result.config || {
      provider: null,
      apiKey: null,
      model: null,
      temperature: 0.7,
      styles: {},
      isConfigured: false
    };
  },

  // Save configuration
  async setConfig(config) {
    await chrome.storage.local.set({ config });
  },

  // Get site-specific style
  async getStyleForSite(hostname) {
    const config = await this.getConfig();
    return config.styles[hostname] || config.styles.default || {
      tone: 'professional',
      length: 'medium',
      formality: 'neutral'
    };
  },

  // Save site-specific style
  async setStyleForSite(hostname, style) {
    const config = await this.getConfig();
    config.styles[hostname] = style;
    await this.setConfig(config);
  },

  // Get conversation context
  async getContext(tabId) {
    const result = await chrome.storage.session.get([`context_${tabId}`]);
    return result[`context_${tabId}`] || [];
  },

  // Save conversation context
  async setContext(tabId, context) {
    await chrome.storage.session.set({ [`context_${tabId}`]: context });
  },

  // Clear context for a tab
  async clearContext(tabId) {
    await chrome.storage.session.remove([`context_${tabId}`]);
  },

  // Check if configured
  async isConfigured() {
    const config = await this.getConfig();
    return config.isConfigured && config.provider && config.apiKey && config.model;
  }
}; 