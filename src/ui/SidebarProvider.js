/**
 * SidebarProvider - Provides the QueryPilot sidebar webview
 * 
 * This module creates and manages the VS Code webview panel for QueryPilot.
 * It handles message passing between the webview and the extension host,
 * ensuring secure communication without exposing Node.js APIs or database
 * credentials directly to the webview.
 */

const ConnectionManager = require('../core/ConnectionManager');
const SchemaManager = require('../core/SchemaManager');
const QueryManager = require('../core/QueryManager');

const vscode = require('vscode');

class SidebarProvider {
  /**
   * Create a new SidebarProvider instance
   * @param {Object} context - VS Code extension context
   */
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.connectionManager = new ConnectionManager(context);
    this.schemaManager = new SchemaManager(context);
    this.queryManager = new QueryManager();
    this.disposables = [];
  }

  /**
   * Create or show the webview panel
   */
  show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'querypilot.sidebar',
      'QueryPilot',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'webview')
        ]
      }
    );

    this.panel.webview.html = this._getWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      undefined,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.dispose();
      },
      undefined,
      this.disposables
    );
  }

  /**
   * Handle messages from the webview
   * @param {Object} message - Message from webview
   * @private
   */
  async _handleMessage(message) {
    try {
      switch (message.type) {
        case 'connect':
          await this._handleConnect(message);
          break;
        case 'disconnect':
          await this._handleDisconnect();
          break;
        case 'refreshSchema':
          await this._handleRefreshSchema();
          break;
        case 'generateQuery':
          await this._handleGenerateQuery(message);
          break;
        case 'executeQuery':
          await this._handleExecuteQuery(message);
          break;
        case 'explainQuery':
          await this._handleExplainQuery(message);
          break;
        case 'optimizeQuery':
          await this._handleOptimizeQuery(message);
          break;
        case 'getSchema':
          await this._handleGetSchema();
          break;
        case 'getConnectionStatus':
          await this._handleGetConnectionStatus();
          break;
        default:
          this._sendError(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this._sendError(`Error handling message: ${error.message}`);
    }
  }

  /**
   * Handle connect request
   * @param {Object} message - Connect message
   * @private
   */
  async _handleConnect(message) {
    try {
      const { databaseType, host, port, database, user, password, connectionString } = message.payload;

      const connectionConfig = {
        databaseType,
        host,
        port,
        database,
        user,
        password,
        connectionString
      };

      const result = await this.connectionManager.connect(connectionConfig);

      this._sendMessage({
        type: 'connectSuccess',
        payload: {
          databaseType: result.databaseType,
          connectionId: result.connectionId
        }
      });

      // Auto-fetch schema after successful connection
      await this._handleRefreshSchema();
    } catch (error) {
      this._sendError(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Handle disconnect request
   * @private
   */
  async _handleDisconnect() {
    try {
      await this.connectionManager.disconnect();

      this._sendMessage({
        type: 'disconnectSuccess',
        payload: {}
      });
    } catch (error) {
      this._sendError(`Disconnect failed: ${error.message}`);
    }
  }

  /**
   * Handle refresh schema request
   * @private
   */
  async _handleRefreshSchema() {
    try {
      const adapter = this.connectionManager.getCurrentAdapter();
      const databaseType = this.connectionManager.getCurrentDatabaseType();
      const connectionId = this.connectionManager.getCurrentConnectionId();

      if (!adapter || !databaseType || !connectionId) {
        throw new Error('Not connected to database');
      }

      const schema = await this.schemaManager.refreshSchema(
        connectionId,
        adapter,
        databaseType
      );

      this._sendMessage({
        type: 'schemaRefreshed',
        payload: {
          schema: schema
        }
      });
    } catch (error) {
      this._sendError(`Schema refresh failed: ${error.message}`);
    }
  }

  /**
   * Handle generate query request
   * @param {Object} message - Generate query message
   * @private
   */
  async _handleGenerateQuery(message) {
    try {
      const { userPrompt } = message.payload;

      const adapter = this.connectionManager.getCurrentAdapter();
      const databaseType = this.connectionManager.getCurrentDatabaseType();
      const connectionId = this.connectionManager.getCurrentConnectionId();

      if (!adapter || !databaseType || !connectionId) {
        throw new Error('Not connected to database');
      }

      const schema = await this.schemaManager.getSchema(
        connectionId,
        adapter,
        databaseType
      );

      // Note: This will fail until AI is configured
      const result = await this.queryManager.generateQuery({
        databaseType,
        schema,
        userPrompt
      });

      if (result.success) {
        this._sendMessage({
          type: 'queryGenerated',
          payload: {
            query: result.query,
            confidence: result.confidence,
            explanation: result.explanation
          }
        });
      } else {
        this._sendError(`Query generation failed: ${result.error}`);
      }
    } catch (error) {
      this._sendError(`Query generation failed: ${error.message}`);
    }
  }

  /**
   * Handle execute query request
   * @param {Object} message - Execute query message
   * @private
   */
  async _handleExecuteQuery(message) {
    try {
      const { query } = message.payload;

      const adapter = this.connectionManager.getCurrentAdapter();

      if (!adapter) {
        throw new Error('Not connected to database');
      }

      const result = await this.queryManager.executeQuery(adapter, query);

      if (result.success) {
        this._sendMessage({
          type: 'queryExecuted',
          payload: {
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields
          }
        });
      } else {
        this._sendError(`Query execution failed: ${result.error}`);
      }
    } catch (error) {
      this._sendError(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Handle explain query request
   * @param {Object} message - Explain query message
   * @private
   */
  async _handleExplainQuery(message) {
    try {
      const { query } = message.payload;

      const adapter = this.connectionManager.getCurrentAdapter();
      const connectionId = this.connectionManager.getCurrentConnectionId();

      if (!adapter || !connectionId) {
        throw new Error('Not connected to database');
      }

      const schema = await this.schemaManager.getSchema(connectionId, adapter);
      const result = await this.queryManager.explainQuery(query, schema);

      if (result.success) {
        this._sendMessage({
          type: 'queryExplained',
          payload: {
            explanation: result.explanation,
            summary: result.summary
          }
        });
      } else {
        this._sendError(`Query explanation failed: ${result.error}`);
      }
    } catch (error) {
      this._sendError(`Query explanation failed: ${error.message}`);
    }
  }

  /**
   * Handle optimize query request
   * @param {Object} message - Optimize query message
   * @private
   */
  async _handleOptimizeQuery(message) {
    try {
      const { query, useAnalyze } = message.payload;

      const adapter = this.connectionManager.getCurrentAdapter();

      if (!adapter) {
        throw new Error('Not connected to database');
      }

      const result = await this.queryManager.optimizeQuery(adapter, query, useAnalyze);

      if (result.success) {
        this._sendMessage({
          type: 'queryOptimized',
          payload: {
            executionPlan: result.executionPlan,
            suggestions: result.suggestions
          }
        });
      } else {
        this._sendError(`Query optimization failed: ${result.error}`);
      }
    } catch (error) {
      this._sendError(`Query optimization failed: ${error.message}`);
    }
  }

  /**
   * Handle get schema request
   * @private
   */
  async _handleGetSchema() {
    try {
      const adapter = this.connectionManager.getCurrentAdapter();
      const databaseType = this.connectionManager.getCurrentDatabaseType();
      const connectionId = this.connectionManager.getCurrentConnectionId();

      if (!adapter || !databaseType || !connectionId) {
        throw new Error('Not connected to database');
      }

      const schema = await this.schemaManager.getSchema(
        connectionId,
        adapter,
        databaseType
      );

      this._sendMessage({
        type: 'schemaData',
        payload: {
          schema: schema
        }
      });
    } catch (error) {
      this._sendError(`Failed to get schema: ${error.message}`);
    }
  }

  /**
   * Handle get connection status request
   * @private
   */
  async _handleGetConnectionStatus() {
    try {
      const isConnected = this.connectionManager.isConnected();
      const connectionConfig = this.connectionManager.getCurrentConnectionConfig();

      this._sendMessage({
        type: 'connectionStatus',
        payload: {
          connected: isConnected,
          config: connectionConfig
        }
      });
    } catch (error) {
      this._sendError(`Failed to get connection status: ${error.message}`);
    }
  }

  /**
   * Send message to webview
   * @param {Object} message - Message to send
   * @private
   */
  _sendMessage(message) {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Send error message to webview
   * @param {string} error - Error message
   * @private
   */
  _sendError(error) {
    this._sendMessage({
      type: 'error',
      payload: {
        error: error
      }
    });
  }

  /**
   * Get webview HTML content
   * @returns {string} HTML content
   * @private
   */
  _getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>QueryPilot</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        h2 {
            color: var(--vscode-foreground);
            margin-top: 30px;
        }
        .section {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: var(--vscode-foreground);
        }
        input, select, textarea {
            width: 100%;
            padding: 8px;
            margin-bottom: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            box-sizing: border-box;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            margin-right: 10px;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .status {
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .status.connected {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }
        .status.disconnected {
            background-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-editor-background);
        }
        .schema-tree {
            font-family: monospace;
            white-space: pre;
            background-color: var(--vscode-editor-background);
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .query-result {
            background-color: var(--vscode-editor-background);
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-editorErrorBackground);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>QueryPilot</h1>
        
        <div id="error-container"></div>
        
        <div class="section">
            <h2>Database Connection</h2>
            <div id="connection-status" class="status disconnected">Not Connected</div>
            
            <label for="database-type">Database Type:</label>
            <select id="database-type">
                <option value="postgresql">PostgreSQL</option>
            </select>
            
            <label for="connection-string">Connection String (optional):</label>
            <input type="text" id="connection-string" placeholder="postgresql://user:password@host:port/database">
            
            <label for="host">Host:</label>
            <input type="text" id="host" placeholder="localhost">
            
            <label for="port">Port:</label>
            <input type="number" id="port" placeholder="5432" value="5432">
            
            <label for="database">Database:</label>
            <input type="text" id="database" placeholder="database_name">
            
            <label for="user">Username:</label>
            <input type="text" id="user" placeholder="username">
            
            <label for="password">Password:</label>
            <input type="password" id="password" placeholder="password">
            
            <button id="connect-btn">Connect</button>
            <button id="disconnect-btn" disabled>Disconnect</button>
        </div>
        
        <div class="section">
            <h2>Schema</h2>
            <button id="refresh-schema-btn" disabled>Refresh Schema</button>
            <div id="schema-display" class="schema-tree">No schema loaded</div>
        </div>
        
        <div class="section">
            <h2>Natural Language Query</h2>
            <label for="user-prompt">Enter your request:</label>
            <textarea id="user-prompt" rows="3" placeholder="Show me all users who signed up last week"></textarea>
            <button id="generate-query-btn" disabled>Generate Query</button>
        </div>
        
        <div class="section">
            <h2>Generated SQL</h2>
            <div id="generated-query" class="query-result">No query generated</div>
            <button id="explain-query-btn" disabled>Explain</button>
            <button id="optimize-query-btn" disabled>Optimize</button>
            <button id="run-query-btn" disabled>Run Query</button>
        </div>
        
        <div class="section">
            <h2>Results</h2>
            <div id="query-results" class="query-result">No results</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // DOM elements
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');
        const refreshSchemaBtn = document.getElementById('refresh-schema-btn');
        const generateQueryBtn = document.getElementById('generate-query-btn');
        const explainQueryBtn = document.getElementById('explain-query-btn');
        const optimizeQueryBtn = document.getElementById('optimize-query-btn');
        const runQueryBtn = document.getElementById('run-query-btn');
        const connectionStatus = document.getElementById('connection-status');
        const schemaDisplay = document.getElementById('schema-display');
        const generatedQueryDisplay = document.getElementById('generated-query');
        const queryResultsDisplay = document.getElementById('query-results');
        const errorContainer = document.getElementById('error-container');
        
        let currentQuery = null;
        
        // Event listeners
        connectBtn.addEventListener('click', handleConnect);
        disconnectBtn.addEventListener('click', handleDisconnect);
        refreshSchemaBtn.addEventListener('click', handleRefreshSchema);
        generateQueryBtn.addEventListener('click', handleGenerateQuery);
        explainQueryBtn.addEventListener('click', handleExplainQuery);
        optimizeQueryBtn.addEventListener('click', handleOptimizeQuery);
        runQueryBtn.addEventListener('click', handleRunQuery);
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'connectSuccess':
                    handleConnectSuccess(message.payload);
                    break;
                case 'disconnectSuccess':
                    handleDisconnectSuccess();
                    break;
                case 'schemaRefreshed':
                    handleSchemaRefreshed(message.payload);
                    break;
                case 'queryGenerated':
                    handleQueryGenerated(message.payload);
                    break;
                case 'queryExecuted':
                    handleQueryExecuted(message.payload);
                    break;
                case 'queryExplained':
                    handleQueryExplained(message.payload);
                    break;
                case 'queryOptimized':
                    handleQueryOptimized(message.payload);
                    break;
                case 'connectionStatus':
                    handleConnectionStatus(message.payload);
                    break;
                case 'error':
                    showError(message.payload.error);
                    break;
            }
        });
        
        function handleConnect() {
            const databaseType = document.getElementById('database-type').value;
            const connectionString = document.getElementById('connection-string').value;
            const host = document.getElementById('host').value;
            const port = parseInt(document.getElementById('port').value);
            const database = document.getElementById('database').value;
            const user = document.getElementById('user').value;
            const password = document.getElementById('password').value;
            
            vscode.postMessage({
                type: 'connect',
                payload: {
                    databaseType,
                    connectionString,
                    host,
                    port,
                    database,
                    user,
                    password
                }
            });
        }
        
        function handleDisconnect() {
            vscode.postMessage({ type: 'disconnect' });
        }
        
        function handleRefreshSchema() {
            vscode.postMessage({ type: 'refreshSchema' });
        }
        
        function handleGenerateQuery() {
            const userPrompt = document.getElementById('user-prompt').value;
            vscode.postMessage({
                type: 'generateQuery',
                payload: { userPrompt }
            });
        }
        
        function handleExplainQuery() {
            if (currentQuery) {
                vscode.postMessage({
                    type: 'explainQuery',
                    payload: { query: currentQuery }
                });
            }
        }
        
        function handleOptimizeQuery() {
            if (currentQuery) {
                vscode.postMessage({
                    type: 'optimizeQuery',
                    payload: { query: currentQuery, useAnalyze: false }
                });
            }
        }
        
        function handleRunQuery() {
            if (currentQuery) {
                vscode.postMessage({
                    type: 'executeQuery',
                    payload: { query: currentQuery }
                });
            }
        }
        
        function handleConnectSuccess(payload) {
            connectionStatus.textContent = 'Connected';
            connectionStatus.className = 'status connected';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            refreshSchemaBtn.disabled = false;
            generateQueryBtn.disabled = false;
            clearError();
        }
        
        function handleDisconnectSuccess() {
            connectionStatus.textContent = 'Not Connected';
            connectionStatus.className = 'status disconnected';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            refreshSchemaBtn.disabled = true;
            generateQueryBtn.disabled = true;
            explainQueryBtn.disabled = true;
            optimizeQueryBtn.disabled = true;
            runQueryBtn.disabled = true;
            schemaDisplay.textContent = 'No schema loaded';
            generatedQueryDisplay.textContent = 'No query generated';
            queryResultsDisplay.textContent = 'No results';
            currentQuery = null;
        }
        
        function handleSchemaRefreshed(payload) {
            const schema = payload.schema;
            let schemaText = \`Database: \${schema.databaseType}\\n\\n\`;
            
            schema.tables.forEach(table => {
                schemaText += \`\${table.schemaName}.\${table.name}\\n\`;
                table.columns.forEach(col => {
                    schemaText += \`  - \${col.name}: \${col.dataType}\\n\`;
                });
                schemaText += '\\n';
            });
            
            schemaDisplay.textContent = schemaText;
        }
        
        function handleQueryGenerated(payload) {
            currentQuery = payload.query;
            generatedQueryDisplay.textContent = payload.query;
            explainQueryBtn.disabled = false;
            optimizeQueryBtn.disabled = false;
            runQueryBtn.disabled = false;
            clearError();
        }
        
        function handleQueryExecuted(payload) {
            const rows = payload.rows;
            if (rows && rows.length > 0) {
                const headers = Object.keys(rows[0]).join('\\t');
                const data = rows.map(row => Object.values(row).join('\\t')).join('\\n');
                queryResultsDisplay.textContent = headers + '\\n' + data;
            } else {
                queryResultsDisplay.textContent = 'No results';
            }
        }
        
        function handleQueryExplained(payload) {
            queryResultsDisplay.textContent = payload.summary;
        }
        
        function handleQueryOptimized(payload) {
            queryResultsDisplay.textContent = payload.suggestions;
        }
        
        function handleConnectionStatus(payload) {
            if (payload.connected) {
                handleConnectSuccess(payload);
            } else {
                handleDisconnectSuccess();
            }
        }
        
        function showError(error) {
            errorContainer.innerHTML = \`<div class="error">\${error}</div>\`;
        }
        
        function clearError() {
            errorContainer.innerHTML = '';
        }
        
        // Request connection status on load
        vscode.postMessage({ type: 'getConnectionStatus' });
    </script>
</body>
</html>`;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    
    if (this.connectionManager) {
      this.connectionManager.disconnect();
    }
  }
}

module.exports = SidebarProvider;
