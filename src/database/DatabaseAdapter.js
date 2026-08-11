/**
 * DatabaseAdapter - Base interface/contract for all database adapters
 * 
 * This defines the common interface that all database adapters must implement.
 * Each database type (PostgreSQL, MySQL, MongoDB, etc.) will have its own
 * adapter that implements these methods.
 */

class DatabaseAdapter {
  /**
   * Connect to the database
   * @param {Object} connectionConfig - Connection configuration
   * @returns {Promise<void>}
   * @throws {Error} If connection fails
   */
  async connect(connectionConfig) {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Test the database connection
   * @returns {Promise<boolean>} true if connection is successful
   * @throws {Error} If connection test fails
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Get the database schema
   * @returns {Promise<Object>} Database schema information
   * @throws {Error} If schema retrieval fails
   */
  async getSchema() {
    throw new Error('getSchema() must be implemented by subclass');
  }

  /**
   * Execute a query
   * @param {string} query - SQL query to execute
   * @returns {Promise<Object>} Query results
   * @throws {Error} If query execution fails
   */
  async executeQuery(query) {
    throw new Error('executeQuery() must be implemented by subclass');
  }

  /**
   * Get the database type
   * @returns {string} Database type identifier (e.g., 'postgresql', 'mysql')
   */
  getDatabaseType() {
    throw new Error('getDatabaseType() must be implemented by subclass');
  }

  /**
   * Check if currently connected
   * @returns {boolean} true if connected
   */
  isConnected() {
    throw new Error('isConnected() must be implemented by subclass');
  }
}

module.exports = DatabaseAdapter;
