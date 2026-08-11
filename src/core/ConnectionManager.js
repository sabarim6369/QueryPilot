/**
 * ConnectionManager - Manages database connections
 * 
 * This module is responsible for managing the active database connection.
 * It uses DatabaseFactory to create the appropriate adapter and handles
 * connecting, disconnecting, and testing connections. It never directly
 * instantiates PostgresAdapter or other database-specific adapters.
 */

const DatabaseFactory = require('../database/DatabaseFactory');
const SecretService = require('../security/SecretService');

class ConnectionManager {
  /**
   * Create a new ConnectionManager instance
   * @param {Object} context - VS Code extension context
   */
  constructor(context) {
    this.context = context;
    this.secretService = new SecretService(context);
    this.currentAdapter = null;
    this.currentDatabaseType = null;
    this.currentConnectionId = null;
    this.currentConnectionConfig = null;
  }

  /**
   * Connect to a database
   * @param {Object} connectionConfig - Connection configuration
   * @param {string} connectionConfig.databaseType - Type of database ('postgresql')
   * @param {string} connectionConfig.host - Database host
   * @param {number} connectionConfig.port - Database port
   * @param {string} connectionConfig.database - Database name
   * @param {string} connectionConfig.user - Username
   * @param {string} connectionConfig.password - Password
   * @param {string} [connectionConfig.connectionString] - Optional connection string
   * @returns {Promise<Object>} Connection result
   */
  async connect(connectionConfig) {
    try {
      // Validate database type
      if (!DatabaseFactory.isSupported(connectionConfig.databaseType)) {
        throw new Error(`Unsupported database type: ${connectionConfig.databaseType}`);
      }

      // Disconnect existing connection if any
      if (this.currentAdapter) {
        await this.disconnect();
      }

      // Create adapter using factory
      this.currentAdapter = DatabaseFactory.createAdapter(connectionConfig.databaseType);
      this.currentDatabaseType = connectionConfig.databaseType;

      // Generate connection ID
      this.currentConnectionId = SecretService.generateConnectionId(connectionConfig);
      this.currentConnectionConfig = this._sanitizeConnectionConfig(connectionConfig);

      // Store credentials securely
      await this.secretService.saveConnection(this.currentConnectionId, {
        password: connectionConfig.password,
        apiKey: connectionConfig.apiKey,
        token: connectionConfig.token
      });

      // Connect using adapter
      await this.currentAdapter.connect(connectionConfig);

      return {
        success: true,
        databaseType: this.currentDatabaseType,
        connectionId: this.currentConnectionId
      };
    } catch (error) {
      // Clean up on failure
      this.currentAdapter = null;
      this.currentDatabaseType = null;
      this.currentConnectionId = null;
      this.currentConnectionConfig = null;

      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from the current database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.currentAdapter) {
        await this.currentAdapter.disconnect();
      }

      this.currentAdapter = null;
      this.currentDatabaseType = null;
      this.currentConnectionId = null;
      this.currentConnectionConfig = null;
    } catch (error) {
      throw new Error(`Disconnect failed: ${error.message}`);
    }
  }

  /**
   * Test the current database connection
   * @returns {Promise<boolean>} true if connection is successful
   */
  async testConnection() {
    if (!this.currentAdapter) {
      throw new Error('No active connection to test');
    }

    try {
      return await this.currentAdapter.testConnection();
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get the current database adapter
   * @returns {DatabaseAdapter|null} Current adapter or null if not connected
   */
  getCurrentAdapter() {
    return this.currentAdapter;
  }

  /**
   * Get the current database type
   * @returns {string|null} Current database type or null if not connected
   */
  getCurrentDatabaseType() {
    return this.currentDatabaseType;
  }

  /**
   * Get the current connection ID
   * @returns {string|null} Current connection ID or null if not connected
   */
  getCurrentConnectionId() {
    return this.currentConnectionId;
  }

  /**
   * Get the current connection configuration (sanitized, without password)
   * @returns {Object|null} Current connection config or null if not connected
   */
  getCurrentConnectionConfig() {
    return this.currentConnectionConfig;
  }

  /**
   * Check if currently connected to a database
   * @returns {boolean} true if connected
   */
  isConnected() {
    return this.currentAdapter !== null && this.currentAdapter.isConnected();
  }

  /**
   * Get credentials for the current connection
   * @returns {Promise<Object|null>} Credentials or null if not connected
   */
  async getCurrentCredentials() {
    if (!this.currentConnectionId) {
      return null;
    }

    return await this.secretService.getConnection(this.currentConnectionId);
  }

  /**
   * Reconnect using stored credentials
   * @returns {Promise<Object>} Connection result
   */
  async reconnect() {
    if (!this.currentConnectionConfig) {
      throw new Error('No previous connection configuration available');
    }

    const credentials = await this.getCurrentCredentials();
    if (!credentials) {
      throw new Error('No stored credentials found');
    }

    const connectionConfig = {
      ...this.currentConnectionConfig,
      password: credentials.password,
      apiKey: credentials.apiKey,
      token: credentials.token
    };

    return await this.connect(connectionConfig);
  }

  /**
   * Sanitize connection config by removing sensitive information
   * @param {Object} connectionConfig - Connection configuration to sanitize
   * @returns {Object} Sanitized connection config
   * @private
   */
  _sanitizeConnectionConfig(connectionConfig) {
    const sanitized = { ...connectionConfig };
    delete sanitized.password;
    delete sanitized.apiKey;
    delete sanitized.token;
    return sanitized;
  }
}

module.exports = ConnectionManager;
