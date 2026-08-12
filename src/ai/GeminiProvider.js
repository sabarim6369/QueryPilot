/**
 * GeminiProvider - AI provider for Google Gemini API
 * 
 * This provider uses Google's Gemini API to generate SQL queries from natural language.
 * Gemini offers powerful models including Gemini Pro and Gemini Ultra.
 */

const BaseAIProvider = require('./BaseAIProvider');

class GeminiProvider extends BaseAIProvider {
  /**
   * Create a new GeminiProvider instance
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - Google API key
   * @param {string} config.model - Model name (default: gemini-1.5-pro)
   */
  constructor(config = {}) {
    super(config);
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Get the default model for Gemini
   * @returns {string} Default model name
   */
  getDefaultModel() {
    return 'gemini-1.5-pro';
  }

  /**
   * Get available models for Gemini
   * @returns {Array<string>} Array of available model names
   */
  getAvailableModels() {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
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
      throw new Error('Gemini API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a SQL expert. Generate only the SQL query, no explanations or additional text. Return the query in a single code block or as plain text.\n\n${prompt}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('No content returned from Gemini API');
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
      throw new Error(`Gemini generation failed: ${error.message}`);
    }
  }
}

module.exports = GeminiProvider;
