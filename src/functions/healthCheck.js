const { app } = require("@azure/functions");

app.http("healthCheck", {
	methods: ["GET"],
	authLevel: "anonymous",
	route: "health",
	handler: async (request, context) => {
		try {
			context.log("Health check requested");

			return {
				status: 200,
				jsonBody: {
					status: "healthy",
					timestamp: new Date().toISOString(),
					environment: process.env.NODE_ENV || "unknown",
					runtime: "node-20",
					version: "1.0.0",
					endpoints: {
						events: "/api/slack/events",
						commands: "/api/slack/commands",
						interactions: "/api/slack/interactions",
						webhook: "/api/wrike-webhook",
					},
					configuration: {
						slack: !!process.env.SLACK_BOT_TOKEN,
						wrike: !!process.env.WRIKE_ACCESS_TOKEN,
						mongodb: !!process.env.MONGODB_URI,
					},
				},
				headers: {
					"Content-Type": "application/json",
				},
			};
		} catch (error) {
			context.error("Health check failed:", error);
			return {
				status: 500,
				jsonBody: {
					status: "unhealthy",
					error: error.message,
					timestamp: new Date().toISOString(),
				},
			};
		}
	},
});
