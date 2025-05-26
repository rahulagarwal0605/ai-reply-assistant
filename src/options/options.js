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
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  resetBtn: document.getElementById('resetBtn')
};

// Initialize
async function init() {
  await loadConfiguration();
  setupEventListeners();
}

// Load saved configuration
async function loadConfiguration() {
  const config = await storage.getConfig();
  
  // API Configuration
  if (config.provider) {
    elements.providerSelect.value = config.provider;
    await updateProviderUI(config.provider);
  }
  
  if (config.apiKey) {
    elements.apiKeyInput.value = config.apiKey;
  }
  
  if (config.model) {
    elements.modelSelect.value = config.model;
  }
  
  elements.temperatureInput.value = config.temperature || 0.7;
  elements.temperatureValue.textContent = config.temperature || 0.7;
  
  // Default styles
  const defaultStyle = config.styles.default || {};
  elements.defaultToneSelect.value = defaultStyle.tone || 'professional';
  elements.defaultLengthSelect.value = defaultStyle.length || 'medium';
}

// Setup event listeners
function setupEventListeners() {
  // Provider change
  elements.providerSelect.addEventListener('change', async (e) => {
    await updateProviderUI(e.target.value);
  });
  
  // API key visibility toggle
  elements.toggleApiKey.addEventListener('click', () => {
    const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
    elements.apiKeyInput.type = type;
  });
  
  // Temperature slider
  elements.temperatureInput.addEventListener('input', (e) => {
    elements.temperatureValue.textContent = e.target.value;
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
}

// Update UI based on selected provider
async function updateProviderUI(provider) {
  if (!provider) {
    elements.modelGroup.style.display = 'none';
    elements.customUrlGroup.style.display = 'none';
    return;
  }
  
  const providerConfig = LLM_PROVIDERS[provider];
  
  // Show/hide custom URL field
  elements.customUrlGroup.style.display = provider === 'custom' ? 'block' : 'none';
  
  // Update model dropdown
  elements.modelSelect.innerHTML = '<option value="">Select a model...</option>';
  
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
  
  // Validate inputs
  if (!provider) {
    showAlert('Please select a provider', 'error');
    return;
  }
  
  if (!apiKey) {
    showAlert('Please enter your API key', 'error');
    return;
  }
  
  if (provider !== 'custom' && !model) {
    showAlert('Please select a model', 'error');
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
      config.customUrl = elements.customUrlInput.value.trim();
    }
    
    await storage.setConfig(config);
    
    // Update extension icon
    await chrome.runtime.sendMessage({ action: 'updateIcon' });
    
    showAlert('Configuration saved successfully!', 'success');
  } catch (error) {
    showAlert('Failed to save configuration: ' + error.message, 'error');
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
  
  if (!provider || !apiKey || (provider !== 'custom' && !model)) {
    showAlert('Please complete the configuration first', 'warning');
    return;
  }
  
  elements.testConfigBtn.classList.add('loading');
  elements.testConfigBtn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'validateConfig',
      provider,
      apiKey,
      model
    });
    
    if (response.valid) {
      showAlert('Connection successful! Your configuration is valid.', 'success');
    } else {
      showAlert('Connection failed: ' + response.error, 'error');
    }
  } catch (error) {
    showAlert('Test failed: ' + error.message, 'error');
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
    config.styles.default = {
      tone,
      length,
      formality: 'neutral'
    };
    
    await storage.setConfig(config);
    
    showAlert('Default style saved!', 'success');
    
    // Animate button
    elements.saveStyleBtn.textContent = '✓ Saved';
    setTimeout(() => {
      elements.saveStyleBtn.textContent = 'Save Default Style';
    }, 2000);
  } catch (error) {
    showAlert('Failed to save style: ' + error.message, 'error');
  }
}

// Export configuration
async function exportConfiguration() {
  const config = await storage.getConfig();
  
  // Remove sensitive data from export
  const exportData = {
    ...config,
    apiKey: '' // Don't export API key
  };
  
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
  
  showAlert('Configuration exported (API key excluded for security)', 'success');
}

// Import configuration
async function importConfiguration(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedConfig = JSON.parse(text);
    
    // Merge with existing config
    const currentConfig = await storage.getConfig();
    const mergedConfig = {
      ...currentConfig,
      ...importedConfig,
      apiKey: currentConfig.apiKey // Keep existing API key
    };
    
    await storage.setConfig(mergedConfig);
    await loadConfiguration();
    
    showAlert('Configuration imported successfully!', 'success');
  } catch (error) {
    showAlert('Failed to import configuration: ' + error.message, 'error');
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
    
    showAlert('All settings have been reset', 'success');
    
    // Reload page after delay
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    showAlert('Failed to reset settings: ' + error.message, 'error');
  }
}

// Show alert message
function showAlert(message, type) {
  elements.configAlert.textContent = message;
  elements.configAlert.className = `alert ${type}`;
  elements.configAlert.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.configAlert.style.display = 'none';
  }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init); 