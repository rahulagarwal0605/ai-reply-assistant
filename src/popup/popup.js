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
  temperatureInput: document.getElementById('temperatureInput'),
  temperatureValue: document.getElementById('temperatureValue'),
  saveStyleBtn: document.getElementById('saveStyleBtn'),
  cancelStyleBtn: document.getElementById('cancelStyleBtn'),
  playgroundLink: document.getElementById('playgroundLink'),
  siteToggle: document.getElementById('siteToggle')
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
      elements.toneSelect.value = style.tone || 'professional';
      elements.temperatureInput.value = style.temperature || '0.7';
      elements.temperatureValue.textContent = style.temperature || '0.7';
      updateTemperatureDescription(style.temperature || '0.7');

      // Load disabled sites and set toggle state
      const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
      elements.siteToggle.checked = !disabledSites.includes(currentHostname);
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
  try {
    const stats = await storage.getStats();
    
    // Update suggestions count
    elements.suggestionsCount.textContent = stats.suggestions || 0;
    
    // Update sites count
    const activeSites = Object.keys(stats.sites || {}).length;
    elements.sitesCount.textContent = activeSites;
    
    // Update stats section visibility
    elements.statsSection.style.display = 'grid';
  } catch (error) {
    console.error('Error loading stats:', error);
    elements.suggestionsCount.textContent = '0';
    elements.sitesCount.textContent = '0';
  }
}

// Update temperature description
function updateTemperatureDescription(value) {
  const descriptions = document.querySelectorAll('.temperature-description .description');
  descriptions.forEach(desc => {
    desc.classList.remove('active');
  });
  
  const temp = parseFloat(value);
  if (temp <= 0.3) {
    document.querySelector('.temperature-description .description.focused').classList.add('active');
  } else if (temp <= 0.7) {
    document.querySelector('.temperature-description .description.balanced').classList.add('active');
  } else {
    document.querySelector('.temperature-description .description.creative').classList.add('active');
  }
}

// Load current site settings
async function loadCurrentSiteSettings() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const hostname = new URL(tab.url).hostname;
    elements.siteName.textContent = hostname;

    const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
    elements.siteToggle.checked = !disabledSites.includes(hostname);
  } catch (error) {
    console.error('Error loading site settings:', error);
  }
}

// Toggle site enablement
async function toggleSiteEnablement() {
  try {
    if (!currentHostname) return;
    
    const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
    
    if (elements.siteToggle.checked) {
      // Enable site
      const newDisabledSites = disabledSites.filter(site => site !== currentHostname);
      await chrome.storage.local.set({ disabledSites: newDisabledSites });
    } else {
      // Disable site
      if (!disabledSites.includes(currentHostname)) {
        disabledSites.push(currentHostname);
        await chrome.storage.local.set({ disabledSites });
      }
    }

    // Notify content script
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'toggleEnabled',
        enabled: elements.siteToggle.checked
      });
    }
  } catch (error) {
    console.error('Error toggling site:', error);
    // Revert toggle state on error
    elements.siteToggle.checked = !elements.siteToggle.checked;
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
  
  // Temperature slider
  elements.temperatureInput.addEventListener('input', (e) => {
    elements.temperatureValue.textContent = e.target.value;
    updateTemperatureDescription(e.target.value);
  });
  
  // Save style button
  elements.saveStyleBtn.addEventListener('click', async () => {
    const style = {
      tone: elements.toneSelect.value,
      temperature: elements.temperatureInput.value
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
    // Reset to original values
    const style = await storage.getStyleForSite(currentHostname);
    elements.toneSelect.value = style.tone || 'professional';
    elements.temperatureInput.value = style.temperature || '0.7';
    elements.temperatureValue.textContent = style.temperature || '0.7';
    updateTemperatureDescription(style.temperature || '0.7');
    
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
  
  // Site toggle
  elements.siteToggle.addEventListener('change', toggleSiteEnablement);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init); 