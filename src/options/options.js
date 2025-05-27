// Options page script
import { storage } from '../utils/storage.js';
import { LLM_PROVIDERS } from '../utils/llm-providers.js';

// DOM elements
const elements = {
  providerSelect: document.getElementById('providerSelect'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleApiKey: document.getElementById('toggleApiKey'),
  modelSelect: document.getElementById('modelSelect'),
  modelGroup: document.getElementById('modelGroup'),
  customUrlInput: document.getElementById('customUrlInput'),
  customUrlGroup: document.getElementById('customUrlGroup'),
  temperatureInput: document.getElementById('temperatureInput'),
  temperatureValue: document.getElementById('temperatureValue'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  testConfigBtn: document.getElementById('testConfigBtn'),
  configAlert: document.getElementById('configAlert'),
  defaultToneSelect: document.getElementById('defaultToneSelect'),
  defaultLengthSelect: document.getElementById('defaultLengthSelect'),
  saveStyleBtn: document.getElementById('saveStyleBtn'),
  styleAlert: document.getElementById('styleAlert'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  resetBtn: document.getElementById('resetBtn'),
  // Advanced Settings Elements
  autoDetectContextCheckbox: document.getElementById('autoDetectContext'),
  showOnFocusCheckbox: document.getElementById('showOnFocus'),
  enableShortcutsCheckbox: document.getElementById('enableShortcuts'),
  debounceDelayInput: document.getElementById('debounceDelay'),
  advancedSettingsAlert: document.getElementById('advancedSettingsAlert'),
  saveAdvancedBtn: document.createElement('button') // Placeholder, will be created if not in HTML
};

// Ensure saveAdvancedBtn exists or create it dynamically if not in HTML
if (!document.getElementById('saveAdvancedBtn')) {
    const advancedSection = document.querySelector('#autoDetectContext')?.closest('.card');
    if (advancedSection) {
        const formActions = advancedSection.querySelector('.form-actions') || document.createElement('div');
        if (!advancedSection.querySelector('.form-actions')) {
            formActions.className = 'form-actions';
            advancedSection.appendChild(formActions);
        }
        elements.saveAdvancedBtn.id = 'saveAdvancedBtn';
        elements.saveAdvancedBtn.textContent = 'Save Advanced Settings';
        elements.saveAdvancedBtn.className = 'btn-primary';
        formActions.appendChild(elements.saveAdvancedBtn);
    }
} else {
    elements.saveAdvancedBtn = document.getElementById('saveAdvancedBtn');
}

// Initialize
async function init() {
  await loadConfiguration();
  setupEventListeners();
  initializeToneDescriptions();
  initializeTemperatureDescriptions();
}

// Load saved configuration
async function loadConfiguration() {
  const config = await storage.getConfig();
  
  // API Configuration
  elements.providerSelect.value = config.provider || '';
  if (config.provider) {
    await updateProviderUI(config.provider);
  }
  
  elements.apiKeyInput.value = config.apiKey || '';
  
  if (config.model) {
    const providerConfig = LLM_PROVIDERS[config.provider];
    if (providerConfig && providerConfig.models.some(m => m.id === config.model)) {
        elements.modelSelect.value = config.model;
    }
  }
  
  elements.customUrlInput.value = config.customUrl || '';
  elements.temperatureInput.value = config.temperature !== undefined ? config.temperature : 0.7;
  elements.temperatureValue.textContent = parseFloat(elements.temperatureInput.value).toFixed(1);
  updateTemperatureDescription(elements.temperatureInput.value);
  
  // Default styles
  const defaultStyle = config.styles?.default || {};
  elements.defaultToneSelect.value = defaultStyle.tone || 'professional';
  elements.defaultLengthSelect.value = defaultStyle.length || 'medium';
  updateToneDescription(elements.defaultToneSelect.value);

  // Load Advanced Settings
  const advanced = config.advanced || {};
  elements.autoDetectContextCheckbox.checked = advanced.autoDetectContext !== undefined ? advanced.autoDetectContext : true;
  elements.showOnFocusCheckbox.checked = advanced.showOnFocus !== undefined ? advanced.showOnFocus : true;
  elements.enableShortcutsCheckbox.checked = advanced.enableShortcuts !== undefined ? advanced.enableShortcuts : true;
  elements.debounceDelayInput.value = advanced.debounceDelay !== undefined ? advanced.debounceDelay : 500;
}

// Setup event listeners
function setupEventListeners() {
  // Provider change
  elements.providerSelect.addEventListener('change', async (e) => {
    await updateProviderUI(e.target.value);
    elements.modelSelect.value = '';
    if (LLM_PROVIDERS[e.target.value]?.models.length > 0) {
        elements.modelSelect.value = LLM_PROVIDERS[e.target.value].models[0].id;
    }
  });
  
  // API key visibility toggle
  elements.toggleApiKey.addEventListener('click', () => {
    const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
    elements.apiKeyInput.type = type;
  });
  
  // Temperature slider
  elements.temperatureInput.addEventListener('input', (e) => {
    elements.temperatureValue.textContent = parseFloat(e.target.value).toFixed(1);
    updateTemperatureDescription(e.target.value);
  });
  
  // Save configuration
  elements.saveConfigBtn.addEventListener('click', saveConfiguration);
  
  // Test configuration
  elements.testConfigBtn.addEventListener('click', testConfiguration);
  
  // Save default style
  elements.saveStyleBtn.addEventListener('click', saveDefaultStyle);
  
  // Export configuration
  elements.exportBtn.addEventListener('click', exportConfiguration);
  
  // Import configuration
  elements.importBtn.addEventListener('click', () => {
    elements.importFile.click();
  });
  
  elements.importFile.addEventListener('change', importConfiguration);
  
  // Reset settings
  elements.resetBtn.addEventListener('click', resetSettings);
  
  // Save Advanced Settings
  if (elements.saveAdvancedBtn) {
    elements.saveAdvancedBtn.addEventListener('click', saveAdvancedSettings);
  }
  
  // Default tone select listener
  elements.defaultToneSelect.addEventListener('change', (e) => {
    updateToneDescription(e.target.value);
  });
}

// Update UI based on selected provider
async function updateProviderUI(provider) {
  elements.modelGroup.style.display = 'none';
  elements.customUrlGroup.style.display = 'none';
  elements.modelSelect.innerHTML = '<option value="">Select a model...</option>';
  
  if (!provider) return;
  
  const providerConfig = LLM_PROVIDERS[provider];
  
  // Show/hide custom URL field
  elements.customUrlGroup.style.display = provider === 'custom' ? 'block' : 'none';
  
  // Update model dropdown
  if (providerConfig && providerConfig.models.length > 0) {
    providerConfig.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      elements.modelSelect.appendChild(option);
    });
    elements.modelGroup.style.display = 'block';
  } else {
    elements.modelGroup.style.display = 'none';
  }
}

// Save configuration
async function saveConfiguration() {
  const provider = elements.providerSelect.value;
  const apiKey = elements.apiKeyInput.value.trim();
  const model = elements.modelSelect.value;
  const temperature = parseFloat(elements.temperatureInput.value);
  const customUrl = elements.customUrlInput.value.trim();
  
  // Validate inputs
  if (!provider) {
    displayAlertOnElement(elements.configAlert, 'Please select a provider', 'error');
    return;
  }
  
  if (!apiKey) {
    displayAlertOnElement(elements.configAlert, 'Please enter your API key', 'error');
    return;
  }
  
  if (provider !== 'custom' && LLM_PROVIDERS[provider]?.models.length > 0 && !model) {
    displayAlertOnElement(elements.configAlert, 'Please select a model for this provider', 'error');
    return;
  }
  
  if (provider === 'custom' && !customUrl) {
    displayAlertOnElement(elements.configAlert, 'Please enter the Custom API Base URL', 'error');
    return;
  }
  
  // Show loading state
  elements.saveConfigBtn.classList.add('loading');
  elements.saveConfigBtn.disabled = true;
  
  try {
    const config = await storage.getConfig();
    config.provider = provider;
    config.apiKey = apiKey;
    config.model = model;
    config.temperature = temperature;
    config.isConfigured = true;
    
    if (provider === 'custom') {
      config.customUrl = customUrl;
    } else {
      delete config.customUrl;
    }
    
    await storage.setConfig(config);
    
    // Update extension icon
    await chrome.runtime.sendMessage({ action: 'updateIcon' });
    
    displayAlertOnElement(elements.configAlert, 'Configuration saved successfully!', 'success');
  } catch (error) {
    displayAlertOnElement(elements.configAlert, 'Failed to save configuration: ' + error.message, 'error');
  } finally {
    elements.saveConfigBtn.classList.remove('loading');
    elements.saveConfigBtn.disabled = false;
  }
}

// Test configuration
async function testConfiguration() {
  const provider = elements.providerSelect.value;
  const apiKey = elements.apiKeyInput.value.trim();
  const model = elements.modelSelect.value;
  const customUrl = elements.customUrlInput.value.trim();
  
  if (!provider || !apiKey || (provider !== 'custom' && LLM_PROVIDERS[provider]?.models.length > 0 && !model)) {
    displayAlertOnElement(elements.configAlert, 'Please complete the API configuration first (Provider, API Key, Model)', 'warning');
    return;
  }
  
  if (provider === 'custom' && !customUrl) {
    displayAlertOnElement(elements.configAlert, 'Please enter the Custom API Base URL for testing', 'warning');
    return;
  }
  
  elements.testConfigBtn.classList.add('loading');
  elements.testConfigBtn.disabled = true;
  
  try {
    const testPayload = { action: 'validateConfig', provider, apiKey, model };
    if (provider === 'custom') {
      testPayload.customUrl = customUrl;
    }
    const response = await chrome.runtime.sendMessage(testPayload);
    
    if (response.valid) {
      displayAlertOnElement(elements.configAlert, 'Connection successful! Your configuration is valid.', 'success');
    } else {
      displayAlertOnElement(elements.configAlert, `Connection failed: ${response.error}`, 'error');
    }
  } catch (error) {
    displayAlertOnElement(elements.configAlert, `Test failed: ${error.message}`, 'error');
  } finally {
    elements.testConfigBtn.classList.remove('loading');
    elements.testConfigBtn.disabled = false;
  }
}

// Save default style
async function saveDefaultStyle() {
  const tone = elements.defaultToneSelect.value;
  const length = elements.defaultLengthSelect.value;
  
  try {
    const config = await storage.getConfig();
    if (!config.styles) config.styles = {};
    config.styles.default = {
      tone,
      length,
      formality: 'neutral'
    };
    
    await storage.setConfig(config);
    
    displayAlertOnElement(elements.styleAlert, 'Default style saved!', 'success');
    
    // Animate button
    elements.saveStyleBtn.textContent = '✓ Saved';
    setTimeout(() => {
      elements.saveStyleBtn.textContent = 'Save Default Style';
    }, 2000);
  } catch (error) {
    displayAlertOnElement(elements.styleAlert, 'Failed to save style: ' + error.message, 'error');
  }
}

// Save Advanced Settings
async function saveAdvancedSettings() {
  const advanced = {
    autoDetectContext: elements.autoDetectContextCheckbox.checked,
    showOnFocus: elements.showOnFocusCheckbox.checked,
    enableShortcuts: elements.enableShortcutsCheckbox.checked,
    debounceDelay: parseInt(elements.debounceDelayInput.value, 10)
  };

  if (isNaN(advanced.debounceDelay) || advanced.debounceDelay < 100 || advanced.debounceDelay > 2000) {
    displayAlertOnElement(elements.advancedSettingsAlert, 'Invalid debounce delay. Must be between 100 and 2000 ms.', 'error');
    return;
  }

  try {
    const config = await storage.getConfig();
    config.advanced = advanced;
    await storage.setConfig(config);
    displayAlertOnElement(elements.advancedSettingsAlert, 'Advanced settings saved!', 'success');
    // Animate button if it's a real button
    if (elements.saveAdvancedBtn && elements.saveAdvancedBtn.textContent) {
        elements.saveAdvancedBtn.textContent = '✓ Saved';
        setTimeout(() => { elements.saveAdvancedBtn.textContent = 'Save Advanced Settings'; }, 2000);
    }
  } catch (error) {
    displayAlertOnElement(elements.advancedSettingsAlert, 'Failed to save advanced settings: ' + error.message, 'error');
  }
}

// Export configuration
async function exportConfiguration() {
  const config = await storage.getConfig();
  
  // Remove sensitive data from export
  const exportData = { ...config, apiKey: '' };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-reply-assistant-config.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  displayAlertOnElement(elements.configAlert, 'Configuration exported (API key excluded for security)', 'success');
}

// Import configuration
async function importConfiguration(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedConfig = JSON.parse(text);
    
    const currentConfig = await storage.getConfig();
    const mergedConfig = { ...currentConfig, ...importedConfig, apiKey: currentConfig.apiKey || importedConfig.apiKey || '' };
    
    // Ensure nested objects like styles and advanced are merged, not just replaced if only partially in importedConfig
    if (importedConfig.styles) {
        mergedConfig.styles = { ...(currentConfig.styles || {}), ...importedConfig.styles };
    }
    if (importedConfig.advanced) {
        mergedConfig.advanced = { ...(currentConfig.advanced || {}), ...importedConfig.advanced };
    }

    await storage.setConfig(mergedConfig);
    await loadConfiguration();
    
    displayAlertOnElement(elements.configAlert, 'Configuration imported successfully!', 'success');
  } catch (error) {
    displayAlertOnElement(elements.configAlert, 'Failed to import configuration: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

// Reset all settings
async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.clear();
    await chrome.runtime.sendMessage({ action: 'updateIcon' });
    
    displayAlertOnElement(elements.configAlert, 'All settings have been reset', 'success');
    
    // Reload page after delay
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    displayAlertOnElement(elements.configAlert, 'Failed to reset settings: ' + error.message, 'error');
  }
}

// Show alert message
function displayAlertOnElement(alertElement, message, type) {
  if (!alertElement) {
    console.warn('Alert element not found for message:', message);
    // Fallback to general config alert if a specific one isn't found,
    // or handle error appropriately. For now, just log and try configAlert.
    alertElement = elements.configAlert; 
    if (!alertElement) return; // If even configAlert is not found, exit.
  }
  alertElement.textContent = message;
  alertElement.className = `alert ${type}`;
  alertElement.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    alertElement.style.display = 'none';
  }, 5000);
}

// Initialize tone descriptions
function initializeToneDescriptions() {
  // This is now handled by the event listener in setupEventListeners and loadConfiguration
}

// Update visible tone description
function updateToneDescription(tone) {
  const descriptions = document.querySelectorAll('.tone-description .description');
  descriptions.forEach(desc => {
    desc.classList.remove('active');
    if (desc.classList.contains(tone)) {
      desc.classList.add('active');
    }
  });
}

// Initialize temperature descriptions
function initializeTemperatureDescriptions() {
  // This is now handled by the event listener in setupEventListeners and loadConfiguration
}

// Update visible temperature description
function updateTemperatureDescription(value) {
  const descriptions = document.querySelectorAll('.temperature-description .description');
  descriptions.forEach(desc => desc.classList.remove('active'));
  
  const temp = parseFloat(value);
  if (temp <= 0.3) {
    document.querySelector('.temperature-description .description.focused').classList.add('active');
  } else if (temp <= 0.7) {
    document.querySelector('.temperature-description .description.balanced').classList.add('active');
  } else {
    document.querySelector('.temperature-description .description.creative').classList.add('active');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  init();
  initializeTemperatureDescriptions();
}); 