// Popup script
import { storage } from '../utils/storage.js';

// DOM elements
const elements = {
  statusIndicator: document.getElementById('statusIndicator'),
  statusDot: document.querySelector('.status-dot'),
  statusText: document.querySelector('.status-text'),
  suggestionsCount: document.getElementById('suggestionsCount'),
  sitesCount: document.getElementById('sitesCount'),
  siteName: document.getElementById('siteName'),
  siteSection: document.getElementById('siteSection'),
  warningSection: document.getElementById('warningSection'),
  statsSection: document.getElementById('statsSection'),
  settingsBtn: document.getElementById('settingsBtn'),
  configureBtn: document.getElementById('configureBtn'),
  editStyleBtn: document.getElementById('editStyleBtn'),
  styleEditor: document.getElementById('styleEditor'),
  toneSelect: document.getElementById('toneSelect'),
  saveStyleBtn: document.getElementById('saveStyleBtn'),
  cancelStyleBtn: document.getElementById('cancelStyleBtn'),
  playgroundLink: document.getElementById('playgroundLink')
};

let currentTab = null;
let currentHostname = null;

// Initialize popup
async function init() {
  // Check configuration status
  const isConfigured = await storage.isConfigured();
  updateStatus(isConfigured);
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  if (tab.url) {
    try {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      elements.siteName.textContent = currentHostname;
      
      // Load current style for site
      const style = await storage.getStyleForSite(currentHostname);
      elements.toneSelect.value = style.tone;
    } catch (e) {
      elements.siteName.textContent = 'Invalid URL';
    }
  }
  
  // Load stats
  await loadStats();
  
  // Setup event listeners
  setupEventListeners();
}

// Update status display
function updateStatus(isConfigured) {
  if (isConfigured) {
    elements.statusIndicator.className = 'status-indicator configured';
    elements.statusText.textContent = 'Configured & Ready';
    elements.warningSection.style.display = 'none';
    elements.siteSection.style.display = 'block';
    elements.statsSection.style.display = 'grid';
  } else {
    elements.statusIndicator.className = 'status-indicator error';
    elements.statusText.textContent = 'Not Configured';
    elements.warningSection.style.display = 'block';
    elements.siteSection.style.display = 'none';
    elements.statsSection.style.display = 'none';
  }
}

// Load statistics
async function loadStats() {
  // Get today's stats from storage
  const today = new Date().toDateString();
  const stats = await chrome.storage.local.get(['stats']);
  
  if (stats.stats && stats.stats.date === today) {
    elements.suggestionsCount.textContent = stats.stats.suggestions || 0;
    elements.sitesCount.textContent = Object.keys(stats.stats.sites || {}).length;
  } else {
    elements.suggestionsCount.textContent = '0';
    elements.sitesCount.textContent = '0';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Configure button
  elements.configureBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Edit style button
  elements.editStyleBtn.addEventListener('click', () => {
    elements.styleEditor.style.display = 'block';
    elements.editStyleBtn.style.display = 'none';
  });
  
  // Save style button
  elements.saveStyleBtn.addEventListener('click', async () => {
    const style = {
      tone: elements.toneSelect.value,
      length: 'medium',
      formality: 'neutral'
    };
    
    await storage.setStyleForSite(currentHostname, style);
    elements.styleEditor.style.display = 'none';
    elements.editStyleBtn.style.display = 'block';
    
    // Show success animation
    elements.saveStyleBtn.textContent = '✓ Saved';
    setTimeout(() => {
      elements.saveStyleBtn.textContent = 'Save';
    }, 1500);
  });
  
  // Cancel style button
  elements.cancelStyleBtn.addEventListener('click', async () => {
    // Reset to original value
    const style = await storage.getStyleForSite(currentHostname);
    elements.toneSelect.value = style.tone;
    
    elements.styleEditor.style.display = 'none';
    elements.editStyleBtn.style.display = 'block';
  });
  
  // Playground link
  elements.playgroundLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/playground/index.html')
    });
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init); 