const databaseService = require("../services/databaseService");

/**
 * Health check utility for Azure Functions to monitor database connectivity
 */
class ConnectionHealthCheck {
	constructor() {
		this.lastSuccessfulConnection = null;
		this.consecutiveFailures = 0;
		this.maxConsecutiveFailures = 3;
	}

	async checkDatabaseHealth() {
		try {
			console.log("🏥 Performing database health check...");

			// Try a simple operation with short timeout
			const startTime = Date.now();
			await databaseService.instance.executeWithRetry(
				async (db) => {
					// Simple ping operation
					await db.admin().ping();
					return true;
				},
				"Database health check",
				1 // Only 1 retry for health check
			);

			const responseTime = Date.now() - startTime;
			this.lastSuccessfulConnection = new Date();
			this.consecutiveFailures = 0;

			console.log(`✅ Database health check passed (${responseTime}ms)`);
			return {
				healthy: true,
				responseTime,
				lastSuccess: this.lastSuccessfulConnection,
				consecutiveFailures: this.consecutiveFailures,
			};
		} catch (error) {
			this.consecutiveFailures++;
			console.error(
				`❌ Database health check failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`,
				error.message
			);

			return {
				healthy: false,
				error: error.message,
				lastSuccess: this.lastSuccessfulConnection,
				consecutiveFailures: this.consecutiveFailures,
				criticalFailure:
					this.consecutiveFailures >= this.maxConsecutiveFailures,
			};
		}
	}

	async checkMongoAtlasStatus() {
		try {
			console.log("🌐 Checking MongoDB Atlas connectivity...");

			// Parse connection string to get cluster info
			const uri = process.env.MONGODB_URI;
			if (!uri) {
				throw new Error("MONGODB_URI not configured");
			}

			// Extract cluster information
			const match = uri.match(/mongodb\+srv:\/\/[^@]+@([^\/]+)/);
			const clusterHost = match ? match[1] : "unknown";

			console.log(`📍 MongoDB Atlas cluster: ${clusterHost}`);

			// Attempt connection with detailed timing
			const startTime = Date.now();
			const health = await this.checkDatabaseHealth();
			const totalTime = Date.now() - startTime;

			return {
				...health,
				clusterHost,
				totalTime,
				uri: uri.replace(/\/\/[^@]+@/, "//***:***@"), // Mask credentials
			};
		} catch (error) {
			console.error("❌ MongoDB Atlas status check failed:", error.message);
			return {
				healthy: false,
				error: error.message,
				clusterHost: "unknown",
			};
		}
	}

	getConnectionAdvice(healthResult) {
		if (healthResult.healthy) {
			return "✅ Database connection is healthy";
		}

		const advice = ["❌ Database connection issues detected:"];

		if (healthResult.error?.includes("timed out")) {
			advice.push("   💡 Timeout issues - check network connectivity");
			advice.push("   💡 Verify MongoDB Atlas cluster is running");
			advice.push("   💡 Check IP whitelist in Atlas Network Access");
		}

		if (healthResult.error?.includes("authentication")) {
			advice.push("   💡 Authentication failed - verify credentials");
			advice.push("   💡 Check MONGODB_URI connection string");
		}

		if (healthResult.criticalFailure) {
			advice.push("   🚨 CRITICAL: Multiple consecutive failures detected");
			advice.push("   🚨 Consider circuit breaker pattern implementation");
		}

		return advice.join("\n");
	}
}

// Export singleton instance
const healthCheck = new ConnectionHealthCheck();

module.exports = {
	checkHealth: () => healthCheck.checkDatabaseHealth(),
	checkAtlasStatus: () => healthCheck.checkMongoAtlasStatus(),
	getAdvice: (result) => healthCheck.getConnectionAdvice(result),
	instance: healthCheck,
};
