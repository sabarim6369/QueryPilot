/**
 * PostgresAdapter - PostgreSQL-specific database adapter
 * 
 * This adapter implements the DatabaseAdapter interface for PostgreSQL.
 * It uses the 'pg' package for database connectivity and PostgreSQL's
 * system catalogs for schema discovery.
 */

const { Pool, Client } = require('pg');
const DatabaseAdapter = require('../DatabaseAdapter');

class PostgresAdapter extends DatabaseAdapter {
  constructor() {
    super();
    this.pool = null;
    this.client = null;
    this.connectionConfig = null;
    this._connected = false;
  }

  /**
   * Connect to PostgreSQL database
   * @param {Object} connectionConfig - Connection configuration
   * @param {string} connectionConfig.host - Database host
   * @param {number} connectionConfig.port - Database port
   * @param {string} connectionConfig.database - Database name
   * @param {string} connectionConfig.user - Username
   * @param {string} connectionConfig.password - Password
   * @param {string} connectionConfig.connectionString - Optional connection string
   * @returns {Promise<void>}
   */
  async connect(connectionConfig) {
    try {
      this.connectionConfig = connectionConfig;

      // Use connection string if provided, otherwise build from individual params
      const config = connectionConfig.connectionString 
        ? { connectionString: connectionConfig.connectionString }
        : {
            host: connectionConfig.host || 'localhost',
            port: connectionConfig.port || 5432,
            database: connectionConfig.database,
            user: connectionConfig.user,
            password: connectionConfig.password,
          };

      // Create a connection pool
      this.pool = new Pool(config);

      // Test the connection
      await this.testConnection();

      this._connected = true;
    } catch (error) {
      this._connected = false;
      this.pool = null;
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
    }
  }

  /**
   * Disconnect from PostgreSQL database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      if (this.client) {
        await this.client.end();
        this.client = null;
      }
      this._connected = false;
      this.connectionConfig = null;
    } catch (error) {
      throw new Error(`Failed to disconnect from PostgreSQL: ${error.message}`);
    }
  }

  /**
   * Test the database connection
   * @returns {Promise<boolean>} true if connection is successful
   */
  async testConnection() {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get the database schema
   * @returns {Promise<Object>} Database schema information
   */
  async getSchema() {
    if (!this._connected || !this.pool) {
      throw new Error('Not connected to database');
    }

    const client = await this.pool.connect();

    try {
      // Get database name
      const dbResult = await client.query('SELECT current_database()');
      const databaseName = dbResult.rows[0].current_database;

      // Get all schemas
      const schemasResult = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);

      const schemas = {};
      schemasResult.rows.forEach(row => {
        schemas[row.schema_name] = { name: row.schema_name };
      });

      // Get all tables with their columns
      const tablesResult = await client.query(`
        SELECT 
          t.table_schema,
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.ordinal_position
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE t.table_type = 'BASE TABLE'
          AND t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY t.table_schema, t.table_name, c.ordinal_position
      `);

      // Organize tables and columns
      const tablesMap = new Map();

      tablesResult.rows.forEach(row => {
        const key = `${row.table_schema}.${row.table_name}`;
        
        if (!tablesMap.has(key)) {
          tablesMap.set(key, {
            schemaName: row.table_schema,
            name: row.table_name,
            columns: []
          });
        }

        const table = tablesMap.get(key);
        table.columns.push({
          name: row.column_name,
          dataType: row.data_type,
          nullable: row.is_nullable === 'YES',
          defaultValue: row.column_default
        });
      });

      // Get primary keys
      const primaryKeyResult = await client.query(`
        SELECT 
          tc.table_schema,
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
      `);

      const primaryKeysMap = new Map();
      primaryKeyResult.rows.forEach(row => {
        const key = `${row.table_schema}.${row.table_name}`;
        if (!primaryKeysMap.has(key)) {
          primaryKeysMap.set(key, []);
        }
        primaryKeysMap.get(key).push(row.column_name);
      });

      // Get foreign keys
      const foreignKeyResult = await client.query(`
        SELECT
          tc.table_schema,
          tc.table_name,
          tc.constraint_name,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
      `);

      const foreignKeysMap = new Map();
      foreignKeyResult.rows.forEach(row => {
        const key = `${row.table_schema}.${row.table_name}`;
        if (!foreignKeysMap.has(key)) {
          foreignKeysMap.set(key, []);
        }
        foreignKeysMap.get(key).push({
          name: row.constraint_name,
          columns: [row.column_name],
          referencedSchema: row.foreign_table_schema,
          referencedTable: row.foreign_table_name,
          referencedColumns: [row.foreign_column_name]
        });
      });

      // Get indexes
      const indexResult = await client.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schemaname, tablename, indexname
      `);

      const indexesMap = new Map();
      indexResult.rows.forEach(row => {
        const key = `${row.schemaname}.${row.tablename}`;
        if (!indexesMap.has(key)) {
          indexesMap.set(key, []);
        }

        // Parse index definition to extract columns and uniqueness
        const isUnique = row.indexdef.toLowerCase().includes('create unique index');
        const columnsMatch = row.indexdef.match(/\(([^)]+)\)/);
        const columns = columnsMatch 
          ? columnsMatch[1].split(',').map(col => col.trim().replace(/"/g, ''))
          : [];

        indexesMap.get(key).push({
          name: row.indexname,
          columns: columns,
          unique: isUnique
        });
      });

      // Build final table objects
      const tables = [];
      tablesMap.forEach((tableData, key) => {
        const [schemaName, tableName] = key.split('.');

        // Mark primary key columns
        const pks = primaryKeysMap.get(key) || [];
        tableData.columns.forEach(col => {
          col.primaryKey = pks.includes(col.name);
        });

        tables.push({
          schemaName: schemaName,
          name: tableName,
          columns: tableData.columns,
          primaryKey: pks.length > 0 ? pks : null,
          foreignKeys: foreignKeysMap.get(key) || [],
          indexes: indexesMap.get(key) || []
        });
      });

      // Build relationships from foreign keys
      const relationships = [];
      foreignKeyResult.rows.forEach(row => {
        relationships.push({
          fromSchema: row.table_schema,
          fromTable: row.table_name,
          fromColumn: row.column_name,
          toSchema: row.foreign_table_schema,
          toTable: row.foreign_table_name,
          toColumn: row.foreign_column_name,
          type: 'foreign_key'
        });
      });

      return {
        databaseType: 'postgresql',
        databaseName: databaseName,
        schemas: schemas,
        tables: tables,
        relationships: relationships
      };
    } catch (error) {
      throw new Error(`Failed to retrieve schema: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query
   * @param {string} query - SQL query to execute
   * @returns {Promise<Object>} Query results
   */
  async executeQuery(query) {
    if (!this._connected || !this.pool) {
      throw new Error('Not connected to database');
    }

    try {
      const result = await this.pool.query(query);
      
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields,
        command: result.command
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Get the database type
   * @returns {string} Database type identifier
   */
  getDatabaseType() {
    return 'postgresql';
  }

  /**
   * Check if currently connected
   * @returns {boolean} true if connected
   */
  isConnected() {
    return this._connected && this.pool !== null;
  }
}

module.exports = PostgresAdapter;
