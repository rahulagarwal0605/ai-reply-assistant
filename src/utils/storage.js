// Storage utility for Chrome extension

const STORAGE_KEY_CONFIG = 'config';
const STORAGE_KEY_STATS = 'stats';
const STORAGE_KEY_DISABLED_SITES = 'disabledSites';
const CONTEXT_PREFIX = 'context_';

const DEFAULT_FALLBACK_STYLE = {
  tone: 'professional',
  temperature: 0.7,
  formality: 'neutral'
};

export const DEFAULT_FALLBACK_STYLE_EXPORT = { ...DEFAULT_FALLBACK_STYLE };

export const storage = {
  DEFAULT_FALLBACK_STYLE: { ...DEFAULT_FALLBACK_STYLE },
  // Get configuration
  async getConfig() {
    const result = await chrome.storage.local.get([STORAGE_KEY_CONFIG]);
    return result[STORAGE_KEY_CONFIG] || {
      provider: null,
      apiKey: null,
      model: null,
      temperature: 0.7,
      styles: { 
        default: { ...DEFAULT_FALLBACK_STYLE }
      },
      isConfigured: false
    };
  },

  // Save configuration
  async setConfig(config) {
    await chrome.storage.local.set({ [STORAGE_KEY_CONFIG]: config });
  },

  // Get site-specific style
  async getStyleForSite(hostname) {
    const config = await this.getConfig();
    const styles = config.styles || {};
    return styles[hostname] || styles.default || DEFAULT_FALLBACK_STYLE;
  },

  // Save site-specific style
  async setStyleForSite(hostname, style) {
    const config = await this.getConfig();
    if (!config.styles) {
        config.styles = {};
    }
    config.styles[hostname] = {
      tone: style.tone,
      temperature: Number(style.temperature),
      formality: style.formality
    };
    await this.setConfig(config);
  },

  // Get conversation context
  async getContext(tabId) {
    const key = `${CONTEXT_PREFIX}${tabId}`;
    const result = await chrome.storage.session.get([key]);
    return result[key] || [];
  },

  // Save conversation context
  async setContext(tabId, context) {
    const key = `${CONTEXT_PREFIX}${tabId}`;
    await chrome.storage.session.set({ [key]: context });
  },

  // Clear context for a tab
  async clearContext(tabId) {
    const key = `${CONTEXT_PREFIX}${tabId}`;
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
    const result = await chrome.storage.local.get([STORAGE_KEY_STATS]);
    const stats = result[STORAGE_KEY_STATS] || { date: today, suggestions: 0, sites: {} };
    
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
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: stats });
    
    return stats;
  },

  // Added functions for disabledSites based on usage in content.js
  async getDisabledSites() {
    const result = await chrome.storage.local.get([STORAGE_KEY_DISABLED_SITES]);
    return result[STORAGE_KEY_DISABLED_SITES] || [];
  },

  async setDisabledSites(disabledSitesArray) {
    await chrome.storage.local.set({ [STORAGE_KEY_DISABLED_SITES]: disabledSitesArray });
  }
}; 