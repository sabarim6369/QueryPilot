/**
 * SchemaTypes - Database-independent schema representation
 * 
 * This module defines the common schema types that work across different
 * database systems (PostgreSQL, MySQL, MongoDB, etc.). The design is flexible
 * enough to handle both relational databases and document stores like MongoDB.
 */

/**
 * ColumnSchema - Represents a column in a relational database table
 */
class ColumnSchema {
  constructor({ name, dataType, nullable = false, defaultValue = null, primaryKey = false }) {
    this.name = name;
    this.dataType = dataType;
    this.nullable = nullable;
    this.defaultValue = defaultValue;
    this.primaryKey = primaryKey;
  }
}

/**
 * ForeignKey - Represents a foreign key relationship
 */
class ForeignKey {
  constructor({ name, columns, referencedSchema, referencedTable, referencedColumns }) {
    this.name = name;
    this.columns = columns; // Array of column names
    this.referencedSchema = referencedSchema;
    this.referencedTable = referencedTable;
    this.referencedColumns = referencedColumns; // Array of column names
  }
}

/**
 * Index - Represents a database index
 */
class Index {
  constructor({ name, columns, unique = false }) {
    this.name = name;
    this.columns = columns; // Array of column names
    this.unique = unique;
  }
}

/**
 * TableSchema - Represents a table in a relational database
 */
class TableSchema {
  constructor({ schemaName, name, columns = [], primaryKey = null, foreignKeys = [], indexes = [] }) {
    this.schemaName = schemaName;
    this.name = name;
    this.columns = columns; // Array of ColumnSchema
    this.primaryKey = primaryKey; // Array of column names or null
    this.foreignKeys = foreignKeys; // Array of ForeignKey
    this.indexes = indexes; // Array of Index
  }

  /**
   * Get column by name
   * @param {string} columnName - Column name
   * @returns {ColumnSchema|null}
   */
  getColumn(columnName) {
    return this.columns.find(col => col.name === columnName) || null;
  }

  /**
   * Get foreign key by name
   * @param {string} fkName - Foreign key name
   * @returns {ForeignKey|null}
   */
  getForeignKey(fkName) {
    return this.foreignKeys.find(fk => fk.name === fkName) || null;
  }

  /**
   * Get index by name
   * @param {string} indexName - Index name
   * @returns {Index|null}
   */
  getIndex(indexName) {
    return this.indexes.find(idx => idx.name === indexName) || null;
  }
}

/**
 * Relationship - Represents a relationship between tables
 */
class Relationship {
  constructor({ fromSchema, fromTable, fromColumn, toSchema, toTable, toColumn, type = 'foreign_key' }) {
    this.fromSchema = fromSchema;
    this.fromTable = fromTable;
    this.fromColumn = fromColumn;
    this.toSchema = toSchema;
    this.toTable = toTable;
    this.toColumn = toColumn;
    this.type = type; // 'foreign_key', 'one_to_one', 'one_to_many', 'many_to_many'
  }
}

/**
 * DatabaseSchema - Represents the complete database schema
 */
class DatabaseSchema {
  constructor({ databaseType, schemas = {}, tables = [], relationships = [] }) {
    this.databaseType = databaseType; // 'postgresql', 'mysql', 'mongodb', etc.
    this.schemas = schemas; // Object with schema names as keys and metadata as values
    this.tables = tables; // Array of TableSchema
    this.relationships = relationships; // Array of Relationship
  }

  /**
   * Get table by schema and name
   * @param {string} schemaName - Schema name
   * @param {string} tableName - Table name
   * @returns {TableSchema|null}
   */
  getTable(schemaName, tableName) {
    return this.tables.find(table => 
      table.schemaName === schemaName && table.name === tableName
    ) || null;
  }

  /**
   * Get all tables in a schema
   * @param {string} schemaName - Schema name
   * @returns {Array<TableSchema>}
   */
  getTablesBySchema(schemaName) {
    return this.tables.filter(table => table.schemaName === schemaName);
  }

  /**
   * Get all relationships for a table
   * @param {string} schemaName - Schema name
   * @param {string} tableName - Table name
   * @returns {Array<Relationship>}
   */
  getRelationshipsForTable(schemaName, tableName) {
    return this.relationships.filter(rel => 
      (rel.fromSchema === schemaName && rel.fromTable === tableName) ||
      (rel.toSchema === schemaName && rel.toTable === tableName)
    );
  }

  /**
   * Get all schema names
   * @returns {Array<string>}
   */
  getSchemaNames() {
    return Object.keys(this.schemas);
  }
}

module.exports = {
  ColumnSchema,
  ForeignKey,
  Index,
  TableSchema,
  Relationship,
  DatabaseSchema
};
