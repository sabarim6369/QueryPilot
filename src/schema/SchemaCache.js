/**
 * SchemaCache - Caches database schema metadata
 * 
 * This module handles caching of database schema information using VS Code's
 * extension storage mechanism. It stores schema metadata but NEVER credentials
 * or passwords. The cache is keyed by connection identifiers to support
 * multiple database connections.
 */

class SchemaCache {
  /**
   * Create a new SchemaCache instance
   * @param {Object} context - VS Code extension context
   */
  constructor(context) {
    this.context = context;
    this.cacheKey = 'querypilot.schemaCache';
  }

  /**
   * Save schema to cache
   * @param {string} connectionId - Unique identifier for the connection
   * @param {Object} schema - Schema object to cache
   * @returns {Promise<void>}
   */
  async saveSchema(connectionId, schema) {
    try {
      const cache = await this._getCache();
      
      // Store schema without any sensitive information
      cache[connectionId] = {
        schema: schema,
        timestamp: Date.now(),
        version: '1.0'
      };

      await this._saveCache(cache);
    } catch (error) {
      throw new Error(`Failed to save schema to cache: ${error.message}`);
    }
  }

  /**
   * Retrieve schema from cache
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<Object|null>} Cached schema or null if not found
   */
  async getSchema(connectionId) {
    try {
      const cache = await this._getCache();
      const cached = cache[connectionId];

      if (!cached) {
        return null;
      }

      return cached.schema;
    } catch (error) {
      throw new Error(`Failed to retrieve schema from cache: ${error.message}`);
    }
  }

  /**
   * Check whether schema exists in cache
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} true if schema exists in cache
   */
  async hasSchema(connectionId) {
    try {
      const cache = await this._getCache();
      return connectionId in cache;
    } catch (error) {
      throw new Error(`Failed to check schema cache: ${error.message}`);
    }
  }

  /**
   * Delete schema from cache
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} true if schema was deleted, false if not found
   */
  async deleteSchema(connectionId) {
    try {
      const cache = await this._getCache();
      
      if (!(connectionId in cache)) {
        return false;
      }

      delete cache[connectionId];
      await this._saveCache(cache);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete schema from cache: ${error.message}`);
    }
  }

  /**
   * Clear all cached schemas
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      await this._saveCache({});
    } catch (error) {
      throw new Error(`Failed to clear schema cache: ${error.message}`);
    }
  }

  /**
   * Refresh existing schema in cache
   * @param {string} connectionId - Unique identifier for the connection
   * @param {Object} schema - New schema object
   * @returns {Promise<void>}
   */
  async refreshSchema(connectionId, schema) {
    await this.saveSchema(connectionId, schema);
  }

  /**
   * Get cache timestamp for a connection
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<number|null>} Timestamp of cached schema or null if not found
   */
  async getCacheTimestamp(connectionId) {
    try {
      const cache = await this._getCache();
      const cached = cache[connectionId];

      if (!cached) {
        return null;
      }

      return cached.timestamp;
    } catch (error) {
      throw new Error(`Failed to get cache timestamp: ${error.message}`);
    }
  }

  /**
   * Get all cached connection IDs
   * @returns {Promise<Array<string>>} Array of connection IDs with cached schemas
   */
  async getAllCachedConnections() {
    try {
      const cache = await this._getCache();
      return Object.keys(cache);
    } catch (error) {
      throw new Error(`Failed to get cached connections: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics object
   */
  async getCacheStats() {
    try {
      const cache = await this._getCache();
      const connectionIds = Object.keys(cache);
      
      let totalSize = 0;
      connectionIds.forEach(id => {
        totalSize += JSON.stringify(cache[id]).length;
      });

      return {
        connectionCount: connectionIds.length,
        totalSizeBytes: totalSize,
        oldestTimestamp: connectionIds.length > 0 
          ? Math.min(...connectionIds.map(id => cache[id].timestamp))
          : null,
        newestTimestamp: connectionIds.length > 0
          ? Math.max(...connectionIds.map(id => cache[id].timestamp))
          : null
      };
    } catch (error) {
      throw new Error(`Failed to get cache stats: ${error.message}`);
    }
  }

  /**
   * Internal method to get the cache from VS Code storage
   * @returns {Promise<Object>} Cache object
   * @private
   */
  async _getCache() {
    try {
      const cached = await this.context.globalState.get(this.cacheKey);
      return cached || {};
    } catch (error) {
      // If storage fails, return empty cache
      console.error('Error reading from global state:', error);
      return {};
    }
  }

  /**
   * Internal method to save the cache to VS Code storage
   * @param {Object} cache - Cache object to save
   * @returns {Promise<void>}
   * @private
   */
  async _saveCache(cache) {
    try {
      await this.context.globalState.update(this.cacheKey, cache);
    } catch (error) {
      throw new Error(`Failed to save to global state: ${error.message}`);
    }
  }
}

module.exports = SchemaCache;
