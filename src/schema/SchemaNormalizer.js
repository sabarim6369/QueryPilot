/**
 * SchemaNormalizer - Converts database-specific metadata to common schema format
 * 
 * This module is responsible for taking raw schema data from database adapters
 * and converting it into QueryPilot's database-independent schema representation.
 * This allows the rest of the application to work with a consistent schema format
 * regardless of the underlying database type.
 */

const { ColumnSchema, ForeignKey, Index, TableSchema, Relationship, DatabaseSchema } = require('./SchemaTypes');

class SchemaNormalizer {
  /**
   * Normalize PostgreSQL schema data to common format
   * @param {Object} rawSchema - Raw schema data from PostgresAdapter
   * @returns {DatabaseSchema} Normalized database schema
   */
  static normalizePostgreSQLSchema(rawSchema) {
    const { databaseType, databaseName, schemas, tables, relationships } = rawSchema;

    // Convert tables to TableSchema objects
    const normalizedTables = tables.map(table => {
      const columns = table.columns.map(col => 
        new ColumnSchema({
          name: col.name,
          dataType: col.dataType,
          nullable: col.nullable,
          defaultValue: col.defaultValue,
          primaryKey: col.primaryKey || false
        })
      );

      const foreignKeys = table.foreignKeys.map(fk =>
        new ForeignKey({
          name: fk.name,
          columns: fk.columns,
          referencedSchema: fk.referencedSchema,
          referencedTable: fk.referencedTable,
          referencedColumns: fk.referencedColumns
        })
      );

      const indexes = table.indexes.map(idx =>
        new Index({
          name: idx.name,
          columns: idx.columns,
          unique: idx.unique
        })
      );

      return new TableSchema({
        schemaName: table.schemaName,
        name: table.name,
        columns: columns,
        primaryKey: table.primaryKey,
        foreignKeys: foreignKeys,
        indexes: indexes
      });
    });

    // Convert relationships to Relationship objects
    const normalizedRelationships = relationships.map(rel =>
      new Relationship({
        fromSchema: rel.fromSchema,
        fromTable: rel.fromTable,
        fromColumn: rel.fromColumn,
        toSchema: rel.toSchema,
        toTable: rel.toTable,
        toColumn: rel.toColumn,
        type: rel.type || 'foreign_key'
      })
    );

    return new DatabaseSchema({
      databaseType: databaseType,
      schemas: schemas,
      tables: normalizedTables,
      relationships: normalizedRelationships
    });
  }

  /**
   * Normalize schema data based on database type
   * @param {string} databaseType - Type of database ('postgresql', 'mysql', etc.)
   * @param {Object} rawSchema - Raw schema data from database adapter
   * @returns {DatabaseSchema} Normalized database schema
   * @throws {Error} If database type is not supported
   */
  static normalizeSchema(databaseType, rawSchema) {
    const normalizedType = databaseType.toLowerCase();

    switch (normalizedType) {
      case 'postgresql':
      case 'postgres':
        return this.normalizePostgreSQLSchema(rawSchema);
      
      // Future database types can be added here:
      // case 'mysql':
      //   return this.normalizeMySQLSchema(rawSchema);
      // case 'mongodb':
      //   return this.normalizeMongoDBSchema(rawSchema);
      // case 'sqlite':
      //   return this.normalizeSQLiteSchema(rawSchema);
      // case 'sqlserver':
      //   return this.normalizeSQLServerSchema(rawSchema);
      
      default:
        throw new Error(`Schema normalization not supported for database type: ${databaseType}`);
    }
  }

  /**
   * Validate that the normalized schema has required structure
   * @param {DatabaseSchema} schema - Normalized schema to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  static validateSchema(schema) {
    const errors = [];

    if (!schema) {
      errors.push('Schema is null or undefined');
      return { valid: false, errors };
    }

    if (!schema.databaseType) {
      errors.push('Schema missing databaseType');
    }

    if (!Array.isArray(schema.tables)) {
      errors.push('Schema tables is not an array');
    } else {
      schema.tables.forEach((table, index) => {
        if (!table.schemaName) {
          errors.push(`Table at index ${index} missing schemaName`);
        }
        if (!table.name) {
          errors.push(`Table at index ${index} missing name`);
        }
        if (!Array.isArray(table.columns)) {
          errors.push(`Table ${table.schemaName}.${table.name} columns is not an array`);
        }
      });
    }

    if (!Array.isArray(schema.relationships)) {
      errors.push('Schema relationships is not an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = SchemaNormalizer;
