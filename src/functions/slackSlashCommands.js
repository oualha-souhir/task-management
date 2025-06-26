const { app } = require("@azure/functions");
const { createTaskModal } = require("../utils/modalBuilder");
const { SlackService } = require("../services/slackService");
const { ResponseBuilder } = require("../utils/responseBuilder");

const slackService = new SlackService();

app.http("SlackSlashCommands", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "slack/commands",
  handler: async (request, context) => {
    context.log("SlackSlashCommands triggered");
    const params = new URLSearchParams(await request.text());
    const command = {
      command: params.get("command"),
      user_id: params.get("user_id"),
      channel_id: params.get("channel_id"),
      trigger_id: params.get("trigger_id"),
    };

    if (command.command === "/task-test") {
      try {
        console.log("Received /task-test command from user:", command.user_id);
        console.log("Channel ID:", command.channel_id);
        // Open modal with channel_id in private_metadata
        await slackService.openModal(command.trigger_id, createTaskModal(command.channel_id));
        return ResponseBuilder.success();
      } catch (error) {
        context.error("Error opening modal:", error.message);
        return ResponseBuilder.ephemeralError(`Failed to open modal: ${error.message}`);
      }
    }

    return ResponseBuilder.ephemeralError("Unknown command");
  },
});

function buildTaskCommandBlocks(userId) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Création d'une nouvelle tâche", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Option 1:* Créez une tâche rapide avec la syntaxe suivante:\n\`\`\`/task\`\`\`` },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `💡 *Exemple:* \`/task\`` }],
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Option 2:* Utilisez le formulaire interactif ci-dessous" },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "📋 Ouvrir le formulaire", emoji: true },
          style: "primary",
          action_id: "create_another_task",
          value: "create_task",
        },
      ],
    },
  ];
}