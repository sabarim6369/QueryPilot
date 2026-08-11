/**
 * QueryManager - Coordinates the complete query workflow
 * 
 * This module is responsible for coordinating the entire query workflow:
 * Natural language request → Schema → QueryGenerator → QueryValidator → 
 * User approval → DatabaseAdapter.executeQuery() → Results
 * 
 * It must not directly instantiate PostgresAdapter or other database-specific adapters.
 */

const QueryGenerator = require('../ai/QueryGenerator');
const QueryValidator = require('../security/QueryValidator');
const QueryExplainer = require('../ai/QueryExplainer');
const QueryOptimizer = require('../ai/QueryOptimizer');

class QueryManager {
  /**
   * Create a new QueryManager instance
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = config;
    this.queryGenerator = new QueryGenerator(config.ai);
    this.queryExplainer = new QueryExplainer(config.ai);
    this.queryOptimizer = new QueryOptimizer(config.ai);
  }

  /**
   * Configure AI provider for query generation
   * @param {string} provider - AI provider name
   * @param {Object} providerConfig - Provider-specific configuration
   * @returns {Promise<void>}
   */
  async configureAI(provider, providerConfig) {
    await this.queryGenerator.configure(provider, providerConfig);
  }

  /**
   * Generate a query from natural language
   * @param {Object} params - Generation parameters
   * @param {string} params.databaseType - Type of database
   * @param {Object} params.schema - Database schema
   * @param {string} params.userPrompt - Natural language request
   * @returns {Promise<Object>} Generation result
   */
  async generateQuery({ databaseType, schema, userPrompt }) {
    try {
      const result = await this.queryGenerator.generateQuery({
        databaseType,
        schema,
        userPrompt
      });

      return {
        success: true,
        query: result.query,
        confidence: result.confidence,
        explanation: result.explanation,
        tablesUsed: result.tablesUsed,
        columnsUsed: result.columnsUsed
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate a generated query
   * @param {string} query - SQL query to validate
   * @returns {Object} Validation result
   */
  validateQuery(query) {
    const validation = QueryValidator.validate(query);

    return {
      valid: validation.valid,
      reason: validation.reason,
      normalizedQuery: validation.normalizedQuery
    };
  }

  /**
   * Explain a query in simple language
   * @param {string} query - SQL query to explain
   * @param {Object} schema - Database schema (optional)
   * @returns {Promise<Object>} Explanation result
   */
  async explainQuery(query, schema = null) {
    try {
      const explanation = await this.queryExplainer.explain(query, schema);

      return {
        success: true,
        explanation: explanation.explanation,
        summary: explanation.summary
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Optimize a query using database execution information
   * @param {DatabaseAdapter} adapter - Database adapter
   * @param {string} query - SQL query to optimize
   * @param {boolean} useAnalyze - Whether to use EXPLAIN ANALYZE
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeQuery(adapter, query, useAnalyze = false) {
    try {
      const optimization = await this.queryOptimizer.optimizeQuery(adapter, query, useAnalyze);

      return {
        success: true,
        executionPlan: this.queryOptimizer.formatExecutionPlan(optimization.executionPlan),
        suggestions: this.queryOptimizer.formatSuggestions(optimization.analysis),
        analysis: optimization.analysis
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a validated query
   * @param {DatabaseAdapter} adapter - Database adapter
   * @param {string} query - SQL query to execute
   * @returns {Promise<Object>} Execution result
   */
  async executeQuery(adapter, query) {
    if (!adapter) {
      return {
        success: false,
        error: 'No database adapter provided'
      };
    }

    try {
      // Validate before execution
      const validation = this.validateQuery(query);
      if (!validation.valid) {
        return {
          success: false,
          error: `Query validation failed: ${validation.reason}`,
          validation: validation
        };
      }

      // Execute the query
      const result = await adapter.executeQuery(query);

      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields,
        command: result.command
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete workflow: generate, validate, and optionally execute query
   * @param {Object} params - Workflow parameters
   * @param {DatabaseAdapter} params.adapter - Database adapter
   * @param {string} params.databaseType - Type of database
   * @param {Object} params.schema - Database schema
   * @param {string} params.userPrompt - Natural language request
   * @param {boolean} params.autoExecute - Whether to auto-execute (default: false)
   * @returns {Promise<Object>} Complete workflow result
   */
  async processNaturalLanguageRequest({ adapter, databaseType, schema, userPrompt, autoExecute = false }) {
    try {
      // Step 1: Generate query
      const generationResult = await this.generateQuery({
        databaseType,
        schema,
        userPrompt
      });

      if (!generationResult.success) {
        return {
          success: false,
          stage: 'generation',
          error: generationResult.error
        };
      }

      const generatedQuery = generationResult.query;

      // Step 2: Validate query
      const validation = this.validateQuery(generatedQuery);

      if (!validation.valid) {
        return {
          success: false,
          stage: 'validation',
          error: validation.reason,
          generatedQuery: generatedQuery,
          validation: validation
        };
      }

      // Step 3: Explain query
      const explanationResult = await this.explainQuery(generatedQuery, schema);

      // Step 4: Execute if auto-execute is enabled
      let executionResult = null;
      if (autoExecute && adapter) {
        executionResult = await this.executeQuery(adapter, generatedQuery);
      }

      return {
        success: true,
        generatedQuery: generatedQuery,
        validation: validation,
        explanation: explanationResult.success ? explanationResult : null,
        execution: executionResult,
        requiresUserApproval: !autoExecute
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get query statistics and metadata
   * @param {string} query - SQL query
   * @returns {Object} Query metadata
   */
  getQueryMetadata(query) {
    const upperQuery = query.toUpperCase();
    
    return {
      length: query.length,
      type: this._getQueryType(upperQuery),
      hasJoins: upperQuery.includes('JOIN'),
      hasWhere: upperQuery.includes('WHERE'),
      hasGroupBy: upperQuery.includes('GROUP BY'),
      hasOrderBy: upperQuery.includes('ORDER BY'),
      hasLimit: upperQuery.includes('LIMIT'),
      hasAggregations: this._hasAggregations(upperQuery),
      estimatedComplexity: this._estimateComplexity(upperQuery)
    };
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
      return 'WITH_CTE';
    }
    return 'UNKNOWN';
  }

  /**
   * Check if query has aggregations
   * @param {string} upperQuery - Uppercase query
   * @returns {boolean} true if has aggregations
   * @private
   */
  _hasAggregations(upperQuery) {
    const aggFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV', 'VARIANCE'];
    return aggFunctions.some(func => upperQuery.includes(func));
  }

  /**
   * Estimate query complexity
   * @param {string} upperQuery - Uppercase query
   * @returns {string} Complexity level
   * @private
   */
  _estimateComplexity(upperQuery) {
    let complexity = 0;

    if (upperQuery.includes('JOIN')) complexity += 2;
    if (upperQuery.includes('WHERE')) complexity += 1;
    if (upperQuery.includes('GROUP BY')) complexity += 2;
    if (upperQuery.includes('ORDER BY')) complexity += 1;
    if (upperQuery.includes('HAVING')) complexity += 2;
    if (upperQuery.includes('SUBQUERY') || upperQuery.includes('(SELECT')) complexity += 3;
    if (this._hasAggregations(upperQuery)) complexity += 1;

    if (complexity <= 2) return 'low';
    if (complexity <= 5) return 'medium';
    return 'high';
  }

  /**
   * Check if AI is configured and ready
   * @returns {boolean} true if AI is ready
   */
  isAIReady() {
    return this.queryGenerator.isReady();
  }
}

module.exports = QueryManager;
