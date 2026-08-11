/**
 * DatabaseFactory - Factory for creating database adapters
 * 
 * This factory is responsible for selecting and instantiating the correct
 * database adapter based on the database type. It makes it easy to add
 * support for new database types without changing the core application.
 */

const PostgresAdapter = require('./postgres/PostgresAdapter');

class DatabaseFactory {
  /**
   * Create a database adapter for the specified database type
   * @param {string} databaseType - The type of database ('postgresql', 'mysql', 'mongodb', etc.)
   * @returns {DatabaseAdapter} The appropriate database adapter
   * @throws {Error} If the database type is not supported
   */
  static createAdapter(databaseType) {
    const normalizedType = databaseType.toLowerCase();

    switch (normalizedType) {
      case 'postgresql':
      case 'postgres':
        return new PostgresAdapter();
      
      // Future database types can be added here:
      // case 'mysql':
      //   return new MySQLAdapter();
      // case 'mongodb':
      //   return new MongoAdapter();
      // case 'sqlite':
      //   return new SQLiteAdapter();
      // case 'sqlserver':
      //   return new SQLServerAdapter();
      
      default:
        throw new Error(`Unsupported database type: ${databaseType}. Supported types: postgresql`);
    }
  }

  /**
   * Get list of supported database types
   * @returns {Array<string>} Array of supported database type identifiers
   */
  static getSupportedDatabaseTypes() {
    return ['postgresql', 'postgres'];
  }

  /**
   * Check if a database type is supported
   * @param {string} databaseType - The database type to check
   * @returns {boolean} true if the database type is supported
   */
  static isSupported(databaseType) {
    return this.getSupportedDatabaseTypes().includes(databaseType.toLowerCase());
  }
}

module.exports = DatabaseFactory;
