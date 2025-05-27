// LLM Provider Configurations
export const LLM_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.85,
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
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
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
      temperature: 0.85,
      max_tokens: 150
    }
  },
  
  google: {
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      // Gemini 2.0 Series
      { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash 001' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite-001', name: 'Gemini 2.0 Flash-Lite 001' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite' },

      // Gemini 1.5 Series
      { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro 002' },
      { id: 'gemini-1.5-pro-001', name: 'Gemini 1.5 Pro 001' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash-8b-001', name: 'Gemini 1.5 Flash-8B 001' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
      { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash 002' },
      { id: 'gemini-1.5-flash-001', name: 'Gemini 1.5 Flash 001' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },

      // Gemma Series
      { id: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
      { id: 'gemma-3-12b-it', name: 'Gemma 3 12B' },
      { id: 'gemma-3-4b-it', name: 'Gemma 3 4B' },
      { id: 'gemma-3-1b-it', name: 'Gemma 3 1B' },
      { id: 'gemma-3n-e4b-it', name: 'Gemma 3n E4B' }
    ],
    headers: () => ({
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.85,
      maxOutputTokens: 150,
      topP: 1,
      topK: 1
    }
  },
  
  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium' },
      { id: 'mistral-small-latest', name: 'Mistral Small' }
    ],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.85,
      max_tokens: 150,
      top_p: 1
    }
  },

  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'deepseek-coder-14b', name: 'DeepCoder 14B' },
      { id: 'deephermes-3-llama-3-8b', name: 'DeepHermes 3 Llama 3 8B' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
      { id: 'deepseek-v3', name: 'DeepSeek V3' },
      { id: 'qwen/qwen3-14b', name: 'Qwen 3 14B' },
      { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' }
    ],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/rahulagarwal0605/ai-reply-assistant',
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.85,
      max_tokens: 150
    }
  },

  cloudflare: {
    name: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/ai/run',
    models: [
      { id: 'gemma-3-12b-instruct', name: 'Gemma 3 12B Instruct' },
      { id: 'gemma-7b-instruct', name: 'Gemma 7B Instruct' },
      { id: 'llama-3-8b-instruct', name: 'Llama 3 8B Instruct' },
      { id: 'llama-3-2-11b-vision-instruct', name: 'Llama 3.2 11B Vision' },
      { id: 'mistral-7b-instruct-v0.2', name: 'Mistral 7B Instruct v0.2' },
      { id: 'mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.1 24B' }
    ],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.85,
      max_tokens: 150
    }
  },

  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      { id: 'llama-3-70b-instruct', name: 'Llama 3 70B Instruct' },
      { id: 'llama-3-8b-instruct', name: 'Llama 3 8B Instruct' },
      { id: 'mistral-7b-instruct', name: 'Mistral 7B Instruct' },
      { id: 'qwen-72b-instruct', name: 'Qwen 72B Instruct' }
    ],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    defaultParams: {
      temperature: 0.85,
      max_tokens: 150
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
export async function validateApiConfig(providerId, apiKey, modelId) {
  try {
    if (!providerId || !apiKey || !modelId) {
      return { valid: false, error: 'Missing configuration: Provider, API Key, and Model are required.' };
    }

    const providerConfig = getProvider(providerId);
    if (!providerConfig) {
      return { valid: false, error: `Invalid provider: ${providerId}` };
    }

    // For custom provider, model validation might be different or skipped if models are user-defined dynamically
    if (providerId !== 'custom') {
        const modelExists = providerConfig.models.some(m => m.id === modelId);
        if (!modelExists) {
            return { valid: false, error: `Model ${modelId} not found for provider ${providerConfig.name}.` };
        }
    }
    
    // Basic API key format check (can be provider-specific if needed)
    if (apiKey.length < 10) { // Arbitrary minimum length
      return { valid: false, error: 'Invalid API key format (too short).' };
    }
    
    // TODO: Consider adding an actual test API call for deeper validation if feasible
    // For example, fetching models from the provider if an endpoint exists.
    // For now, these checks cover basic configuration integrity.

    return { valid: true };
  } catch (error) {
    console.error(`Error validating API config for ${providerId}:`, error);
    return { valid: false, error: error.message || 'An unexpected error occurred during validation.' };
  }
} 