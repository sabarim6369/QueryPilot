/**
 * QueryPilot Extension Entry Point
 * 
 * This is the main extension file that bootstraps QueryPilot and registers
 * VS Code functionality. It keeps the extension.js thin by delegating to
 * the SidebarProvider for the main UI and functionality.
 */

const vscode = require('vscode');
const SidebarProvider = require('./ui/SidebarProvider');

/**
 * Activate the extension
 * @param {Object} context - VS Code extension context
 */
function activate(context) {
  console.log('QueryPilot extension is now active');

  // Create sidebar provider
  const sidebarProvider = new SidebarProvider(context);

  // Register command to show the sidebar
  const showSidebarCommand = vscode.commands.registerCommand(
    'querypilot.showSidebar',
    () => {
      sidebarProvider.show();
    }
  );

  // Register command to connect to database (quick action)
  const connectCommand = vscode.commands.registerCommand(
    'querypilot.connect',
    () => {
      sidebarProvider.show();
    }
  );

  // Add disposables to context
  context.subscriptions.push(showSidebarCommand);
  context.subscriptions.push(connectCommand);
  context.subscriptions.push(sidebarProvider);
}

/**
 * Deactivate the extension
 */
function deactivate() {
  console.log('QueryPilot extension is now deactivated');
}

module.exports = {
  activate,
  deactivate
};
