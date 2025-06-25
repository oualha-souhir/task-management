const { app } = require("@azure/functions");

// Register the function at module level (startup)
app.http("SlackEvents", {
	methods: ["GET", "POST"],
	authLevel: "anonymous",
	route: "slack/events",
	handler: async (request, context) => {
		try {
			context.log("SlackEvents function triggered");
			context.log("Request method:", request.method);
			context.log("Request headers:", request.headers);

			// Handle GET requests (simple health check)
			if (request.method === "GET") {
				return {
					status: 200,
					jsonBody: {
						message: "Slack Events endpoint is active",
						timestamp: new Date().toISOString(),
						endpoint: "slack/events",
					},
				};
			}

			// Check if running in demo mode
			const isDemoMode =
				!process.env.SLACK_BOT_TOKEN ||
				
				process.env.SLACK_BOT_TOKEN === "demo-mode";

			// Get request body
			const body = await request.text();
			context.log("Request body:", body);

			let payload;

			try {
				payload = JSON.parse(body);
				context.log("Parsed payload:", JSON.stringify(payload, null, 2));
			} catch (e) {
				context.warn("Invalid JSON payload received:", body);
				return {
					status: 400,
					headers: { "Content-Type": "application/json" },
					jsonBody: { error: "Invalid JSON" },
				};
			}

			// Handle Slack URL verification challenge - this is CRITICAL
			if (payload.challenge) {
				context.log("CHALLENGE RECEIVED:", payload.challenge);
				context.log("Challenge type:", payload.type);

				return {
					status: 200,
					headers: {
						"Content-Type": "text/plain",
					},
					body: payload.challenge,
				};
			}

			// Handle URL verification type (alternative format)
			if (payload.type === "url_verification") {
				context.log("URL verification request received");
				context.log("Challenge value:", payload.challenge);

				return {
					status: 200,
					headers: {
						"Content-Type": "text/plain",
					},
					body: payload.challenge,
				};
			}

			if (isDemoMode) {
				context.info("Running in demo mode - Slack not configured");
				return {
					status: 200,
					jsonBody: {
						message: "SlackEvents endpoint active (Demo mode)",
						timestamp: new Date().toISOString(),
						configured: false,
					},
				};
			}

			// Handle actual Slack events
			if (payload.event) {
				context.info("Processing Slack event:", payload.event.type);

				// Process different event types
				switch (payload.event.type) {
					case "message":
						return await handleMessage(payload.event, context);
					case "app_mention":
						return await handleAppMention(payload.event, context);
					default:
						context.log("Unhandled event type:", payload.event.type);
				}
			}

			// Default success response
			return {
				status: 200,
				jsonBody: {
					message: "Event processed successfully",
					eventType: payload.event?.type || "unknown",
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			context.error("SlackEvents error:", error);
			return {
				status: 500,
				jsonBody: {
					error: "Internal server error",
					message:
						process.env.NODE_ENV === "development"
							? error.message
							: "Something went wrong",
					timestamp: new Date().toISOString(),
				},
			};
		}
	},
});

async function handleMessage(event, context) {
	context.log("Handling message event:", event);

	// Don't respond to bot messages or messages without text
	if (event.bot_id || !event.text) {
		return {
			status: 200,
			jsonBody: { message: "Message processed" },
		};
	}

	// Process the message here
	return {
		status: 200,
		jsonBody: { message: "Message processed successfully" },
	};
}

async function handleAppMention(event, context) {
	context.log("Handling app mention:", event);

	// Handle when your bot is mentioned
	return {
		status: 200,
		jsonBody: { message: "App mention processed" },
	};
}
