/**
 * QueryGenerator - Generates SQL queries from natural language
 * 
 * This module is responsible for converting natural language requests into
 * SQL queries. It receives the database schema as context to ensure generated
 * queries reference actual tables and columns. The AI layer is designed to be
 * provider-agnostic so the LLM provider can be changed later.
 * 
 * Note: This is a placeholder implementation. An actual AI provider needs to be
 * integrated to generate real queries. The architecture supports easy integration
 * of different AI providers (OpenAI, Anthropic, etc.).
 */

class QueryGenerator {
  /**
   * Create a new QueryGenerator instance
   * @param {Object} config - Configuration for the AI provider
   */
  constructor(config = {}) {
    this.config = config;
    this.aiProvider = null;
    this.isConfigured = false;
  }

  /**
   * Configure the AI provider
   * @param {string} provider - AI provider name ('openai', 'anthropic', etc.)
   * @param {Object} providerConfig - Provider-specific configuration
   * @returns {Promise<void>}
   */
  async configure(provider, providerConfig) {
    try {
      // Future implementation: Initialize specific AI provider
      // switch (provider) {
      //   case 'openai':
      //     this.aiProvider = new OpenAIProvider(providerConfig);
      //     break;
      //   case 'anthropic':
      //     this.aiProvider = new AnthropicProvider(providerConfig);
      //     break;
      //   default:
      //     throw new Error(`Unsupported AI provider: ${provider}`);
      // }
      
      this.isConfigured = true;
    } catch (error) {
      throw new Error(`Failed to configure AI provider: ${error.message}`);
    }
  }

  /**
   * Generate a SQL query from natural language
   * @param {Object} params - Generation parameters
   * @param {string} params.databaseType - Type of database ('postgresql')
   * @param {Object} params.schema - Database schema context
   * @param {string} params.userPrompt - Natural language request
   * @returns {Promise<Object>} Generated query result
   */
  async generateQuery({ databaseType, schema, userPrompt }) {
    if (!databaseType || !schema || !userPrompt) {
      throw new Error('Missing required parameters: databaseType, schema, and userPrompt');
    }

    try {
      // If AI is configured, use it
      if (this.isConfigured) {
        const schemaContext = this._buildSchemaContext(schema, databaseType);
        const prompt = this._buildPrompt(userPrompt, schemaContext, databaseType);
        
        // Future: Call AI provider
        // const generatedQuery = await this.aiProvider.generate(prompt);
        // return {
        //   query: generatedQuery,
        //   confidence: 0.95,
        //   explanation: 'Generated query description',
        //   tablesUsed: ['users'],
        //   columnsUsed: ['id', 'name', 'email', 'created_at']
        // };
      }

      // Fallback: Use rule-based generation for basic patterns
      return this._generateWithRules(userPrompt, schema, databaseType);
    } catch (error) {
      throw new Error(`Query generation failed: ${error.message}`);
    }
  }

  /**
   * Build schema context for AI prompt
   * @param {Object} schema - Database schema
   * @param {string} databaseType - Type of database
   * @returns {string} Schema context string
   * @private
   */
  _buildSchemaContext(schema, databaseType) {
    let context = `Database Type: ${databaseType}\n\n`;

    if (schema.schemas && Object.keys(schema.schemas).length > 0) {
      context += 'Schemas:\n';
      Object.values(schema.schemas).forEach(s => {
        context += `- ${s.name}\n`;
      });
      context += '\n';
    }

    if (schema.tables && schema.tables.length > 0) {
      context += 'Tables:\n';
      schema.tables.forEach(table => {
        context += `\n${table.schemaName}.${table.name}:\n`;
        
        if (table.columns && table.columns.length > 0) {
          context += '  Columns:\n';
          table.columns.forEach(col => {
            const pkMarker = col.primaryKey ? ' (PK)' : '';
            const nullableMarker = col.nullable ? ' NULL' : ' NOT NULL';
            context += `    - ${col.name}: ${col.dataType}${pkMarker}${nullableMarker}\n`;
          });
        }

        if (table.foreignKeys && table.foreignKeys.length > 0) {
          context += '  Foreign Keys:\n';
          table.foreignKeys.forEach(fk => {
            context += `    - ${fk.name}: ${fk.columns.join(', ')} -> ${fk.referencedSchema}.${fk.referencedTable}(${fk.referencedColumns.join(', ')})\n`;
          });
        }
      });
    }

    if (schema.relationships && schema.relationships.length > 0) {
      context += '\nRelationships:\n';
      schema.relationships.forEach(rel => {
        context += `- ${rel.fromSchema}.${rel.fromTable}.${rel.fromColumn} -> ${rel.toSchema}.${rel.toTable}.${rel.toColumn}\n`;
      });
    }

    return context;
  }

  /**
   * Build prompt for AI
   * @param {string} userPrompt - User's natural language request
   * @param {string} schemaContext - Schema context string
   * @param {string} databaseType - Type of database
   * @returns {string} Complete prompt for AI
   * @private
   */
  _buildPrompt(userPrompt, schemaContext, databaseType) {
    return `You are a SQL expert. Generate a ${databaseType} SQL query based on the user's natural language request.

${schemaContext}

User Request: ${userPrompt}

Generate a SQL query that answers the user's request. Only use tables and columns that exist in the schema above.
Return only the SQL query, no explanations or additional text.`;
  }

  /**
   * Validate generated query against schema
   * @param {string} query - Generated SQL query
   * @param {Object} schema - Database schema
   * @returns {Object} Validation result
   */
  validateGeneratedQuery(query, schema) {
    const errors = [];
    const warnings = [];

    if (!query || query.trim().length === 0) {
      errors.push('Generated query is empty');
      return { valid: false, errors, warnings };
    }

    // Check if query references tables that exist
    const tableNames = this._extractTableNames(query);
    const availableTables = schema.tables.map(t => `${t.schemaName}.${t.name}`);
    
    tableNames.forEach(tableName => {
      const tableExists = availableTables.some(at => 
        at.toLowerCase() === tableName.toLowerCase() ||
        at.endsWith(`.${tableName.toLowerCase()}`)
      );
      
      if (!tableExists) {
        errors.push(`Query references non-existent table: ${tableName}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Extract table names from SQL query
   * @param {string} query - SQL query
   * @returns {Array<string>} Array of table names
   * @private
   */
  _extractTableNames(query) {
    const upperQuery = query.toUpperCase();
    const tables = [];

    // Extract FROM tables
    const fromMatch = upperQuery.match(/FROM\s+([^\s,;]+)/i);
    if (fromMatch) {
      tables.push(fromMatch[1].trim());
    }

    // Extract JOIN tables
    const joinMatches = upperQuery.match(/JOIN\s+([^\s,;]+)/gi);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const tableName = match.replace(/JOIN\s+/i, '').trim();
        tables.push(tableName);
      });
    }

    return [...new Set(tables)];
  }

  /**
   * Generate SQL using rule-based patterns (fallback when AI is not configured)
   * @param {string} userPrompt - Natural language request
   * @param {Object} schema - Database schema
   * @param {string} databaseType - Type of database
   * @returns {Object} Generated query result
   * @private
   */
  _generateWithRules(userPrompt, schema, databaseType) {
    const prompt = userPrompt.toLowerCase();
    
    // Extract table name from schema
    const tableName = this._extractTableName(prompt, schema);
    if (!tableName) {
      throw new Error('Could not determine which table to query. Please specify a table name in your request.');
    }

    let query = '';
    let explanation = '';
    const columns = this._extractColumns(prompt, schema, tableName);

    // Pattern: "get all [table]" or "show all [table]" or "select all [table]"
    if (prompt.match(/get all|show all|select all|list all|all \w+/)) {
      query = `SELECT * FROM ${tableName}`;
      explanation = `Retrieving all records from ${tableName}`;
    }
    // Pattern: "get [table]" or "show [table]" or "select [table]"
    else if (prompt.match(/get |show |select |list /)) {
      if (columns.length > 0) {
        query = `SELECT ${columns.join(', ')} FROM ${tableName}`;
        explanation = `Retrieving specific columns from ${tableName}`;
      } else {
        query = `SELECT * FROM ${tableName}`;
        explanation = `Retrieving all records from ${tableName}`;
      }
    }
    // Pattern: "count [table]"
    else if (prompt.match(/count /)) {
      query = `SELECT COUNT(*) FROM ${tableName}`;
      explanation = `Counting records in ${tableName}`;
    }
    // Default fallback
    else {
      query = `SELECT * FROM ${tableName}`;
      explanation = `Retrieving all records from ${tableName}`;
    }

    // Add LIMIT clause if specified
    const limitMatch = prompt.match(/limit (\d+)/);
    if (limitMatch) {
      query += ` LIMIT ${limitMatch[1]}`;
      explanation += ` (limited to ${limitMatch[1]} records)`;
    }

    // Add ORDER BY if specified
    if (prompt.includes('order by') || prompt.includes('sort by')) {
      const orderColumn = this._extractOrderColumn(prompt, schema, tableName);
      if (orderColumn) {
        const direction = prompt.includes('desc') ? 'DESC' : 'ASC';
        query += ` ORDER BY ${orderColumn} ${direction}`;
        explanation += ` (sorted by ${orderColumn} ${direction})`;
      }
    }

    // Add WHERE clause for simple conditions
    const whereCondition = this._extractWhereCondition(prompt, schema, tableName);
    if (whereCondition) {
      query += ` WHERE ${whereCondition}`;
      explanation += ` (filtered by condition)`;
    }

    return {
      query: query,
      confidence: 0.6,
      explanation: explanation,
      tablesUsed: [tableName],
      columnsUsed: columns.length > 0 ? columns : ['*']
    };
  }

  /**
   * Extract table name from prompt using schema
   * @param {string} prompt - Lowercase user prompt
   * @param {Object} schema - Database schema
   * @returns {string|null} Table name or null
   * @private
   */
  _extractTableName(prompt, schema) {
    if (!schema.tables || schema.tables.length === 0) {
      return null;
    }

    // Try to find table name mentioned in prompt
    for (const table of schema.tables) {
      const tableName = table.name.toLowerCase();
      const fullTableName = `${table.schemaName}.${table.name}`.toLowerCase();
      
      if (prompt.includes(tableName) || prompt.includes(fullTableName)) {
        return fullTableName;
      }
    }

    // If no match, return first table
    const firstTable = schema.tables[0];
    return `${firstTable.schemaName}.${firstTable.name}`;
  }

  /**
   * Extract column names from prompt
   * @param {string} prompt - Lowercase user prompt
   * @param {Object} schema - Database schema
   * @param {string} tableName - Full table name
   * @returns {Array<string>} Column names
   * @private
   */
  _extractColumns(prompt, schema, tableName) {
    const table = schema.tables.find(t => 
      `${t.schemaName}.${t.name}` === tableName || t.name === tableName
    );

    if (!table || !table.columns) {
      return [];
    }

    const mentionedColumns = [];
    for (const col of table.columns) {
      if (prompt.includes(col.name.toLowerCase())) {
        mentionedColumns.push(col.name);
      }
    }

    return mentionedColumns;
  }

  /**
   * Extract order by column from prompt
   * @param {string} prompt - Lowercase user prompt
   * @param {Object} schema - Database schema
   * @param {string} tableName - Full table name
   * @returns {string|null} Column name or null
   * @private
   */
  _extractOrderColumn(prompt, schema, tableName) {
    const table = schema.tables.find(t => 
      `${t.schemaName}.${t.name}` === tableName || t.name === tableName
    );

    if (!table || !table.columns) {
      return null;
    }

    for (const col of table.columns) {
      if (prompt.includes(col.name.toLowerCase())) {
        return col.name;
      }
    }

    return null;
  }

  /**
   * Extract WHERE condition from prompt (simple implementation)
   * @param {string} prompt - Lowercase user prompt
   * @param {Object} schema - Database schema
   * @param {string} tableName - Full table name
   * @returns {string|null} WHERE condition or null
   * @private
   */
  _extractWhereCondition(prompt, schema, tableName) {
    const table = schema.tables.find(t => 
      `${t.schemaName}.${t.name}` === tableName || t.name === tableName
    );

    if (!table || !table.columns) {
      return null;
    }

    // Simple pattern: "where column = value"
    const whereMatch = prompt.match(/where (\w+)\s*=\s*(\w+)/i);
    if (whereMatch) {
      const column = whereMatch[1];
      const value = whereMatch[2];
      
      // Check if column exists
      const colExists = table.columns.some(c => c.name.toLowerCase() === column.toLowerCase());
      if (colExists) {
        // Add quotes for string values
        const isNumeric = !isNaN(value);
        return `${column} = ${isNumeric ? value : `'${value}'`}`;
      }
    }

    return null;
  }

  /**
   * Check if AI provider is configured
   * @returns {boolean} true if configured
   */
  isReady() {
    return this.isConfigured;
  }
}

module.exports = QueryGenerator;
