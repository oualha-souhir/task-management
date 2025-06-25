import { app } from "@azure/functions";

// Configure global error handling with proper Azure Functions handling
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
	// Don't exit in Azure Functions - let the host handle recovery
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
	// Don't exit in Azure Functions - let the host handle recovery
});

// Export a simple configuration object for Azure Functions
export const config = {
	enableHttpStream: true,
	timeout: 300000, // 5 minutes
};

// Export initialization helper
export const initializeEnvironment = () => {
	const requiredEnvVars = ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"];
	const missingVars = requiredEnvVars.filter(
		(varName) =>
			!process.env[varName] ||
			process.env[varName].includes("your-") ||
			process.env[varName].includes("-here")
	);

	if (missingVars.length > 0) {
		console.warn(
			`Missing environment variables: ${missingVars.join(
				", "
			)} - Running in demo mode`
		);
		return false;
	}

	return true;
};
