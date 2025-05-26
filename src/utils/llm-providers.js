// LLM Provider Configurations
export const LLM_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.7,
      max_tokens: 150,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    }
  },
  
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
    ],
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.7,
      max_tokens: 150
    }
  },
  
  google: {
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
    ],
    headers: () => ({
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.7,
      maxOutputTokens: 150,
      topP: 1,
      topK: 1
    }
  },
  
  custom: {
    name: 'Custom API',
    baseUrl: '',
    models: [],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.7,
      max_tokens: 150
    }
  }
};

// Get provider configuration
export function getProvider(providerId) {
  return LLM_PROVIDERS[providerId] || null;
}

// Validate API configuration
export async function validateApiConfig(provider, apiKey, model) {
  try {
    // Simple validation - could be expanded with actual API calls
    if (!provider || !apiKey || !model) {
      return { valid: false, error: 'Missing configuration' };
    }
    
    if (apiKey.length < 10) {
      return { valid: false, error: 'Invalid API key format' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
} 