const { app } = require("@azure/functions");

app.http("WrikeWebhook", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "wrike-webhook",
	handler: async (request, context) => {
		try {
			context.log("WrikeWebhook function triggered");

			// Check if running in demo mode
			const isDemoMode =
				!process.env.WRIKE_API_TOKEN ||
				process.env.WRIKE_API_TOKEN === "your-wrike-api-token-here" ||
				process.env.WRIKE_API_TOKEN === "demo-mode";

			if (isDemoMode) {
				context.info("Running in demo mode - Wrike not configured");
				return {
					status: 200,
					jsonBody: {
						message: "WrikeWebhook endpoint active (Demo mode)",
						timestamp: new Date().toISOString(),
						configured: false,
					},
				};
			}

			const body = await request.json();
			context.log("Received Wrike webhook:", body);

			// Process the webhook based on event type
			const eventType = body.eventType;

			switch (eventType) {
				case "TaskCreated":
					return await handleTaskCreated(body, context);
				case "TaskUpdated":
					return await handleTaskUpdated(body, context);
				case "TaskDeleted":
					return await handleTaskDeleted(body, context);
				default:
					context.info("Unhandled Wrike event type:", eventType);
					return {
						status: 200,
						jsonBody: { message: "Event received but not processed" },
					};
			}
		} catch (error) {
			context.error("WrikeWebhook error:", error);
			return {
				status: 500,
				jsonBody: {
					error: "Internal server error",
				},
			};
		}
	},
});

async function handleTaskCreated(payload, context) {
	context.log("Processing task created event");

	// Here you would typically:
	// 1. Send notification to Slack
	// 2. Update local database
	// 3. Trigger other workflows

	return {
		status: 200,
		jsonBody: { message: "Task created event processed" },
	};
}

async function handleTaskUpdated(payload, context) {
	context.log("Processing task updated event");

	return {
		status: 200,
		jsonBody: { message: "Task updated event processed" },
	};
}

async function handleTaskDeleted(payload, context) {
	context.log("Processing task deleted event");

	return {
		status: 200,
		jsonBody: { message: "Task deleted event processed" },
	};
}
