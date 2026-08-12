/**
 * BaseAIProvider - Base interface for all AI providers
 * 
 * This defines the common interface that all AI providers must implement.
 * Each AI provider (Groq, Gemini, OpenAI, etc.) will extend this class.
 */

class BaseAIProvider {
  /**
   * Create a new AI provider instance
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - API key for the provider
   * @param {string} config.model - Model name to use
   */
  constructor(config = {}) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.model = config.model || this.getDefaultModel();
  }

  /**
   * Generate SQL query from natural language prompt
   * @param {string} prompt - Complete prompt with schema context and user request
   * @returns {Promise<string>} Generated SQL query
   * @throws {Error} If generation fails
   */
  async generate(prompt) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Get the default model for this provider
   * @returns {string} Default model name
   */
  getDefaultModel() {
    throw new Error('getDefaultModel() must be implemented by subclass');
  }

  /**
   * Get available models for this provider
   * @returns {Array<string>} Array of available model names
   */
  getAvailableModels() {
    throw new Error('getAvailableModels() must be implemented by subclass');
  }

  /**
   * Update the model
   * @param {string} model - New model name
   */
  setModel(model) {
    this.model = model;
  }

  /**
   * Update the API key
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Check if provider is configured
   * @returns {boolean} true if API key is set
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = BaseAIProvider;
