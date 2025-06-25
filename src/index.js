const { app } = require("@azure/functions");

// Configure app-level settings
app.setup({
	capabilities: {
		isHttpTriggerAsyncSupported: true,
	},
});

// Import and register all functions
require("./functions/slackEvents");
require("./functions/slackInteractions");
require("./functions/slackSlashCommands");
require("./functions/wrikeWebhook");

// Import health check (outside src directory)
require("../health-check");
