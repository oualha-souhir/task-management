/**
 * Environment configuration for Azure Functions
 */
class EnvironmentConfig {
	constructor() {
		this.isProduction = process.env.NODE_ENV === "production";
		this.isDevelopment = process.env.NODE_ENV === "development";
		this.isTest = process.env.NODE_ENV === "test";
	}

	/**
	 * Get configuration based on environment
	 */
	getConfig() {
		const baseConfig = {
			mongodb: {
				uri: process.env.MONGODB_URI,
				options: {
					useNewUrlParser: true,
					useUnifiedTopology: true,
					maxPoolSize: this.isProduction ? 50 : 10,
					serverSelectionTimeoutMS: this.isProduction ? 30000 : 10000,
					socketTimeoutMS: 45000,
				},
			},
			slack: {
				botToken: process.env.SLACK_BOT_TOKEN,
				signingSecret: process.env.SLACK_SIGNING_SECRET,
				appToken: process.env.SLACK_APP_TOKEN,
				verifySignature: this.isProduction,
			},
			wrike: {
				accessToken: process.env.WRIKE_ACCESS_TOKEN,
				apiUrl: process.env.WRIKE_API_URL || "https://www.wrike.com/api/v4",
			},
			functions: {
				timeout: this.isProduction ? 300000 : 180000, // 5 min prod, 3 min dev
				retries: this.isProduction ? 3 : 1,
				logLevel: this.isProduction ? "warn" : "info",
			},
		};

		return baseConfig;
	}

	/**
	 * Validate required environment variables
	 */
	validate() {
		const required = [
			"SLACK_BOT_TOKEN",
			"SLACK_SIGNING_SECRET",
			"WRIKE_ACCESS_TOKEN",
			"MONGODB_URI",
		];

		const missing = required.filter((key) => !process.env[key]);

		if (missing.length > 0) {
			console.warn(`⚠️ Missing environment variables: ${missing.join(", ")}`);
			if (this.isProduction) {
				throw new Error(
					`Production deployment requires: ${missing.join(", ")}`
				);
			}
		}

		return missing.length === 0;
	}

	/**
	 * Get current environment info
	 */
	getInfo() {
		return {
			environment: process.env.NODE_ENV || "development",
			isProduction: this.isProduction,
			functionsVersion: process.env.FUNCTIONS_EXTENSION_VERSION || "unknown",
			nodeVersion: process.version,
			platform: process.platform,
		};
	}
}

module.exports = new EnvironmentConfig();
