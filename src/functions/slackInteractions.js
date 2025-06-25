const { app } = require("@azure/functions");

app.http("SlackInteractions", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/interactions",
	handler: async (request, context) => {
		try {
			context.log("SlackInteractions function triggered");

			// Check if running in demo mode
			const isDemoMode =
				!process.env.SLACK_BOT_TOKEN ||
				
				process.env.SLACK_BOT_TOKEN === "demo-mode";

			if (isDemoMode) {
				context.info("Running in demo mode - Slack not configured");
				return {
					status: 200,
					jsonBody: {
						response_type: "ephemeral",
						text: "🔧 Demo Mode - Slack Interactions endpoint active",
						blocks: [
							{
								type: "section",
								text: {
									type: "mrkdwn",
									text: "*Demo Mode* 🚧\nSlack interactions endpoint is active but not configured",
								},
							},
						],
					},
				};
			}

			// Handle form data from Slack
			const body = await request.text();
			const params = new URLSearchParams(body);
			const payload = JSON.parse(params.get("payload") || "{}");

			context.log("Processing interaction:", payload.type);

			// Handle different interaction types
			switch (payload.type) {
				case "block_actions":
					return await handleBlockActions(payload, context);
				case "view_submission":
					return await handleViewSubmission(payload, context);
				default:
					context.warn("Unknown interaction type:", payload.type);
					return {
						status: 200,
						jsonBody: { message: "Interaction received" },
					};
			}
		} catch (error) {
			context.error("SlackInteractions error:", error);
			return {
				status: 500,
				jsonBody: {
					error: "Internal server error",
					response_type: "ephemeral",
					text: "Sorry, something went wrong processing your request.",
				},
			};
		}
	},
});

async function handleBlockActions(payload, context) {
	const action = payload.actions[0];
	context.log("Handling block action:", action.action_id);

	return {
		status: 200,
		jsonBody: {
			response_type: "ephemeral",
			text: `Action processed: ${action.action_id}`,
		},
	};
}

async function handleViewSubmission(payload, context) {
	context.log("Handling view submission:", payload.view.callback_id);

	return {
		status: 200,
		jsonBody: {
			response_action: "clear",
		},
	};
}
