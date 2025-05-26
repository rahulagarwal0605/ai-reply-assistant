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
  console.log('Popup init started (v2 logic)'); 
  const isConfigured = await storage.isConfigured();
  updateStatus(isConfigured);
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  console.log('Current tab (v2 logic):', currentTab);
  
  if (tab && tab.url) {
    console.log('Tab URL found (v2 logic):', tab.url);
    try {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      elements.siteName.textContent = currentHostname;
      console.log('Hostname extracted (v2 logic):', currentHostname);
      
      let style = await storage.getStyleForSite(currentHostname);
      
      if (!style || typeof style.temperature === 'undefined' || typeof style.tone === 'undefined' || typeof style.formality === 'undefined') {
        console.log('Style or its properties undefined, applying defaults (v2 logic). Initial site style:', JSON.stringify(style));
        const defaultConfig = await storage.getConfig();
        const globalDefaultStyleFromConfig = defaultConfig?.styles?.default;
        console.log('Global default style from config (v2 logic):', JSON.stringify(globalDefaultStyleFromConfig));

        let finalTone = storage.DEFAULT_FALLBACK_STYLE.tone;
        let finalTemp = storage.DEFAULT_FALLBACK_STYLE.temperature;
        let finalFormality = storage.DEFAULT_FALLBACK_STYLE.formality;

        if (globalDefaultStyleFromConfig) {
            finalTone = globalDefaultStyleFromConfig.tone !== undefined ? globalDefaultStyleFromConfig.tone : finalTone;
            finalTemp = globalDefaultStyleFromConfig.temperature !== undefined ? globalDefaultStyleFromConfig.temperature : finalTemp;
            finalFormality = globalDefaultStyleFromConfig.formality !== undefined ? globalDefaultStyleFromConfig.formality : finalFormality;
        }
        
        if (style) { 
            style.tone = style.tone !== undefined ? style.tone : finalTone;
            style.temperature = style.temperature !== undefined ? style.temperature : finalTemp;
            style.formality = style.formality !== undefined ? style.formality : finalFormality;
        } else { 
            style = {
                tone: finalTone,
                temperature: finalTemp,
                formality: finalFormality
            };
        }
        console.log('Final resolved style (v2 logic):', JSON.stringify(style));
      }

      elements.toneSelect.value = style.tone;
      elements.temperatureInput.value = Number(style.temperature);
      elements.temperatureValue.textContent = Number(style.temperature).toFixed(1);
      updateTemperatureDescription(String(style.temperature));

      const disabledSites = await storage.getDisabledSites();
      elements.siteToggle.checked = !disabledSites.includes(currentHostname);
      elements.siteSection.style.display = 'block'; // Explicitly show if successful
      console.log('Site section displayed (v2 logic)');

    } catch (e) {
      console.error('Error processing tab URL in init (v2 logic):', e, e.stack);
      elements.siteName.textContent = 'N/A';
      elements.siteSection.style.display = 'none';
      console.log('Site section hidden due to URL processing error (v2 logic)');
    }
  } else {
    elements.siteName.textContent = 'N/A';
    elements.siteSection.style.display = 'none';
    console.log('Site section hidden due to no tab or no tab.url (v2 logic)');
  }
  
  await loadStats();
  setupEventListeners();
  console.log('Popup init finished (v2 logic)');
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

// Toggle site enablement
async function toggleSiteEnablement() {
  if (!currentHostname) return;
  
  try {
    let disabledSites = await storage.getDisabledSites();
    
    if (elements.siteToggle.checked) {
      // Enable site
      disabledSites = disabledSites.filter(site => site !== currentHostname);
    } else {
      // Disable site
      if (!disabledSites.includes(currentHostname)) {
        disabledSites.push(currentHostname);
      }
    }
    await storage.setDisabledSites(disabledSites);

    // Notify content script
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'toggleEnabled',
        enabled: elements.siteToggle.checked
      });
    }
  } catch (error) {
    console.error('Error toggling site:', error);
    // Revert toggle state on error by re-reading from storage
    const originalDisabledSites = await storage.getDisabledSites();
    elements.siteToggle.checked = !originalDisabledSites.includes(currentHostname);
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
    const tempValue = parseFloat(e.target.value).toFixed(1);
    elements.temperatureValue.textContent = tempValue;
    updateTemperatureDescription(tempValue);
  });
  
  // Save style button
  elements.saveStyleBtn.addEventListener('click', async () => {
    const styleToSave = {
      tone: elements.toneSelect.value,
      temperature: parseFloat(elements.temperatureInput.value),
      formality: (await storage.getStyleForSite(currentHostname))?.formality || storage.DEFAULT_FALLBACK_STYLE.formality 
    };
    
    await storage.setStyleForSite(currentHostname, styleToSave);
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
    let style = await storage.getStyleForSite(currentHostname);
    console.log('Cancel button: Initial site style (v2 logic):', JSON.stringify(style));

    if (!style || typeof style.temperature === 'undefined' || typeof style.tone === 'undefined' || typeof style.formality === 'undefined') {
        const defaultConfig = await storage.getConfig(); 
        const globalDefaultStyleFromConfig = defaultConfig?.styles?.default;
        console.log('Cancel button: Global default style from config (v2 logic):', JSON.stringify(globalDefaultStyleFromConfig));

        let finalTone = storage.DEFAULT_FALLBACK_STYLE.tone;
        let finalTemp = storage.DEFAULT_FALLBACK_STYLE.temperature;
        let finalFormality = storage.DEFAULT_FALLBACK_STYLE.formality;

        if (globalDefaultStyleFromConfig) {
            finalTone = globalDefaultStyleFromConfig.tone !== undefined ? globalDefaultStyleFromConfig.tone : finalTone;
            finalTemp = globalDefaultStyleFromConfig.temperature !== undefined ? globalDefaultStyleFromConfig.temperature : finalTemp;
            finalFormality = globalDefaultStyleFromConfig.formality !== undefined ? globalDefaultStyleFromConfig.formality : finalFormality;
        }

        if (style) { 
            style.tone = style.tone !== undefined ? style.tone : finalTone;
            style.temperature = style.temperature !== undefined ? style.temperature : finalTemp;
            style.formality = style.formality !== undefined ? style.formality : finalFormality;
        } else {
            style = {
                tone: finalTone,
                temperature: finalTemp,
                formality: finalFormality
            };
        }
        console.log('Cancel button: Final resolved style (v2 logic):', JSON.stringify(style));
    }

    elements.toneSelect.value = style.tone;
    elements.temperatureInput.value = Number(style.temperature);
    elements.temperatureValue.textContent = Number(style.temperature).toFixed(1);
    updateTemperatureDescription(String(style.temperature));
    
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