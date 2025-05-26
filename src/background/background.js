import { storage } from '../utils/storage.js';
import { LLMApiClient } from '../utils/api-client.js';
import { validateApiConfig } from '../utils/llm-providers.js';

const ICON_SIZES = [16, 32, 48, 128];
const ICON_PATH_BASE = 'src/assets/icons/';
const PLAYGROUND_HOSTNAME = 'playground.test';

function getIconPaths(status) {
  const prefix = status ? 'icon-green-' : 'icon-red-';
  const paths = {};
  for (const size of ICON_SIZES) {
    paths[size.toString()] = chrome.runtime.getURL(`${ICON_PATH_BASE}${prefix}${size}.png`);
  }
  return paths;
}

// Update extension icon based on configuration status
async function updateIcon() {
  try {
    const isConfigured = await storage.isConfigured();
    await chrome.action.setIcon({
      path: getIconPaths(isConfigured)
    });
  } catch (error) {
    console.error("Error updating icon:", error);
  }
}

const SCENARIO_STYLES = {
  professional: {
    tone: 'professional',
    length: 'medium',
    formality: 'formal'
  },
  slack: {
    tone: 'casual',
    length: 'short',
    formality: 'informal'
  },
  dating: {
    tone: 'romantic',
    length: 'medium',
    formality: 'casual'
  },
  customer: {
    tone: 'empathetic',
    length: 'medium',
    formality: 'professional'
  },
  social: {
    tone: 'casual',
    length: 'short',
    formality: 'very informal'
  },
  custom: {
    tone: 'professional',
    length: 'medium',
    formality: 'neutral'
  }
};

// Get style based on scenario
function getScenarioStyle(scenario) {
  return SCENARIO_STYLES[scenario] || SCENARIO_STYLES.custom;
}

async function handleGenerateReplies(request, sender) {
  const config = await storage.getConfig();
  if (!config.isConfigured) {
    return { error: 'Extension not configured' };
  }

  const client = new LLMApiClient(config);
  let style;
  if (request.hostname === PLAYGROUND_HOSTNAME) {
    style = getScenarioStyle(request.scenario);
  } else {
    style = await storage.getStyleForSite(request.hostname);
  }

  let conversationContext = [];
  if (request.hostname === PLAYGROUND_HOSTNAME) {
    conversationContext = request.context;
  } else {
    // Use advanced setting to determine if context should be used
    // Default to true if the setting is not present (e.g. for older configs)
    const autoDetectContext = (config.advanced && config.advanced.autoDetectContext !== undefined) 
                              ? config.advanced.autoDetectContext 
                              : true; 
    if (autoDetectContext) {
      conversationContext = request.context; // Use context sent from content.js
    } else {
      conversationContext = []; // Context detection disabled by user
    }
  }

  const replies = await client.generateReplies(
    conversationContext, // Use the determined context
    request.currentInput,
    style
  );

  if (request.hostname !== PLAYGROUND_HOSTNAME) {
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
  return await validateApiConfig(
    request.provider,
    request.apiKey,
    request.model
  );
}

async function handleUpdateIcon() {
  await updateIcon();
  return { success: true };
}

async function handleGetConfig() {
  const currentConfig = await storage.getConfig();
  return { config: currentConfig };
}

async function handleSaveConfig(request) {
  await storage.setConfig(request.config);
  await updateIcon();
  return { success: true };
}

const messageActions = {
  generateReplies: handleGenerateReplies,
  updateContext: handleUpdateContext,
  validateConfig: handleValidateConfig,
  updateIcon: handleUpdateIcon,
  getConfig: handleGetConfig,
  saveConfig: handleSaveConfig,
};

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  await updateIcon();
  
  const config = await storage.getConfig();
  // Ensure default style object exists and has all necessary properties
  if (!config.styles.default || 
      typeof config.styles.default.tone === 'undefined' || 
      typeof config.styles.default.temperature === 'undefined' || 
      typeof config.styles.default.formality === 'undefined') {
    
    const fallback = storage.DEFAULT_FALLBACK_STYLE; // Get it once
    config.styles.default = {
      tone: config.styles.default?.tone ?? fallback.tone,
      length: config.styles.default?.length ?? fallback.length, // length might also be useful from fallback
      formality: config.styles.default?.formality ?? fallback.formality,
      temperature: config.styles.default?.temperature ?? fallback.temperature
    };
    await storage.setConfig(config);
  }

  // Inject content script into existing eligible tabs when extension is installed/updated
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) { // Ensure tab.id is not undefined
        injectContentScripts(tab.id, tab.url);
      }
    }
  });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const handler = messageActions[request.action];
      if (handler) {
        const response = await handler(request, sender);
        sendResponse(response);
      } else {
        sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();
  return true; // Keep the message channel open for async response
});

// Clean up context when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await storage.clearContext(tabId);
});

// Update icon on startup
updateIcon();

// Function to inject content scripts
async function injectContentScripts(tabId, tabUrl) {
  // Prevent injection into chrome:// URLs or other restricted pages
  if (!tabUrl || 
      tabUrl.startsWith('chrome://') || 
      tabUrl.startsWith('about:') || 
      tabUrl.startsWith('chrome-extension://')) {
    return;
  }

  try {
    // Check if scripts are already injected to prevent multiple injections
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.aiReplyAssistantInjected, // Check for a global flag
    });

    if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
      // Inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ["src/styles/content.css"]
      });

      // Inject JavaScript module using dynamic import
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (contentScriptPath) => {
          // This function is executed in the content script environment
          import(contentScriptPath)
            .then(() => {
              // console.log('content.js loaded successfully via dynamic import().');
              // You might need to set the window.aiReplyAssistantInjected flag here too,
              // or call an initialization function from the imported module.
              // For now, successful import is logged from the module itself if it runs.
            })
            .catch(err => {
              console.error('Error dynamically importing content.js:', err.message, err.stack);
              // If the import itself fails, the original error might appear here.
            });
        },
        args: [chrome.runtime.getURL("src/content/content.js")]
        // world: "MAIN" // Optional: consider if MAIN world is needed, usually ISOLATED is fine for content scripts
      });
      
      // Set a flag to indicate injection attempt. Actual module load success depends on the import() above.
      // Note: If content.js itself sets a flag upon successful execution, that's more reliable.
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { window.aiReplyAssistantInjectedAttempted = true; },
      });
    } else {
      // console.log('AI Reply Assistant already injected into:', tabUrl);
    }
  } catch (error) {
    console.error(`Failed to inject content script into ${tabUrl}:`, error);
    // Potentially handle specific errors like "Cannot access chrome:// URLs" more gracefully
    if (error.message.includes("Cannot access a chrome:// URL") || 
        error.message.includes("No tab with id") ||
        error.message.includes("Frame with ID 0 is showing error page") ||
        error.message.includes("Extension context invalidated")) { // Added more common, ignorable errors
        // Do nothing, expected for certain URLs or if tab closes during async ops
    } else {
        // Re-throw other errors or log more detailed info
        console.error('Unhandled injection error:', error);
    }
  }
}

// Inject content scripts on tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Ensure the tab is fully loaded and has a URL
    injectContentScripts(tabId, tab.url);
  }
}); 