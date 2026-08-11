/**
 * QueryOptimizer - Optimizes SQL queries using database execution information
 * 
 * This module is responsible for query optimization using actual database
 * execution information. For PostgreSQL, it uses EXPLAIN and EXPLAIN ANALYZE
 * to get real execution plans and statistics. The database provides actual
 * execution information, and the AI can explain it and provide suggestions.
 * 
 * Note: This is a basic implementation that provides the architecture for
 * optimization. Advanced AI-powered optimization suggestions can be added
 * later by integrating an AI provider similar to QueryGenerator.
 */

class QueryOptimizer {
  /**
   * Create a new QueryOptimizer instance
   * @param {Object} config - Configuration (optional, for future AI integration)
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Get query execution plan using EXPLAIN
   * @param {DatabaseAdapter} adapter - Database adapter
   * @param {string} query - SQL query to analyze
   * @returns {Promise<Object>} Execution plan result
   */
  async getExecutionPlan(adapter, query) {
    if (!adapter) {
      throw new Error('Database adapter is required');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    try {
      const explainQuery = `EXPLAIN ${query}`;
      const result = await adapter.executeQuery(explainQuery);

      return {
        query: query,
        plan: result.rows,
        success: true
      };
    } catch (error) {
      throw new Error(`Failed to get execution plan: ${error.message}`);
    }
  }

  /**
   * Get query execution plan with actual runtime statistics using EXPLAIN ANALYZE
   * @param {DatabaseAdapter} adapter - Database adapter
   * @param {string} query - SQL query to analyze
   * @returns {Promise<Object>} Execution plan with runtime statistics
   */
  async getExecutionPlanWithStats(adapter, query) {
    if (!adapter) {
      throw new Error('Database adapter is required');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    try {
      const explainAnalyzeQuery = `EXPLAIN ANALYZE ${query}`;
      const result = await adapter.executeQuery(explainAnalyzeQuery);

      return {
        query: query,
        plan: result.rows,
        success: true,
        hasRuntimeStats: true
      };
    } catch (error) {
      throw new Error(`Failed to get execution plan with stats: ${error.message}`);
    }
  }

  /**
   * Analyze execution plan and provide optimization suggestions
   * @param {Object} executionPlan - Execution plan from getExecutionPlan or getExecutionPlanWithStats
   * @returns {Promise<Object>} Optimization analysis with suggestions
   */
  async analyzeExecutionPlan(executionPlan) {
    if (!executionPlan || !executionPlan.plan) {
      throw new Error('Valid execution plan is required');
    }

    try {
      const analysis = {
        plan: executionPlan.plan,
        suggestions: [],
        warnings: [],
        estimatedCost: this._extractCost(executionPlan.plan),
        actualRuntime: this._extractRuntime(executionPlan.plan),
        scanTypes: this._extractScanTypes(executionPlan.plan),
        indexesUsed: this._extractIndexesUsed(executionPlan.plan)
      };

      // Generate basic suggestions based on plan analysis
      this._generateBasicSuggestions(analysis);

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze execution plan: ${error.message}`);
    }
  }

  /**
   * Extract estimated cost from execution plan
   * @param {Array} planRows - Execution plan rows
   * @returns {Object|null} Cost information
   * @private
   */
  _extractCost(planRows) {
    for (const row of planRows) {
      if (row['QUERY PLAN'] && typeof row['QUERY PLAN'] === 'string') {
        const costMatch = row['QUERY PLAN'].match(/cost=([\d.]+)\.\.([\d.]+)/);
        if (costMatch) {
          return {
            start: parseFloat(costMatch[1]),
            end: parseFloat(costMatch[2]),
            total: parseFloat(costMatch[2])
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract actual runtime from execution plan
   * @param {Array} planRows - Execution plan rows
   * @returns {Object|null} Runtime information
   * @private
   */
  _extractRuntime(planRows) {
    for (const row of planRows) {
      if (row['QUERY PLAN'] && typeof row['QUERY PLAN'] === 'string') {
        const timeMatch = row['QUERY PLAN'].match(/actual time=([\d.]+)\.\.([\d.]+)/);
        if (timeMatch) {
          return {
            start: parseFloat(timeMatch[1]),
            end: parseFloat(timeMatch[2]),
            total: parseFloat(timeMatch[2]) - parseFloat(timeMatch[1])
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract scan types from execution plan
   * @param {Array} planRows - Execution plan rows
   * @returns {Array<string>} Array of scan types
   * @private
   */
  _extractScanTypes(planRows) {
    const scanTypes = [];
    const scanPatterns = [
      /Seq Scan/i,
      /Index Scan/i,
      /Index Only Scan/i,
      /Bitmap Heap Scan/i,
      /Bitmap Index Scan/i,
      /Tid Scan/i,
      /Foreign Scan/i
    ];

    for (const row of planRows) {
      if (row['QUERY PLAN'] && typeof row['QUERY PLAN'] === 'string') {
        for (const pattern of scanPatterns) {
          const match = row['QUERY PLAN'].match(pattern);
          if (match) {
            const scanType = match[0].trim();
            if (!scanTypes.includes(scanType)) {
              scanTypes.push(scanType);
            }
          }
        }
      }
    }

    return scanTypes;
  }

  /**
   * Extract indexes used from execution plan
   * @param {Array} planRows - Execution plan rows
   * @returns {Array<string>} Array of index names
   * @private
   */
  _extractIndexesUsed(planRows) {
    const indexes = [];

    for (const row of planRows) {
      if (row['QUERY PLAN'] && typeof row['QUERY PLAN'] === 'string') {
        const indexMatch = row['QUERY PLAN'].match(/on\s+(\w+)\s+using\s+(\w+)/i);
        if (indexMatch) {
          indexes.push({
            table: indexMatch[1],
            index: indexMatch[2]
          });
        }
      }
    }

    return indexes;
  }

  /**
   * Generate basic optimization suggestions
   * @param {Object} analysis - Analysis object to modify
   * @private
   */
  _generateBasicSuggestions(analysis) {
    // Check for sequential scans (may indicate missing indexes)
    if (analysis.scanTypes.includes('Seq Scan')) {
      analysis.suggestions.push({
        type: 'index',
        severity: 'info',
        message: 'Query uses sequential scan. Consider adding indexes on frequently filtered columns.',
        recommendation: 'Review WHERE clause columns and consider creating appropriate indexes'
      });
    }

    // Check for high cost
    if (analysis.estimatedCost && analysis.estimatedCost.total > 1000) {
      analysis.suggestions.push({
        type: 'performance',
        severity: 'warning',
        message: `Query has high estimated cost: ${analysis.estimatedCost.total.toFixed(2)}`,
        recommendation: 'Consider optimizing the query or breaking it into smaller queries'
      });
    }

    // Check for slow runtime
    if (analysis.actualRuntime && analysis.actualRuntime.total > 1.0) {
      analysis.suggestions.push({
        type: 'performance',
        severity: 'warning',
        message: `Query has slow runtime: ${analysis.actualRuntime.total.toFixed(3)}ms`,
        recommendation: 'Review execution plan for bottlenecks and consider query optimization'
      });
    }

    // Check if indexes are being used
    if (analysis.indexesUsed.length === 0 && analysis.scanTypes.includes('Seq Scan')) {
      analysis.suggestions.push({
        type: 'index',
        severity: 'info',
        message: 'No indexes appear to be used in this query',
        recommendation: 'Consider creating indexes on columns used in JOIN and WHERE clauses'
      });
    }

    // Positive feedback when indexes are used
    if (analysis.indexesUsed.length > 0) {
      analysis.suggestions.push({
        type: 'index',
        severity: 'success',
        message: `Query effectively uses ${analysis.indexesUsed.length} index(es)`,
        recommendation: 'Current index usage looks good'
      });
    }
  }

  /**
   * Get comprehensive optimization analysis
   * @param {DatabaseAdapter} adapter - Database adapter
   * @param {string} query - SQL query to optimize
   * @param {boolean} useAnalyze - Whether to use EXPLAIN ANALYZE (slower but more accurate)
   * @returns {Promise<Object>} Comprehensive optimization analysis
   */
  async optimizeQuery(adapter, query, useAnalyze = false) {
    try {
      // Get execution plan
      let executionPlan;
      if (useAnalyze) {
        executionPlan = await this.getExecutionPlanWithStats(adapter, query);
      } else {
        executionPlan = await this.getExecutionPlan(adapter, query);
      }

      // Analyze the plan
      const analysis = await this.analyzeExecutionPlan(executionPlan);

      return {
        query: query,
        executionPlan: executionPlan,
        analysis: analysis,
        optimized: false
      };
    } catch (error) {
      throw new Error(`Query optimization failed: ${error.message}`);
    }
  }

  /**
   * Format execution plan for human reading
   * @param {Object} executionPlan - Execution plan to format
   * @returns {string} Formatted execution plan
   */
  formatExecutionPlan(executionPlan) {
    if (!executionPlan || !executionPlan.plan) {
      return 'No execution plan available';
    }

    let formatted = 'Execution Plan:\n';
    formatted += '================\n\n';

    executionPlan.plan.forEach((row, index) => {
      if (row['QUERY PLAN']) {
        const indent = '  '.repeat(index);
        formatted += `${indent}${row['QUERY PLAN']}\n`;
      }
    });

    return formatted;
  }

  /**
   * Format optimization suggestions for human reading
   * @param {Object} analysis - Analysis object
   * @returns {string} Formatted suggestions
   */
  formatSuggestions(analysis) {
    if (!analysis || !analysis.suggestions) {
      return 'No suggestions available';
    }

    let formatted = 'Optimization Suggestions:\n';
    formatted += '========================\n\n';

    if (analysis.suggestions.length === 0) {
      formatted += 'No specific suggestions. Query appears well-optimized.\n';
    } else {
      analysis.suggestions.forEach((suggestion, index) => {
        const severityIcon = this._getSeverityIcon(suggestion.severity);
        formatted += `${index + 1}. ${severityIcon} ${suggestion.message}\n`;
        formatted += `   Recommendation: ${suggestion.recommendation}\n\n`;
      });
    }

    return formatted;
  }

  /**
   * Get icon for severity level
   * @param {string} severity - Severity level
   * @returns {string} Icon character
   * @private
   */
  _getSeverityIcon(severity) {
    switch (severity) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      case 'info':
      default:
        return 'ℹ';
    }
  }
}

module.exports = QueryOptimizer;
