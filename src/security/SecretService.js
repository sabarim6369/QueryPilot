/**
 * SecretService - Secure storage for database credentials
 * 
 * This module handles secure storage of database credentials using VS Code's
 * SecretStorage API. It ensures that passwords and other sensitive information
 * are never stored in plain text files.
 */

class SecretService {
  /**
   * Create a new SecretService instance
   * @param {Object} context - VS Code extension context
   */
  constructor(context) {
    this.context = context;
    this.secretPrefix = 'querypilot.connection.';
    this.aiSecretPrefix = 'querypilot.ai.';
  }

  /**
   * Save connection credentials securely
   * @param {string} connectionId - Unique identifier for the connection
   * @param {Object} credentials - Credentials object to store
   * @param {string} credentials.password - Password (required)
   * @param {string} [credentials.apiKey] - Optional API key
   * @param {string} [credentials.token] - Optional authentication token
   * @returns {Promise<void>}
   */
  async saveConnection(connectionId, credentials) {
    try {
      if (!credentials) {
        throw new Error('Credentials object is required');
      }

      // Store only sensitive information
      const secretsToStore = {};
      
      if (credentials.password) {
        secretsToStore.password = credentials.password;
      }
      
      if (credentials.apiKey) {
        secretsToStore.apiKey = credentials.apiKey;
      }
      
      if (credentials.token) {
        secretsToStore.token = credentials.token;
      }

      // Store as JSON string in secret storage
      const secretValue = JSON.stringify(secretsToStore);
      const secretKey = this._getSecretKey(connectionId);
      
      await this.context.secrets.store(secretKey, secretValue);
    } catch (error) {
      throw new Error(`Failed to save connection secrets: ${error.message}`);
    }
  }

  /**
   * Retrieve connection credentials
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<Object|null>} Credentials object or null if not found
   */
  async getConnection(connectionId) {
    try {
      const secretKey = this._getSecretKey(connectionId);
      const secretValue = await this.context.secrets.get(secretKey);

      if (!secretValue) {
        return null;
      }

      return JSON.parse(secretValue);
    } catch (error) {
      throw new Error(`Failed to retrieve connection secrets: ${error.message}`);
    }
  }

  /**
   * Delete connection credentials
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} true if credentials were deleted, false if not found
   */
  async deleteConnection(connectionId) {
    try {
      const secretKey = this._getSecretKey(connectionId);
      const secretValue = await this.context.secrets.get(secretKey);

      if (!secretValue) {
        return false;
      }

      await this.context.secrets.delete(secretKey);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete connection secrets: ${error.message}`);
    }
  }

  /**
   * Check if connection credentials exist
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} true if credentials exist
   */
  async hasConnection(connectionId) {
    try {
      const secretKey = this._getSecretKey(connectionId);
      const secretValue = await this.context.secrets.get(secretKey);
      return secretValue !== null;
    } catch (error) {
      throw new Error(`Failed to check connection secrets: ${error.message}`);
    }
  }

  /**
   * Update specific credential fields
   * @param {string} connectionId - Unique identifier for the connection
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateConnection(connectionId, updates) {
    try {
      const existing = await this.getConnection(connectionId);
      
      if (!existing) {
        throw new Error('Connection not found');
      }

      const updated = { ...existing, ...updates };
      await this.saveConnection(connectionId, updated);
    } catch (error) {
      throw new Error(`Failed to update connection secrets: ${error.message}`);
    }
  }

  /**
   * Delete all connection secrets (use with caution)
   * @returns {Promise<number>} Number of secrets deleted
   */
  async deleteAllConnections() {
    try {
      // Note: VS Code SecretStorage doesn't provide a way to list all keys
      // This is a limitation of the API. In practice, you would need to
      // maintain a separate list of connection IDs in global state.
      
      // For now, this method requires external tracking of connection IDs
      throw new Error('deleteAllConnections requires external connection ID tracking');
    } catch (error) {
      throw new Error(`Failed to delete all connection secrets: ${error.message}`);
    }
  }

  /**
   * Generate a connection ID from connection parameters
   * @param {Object} connectionConfig - Connection configuration
   * @param {string} connectionConfig.host - Database host
   * @param {number} connectionConfig.port - Database port
   * @param {string} connectionConfig.database - Database name
   * @param {string} connectionConfig.user - Username
   * @returns {string} Unique connection ID
   */
  static generateConnectionId(connectionConfig) {
    const parts = [
      connectionConfig.host || 'localhost',
      connectionConfig.port || 5432,
      connectionConfig.database,
      connectionConfig.user
    ];

    return parts.join(':');
  }

  /**
   * Internal method to generate secret storage key
   * @param {string} connectionId - Connection identifier
   * @returns {string} Secret storage key
   * @private
   */
  _getSecretKey(connectionId) {
    return `${this.secretPrefix}${connectionId}`;
  }

  /**
   * Save AI API key securely
   * @param {string} provider - AI provider name (e.g., 'groq', 'gemini')
   * @param {string} apiKey - API key to store
   * @returns {Promise<void>}
   */
  async saveAIKey(provider, apiKey) {
    try {
      if (!provider || !apiKey) {
        throw new Error('Provider and API key are required');
      }

      const secretKey = this._getAISecretKey(provider);
      await this.context.secrets.store(secretKey, apiKey);
    } catch (error) {
      throw new Error(`Failed to save AI API key: ${error.message}`);
    }
  }

  /**
   * Retrieve AI API key
   * @param {string} provider - AI provider name (e.g., 'groq', 'gemini')
   * @returns {Promise<string|null>} API key or null if not found
   */
  async getAIKey(provider) {
    try {
      const secretKey = this._getAISecretKey(provider);
      const apiKey = await this.context.secrets.get(secretKey);
      return apiKey;
    } catch (error) {
      throw new Error(`Failed to retrieve AI API key: ${error.message}`);
    }
  }

  /**
   * Delete AI API key
   * @param {string} provider - AI provider name (e.g., 'groq', 'gemini')
   * @returns {Promise<boolean>} true if key was deleted, false if not found
   */
  async deleteAIKey(provider) {
    try {
      const secretKey = this._getAISecretKey(provider);
      const apiKey = await this.context.secrets.get(secretKey);

      if (!apiKey) {
        return false;
      }

      await this.context.secrets.delete(secretKey);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete AI API key: ${error.message}`);
    }
  }

  /**
   * Internal method to generate AI secret storage key
   * @param {string} provider - AI provider name
   * @returns {string} Secret storage key
   * @private
   */
  _getAISecretKey(provider) {
    return `${this.aiSecretPrefix}${provider.toLowerCase()}`;
  }
}

module.exports = SecretService;
