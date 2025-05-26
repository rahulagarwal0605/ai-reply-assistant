// Storage utility for Chrome extension

const STORAGE_KEYS = {
  CONFIG: 'config',
  STATS: 'stats',
  CONTEXT_PREFIX: 'context_'
};

const DEFAULT_STYLE = {
  tone: 'professional',
  length: 'medium', // Added for consistency
  formality: 'neutral', // Added for consistency
  temperature: '0.7' // Kept as string to match existing site-specific, consider number conversion at usage point
};

const DEFAULT_CONFIG = {
  provider: null,
  apiKey: null,
  model: null,
  temperature: 0.7, // Number here for global config
  styles: {
    default: { ...DEFAULT_STYLE } // Ensure default style is part of default config
  },
  isConfigured: false
};

export const storage = {
  // Get configuration
  async getConfig() {
    const result = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
    // Deep merge for styles, particularly default style, might be safer if structure evolves
    // For now, simple || with a structured default is okay.
    const loadedConfig = result[STORAGE_KEYS.CONFIG];
    if (loadedConfig) {
      // Ensure default style exists and has all fields from DEFAULT_STYLE
      if (!loadedConfig.styles) loadedConfig.styles = {};
      loadedConfig.styles.default = { ...DEFAULT_STYLE, ...(loadedConfig.styles.default || {}) };
      return { ...DEFAULT_CONFIG, ...loadedConfig }; 
    }
    return { ...DEFAULT_CONFIG }; // Return a copy
  },

  // Save configuration
  async setConfig(config) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
  },

  // Get site-specific style
  async getStyleForSite(hostname) {
    const config = await this.getConfig();
    // Site-specific style OR config's default style OR absolute default style
    return config.styles[hostname] || config.styles.default || { ...DEFAULT_STYLE };
  },

  // Save site-specific style
  async setStyleForSite(hostname, style) {
    const config = await this.getConfig();
    if (!config.styles) {
      config.styles = {};
    }
    // Ensure all parts of a style object are saved, merging with default as a base
    config.styles[hostname] = {
      ...DEFAULT_STYLE, // Start with default to ensure all fields are there
      tone: style.tone, // Override with specific
      temperature: style.temperature // Override with specific
      // length and formality for site-specific styles are not currently set by UI, but would go here
    };
    await this.setConfig(config);
  },

  // Get conversation context
  _getContextKey(tabId) {
    return `${STORAGE_KEYS.CONTEXT_PREFIX}${tabId}`;
  },

  async getContext(tabId) {
    const key = this._getContextKey(tabId);
    const result = await chrome.storage.session.get([key]);
    return result[key] || [];
  },

  // Save conversation context
  async setContext(tabId, context) {
    const key = this._getContextKey(tabId);
    await chrome.storage.session.set({ [key]: context });
  },

  // Clear context for a tab
  async clearContext(tabId) {
    const key = this._getContextKey(tabId);
    await chrome.storage.session.remove([key]);
  },

  // Check if configured
  async isConfigured() {
    const config = await this.getConfig();
    return !!(config.isConfigured && config.provider && config.apiKey && config.model);
  },

  // Get today's stats
  async getStats() {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get([STORAGE_KEYS.STATS]);
    const stats = result[STORAGE_KEYS.STATS] || { date: today, suggestions: 0, sites: {} };
    
    // Reset stats if it's a new day
    if (stats.date !== today) {
      stats.date = today;
      stats.suggestions = 0;
      stats.sites = {};
    }
    
    return stats;
  },

  // Update stats
  async updateStats(hostname) {
    const stats = await this.getStats();
    
    // Increment suggestions count
    stats.suggestions = (stats.suggestions || 0) + 1;
    
    // Update sites count
    if (!stats.sites[hostname]) {
      stats.sites[hostname] = {
        firstSeen: new Date().toISOString(),
        suggestions: 0
      };
    }
    stats.sites[hostname].suggestions++;
    
    // Save updated stats
    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
    
    return stats;
  }
}; 