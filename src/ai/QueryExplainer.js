/**
 * QueryExplainer - Explains SQL queries in simple language
 * 
 * This module is responsible for explaining generated SQL queries in simple,
 * human-readable language. It describes what tables are accessed, what columns
 * are used, what filtering is happening, and any special conditions. It does
 * not execute the query.
 * 
 * Note: This is a basic implementation that uses pattern matching. For more
 * sophisticated explanations, an AI provider could be integrated similar to
 * QueryGenerator.
 */

class QueryExplainer {
  /**
   * Create a new QueryExplainer instance
   * @param {Object} config - Configuration (optional, for future AI integration)
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Explain a SQL query in simple language
   * @param {string} query - SQL query to explain
   * @param {Object} schema - Database schema context (optional)
   * @returns {Promise<Object>} Explanation result
   */
  async explain(query, schema = null) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    try {
      const normalizedQuery = query.trim();
      const explanation = this._analyzeQuery(normalizedQuery, schema);

      return {
        query: normalizedQuery,
        explanation: explanation,
        summary: this._generateSummary(explanation)
      };
    } catch (error) {
      throw new Error(`Query explanation failed: ${error.message}`);
    }
  }

  /**
   * Analyze query and extract explanation components
   * @param {string} query - SQL query to analyze
   * @param {Object} schema - Database schema context
   * @returns {Object} Query analysis
   * @private
   */
  _analyzeQuery(query, schema) {
    const upperQuery = query.toUpperCase();
    const analysis = {
      type: this._getQueryType(upperQuery),
      tables: this._extractTables(upperQuery),
      columns: this._extractColumns(query, upperQuery),
      joins: this._extractJoins(upperQuery),
      whereClause: this._extractWhereClause(upperQuery),
      orderBy: this._extractOrderBy(upperQuery),
      groupBy: this._extractGroupBy(upperQuery),
      limit: this._extractLimit(upperQuery),
      aggregations: this._extractAggregations(upperQuery)
    };

    return analysis;
  }

  /**
   * Get query type
   * @param {string} upperQuery - Uppercase query
   * @returns {string} Query type
   * @private
   */
  _getQueryType(upperQuery) {
    if (upperQuery.startsWith('SELECT')) {
      return 'SELECT';
    } else if (upperQuery.startsWith('WITH')) {
      return 'WITH (CTE)';
    }
    return 'UNKNOWN';
  }

  /**
   * Extract table names from query
   * @param {string} upperQuery - Uppercase query
   * @returns {Array<Object>} Array of table objects
   * @private
   */
  _extractTables(upperQuery) {
    const tables = [];

    // Extract FROM tables
    const fromMatch = upperQuery.match(/FROM\s+([^\s,;]+)/i);
    if (fromMatch) {
      tables.push({
        name: fromMatch[1].trim(),
        role: 'primary'
      });
    }

    // Extract JOIN tables
    const joinMatches = upperQuery.match(/(?:LEFT\s+|RIGHT\s+|INNER\s+|FULL\s+)?JOIN\s+([^\s,;]+)/gi);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const tableName = match.replace(/(?:LEFT\s+|RIGHT\s+|INNER\s+|FULL\s+)?JOIN\s+/i, '').trim();
        tables.push({
          name: tableName,
          role: 'joined'
        });
      });
    }

    return tables;
  }

  /**
   * Extract column names from query
   * @param {string} query - Original query
   * @param {string} upperQuery - Uppercase query
   * @returns {Array<Object>} Array of column objects
   * @private
   */
  _extractColumns(query, upperQuery) {
    const columns = [];

    // Extract columns from SELECT clause
    const selectMatch = upperQuery.match(/SELECT\s+(.*?)\s+FROM/i);
    if (selectMatch) {
      const selectClause = selectMatch[1].trim();
      
      if (selectClause === '*') {
        columns.push({
          name: '*',
          description: 'all columns'
        });
      } else {
        const columnList = selectClause.split(',');
        columnList.forEach(col => {
          const trimmedCol = col.trim();
          columns.push({
            name: trimmedCol,
            description: trimmedCol
          });
        });
      }
    }

    return columns;
  }

  /**
   * Extract JOIN information
   * @param {string} upperQuery - Uppercase query
   * @returns {Array<Object>} Array of join objects
   * @private
   */
  _extractJoins(upperQuery) {
    const joins = [];

    const joinPattern = /((?:LEFT\s+|RIGHT\s+|INNER\s+|FULL\s+)?JOIN)\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+([^;]+)/gi;
    let match;

    while ((match = joinPattern.exec(upperQuery)) !== null) {
      joins.push({
        type: match[1].trim(),
        table: match[2].trim(),
        alias: match[3] ? match[3].trim() : null,
        condition: match[4].trim()
      });
    }

    return joins;
  }

  /**
   * Extract WHERE clause
   * @param {string} upperQuery - Uppercase query
   * @returns {Object|null} WHERE clause analysis
   * @private
   */
  _extractWhereClause(upperQuery) {
    const whereMatch = upperQuery.match(/WHERE\s+(.*?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i);
    
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      return {
        raw: whereClause,
        conditions: this._parseConditions(whereClause)
      };
    }

    return null;
  }

  /**
   * Parse WHERE conditions
   * @param {string} whereClause - WHERE clause string
   * @returns {Array<Object>} Array of condition objects
   * @private
   */
  _parseConditions(whereClause) {
    const conditions = [];
    
    // Simple parsing - split by AND/OR
    const parts = whereClause.split(/\s+AND\s+|\s+OR\s+/i);
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed) {
        conditions.push({
          raw: trimmed,
          description: this._describeCondition(trimmed)
        });
      }
    });

    return conditions;
  }

  /**
   * Describe a condition in simple language
   * @param {string} condition - Condition string
   * @returns {string} Description
   * @private
   */
  _describeCondition(condition) {
    const upperCondition = condition.toUpperCase();
    
    // Date conditions
    if (upperCondition.includes('NOW()') || upperCondition.includes('CURRENT_DATE')) {
      if (upperCondition.includes('>=')) {
        return 'matches records from the current time onwards';
      } else if (upperCondition.includes('<=')) {
        return 'matches records up to the current time';
      } else if (upperCondition.includes('>')) {
        return 'matches records after the current time';
      } else if (upperCondition.includes('<')) {
        return 'matches records before the current time';
      }
    }

    // Interval conditions
    if (upperCondition.includes('INTERVAL')) {
      return 'matches records within a specific time range';
    }

    // LIKE conditions
    if (upperCondition.includes('LIKE')) {
      return 'matches records with a pattern';
    }

    // IN conditions
    if (upperCondition.includes(' IN ')) {
      return 'matches records in a specific list';
    }

    // BETWEEN conditions
    if (upperCondition.includes('BETWEEN')) {
      return 'matches records within a range';
    }

    // Simple comparison
    if (upperCondition.includes('=')) {
      return 'matches records that exactly equal a value';
    } else if (upperCondition.includes('>')) {
      return 'matches records greater than a value';
    } else if (upperCondition.includes('<')) {
      return 'matches records less than a value';
    }

    return 'applies a filter condition';
  }

  /**
   * Extract ORDER BY clause
   * @param {string} upperQuery - Uppercase query
   * @returns {Object|null} ORDER BY analysis
   * @private
   */
  _extractOrderBy(upperQuery) {
    const orderByMatch = upperQuery.match(/ORDER\s+BY\s+(.*?)(?:\s+LIMIT|\s+OFFSET|$)/i);
    
    if (orderByMatch) {
      const orderByClause = orderByMatch[1].trim();
      return {
        raw: orderByClause,
        columns: orderByClause.split(',').map(col => col.trim())
      };
    }

    return null;
  }

  /**
   * Extract GROUP BY clause
   * @param {string} upperQuery - Uppercase query
   * @returns {Object|null} GROUP BY analysis
   * @private
   */
  _extractGroupBy(upperQuery) {
    const groupByMatch = upperQuery.match(/GROUP\s+BY\s+(.*?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i);
    
    if (groupByMatch) {
      const groupByClause = groupByMatch[1].trim();
      return {
        raw: groupByClause,
        columns: groupByClause.split(',').map(col => col.trim())
      };
    }

    return null;
  }

  /**
   * Extract LIMIT clause
   * @param {string} upperQuery - Uppercase query
   * @returns {Object|null} LIMIT analysis
   * @private
   */
  _extractLimit(upperQuery) {
    const limitMatch = upperQuery.match(/LIMIT\s+(\d+)/i);
    
    if (limitMatch) {
      return {
        value: parseInt(limitMatch[1], 10),
        description: `limits results to ${limitMatch[1]} rows`
      };
    }

    return null;
  }

  /**
   * Extract aggregation functions
   * @param {string} upperQuery - Uppercase query
   * @returns {Array<Object>} Array of aggregation objects
   * @private
   */
  _extractAggregations(upperQuery) {
    const aggregations = [];
    const aggFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV', 'VARIANCE'];

    aggFunctions.forEach(func => {
      const regex = new RegExp(`${func}\\s*\\(([^)]+)\\)`, 'gi');
      let match;
      
      while ((match = regex.exec(upperQuery)) !== null) {
        aggregations.push({
          function: func,
          argument: match[1].trim()
        });
      }
    });

    return aggregations;
  }

  /**
   * Generate a human-readable summary
   * @param {Object} analysis - Query analysis
   * @returns {string} Summary text
   * @private
   */
  _generateSummary(analysis) {
    const parts = [];

    // Query type
    parts.push(`This is a ${analysis.type.toLowerCase()} query`);

    // Tables
    if (analysis.tables.length > 0) {
      const tableNames = analysis.tables.map(t => t.name).join(', ');
      parts.push(`that accesses the following tables: ${tableNames}`);
    }

    // Columns
    if (analysis.columns.length > 0) {
      if (analysis.columns.length === 1 && analysis.columns[0].name === '*') {
        parts.push('and retrieves all columns');
      } else {
        const columnNames = analysis.columns.map(c => c.name).join(', ');
        parts.push(`and retrieves the following columns: ${columnNames}`);
      }
    }

    // WHERE clause
    if (analysis.whereClause) {
      parts.push('It filters results based on specific conditions');
    }

    // Joins
    if (analysis.joins.length > 0) {
      parts.push(`It joins ${analysis.joins.length} table(s) together`);
    }

    // Aggregations
    if (analysis.aggregations.length > 0) {
      const aggNames = [...new Set(analysis.aggregations.map(a => a.function))].join(', ');
      parts.push(`It uses the following aggregation functions: ${aggNames}`);
    }

    // ORDER BY
    if (analysis.orderBy) {
      parts.push('Results are sorted');
    }

    // LIMIT
    if (analysis.limit) {
      parts.push(analysis.limit.description);
    }

    return parts.join('. ') + '.';
  }
}

module.exports = QueryExplainer;
