// src/features/ai/AIService.ts

import axios from 'axios';
import { CONFIG } from '../../config';
import { AIDecision } from './types';

export class AIService {
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly apiKey = CONFIG.openRouterApiKey;
  private readonly aiSettings = CONFIG.aiSettings;

  /**
   * Consults the AI model with a detailed strategic prompt to get a decision.
   * This method includes retry logic and a safe fallback mechanism.
   *
   * @param strategicPrompt - The fully constructed prompt containing all necessary data for the AI.
   * @returns A promise that resolves to a validated AIDecision.
   */
  public async getDecision(strategicPrompt: string): Promise<AIDecision> {
    for (let attempt = 1; attempt <= this.aiSettings.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          this.apiUrl,
          {
            model: this.aiSettings.aiModel,
            messages: [{ role: 'user', content: strategicPrompt }],
            response_format: { type: 'json_object' }, // Crucial for getting structured JSON output
            temperature: this.aiSettings.temperature,
            max_tokens: this.aiSettings.maxTokens,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: this.aiSettings.timeout,
          }
        );

        const aiResponseContent = response.data.choices[0]?.message?.content;
        if (aiResponseContent) {
          const parsedDecision = this.parseAndValidateResponse(aiResponseContent);
          if (parsedDecision) {
            return parsedDecision; // Success!
          }
          console.warn(`[AI Service] ⚠️ Attempt ${attempt}: AI response was not valid JSON. Retrying...`);
        } else {
          console.warn(`[AI Service] ⚠️ Attempt ${attempt}: AI response was empty. Retrying...`);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error(`[AI Service] ❌ Attempt ${attempt} failed:`, errorMessage);

        if (attempt === this.aiSettings.maxRetries) {
          console.error('[AI Service] 🛡️ All AI attempts failed. Using safe fallback decision.');
          break; // Exit loop and proceed to fallback
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    // If all retries fail, return a safe fallback action.
    return {
      action: 'train',
      reasoning: 'AI service failed to get a valid response after all retries. Executing a safe fallback action.',
    };
  }

  /**
   * Parses and validates the raw string response from the AI.
   *
   * @param rawResponse - The JSON string from the AI model.
   * @returns An AIDecision object if valid, otherwise null.
   */
  private parseAndValidateResponse(rawResponse: string): AIDecision | null {
    try {
      const parsed = JSON.parse(rawResponse);

      // Validate required fields and their types
      if (!parsed.action || typeof parsed.action !== 'string') {
        console.error('❌ AI response validation failed: Missing or invalid "action" field.');
        return null;
      }
      if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
        console.error('❌ AI response validation failed: Missing or invalid "reasoning" field.');
        return null;
      }
      if (parsed.itemId !== undefined && typeof parsed.itemId !== 'number') {
        console.error('❌ AI response validation failed: Invalid "itemId" type.');
        return null;
      }

      // If all checks pass, we can confidently cast and return the object.
      return parsed as AIDecision;
    } catch (error) {
      console.error('❌ AI response validation failed: Could not parse JSON string.', error);
      console.error('   Invalid Response:', rawResponse);
      return null;
    }
  }
  }
