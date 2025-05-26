import { getProvider } from './llm-providers.js';

// Generic API client for LLM providers
export class LLMApiClient {
  constructor(config) {
    this.provider = getProvider(config.provider);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature || 0.7;
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
      console.error('API Error:', error);
      throw error;
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
      professional: `Use natural, professional language that sounds human and conversational while maintaining professionalism.
        - Keep it warm but professional
        - Use natural transitions and flow
        - Include appropriate business expressions
        - Maintain a helpful, solution-oriented tone
        - Avoid overly formal or stiff language`,

      casual: `Use very natural, friendly language as if talking to a close friend.
        - Include casual expressions and slang naturally
        - Use contractions (I'm, you're, etc.)
        - Add personality and warmth
        - Keep it light and conversational
        - Feel free to use emojis and casual punctuation
        - Include natural filler words and expressions`,

      romantic: `Use warm, affectionate language that feels genuine and natural.
        - Express interest and attraction naturally
        - Use subtle flirting and playful banter
        - Show genuine curiosity about the other person
        - Keep compliments specific and meaningful
        - Maintain a balance of warmth and respect
        - Use natural expressions of affection`,

      humorous: `Use natural humor and wit that feels authentic.
        - Include light jokes and playful banter
        - Use situational humor when appropriate
        - Keep it friendly and not offensive
        - Add personality and charm
        - Use natural expressions of amusement
        - Include playful emojis when fitting`,

      empathetic: `Show genuine understanding and emotional intelligence.
        - Acknowledge feelings naturally
        - Show genuine care and concern
        - Use supportive and understanding language
        - Offer comfort in a natural way
        - Validate emotions without being overly dramatic
        - Keep responses warm and personal`,

      friendly: `Use warm, approachable language that builds connection.
        - Be welcoming and inclusive
        - Show genuine interest in the conversation
        - Use natural expressions of friendliness
        - Keep it positive and encouraging
        - Add personal touches and warmth
        - Use casual but respectful language`,

      enthusiastic: `Show natural excitement and energy.
        - Express genuine enthusiasm
        - Use positive and energetic language
        - Include natural expressions of excitement
        - Keep it authentic and not overdone
        - Add personality and spark
        - Use appropriate exclamations naturally`,

      thoughtful: `Show depth and consideration in responses.
        - Express genuine interest and curiosity
        - Ask meaningful questions
        - Share insights naturally
        - Show careful consideration
        - Keep it engaging and personal
        - Use natural expressions of thoughtfulness`
    };
    
    return guides[style.tone] || guides.friendly;
  }

  // OpenAI API call
  async callOpenAI(prompt, temperature) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
        } else if (error.error?.code === 'insufficient_quota') {
          throw new Error('API quota exceeded. Please check your OpenAI account usage.');
        } else {
          throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      return content.replies || [];
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Anthropic API call
  async callAnthropic(prompt, temperature) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/messages`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt + '\n\nRemember to respond with valid JSON only.' }],
          max_tokens: 300,
          temperature: temperature
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.type === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your Anthropic API key in settings.');
        } else if (error.error?.type === 'rate_limit') {
          throw new Error('Rate limit exceeded. Please try again in a few moments.');
        } else {
          throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      try {
        const content = JSON.parse(data.content[0].text);
        return content.replies || [];
      } catch (e) {
        console.error('Failed to parse Anthropic response:', data.content[0].text);
        throw new Error('Invalid response format from API. Please try again.');
      }
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Google AI API call
  async callGoogleAI(prompt, temperature) {
    try {
      const response = await fetch(
        `${this.provider.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: this.provider.headers(),
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt + '\n\nIMPORTANT: Respond ONLY with a valid JSON object containing a "replies" array. No markdown, no explanation, just the JSON object.'
              }]
            }],
            generationConfig: {
              temperature: temperature,
              maxOutputTokens: 300,
              candidateCount: 1
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.status === 'INVALID_ARGUMENT') {
          throw new Error('Invalid API key or model. Please check your Google AI settings.');
        } else if (error.error?.status === 'RESOURCE_EXHAUSTED') {
          throw new Error('API quota exceeded. Please check your Google AI account usage.');
        } else {
          throw new Error(`Google AI API error: ${error.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      try {
        const text = data.candidates[0].content.parts[0].text;
        // Remove any markdown code blocks if present
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const content = JSON.parse(cleanedText);
        return content.replies || [];
      } catch (e) {
        console.error('Failed to parse Google AI response:', data);
        throw new Error('Invalid response format from API. Please try again.');
      }
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Mistral AI API call
  async callMistralAI(prompt, temperature) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your Mistral AI API key in settings.');
        } else if (error.error?.code === 'insufficient_quota') {
          throw new Error('API quota exceeded. Please check your Mistral AI account usage.');
        } else {
          throw new Error(`Mistral AI API error: ${error.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      return content.replies || [];
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // OpenRouter API call
  async callOpenRouter(prompt, temperature) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your OpenRouter API key in settings.');
        } else if (error.error?.code === 'insufficient_quota') {
          throw new Error('API quota exceeded. Please check your OpenRouter account usage.');
        } else {
          throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      return content.replies || [];
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Cloudflare Workers AI API call
  async callCloudflare(prompt, temperature) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/${this.model}`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          prompt: prompt + '\n\nIMPORTANT: Respond ONLY with a valid JSON object containing a "replies" array. No markdown, no explanation, just the JSON object.',
          temperature: temperature,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.errors?.[0]?.code === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your Cloudflare API key in settings.');
        } else if (error.errors?.[0]?.code === 'quota_exceeded') {
          throw new Error('API quota exceeded. Please check your Cloudflare account usage.');
        } else {
          throw new Error(`Cloudflare API error: ${error.errors?.[0]?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      try {
        const content = JSON.parse(data.response);
        return content.replies || [];
      } catch (e) {
        console.error('Failed to parse Cloudflare response:', data.response);
        throw new Error('Invalid response format from API. Please try again.');
      }
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Together AI API call
  async callTogether(prompt, temperature) {
    try {
      const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your Together AI API key in settings.');
        } else if (error.error?.code === 'insufficient_quota') {
          throw new Error('API quota exceeded. Please check your Together AI account usage.');
        } else {
          throw new Error(`Together AI API error: ${error.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      return content.replies || [];
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Custom API call (generic format)
  async callCustomAPI(prompt, temperature) {
    const response = await fetch(`${this.provider.baseUrl}/completions`, {
      method: 'POST',
      headers: this.provider.headers(this.apiKey),
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        temperature: temperature,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    try {
      const content = JSON.parse(data.choices[0].text);
      return content.replies || [];
    } catch (e) {
      console.error('Failed to parse Custom API response:', data.choices[0].text);
      return [];
    }
  }
} 