import { getProvider } from './llm-providers.js';

const SUGGESTION_REQUEST_MAX_TOKENS = 300;
const OPENAI_SYSTEM_MESSAGE_JSON = 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.';
const ANTHROPIC_JSON_REMINDER = '\n\nRemember to respond with valid JSON only.';
const GOOGLE_JSON_REMINDER = '\n\nIMPORTANT: Respond ONLY with a valid JSON object containing a "replies" array. No markdown, no explanation, just the JSON object.';
const CLOUDFLARE_JSON_REMINDER = '\n\nIMPORTANT: Respond ONLY with a valid JSON object containing a "replies" array. No markdown, no explanation, just the JSON object.';

// Generic API client for LLM providers
export class LLMApiClient {
  constructor(config) {
    this.provider = getProvider(config.provider);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature || 0.7;
  }

  async _fetchAPI(url, options, providerName, specificErrorParser) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // If error response is not JSON, try to get text
          const errorText = await response.text().catch(() => 'Failed to get error details');
          throw new Error(`${providerName} API error: ${response.status} ${response.statusText}. Details: ${errorText}`);
        }
        
        if (specificErrorParser) {
          throw specificErrorParser(errorData, response.status, providerName);
        } else {
          const defaultMessage = errorData?.error?.message || errorData?.message || response.statusText;
          throw new Error(`${providerName} API error: ${defaultMessage}`);
        }
      }
      return response.json();
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      // Re-throw errors already processed (e.g., by specificErrorParser) or other unexpected errors
      throw error;
    }
  }

  // Generate reply suggestions
  async generateReplies(context, currentInput, style) {
    try {
      // Use site-specific temperature if available, otherwise use global temperature
      const temperature = style.temperature ? parseFloat(style.temperature) : this.temperature;
      
      const prompt = this.buildPrompt(context, currentInput, style);
      
      switch (this.provider.name) {
        case 'OpenAI':
          return await this.callOpenAI(prompt, temperature);
        case 'Anthropic':
          return await this.callAnthropic(prompt, temperature);
        case 'Google AI':
          return await this.callGoogleAI(prompt, temperature);
        case 'Mistral AI':
          return await this.callMistralAI(prompt, temperature);
        case 'OpenRouter':
          return await this.callOpenRouter(prompt, temperature);
        case 'Cloudflare Workers AI':
          return await this.callCloudflare(prompt, temperature);
        case 'Together AI':
          return await this.callTogether(prompt, temperature);
        default:
          return await this.callCustomAPI(prompt, temperature);
      }
    } catch (error) {
      console.error('API Error in generateReplies:', error.message);
      // Ensure a user-friendly error is thrown from here if not already
      if (error.isUserFriendly) { // Assuming we might add such a flag to custom errors
        throw error;
      } else {
        throw new Error(`Failed to generate replies: ${error.message}`);
      }
    }
  }

  // Build prompt from context
  buildPrompt(context, currentInput, style) {
    const styleGuide = this.getStyleGuide(style);
    
    let prompt = `You are an AI assistant helping to generate natural, human-like conversation replies. Your goal is to create responses that feel authentic and conversational, as if written by a real person. ${styleGuide}\n\n`;
    
    if (context && context.length > 0) {
      prompt += 'Previous conversation:\n';
      context.forEach(msg => {
        prompt += `${msg.sender}: ${msg.text}\n`;
      });
      prompt += '\n';
    }
    
    if (currentInput) {
      prompt += `User is typing: "${currentInput}"\n\n`;
    }
    
    prompt += 'Generate 4 different reply suggestions that sound natural and human-like. Each reply should be different in approach or tone. Make them feel authentic and conversational, as if written by a real person. Consider the context and maintain a natural flow. Return ONLY a JSON object with a "replies" array containing 4 string suggestions. Example format: {"replies": ["suggestion1", "suggestion2", "suggestion3", "suggestion4"]}';
    
    return prompt;
  }

  // Get style guide based on settings
  getStyleGuide(style) {
    const guides = {
      professional: `Use natural, professional language that sounds human and conversational while maintaining professionalism.\n        - Keep it warm but professional\n        - Use natural transitions and flow\n        - Include appropriate business expressions\n        - Maintain a helpful, solution-oriented tone\n        - Avoid overly formal or stiff language`,
      casual: `Use very natural, friendly language as if talking to a close friend.\n        - Include casual expressions and slang naturally\n        - Use contractions (I'm, you're, etc.)\n        - Add personality and warmth\n        - Keep it light and conversational\n        - Feel free to use emojis and casual punctuation\n        - Include natural filler words and expressions`,
      romantic: `Use warm, affectionate language that feels genuine and natural.\n        - Express interest and attraction naturally\n        - Use subtle flirting and playful banter\n        - Show genuine curiosity about the other person\n        - Keep compliments specific and meaningful\n        - Maintain a balance of warmth and respect\n        - Use natural expressions of affection`,
      humorous: `Use natural humor and wit that feels authentic.\n        - Include light jokes and playful banter\n        - Use situational humor when appropriate\n        - Keep it friendly and not offensive\n        - Add personality and charm\n        - Use natural expressions of amusement\n        - Include playful emojis when fitting`,
      empathetic: `Show genuine understanding and emotional intelligence.\n        - Acknowledge feelings naturally\n        - Show genuine care and concern\n        - Use supportive and understanding language\n        - Offer comfort in a natural way\n        - Validate emotions without being overly dramatic\n        - Keep responses warm and personal`,
      friendly: `Use warm, approachable language that builds connection.\n        - Be welcoming and inclusive\n        - Show genuine interest in the conversation\n        - Use natural expressions of friendliness\n        - Keep it positive and encouraging\n        - Add personal touches and warmth\n        - Use casual but respectful language`,
      enthusiastic: `Show natural excitement and energy.\n        - Express genuine enthusiasm\n        - Use positive and energetic language\n        - Include natural expressions of excitement\n        - Keep it authentic and not overdone\n        - Add personality and spark\n        - Use appropriate exclamations naturally`,
      thoughtful: `Show depth and consideration in responses.\n        - Express genuine interest and curiosity\n        - Ask meaningful questions\n        - Share insights naturally\n        - Show careful consideration\n        - Keep it engaging and personal\n        - Use natural expressions of thoughtfulness`
    };
    
    return guides[style.tone] || guides.friendly;
  }

  _openAICompatibleErrorParser(errorData, status, providerName) {
    let userMessage = `${providerName} API error: ${errorData?.error?.message || errorData?.message || status}`;
    if (errorData?.error?.code === 'invalid_api_key') {
      userMessage = `Invalid API key. Please check your ${providerName} API key in settings.`;
    } else if (errorData?.error?.code === 'insufficient_quota') {
      userMessage = `API quota exceeded. Please check your ${providerName} account usage.`;
    }
    const err = new Error(userMessage);
    err.isUserFriendly = true;
    return err;
  }

  async _callOpenAICompatibleAPI(prompt, temperature, specificProviderName) {
    const endpoint = `${this.provider.baseUrl}/chat/completions`;
    const headers = this.provider.headers(this.apiKey);
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: OPENAI_SYSTEM_MESSAGE_JSON },
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: SUGGESTION_REQUEST_MAX_TOKENS,
      response_format: { type: 'json_object' }
    });

    const data = await this._fetchAPI(endpoint, { method: 'POST', headers, body }, specificProviderName, this._openAICompatibleErrorParser);
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      try {
        const content = JSON.parse(data.choices[0].message.content);
        return content.replies || [];
      } catch (e) {
        throw new Error(`Invalid JSON in response from ${specificProviderName}: ${e.message}`);
      }
    } else {
      throw new Error(`Unexpected response structure from ${specificProviderName}.`);
    }
  }

  async callOpenAI(prompt, temperature) {
    return this._callOpenAICompatibleAPI(prompt, temperature, 'OpenAI');
  }

  async callMistralAI(prompt, temperature) {
    return this._callOpenAICompatibleAPI(prompt, temperature, 'Mistral AI');
  }

  async callOpenRouter(prompt, temperature) {
    return this._callOpenAICompatibleAPI(prompt, temperature, 'OpenRouter');
  }

  async callTogether(prompt, temperature) {
    return this._callOpenAICompatibleAPI(prompt, temperature, 'Together AI');
  }

  _anthropicErrorParser(errorData, status, providerName) {
    let userMessage = `Anthropic API error: ${errorData?.error?.message || status}`;
    if (errorData?.error?.type === 'invalid_api_key') {
      userMessage = 'Invalid API key. Please check your Anthropic API key in settings.';
    } else if (errorData?.error?.type === 'rate_limit') {
      userMessage = 'Rate limit exceeded. Please try again in a few moments.';
    }
    const err = new Error(userMessage);
    err.isUserFriendly = true;
    return err;
  }

  async callAnthropic(prompt, temperature) {
    const endpoint = `${this.provider.baseUrl}/messages`;
    const headers = this.provider.headers(this.apiKey);
    const body = JSON.stringify({
      model: this.model,
      messages: [{ role: 'user', content: prompt + ANTHROPIC_JSON_REMINDER }],
      max_tokens: SUGGESTION_REQUEST_MAX_TOKENS,
      temperature: temperature
    });

    const data = await this._fetchAPI(endpoint, { method: 'POST', headers, body }, 'Anthropic', this._anthropicErrorParser);

    try {
      if (data.content && data.content[0] && data.content[0].text) {
        const content = JSON.parse(data.content[0].text);
        return content.replies || [];
      }
      throw new Error('Unexpected response structure from Anthropic.');
    } catch (e) {
      console.error('Failed to parse Anthropic response:', e, data.content && data.content[0] ? data.content[0].text : 'No text content');
      throw new Error('Invalid response format from Anthropic. Please try again.');
    }
  }

  _googleAIErrorParser(errorData, status, providerName) {
    let userMessage = `Google AI API error: ${errorData?.error?.message || status}`;
    if (errorData?.error?.status === 'INVALID_ARGUMENT') {
      userMessage = 'Invalid API key or model. Please check your Google AI settings.';
    } else if (errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
      userMessage = 'API quota exceeded. Please check your Google AI account usage.';
    }
    const err = new Error(userMessage);
    err.isUserFriendly = true;
    return err;
  }

  async callGoogleAI(prompt, temperature) {
    const endpoint = `${this.provider.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const headers = this.provider.headers(); // Google API key is in URL
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt + GOOGLE_JSON_REMINDER }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: SUGGESTION_REQUEST_MAX_TOKENS,
        candidateCount: 1,
        responseMimeType: 'application/json' // Explicitly request JSON output
      }
    });

    const data = await this._fetchAPI(endpoint, { method: 'POST', headers, body }, 'Google AI', this._googleAIErrorParser);

    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      try {
        let jsonString = data.candidates[0].content.parts[0].text;
        // Strip Markdown code block fences if present
        const markdownJsonRegex = /^```json\n([\s\S]*?)\n```$/;
        const match = jsonString.match(markdownJsonRegex);
        if (match && match[1]) {
          jsonString = match[1];
        }
        const content = JSON.parse(jsonString);
        return content.replies || [];
      } catch (e) {
        console.error('Failed to parse Google AI response:', e, data.candidates[0].content.parts[0].text);
        throw new Error('Invalid JSON response format from Google AI.');
      }
    } else {
      console.error('Unexpected Google AI response structure:', data);
      throw new Error('Unexpected response structure from Google AI.');
    }
  }

  _cloudflareErrorParser(errorData, status, providerName) {
    let userMessage = `Cloudflare API error: ${errorData?.errors?.[0]?.message || status}`;
     // Cloudflare error codes are numeric, e.g. 10000 range, or specific strings in messages.
     // For now, a generic check.
    if (errorData?.errors?.[0]?.code === 'auth_error' || errorData?.errors?.[0]?.message?.includes('Invalid token')) { // Example, adjust to actual codes
        userMessage = 'Invalid API key. Please check your Cloudflare API key in settings.';
    } else if (errorData?.errors?.[0]?.code === 'quota_exceeded_error') { // Example
        userMessage = 'API quota exceeded. Please check your Cloudflare account usage.';
    }
    const err = new Error(userMessage);
    err.isUserFriendly = true;
    return err;
  }

  async callCloudflare(prompt, temperature) {
    // Cloudflare might not use /chat/completions, but a direct model endpoint
    const endpoint = `${this.provider.baseUrl}/${this.provider.modelPath || '@cf/meta/llama-2-7b-chat-int8'}/${this.model}`.replace('@cf/meta/llama-2-7b-chat-int8/',''); //Hacky, make modelPath part of config
    const headers = this.provider.headers(this.apiKey);
    const body = JSON.stringify({
      // Cloudflare API expects a raw prompt or messages array depending on model.
      // Assuming a simple prompt for now, adjust if models expect messages array.
      prompt: prompt + CLOUDFLARE_JSON_REMINDER, 
      temperature: temperature,
      max_tokens: SUGGESTION_REQUEST_MAX_TOKENS
    });

    const data = await this._fetchAPI(endpoint, { method: 'POST', headers, body }, 'Cloudflare Workers AI', this._cloudflareErrorParser);

    try {
      // Cloudflare's response structure is often { result: { response: "..." } } or { response: "..." }
      // The actual JSON content would be in data.result.response or data.response
      let jsonString = data.response; // Default assumption
      if(data.result && data.result.response){
        jsonString = data.result.response;
      }
      const content = JSON.parse(jsonString);
      return content.replies || [];
    } catch (e) {
      console.error('Failed to parse Cloudflare response:', e, data);
      throw new Error('Invalid response format from Cloudflare. Please try again.');
    }
  }

  async callCustomAPI(prompt, temperature) {
    const endpoint = `${this.provider.baseUrl || ''}/completions`; // Ensure provider.baseUrl is checked
    const headers = this.provider.headers(this.apiKey);
    const bodyContent = {
      model: this.model,
      prompt: prompt, // Or use messages format depending on custom API contract
      temperature: temperature,
      max_tokens: SUGGESTION_REQUEST_MAX_TOKENS
      // Potentially add response_format: { type: 'json_object' } if custom API supports
    };
    // Allow provider config to specify if it needs a messages array for custom
    if(this.provider.customPromptFormat === 'messages'){
        bodyContent.messages = [{role: 'user', content: prompt}];
        delete bodyContent.prompt;
        //Potentially add system message here from provider config
        if(this.provider.customSystemMessage){
             bodyContent.messages.unshift({role: 'system', content: this.provider.customSystemMessage});   
        }
    }

    const body = JSON.stringify(bodyContent);

    // For custom API, error parsing is very generic
    const customErrorParser = (errorData, status, providerName) => {
      const message = errorData?.error?.message || errorData?.message || (typeof errorData === 'string' ? errorData : 'Unknown error')
      const err = new Error(`${providerName} API error (${status}): ${message}`);
      err.isUserFriendly = true; // Assume it might be somewhat understandable
      return err;
    };

    const data = await this._fetchAPI(endpoint, { method: 'POST', headers, body }, this.provider.name || 'Custom API', customErrorParser);

    try {
      // Custom API response structure is unknown, try common patterns
      let replies = [];
      if (data.replies && Array.isArray(data.replies)) {
        replies = data.replies;
      } else if (data.choices && data.choices[0]) {
        if (data.choices[0].message && data.choices[0].message.content) {
          // OpenAI-like structure in message.content (JSON string)
          try { replies = JSON.parse(data.choices[0].message.content).replies || []; } catch (e) { /* ignore */ }
        } else if (data.choices[0].text) {
          // Anthropic/Custom-like structure in text (JSON string)
          try { replies = JSON.parse(data.choices[0].text).replies || []; } catch (e) { /* ignore */ }
        }
      } else if (data.response) {
         // Cloudflare-like
         try { replies = JSON.parse(data.response).replies || []; } catch (e) { /* ignore */ }
      }
      // If still no replies, and data itself is an object with a replies key (direct JSON)
      if (replies.length === 0 && typeof data === 'object' && data.replies && Array.isArray(data.replies)) {
        replies = data.replies;
      }

      if (replies.length > 0) return replies;
      
      console.warn('Could not extract replies from Custom API response:', data);
      throw new Error('Unsupported response structure from Custom API.');
    } catch (e) {
      console.error('Failed to parse Custom API response:', e, data);
      throw new Error(`Invalid response from Custom API: ${e.message}`);
    }
  }
} 