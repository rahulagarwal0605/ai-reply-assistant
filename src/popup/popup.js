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
  const isConfigured = await storage.isConfigured();
  updateStatus(isConfigured);
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      elements.siteName.textContent = currentHostname;
      
      let style = await storage.getStyleForSite(currentHostname);
      
      if (!style || typeof style.temperature === 'undefined' || typeof style.tone === 'undefined' || typeof style.formality === 'undefined') {
        const defaultConfig = await storage.getConfig();
        const globalDefaultStyleFromConfig = defaultConfig?.styles?.default;

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
      }

      elements.toneSelect.value = style.tone;
      elements.temperatureInput.value = Number(style.temperature);
      elements.temperatureValue.textContent = Number(style.temperature).toFixed(1);
      updateTemperatureDescription(String(style.temperature));

      const disabledSites = await storage.getDisabledSites();
      elements.siteToggle.checked = !disabledSites.includes(currentHostname);
      elements.siteSection.style.display = 'block';

    } catch (e) {
      console.error('Error processing tab URL in init:', e, e.stack);
      elements.siteName.textContent = 'N/A';
      elements.siteSection.style.display = 'none';
    }
  } else {
    elements.siteName.textContent = 'N/A';
    elements.siteSection.style.display = 'none';
  }
  
  await loadStats();
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
    elements.suggestionsCount.textContent = stats.suggestions || 0;
    const activeSites = Object.keys(stats.sites || {}).length;
    elements.sitesCount.textContent = activeSites;
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
      disabledSites = disabledSites.filter(site => site !== currentHostname);
    } else {
      if (!disabledSites.includes(currentHostname)) {
        disabledSites.push(currentHostname);
      }
    }
    await storage.setDisabledSites(disabledSites);
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'toggleEnabled',
        enabled: elements.siteToggle.checked
      });
    }
  } catch (error) {
    console.error('Error toggling site:', error);
    const originalDisabledSites = await storage.getDisabledSites();
    elements.siteToggle.checked = !originalDisabledSites.includes(currentHostname);
  }
}

// Setup event listeners
function setupEventListeners() {
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  elements.configureBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  elements.editStyleBtn.addEventListener('click', () => {
    elements.styleEditor.style.display = 'block';
    elements.editStyleBtn.style.display = 'none';
  });
  elements.temperatureInput.addEventListener('input', (e) => {
    const tempValue = parseFloat(e.target.value).toFixed(1);
    elements.temperatureValue.textContent = tempValue;
    updateTemperatureDescription(tempValue);
  });
  elements.saveStyleBtn.addEventListener('click', async () => {
    const styleToSave = {
      tone: elements.toneSelect.value,
      temperature: parseFloat(elements.temperatureInput.value),
      formality: (await storage.getStyleForSite(currentHostname))?.formality || storage.DEFAULT_FALLBACK_STYLE.formality 
    };
    await storage.setStyleForSite(currentHostname, styleToSave);
    elements.styleEditor.style.display = 'none';
    elements.editStyleBtn.style.display = 'block';
    elements.saveStyleBtn.textContent = '✓ Saved';
    setTimeout(() => {
      elements.saveStyleBtn.textContent = 'Save';
    }, 1500);
  });
  elements.cancelStyleBtn.addEventListener('click', async () => {
    let style = await storage.getStyleForSite(currentHostname);
    if (!style || typeof style.temperature === 'undefined' || typeof style.tone === 'undefined' || typeof style.formality === 'undefined') {
        const defaultConfig = await storage.getConfig(); 
        const globalDefaultStyleFromConfig = defaultConfig?.styles?.default;
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
    }
    elements.toneSelect.value = style.tone;
    elements.temperatureInput.value = Number(style.temperature);
    elements.temperatureValue.textContent = Number(style.temperature).toFixed(1);
    updateTemperatureDescription(String(style.temperature));
    elements.styleEditor.style.display = 'none';
    elements.editStyleBtn.style.display = 'block';
  });
  elements.playgroundLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/playground/index.html')
    });
  });
  elements.siteToggle.addEventListener('change', toggleSiteEnablement);
}

document.addEventListener('DOMContentLoaded', init); 