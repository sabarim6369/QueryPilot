/**
 * QueryValidator - Validates SQL queries for read-only operations
 * 
 * This module implements READ-ONLY validation for SQL queries. It allows
 * SELECT and WITH...SELECT queries but rejects INSERT, UPDATE, DELETE, DROP,
 * ALTER, TRUNCATE, CREATE, GRANT, REVOKE and other mutating/destructive operations.
 * It also rejects multiple statements for the MVP.
 */

class QueryValidator {
  /**
   * Validate a query for read-only operations
   * @param {string} query - SQL query to validate
   * @returns {Object} Validation result with valid flag, reason, and normalized query
   */
  static validate(query) {
    if (!query || typeof query !== 'string') {
      return {
        valid: false,
        reason: 'Query is empty or invalid',
        normalizedQuery: null
      };
    }

    const normalizedQuery = this._normalizeQuery(query);

    // Check for multiple statements
    if (this._hasMultipleStatements(normalizedQuery)) {
      return {
        valid: false,
        reason: 'Multiple statements are not allowed for security reasons',
        normalizedQuery: normalizedQuery
      };
    }

    // Check for destructive operations
    const destructiveCheck = this._checkDestructiveOperations(normalizedQuery);
    if (!destructiveCheck.safe) {
      return {
        valid: false,
        reason: `Query contains destructive operation: ${destructiveCheck.operation}`,
        normalizedQuery: normalizedQuery
      };
    }

    // Check if it's a valid SELECT or WITH query
    const selectCheck = this._checkSelectQuery(normalizedQuery);
    if (!selectCheck.isSelect) {
      return {
        valid: false,
        reason: 'Only SELECT and WITH...SELECT queries are allowed in read-only mode',
        normalizedQuery: normalizedQuery
      };
    }

    return {
      valid: true,
      reason: 'Query is valid and read-only',
      normalizedQuery: normalizedQuery
    };
  }

  /**
   * Normalize query by removing extra whitespace and comments
   * @param {string} query - Query to normalize
   * @returns {string} Normalized query
   * @private
   */
  static _normalizeQuery(query) {
    let normalized = query.trim();

    // Remove single-line comments
    normalized = normalized.replace(/--.*$/gm, '');

    // Remove multi-line comments
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Check if query contains multiple statements
   * @param {string} query - Query to check
   * @returns {boolean} true if multiple statements detected
   * @private
   */
  static _hasMultipleStatements(query) {
    // Check for semicolons that would separate statements
    // But be careful with semicolons in WITH clauses or function calls
    const semicolonCount = (query.match(/;/g) || []).length;
    
    // If more than one semicolon, likely multiple statements
    if (semicolonCount > 1) {
      return true;
    }

    // Check for multiple SELECT keywords at the start level
    const upperQuery = query.toUpperCase();
    const selectCount = (upperQuery.match(/\bSELECT\b/g) || []).length;
    
    // If multiple SELECTs not in subqueries, might be multiple statements
    // This is a simple heuristic - could be improved with proper SQL parsing
    if (selectCount > 1 && !this._hasSubqueries(query)) {
      return true;
    }

    return false;
  }

  /**
   * Check if query has subqueries (which would have nested SELECTs)
   * @param {string} query - Query to check
   * @returns {boolean} true if subqueries detected
   * @private
   */
  static _hasSubqueries(query) {
    const upperQuery = query.toUpperCase();
    
    // Check for subquery indicators
    return (
      upperQuery.includes('(SELECT') ||
      upperQuery.includes('EXISTS') ||
      upperQuery.includes('IN (SELECT') ||
      upperQuery.includes('NOT IN (SELECT')
    );
  }

  /**
   * Check for destructive operations
   * @param {string} query - Query to check
   * @returns {Object} Object with safe flag and operation name if unsafe
   * @private
   */
  static _checkDestructiveOperations(query) {
    const upperQuery = query.toUpperCase();
    
    const destructiveOperations = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'ALTER',
      'TRUNCATE',
      'CREATE',
      'GRANT',
      'REVOKE',
      'REPLACE',
      'MERGE',
      'CALL',
      'EXEC',
      'EXECUTE'
    ];

    for (const operation of destructiveOperations) {
      // Use word boundaries to avoid false positives
      const regex = new RegExp(`\\b${operation}\\b`, 'i');
      if (regex.test(upperQuery)) {
        return { safe: false, operation: operation };
      }
    }

    return { safe: true, operation: null };
  }

  /**
   * Check if query is a SELECT or WITH...SELECT query
   * @param {string} query - Query to check
   * @returns {Object} Object with isSelect flag
   * @private
   */
  static _checkSelectQuery(query) {
    const upperQuery = query.toUpperCase().trim();

    // Check if it starts with SELECT
    if (upperQuery.startsWith('SELECT')) {
      return { isSelect: true };
    }

    // Check if it starts with WITH (CTE)
    if (upperQuery.startsWith('WITH')) {
      // WITH should be followed by SELECT eventually
      if (upperQuery.includes('SELECT')) {
        return { isSelect: true };
      }
    }

    return { isSelect: false };
  }

  /**
   * Extract table names from a SELECT query
   * @param {string} query - SELECT query
   * @returns {Array<string>} Array of table names
   */
  static extractTableNames(query) {
    const upperQuery = query.toUpperCase();
    const tables = [];

    // Simple extraction - look for FROM and JOIN clauses
    // This is a basic implementation and could be improved with proper SQL parsing
    
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

    return [...new Set(tables)]; // Remove duplicates
  }

  /**
   * Validate that query only accesses specified tables
   * @param {string} query - Query to validate
   * @param {Array<string>} allowedTables - Array of allowed table names
   * @returns {Object} Validation result
   */
  static validateTableAccess(query, allowedTables) {
    const extractedTables = this.extractTableNames(query);
    const upperAllowedTables = allowedTables.map(t => t.toUpperCase());
    
    const disallowedTables = extractedTables.filter(
      table => !upperAllowedTables.includes(table.toUpperCase())
    );

    if (disallowedTables.length > 0) {
      return {
        valid: false,
        reason: `Query accesses disallowed tables: ${disallowedTables.join(', ')}`,
        disallowedTables
      };
    }

    return {
      valid: true,
      reason: 'Query only accesses allowed tables',
      accessedTables: extractedTables
    };
  }
}

module.exports = QueryValidator;
