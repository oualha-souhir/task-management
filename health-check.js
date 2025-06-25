const { app } = require("@azure/functions");
const wrikeService = require("./src/services/wrikeService");
const databaseService = require("./src/services/databaseService");

app.http("healthCheck", {
	methods: ["GET"],
	authLevel: "anonymous",
	route: "health",
	handler: async (request, context) => {
		const healthStatus = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			environment: process.env.NODE_ENV || "unknown",
			version: process.env.npm_package_version || "1.0.0",
			services: {},
		};

		try {
			// Check Wrike service
			const wrikeHealth = await checkWrikeHealth(context);
			healthStatus.services.wrike = wrikeHealth;

			// Check Database service
			const dbHealth = await checkDatabaseHealth(context);
			healthStatus.services.database = dbHealth;

			// Check overall health
			const hasUnhealthyServices = Object.values(healthStatus.services).some(
				(service) => service.status !== "healthy"
			);

			if (hasUnhealthyServices) {
				healthStatus.status = "degraded";
			}

			const statusCode = healthStatus.status === "healthy" ? 200 : 503;

			return {
				status: statusCode,
				jsonBody: healthStatus,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
				},
			};
		} catch (error) {
			context.error("Health check failed:", error);

			return {
				status: 503,
				jsonBody: {
					status: "unhealthy",
					timestamp: new Date().toISOString(),
					error: error.message,
				},
			};
		}
	},
});

async function checkWrikeHealth(context) {
	try {
		const isHealthy = await wrikeService.testConnection();
		return {
			status: isHealthy ? "healthy" : "unhealthy",
			message: isHealthy ? "Wrike API accessible" : "Wrike API not accessible",
			lastChecked: new Date().toISOString(),
		};
	} catch (error) {
		return {
			status: "unhealthy",
			message: `Wrike check failed: ${error.message}`,
			lastChecked: new Date().toISOString(),
		};
	}
}

async function checkDatabaseHealth(context) {
	try {
		const isConnected = await databaseService.ensureConnection();
		return {
			status: isConnected ? "healthy" : "degraded",
			message: isConnected ? "MongoDB connected" : "Using fallback storage",
			storage: isConnected ? "mongodb" : "memory",
			lastChecked: new Date().toISOString(),
		};
	} catch (error) {
		return {
			status: "degraded",
			message: `Database check failed: ${error.message}`,
			storage: "memory",
			lastChecked: new Date().toISOString(),
		};
	}
}
