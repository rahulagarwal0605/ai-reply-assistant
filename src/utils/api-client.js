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
      const prompt = this.buildPrompt(context, currentInput, style);
      
      switch (this.provider.name) {
        case 'OpenAI':
          return await this.callOpenAI(prompt);
        case 'Anthropic':
          return await this.callAnthropic(prompt);
        case 'Google AI':
          return await this.callGoogleAI(prompt);
        default:
          return await this.callCustomAPI(prompt);
      }
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Build prompt from context
  buildPrompt(context, currentInput, style) {
    const styleGuide = this.getStyleGuide(style);
    
    let prompt = `You are an AI assistant helping to generate conversation replies. ${styleGuide}\n\n`;
    
    if (context && context.length > 0) {
      prompt += 'Previous conversation:\n';
      context.slice(-10).forEach(msg => {
        prompt += `${msg.sender}: ${msg.text}\n`;
      });
      prompt += '\n';
    }
    
    if (currentInput) {
      prompt += `User is typing: "${currentInput}"\n\n`;
    }
    
    prompt += 'Generate 4 different reply suggestions that continue naturally from the context. Each reply should be different in approach or tone. Return ONLY a JSON object with a "replies" array containing 4 string suggestions. Example format: {"replies": ["suggestion1", "suggestion2", "suggestion3", "suggestion4"]}';
    
    return prompt;
  }

  // Get style guide based on settings
  getStyleGuide(style) {
    const guides = {
      professional: 'Use professional, formal language suitable for business communication.',
      casual: 'Use casual, friendly language as if talking to a friend.',
      romantic: 'Use warm, affectionate language suitable for romantic conversations.',
      humorous: 'Include appropriate humor and wit while being helpful.',
      empathetic: 'Show understanding and emotional intelligence in responses.'
    };
    
    return guides[style.tone] || guides.professional;
  }

  // OpenAI API call
  async callOpenAI(prompt) {
    const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.provider.headers(this.apiKey),
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates conversation replies. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: this.temperature,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return content.replies || [];
  }

  // Anthropic API call
  async callAnthropic(prompt) {
    const response = await fetch(`${this.provider.baseUrl}/messages`, {
      method: 'POST',
      headers: this.provider.headers(this.apiKey),
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt + '\n\nRemember to respond with valid JSON only.' }],
        max_tokens: 300,
        temperature: this.temperature
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    try {
      const content = JSON.parse(data.content[0].text);
      return content.replies || [];
    } catch (e) {
      console.error('Failed to parse Anthropic response:', data.content[0].text);
      return [];
    }
  }

  // Google AI API call
  async callGoogleAI(prompt) {
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
            temperature: this.temperature,
            maxOutputTokens: 300,
            candidateCount: 1
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google AI API error: ${response.status} - ${error}`);
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
      // Try to extract suggestions from the text
      try {
        const text = data.candidates[0].content.parts[0].text;
        const matches = text.match(/"([^"]+)"/g);
        if (matches && matches.length >= 4) {
          return matches.slice(0, 4).map(m => m.replace(/"/g, ''));
        }
      } catch (fallbackError) {
        console.error('Fallback parsing also failed:', fallbackError);
      }
      return [];
    }
  }

  // Custom API call (generic format)
  async callCustomAPI(prompt) {
    const response = await fetch(`${this.provider.baseUrl}/completions`, {
      method: 'POST',
      headers: this.provider.headers(this.apiKey),
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        temperature: this.temperature,
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