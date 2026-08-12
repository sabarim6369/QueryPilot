/**
 * GroqProvider - AI provider for Groq API
 * 
 * This provider uses Groq's API to generate SQL queries from natural language.
 * Groq offers fast inference with various models including Llama and Mixtral.
 */

const BaseAIProvider = require('./BaseAIProvider');

class GroqProvider extends BaseAIProvider {
  /**
   * Create a new GroqProvider instance
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - Groq API key
   * @param {string} config.model - Model name (default: llama3-70b-8192)
   */
  constructor(config = {}) {
    super(config);
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  /**
   * Get the default model for Groq
   * @returns {string} Default model name
   */
  getDefaultModel() {
    return 'llama3-70b-8192';
  }

  /**
   * Get available models for Groq
   * @returns {Array<string>} Array of available model names
   */
  getAvailableModels() {
    return [
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma-7b-it'
    ];
  }

  /**
   * Generate SQL query from natural language prompt
   * @param {string} prompt - Complete prompt with schema context and user request
   * @returns {Promise<string>} Generated SQL query
   * @throws {Error} If generation fails
   */
  async generate(prompt) {
    if (!this.isConfigured()) {
      throw new Error('Groq API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a SQL expert. Generate only the SQL query, no explanations or additional text. Return the query in a single code block or as plain text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content returned from Groq API');
      }

      // Extract SQL from markdown code blocks if present
      const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/```([\s\S]*?)```/);
      
      if (sqlMatch) {
        return sqlMatch[1].trim();
      }

      // Return content as-is if no code block found
      return content.trim();
    } catch (error) {
      throw new Error(`Groq generation failed: ${error.message}`);
    }
  }
}

module.exports = GroqProvider;
