const { app } = require("@azure/functions");
console.log("App setup complete");

// Configure app-level settings
app.setup({
	capabilities: {
		isHttpTriggerAsyncSupported: true,
	},
});
console.log("App setup complete");

// Import and register all functions
require("./functions/slackEvents");
require("./functions/slackInteractions");
require("./functions/slackSlashCommands");

// Import health check (outside src directory)
require("../health-check");
