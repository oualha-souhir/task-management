const { app } = require("@azure/functions");

console.log("Initializing Azure Functions app...");

app.setup({ capabilities: { isHttpTriggerAsyncSupported: true } });

try {
  require("./functions/slackEvents");
  require("./functions/slackInteractions");
  require("./functions/slackSlashCommands");
  console.log("Functions loaded successfully");
} catch (error) {
  console.error("Error loading functions:", error);
  throw error;
}