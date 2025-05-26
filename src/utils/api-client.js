import { getProvider } from './llm-providers.js';

// Generic API client for LLM providers
export class LLMApiClient {
  constructor(config) {
    this.provider = getProvider(config.provider);
    this.apiKey = config.apiKey;
    this.model = config.model;
    // Default temperature hierarchy: user config -> provider default -> hardcoded fallback
    this.temperature = config.temperature || (this.provider && this.provider.defaultParams && this.provider.defaultParams.temperature) || 0.7;
    // Store default max_tokens from provider config, or a general fallback
    this.defaultMaxTokens = (this.provider && this.provider.defaultParams && (this.provider.defaultParams.max_tokens || this.provider.defaultParams.maxOutputTokens)) || 300;
  }

  async _handleApiResponse(response, providerName, successParser, errorMapping) {
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If error response is not JSON, use text
        errorData = { error: { message: await response.text() } };
      }

      // Use provider-specific error mapping
      for (const key in errorMapping) {
        const path = key.split('.'); // e.g., error.code
        let current = errorData;
        for (const p of path) {
          current = current ? current[p] : undefined;
        }
        if (current === errorMapping[key].value) {
          throw new Error(errorMapping[key].message);
        }
      }
      // Generic error
      const errorMessage = errorData.error?.message || errorData.error?.type || response.statusText || 'Unknown API error';
      throw new Error(`${providerName} API error: ${errorMessage}`);
    }

    const data = await response.json();
    try {
      return successParser(data);
    } catch (e) {
      console.error(`Failed to parse ${providerName} response:`, data);
      throw new Error('Invalid response format from API. Please try again.');
    }
  }

  _getProviderRequestConfig(providerName, prompt, temperature, maxTokens) {
    const commonSystemContent = 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.';
    const commonUserPrompt = prompt;
    const jsonOutputInstruction = '\\n\\nIMPORTANT: Respond ONLY with a valid JSON object containing a "replies" array. No markdown, no explanation, just the JSON object.';

    switch (providerName) {
      case 'OpenAI':
      case 'Mistral AI':
      case 'OpenRouter':
      case 'Together AI':
        return {
          url: `${this.provider.baseUrl}/chat/completions`,
          options: {
            method: 'POST',
            headers: this.provider.headers(this.apiKey),
            body: JSON.stringify({
              model: this.model,
              messages: [
                { role: 'system', content: commonSystemContent },
                { role: 'user', content: commonUserPrompt }
              ],
              temperature: temperature,
              max_tokens: maxTokens,
              response_format: { type: 'json_object' }
            })
          },
          errorMapping: { // Maps specific error details to user-friendly messages
            'error.code': { value: 'invalid_api_key', message: `Invalid API key. Please check your ${providerName} API key in settings.` },
            'error.type': { value: 'invalid_request_error', message: `Invalid API key. Please check your ${providerName} API key in settings.` }, // OpenAI can use this for key issues
            'error.code': { value: 'insufficient_quota', message: `API quota exceeded. Please check your ${providerName} account usage.` }
          },
          successParser: (data) => JSON.parse(data.choices[0].message.content).replies || []
        };
      // Other provider configs would go here
      default:
        return null; // Should not happen if provider name is valid
    }
  }
  
  async generateReplies(context, currentInput, style) {
    try {
      const temperature = style.temperature ? parseFloat(style.temperature) : this.temperature;
      const maxTokens = this.defaultMaxTokens;
      const prompt = this.buildPrompt(context, currentInput, style);

      const providerName = this.provider.name;
      const requestConfig = this._getProviderRequestConfig(providerName, prompt, temperature, maxTokens);

      if (requestConfig) {
        const { url, options, errorMapping, successParser } = requestConfig;
        const response = await fetch(url, options);
        return await this._handleApiResponse(response, providerName, successParser, errorMapping);
      }

      // Fallback to individual methods if not yet migrated to _getProviderRequestConfig
      switch (providerName) {
        // case 'OpenAI': // Now handled by _getProviderRequestConfig
        //   return await this.callOpenAI(prompt, temperature, maxTokens);
        case 'Anthropic':
          return await this.callAnthropic(prompt, temperature, maxTokens);
        case 'Google AI':
          return await this.callGoogleAI(prompt, temperature, maxTokens);
        // case 'Mistral AI': // Example: if Mistral was also migrated
        // case 'OpenRouter':
        // case 'Together AI':
        //   const mistralConfig = this._getProviderRequestConfig('Mistral AI', prompt, temperature, maxTokens);
        //   const mistralResponse = await fetch(mistralConfig.url, mistralConfig.options);
        //   return await this._handleApiResponse(mistralResponse, 'Mistral AI', mistralConfig.successParser, mistralConfig.errorMapping);
        case 'Cloudflare Workers AI':
          return await this.callCloudflare(prompt, temperature, maxTokens);
        default: // Covers 'Custom API' and any not yet refactored explicitly
          if (this.provider.name === 'Custom API') {
             return await this.callCustomAPI(prompt, temperature, maxTokens);
          } else if (this.provider.name === 'Mistral AI' || this.provider.name === 'OpenRouter' || this.provider.name === 'Together AI') {
            // Temporary catch-all for OpenAI-like APIs already covered by the _getProviderRequestConfig structure
            const genericOpenAIStyleConfig = this._getProviderRequestConfig(this.provider.name, prompt, temperature, maxTokens);
             if (genericOpenAIStyleConfig) {
                const resp = await fetch(genericOpenAIStyleConfig.url, genericOpenAIStyleConfig.options);
                return await this._handleApiResponse(resp, this.provider.name, genericOpenAIStyleConfig.successParser, genericOpenAIStyleConfig.errorMapping);
            }
          }
          throw new Error(`Unsupported or not-yet-refactored provider: ${this.provider.name}`);
      }
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      console.error('API Error in generateReplies:', error);
      throw error; // Re-throw the original error or a new one
    }
  }

  buildPrompt(context, currentInput, style) {
    const styleGuide = this.getStyleGuide(style);
    let prompt = `You are an AI assistant helping to generate natural, human-like conversation replies. Your goal is to create responses that feel authentic and conversational, as if written by a real person. ${styleGuide}\\n\\n`;
    if (context && context.length > 0) {
      prompt += 'Previous conversation:\\n';
      context.forEach(msg => {
        prompt += `${msg.sender}: ${msg.text}\\n`;
      });
      prompt += '\\n';
    }
    if (currentInput) {
      prompt += `User is typing: \"${currentInput}\"\\n\\n`;
    }
    prompt += 'Generate 4 different reply suggestions that sound natural and human-like. Each reply should be different in approach or tone. Make them feel authentic and conversational, as if written by a real person. Consider the context and maintain a natural flow. Return ONLY a JSON object with a \"replies\" array containing 4 string suggestions. Example format: {\"replies\": [\"suggestion1\", \"suggestion2\", \"suggestion3\", \"suggestion4\"]}';
    return prompt;
  }

  getStyleGuide(style) {
    const guides = {
      professional: `Use natural, professional language that sounds human and conversational while maintaining professionalism.\n        - Keep it warm but professional\n        - Use natural transitions and flow\n        - Include appropriate business expressions\n        - Maintain a helpful, solution-oriented tone\n        - Avoid overly formal or stiff language`,
      casual: `Use very natural, friendly language as if talking to a close friend.\n        - Include casual expressions and slang naturally\n        - Use contractions (I\'m, you\'re, etc.)\n        - Add personality and warmth\n        - Keep it light and conversational\n        - Feel free to use emojis and casual punctuation\n        - Include natural filler words and expressions`,
      romantic: `Use warm, affectionate language that feels genuine and natural.\n        - Express interest and attraction naturally\n        - Use subtle flirting and playful banter\n        - Show genuine curiosity about the other person\n        - Keep compliments specific and meaningful\n        - Maintain a balance of warmth and respect\n        - Use natural expressions of affection`,
      humorous: `Use natural humor and wit that feels authentic.\n        - Include light jokes and playful banter\n        - Use situational humor when appropriate\n        - Keep it friendly and not offensive\n        - Add personality and charm\n        - Use natural expressions of amusement\n        - Include playful emojis when fitting`,
      empathetic: `Show genuine understanding and emotional intelligence.\n        - Acknowledge feelings naturally\n        - Show genuine care and concern\n        - Use supportive and understanding language\n        - Offer comfort in a natural way\n        - Validate emotions without being overly dramatic\n        - Keep responses warm and personal`,
      friendly: `Use warm, approachable language that builds connection.\n        - Be welcoming and inclusive\n        - Show genuine interest in the conversation\n        - Use natural expressions of friendliness\n        - Keep it positive and encouraging\n        - Add personal touches and warmth\n        - Use casual but respectful language`,
      enthusiastic: `Show natural excitement and energy.\n        - Express genuine enthusiasm\n        - Use positive and energetic language\n        - Include natural expressions of excitement\n        - Keep it authentic and not overdone\n        - Add personality and spark\n        - Use appropriate exclamations naturally`,
      thoughtful: `Show depth and consideration in responses.\n        - Express genuine interest and curiosity\n        - Ask meaningful questions\n        - Share insights naturally\n        - Show careful consideration\n        - Keep it engaging and personal\n        - Use natural expressions of thoughtfulness`
    };
    return guides[style.tone] || guides.friendly;
  }

  // OpenAI API call - Refactored to use _getProviderRequestConfig and _handleApiResponse via generateReplies
  // async callOpenAI(prompt, temperature, maxTokens) { ... } // Kept for reference, will be removed

  // Anthropic API call
  async callAnthropic(prompt, temperature, maxTokens) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/messages`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt + '\\n\\nRemember to respond with valid JSON only.' }],
          max_tokens: maxTokens,
          temperature: temperature
        })
      });

      return await this._handleApiResponse(response, 'Anthropic', 
        (data) => JSON.parse(data.content[0].text).replies || [],
        {
          'error.type': { value: 'authentication_error', message: 'Invalid API key. Please check your Anthropic API key in settings.' }, // Common for Anthropic
          'error.type': { value: 'invalid_request_error', message: 'Invalid API key or request. Please check your Anthropic API key and model in settings.' }, // Can also be key related
          'error.type': { value: 'rate_limit_error', message: 'Rate limit exceeded. Please try again in a few moments.' }
        }
      );
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Google AI API call
  async callGoogleAI(prompt, temperature, maxTokens) {
    try {
      const response = await fetch(
        `${this.provider.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: this.provider.headers(), // Google specific - API key in URL
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt + '\\n\\nIMPORTANT: Respond ONLY with a valid JSON object containing a \"replies\" array. No markdown, no explanation, just the JSON object.'
              }]
            }],
            generationConfig: {
              temperature: temperature,
              maxOutputTokens: maxTokens,
              candidateCount: 1
            }
          })
        }
      );
      return await this._handleApiResponse(response, 'Google AI', 
        (data) => {
          const text = data.candidates[0].content.parts[0].text;
          const cleanedText = text.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();
          return JSON.parse(cleanedText).replies || [];
        },
        {
          'error.status': { value: 'INVALID_ARGUMENT', message: 'Invalid API key or model. Please check your Google AI settings.' },
          'error.status': { value: 'RESOURCE_EXHAUSTED', message: 'API quota exceeded. Please check your Google AI account usage.' }
        }
      );
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }
  
  // Mistral AI API call - Refactored to use _getProviderRequestConfig and _handleApiResponse via generateReplies
  // async callMistralAI(prompt, temperature, maxTokens) { ... } // Kept for reference, will be removed

  // OpenRouter API call - Refactored to use _getProviderRequestConfig and _handleApiResponse via generateReplies
  // async callOpenRouter(prompt, temperature, maxTokens) { ... } // Kept for reference, will be removed
  
  // Cloudflare Workers AI API call
  async callCloudflare(prompt, temperature, maxTokens) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/${this.model}`, { // Model in URL path
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          // Cloudflare uses 'prompt' field directly, not messages array for some models
          prompt: prompt + '\\n\\nIMPORTANT: Respond ONLY with a valid JSON object containing a \"replies\" array. No markdown, no explanation, just the JSON object.',
          temperature: temperature,
          max_tokens: maxTokens 
        })
      });
      return await this._handleApiResponse(response, 'Cloudflare Workers AI',
        (data) => JSON.parse(data.response).replies || [], // Response structure
        {
            'errors.[0].code': { value: 'auth_error', message: 'Invalid API key. Please check your Cloudflare API key in settings.' }, // Example for CF
            'errors.[0].code': { value: 'quota_exceeded', message: 'API quota exceeded. Please check your Cloudflare account usage.' }
        }
      );
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Together AI API call - Refactored to use _getProviderRequestConfig and _handleApiResponse via generateReplies
  // async callTogether(prompt, temperature, maxTokens) { ... } // Kept for reference, will be removed

  // Custom API call (generic format)
  async callCustomAPI(prompt, temperature, maxTokens) {
    try {
        const response = await fetch(this.provider.customUrl || `${this.provider.baseUrl}/completions`, { // Use customUrl if provided
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
            model: this.model, // May or may not be used by custom API
            prompt: prompt,
            temperature: temperature,
            max_tokens: maxTokens
        })
        });

        // Simpler error handling for truly custom APIs, as structure is unknown
        if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        // Attempt a common parsing strategy, might need adjustment for specific custom APIs
        if (data.replies) return data.replies;
        if (data.choices && data.choices[0] && data.choices[0].text) {
            try {
                const content = JSON.parse(data.choices[0].text);
                return content.replies || [];
            } catch (e) {
                 console.error('Failed to parse Custom API response from choices[0].text:', data.choices[0].text);
            }
        }
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
             try {
                const content = JSON.parse(data.choices[0].message.content);
                return content.replies || [];
            } catch (e) {
                 console.error('Failed to parse Custom API response from choices[0].message.content:', data.choices[0].message.content);
            }
        }
        console.error('Custom API response does not contain a known replies structure:', data);
        throw new Error('Invalid or unexpected response format from Custom API.');

    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
  }
} 