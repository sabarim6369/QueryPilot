/**
 * SchemaManager - Manages database schema operations
 * 
 * This module is responsible for loading cached schema, fetching fresh schema,
 * normalizing schema, caching schema, and refreshing schema. It depends on the
 * database adapter and SchemaCache.
 */

const SchemaCache = require('../schema/SchemaCache');
const SchemaNormalizer = require('../schema/SchemaNormalizer');

class SchemaManager {
  /**
   * Create a new SchemaManager instance
   * @param {Object} context - VS Code extension context
   */
  constructor(context) {
    this.context = context;
    this.schemaCache = new SchemaCache(context);
  }

  /**
   * Load schema from cache
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<Object|null>} Cached schema or null if not found
   */
  async loadCachedSchema(connectionId) {
    try {
      return await this.schemaCache.getSchema(connectionId);
    } catch (error) {
      throw new Error(`Failed to load cached schema: ${error.message}`);
    }
  }

  /**
   * Fetch fresh schema from database
   * @param {DatabaseAdapter} adapter - Database adapter to use
   * @param {string} databaseType - Type of database
   * @returns {Promise<Object>} Fresh schema from database
   */
  async fetchFreshSchema(adapter, databaseType) {
    try {
      if (!adapter) {
        throw new Error('No database adapter provided');
      }

      // Get raw schema from adapter
      const rawSchema = await adapter.getSchema();

      // Normalize schema to common format
      const normalizedSchema = SchemaNormalizer.normalizeSchema(databaseType, rawSchema);

      // Validate normalized schema
      const validation = SchemaNormalizer.validateSchema(normalizedSchema);
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
      }

      return normalizedSchema;
    } catch (error) {
      throw new Error(`Failed to fetch fresh schema: ${error.message}`);
    }
  }

  /**
   * Cache schema
   * @param {string} connectionId - Unique identifier for the connection
   * @param {Object} schema - Schema to cache
   * @returns {Promise<void>}
   */
  async cacheSchema(connectionId, schema) {
    try {
      await this.schemaCache.saveSchema(connectionId, schema);
    } catch (error) {
      throw new Error(`Failed to cache schema: ${error.message}`);
    }
  }

  /**
   * Refresh schema - fetch fresh schema and update cache
   * @param {string} connectionId - Unique identifier for the connection
   * @param {DatabaseAdapter} adapter - Database adapter to use
   * @param {string} databaseType - Type of database
   * @returns {Promise<Object>} Fresh schema
   */
  async refreshSchema(connectionId, adapter, databaseType) {
    try {
      // Fetch fresh schema
      const freshSchema = await this.fetchFreshSchema(adapter, databaseType);

      // Update cache
      await this.schemaCache.refreshSchema(connectionId, freshSchema);

      return freshSchema;
    } catch (error) {
      throw new Error(`Failed to refresh schema: ${error.message}`);
    }
  }

  /**
   * Get schema - tries cache first, falls back to database
   * @param {string} connectionId - Unique identifier for the connection
   * @param {DatabaseAdapter} adapter - Database adapter to use
   * @param {string} databaseType - Type of database
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Object>} Schema
   */
  async getSchema(connectionId, adapter, databaseType, forceRefresh = false) {
    try {
      // If force refresh, skip cache
      if (forceRefresh) {
        return await this.refreshSchema(connectionId, adapter, databaseType);
      }

      // Try to load from cache
      const cachedSchema = await this.loadCachedSchema(connectionId);
      if (cachedSchema) {
        return cachedSchema;
      }

      // If not in cache, fetch from database
      const freshSchema = await this.fetchFreshSchema(adapter, databaseType);
      await this.cacheSchema(connectionId, freshSchema);

      return freshSchema;
    } catch (error) {
      throw new Error(`Failed to get schema: ${error.message}`);
    }
  }

  /**
   * Check if schema is cached
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} true if schema is cached
   */
  async isSchemaCached(connectionId) {
    try {
      return await this.schemaCache.hasSchema(connectionId);
    } catch (error) {
      throw new Error(`Failed to check if schema is cached: ${error.message}`);
    }
  }

  /**
   * Delete cached schema
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} true if schema was deleted
   */
  async deleteCachedSchema(connectionId) {
    try {
      return await this.schemaCache.deleteSchema(connectionId);
    } catch (error) {
      throw new Error(`Failed to delete cached schema: ${error.message}`);
    }
  }

  /**
   * Clear all cached schemas
   * @returns {Promise<void>}
   */
  async clearAllCachedSchemas() {
    try {
      await this.schemaCache.clearCache();
    } catch (error) {
      throw new Error(`Failed to clear cached schemas: ${error.message}`);
    }
  }

  /**
   * Get cache timestamp
   * @param {string} connectionId - Unique identifier for the connection
   * @returns {Promise<number|null>} Cache timestamp or null
   */
  async getCacheTimestamp(connectionId) {
    try {
      return await this.schemaCache.getCacheTimestamp(connectionId);
    } catch (error) {
      throw new Error(`Failed to get cache timestamp: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      return await this.schemaCache.getCacheStats();
    } catch (error) {
      throw new Error(`Failed to get cache stats: ${error.message}`);
    }
  }
}

module.exports = SchemaManager;
