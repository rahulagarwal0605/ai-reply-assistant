import { storage } from '../utils/storage.js';
import { LLMApiClient } from '../utils/api-client.js';
import { validateApiConfig } from '../utils/llm-providers.js';

// Update extension icon based on configuration status
async function updateIcon() {
  const isConfigured = await storage.isConfigured();
  const iconPath = isConfigured ? 
    'src/assets/icons/icon-green-' : 
    'src/assets/icons/icon-red-';
  
  chrome.action.setIcon({
    path: {
      '16': `${iconPath}16.png`,
      '32': `${iconPath}32.png`,
      '48': `${iconPath}48.png`,
      '128': `${iconPath}128.png`
    }
  });
}

// Get style based on scenario
function getScenarioStyle(scenario) {
  const styles = {
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
  
  return styles[scenario] || styles.custom;
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  await updateIcon();
  
  // Set default configuration if not exists
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

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'generateReplies':
          const config = await storage.getConfig();
          if (!config.isConfigured) {
            sendResponse({ error: 'Extension not configured' });
            return;
          }
          
          const client = new LLMApiClient(config);
          
          // Handle playground context differently
          let style;
          if (request.hostname === 'playground.test') {
            style = getScenarioStyle(request.scenario);
          } else {
            style = await storage.getStyleForSite(request.hostname);
          }
          
          // Use provided context for playground, otherwise get from storage
          const context = request.hostname === 'playground.test' 
            ? request.context 
            : await storage.getContext(sender.tab.id);
          
          const replies = await client.generateReplies(
            context,
            request.currentInput,
            style
          );
          
          sendResponse({ replies });
          break;
          
        case 'updateContext':
          // Only store context for non-playground pages
          if (sender.tab && sender.tab.url && !sender.tab.url.includes('playground')) {
            await storage.setContext(sender.tab.id, request.context);
          }
          sendResponse({ success: true });
          break;
          
        case 'validateConfig':
          const validation = await validateApiConfig(
            request.provider,
            request.apiKey,
            request.model
          );
          sendResponse(validation);
          break;
          
        case 'updateIcon':
          await updateIcon();
          sendResponse({ success: true });
          break;
          
        case 'getConfig':
          const currentConfig = await storage.getConfig();
          sendResponse({ config: currentConfig });
          break;
          
        case 'saveConfig':
          await storage.setConfig(request.config);
          await updateIcon();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});

// Clean up context when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await storage.clearContext(tabId);
});

// Update icon on startup
updateIcon(); 