import { storage } from '../utils/storage.js';
import { LLMApiClient } from '../utils/api-client.js';
import { validateApiConfig } from '../utils/llm-providers.js';

// Action types constants
const ACTION_TYPES = {
  GENERATE_REPLIES: 'generateReplies',
  UPDATE_CONTEXT: 'updateContext',
  VALIDATE_CONFIG: 'validateConfig',
  UPDATE_ICON: 'updateIcon',
  GET_CONFIG: 'getConfig',
  SAVE_CONFIG: 'saveConfig'
};

// --- Icon Logic ---
async function updateIcon() {
  const isConfigured = await storage.isConfigured();
  const iconPath = isConfigured ? 
    'src/assets/icons/icon-green-' : 
    'src/assets/icons/icon-red-';
  
  chrome.action.setIcon({
    path: {
      '16': `${iconPath}16.svg`,
      '32': `${iconPath}32.svg`,
      '48': `${iconPath}48.svg`,
      '128': `${iconPath}128.svg`
    }
  });
}

// --- Style Logic ---
function getScenarioStyle(scenario) {
  const styles = {
    professional: { tone: 'professional', length: 'medium', formality: 'formal' },
    slack: { tone: 'casual', length: 'short', formality: 'informal' },
    dating: { tone: 'romantic', length: 'medium', formality: 'casual' },
    customer: { tone: 'empathetic', length: 'medium', formality: 'professional' },
    social: { tone: 'casual', length: 'short', formality: 'very informal' },
    custom: { tone: 'professional', length: 'medium', formality: 'neutral' }
  };
  return styles[scenario] || styles.custom;
}

// --- Message Handler Helper Functions ---
async function handleGenerateReplies(request, sender) {
  const config = await storage.getConfig();
  if (!config.isConfigured) {
    return { error: 'Extension not configured' };
  }

  const client = new LLMApiClient(config);
  const isPlayground = request.hostname === 'playground.test';

  const style = isPlayground
    ? getScenarioStyle(request.scenario)
    : await storage.getStyleForSite(request.hostname);

  const context = isPlayground
    ? request.context
    : await storage.getContext(sender.tab.id);

  const replies = await client.generateReplies(
    context,
    request.currentInput,
    style
  );

  if (!isPlayground) {
    await storage.updateStats(request.hostname);
  }
  return { replies };
}

async function handleUpdateContext(request, sender) {
  if (sender.tab && sender.tab.url && !sender.tab.url.includes('playground')) {
    await storage.setContext(sender.tab.id, request.context);
  }
  return { success: true };
}

async function handleValidateConfig(request) {
  return await validateApiConfig(request.provider, request.apiKey, request.model);
}

async function handleUpdateIcon() {
  await updateIcon();
  return { success: true };
}

async function handleGetConfig() {
  const config = await storage.getConfig();
  return { config };
}

async function handleSaveConfig(request) {
  await storage.setConfig(request.config);
  await updateIcon(); // Ensure icon updates after saving config
  return { success: true };
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let promise;
  switch (request.action) {
    case ACTION_TYPES.GENERATE_REPLIES:
      promise = handleGenerateReplies(request, sender);
      break;
    case ACTION_TYPES.UPDATE_CONTEXT:
      promise = handleUpdateContext(request, sender);
      break;
    case ACTION_TYPES.VALIDATE_CONFIG:
      promise = handleValidateConfig(request);
      break;
    case ACTION_TYPES.UPDATE_ICON:
      promise = handleUpdateIcon();
      break;
    case ACTION_TYPES.GET_CONFIG:
      promise = handleGetConfig();
      break;
    case ACTION_TYPES.SAVE_CONFIG:
      promise = handleSaveConfig(request);
      break;
    default:
      sendResponse({ error: 'Unknown action' });
      return false; // No async response for unknown action
  }

  promise
    .then(sendResponse)
    .catch(error => {
      console.error(`Error handling action ${request.action}:`, error);
      sendResponse({ error: error.message || 'An unexpected error occurred' });
    });

  return true; // Indicates that the response will be sent asynchronously
});

// --- Lifecycle Listeners ---
chrome.runtime.onInstalled.addListener(async () => {
  await updateIcon();
  const config = await storage.getConfig();
  if (!config.styles.default) {
    config.styles.default = {
      tone: 'professional',
      length: 'medium',
      formality: 'neutral'
    };
    await storage.setConfig(config);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await storage.clearContext(tabId);
});

// Update icon on startup
updateIcon(); 