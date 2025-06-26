/**
 * Azure Functions utilities for handling async operations and context management
 */

/**
 * Safely execute async operations without blocking Azure Function response
 * @param {Function} asyncOperation - The async operation to execute
 * @param {Object} context - Azure Functions context object
 * @param {string} operationName - Name for logging purposes
 */
function executeInBackground(
	asyncOperation,
	context,
	operationName = "Background operation"
) {
	// Execute the operation but don't await it
	asyncOperation()
		.then(() => {
			// Don't use context.log here as it may cause warnings
			console.log(`✅ ${operationName} completed successfully`);
		})
		.catch((error) => {
			// Don't use context.log here as it may cause warnings
			console.error(`❌ ${operationName} failed:`, error.message);
		});
}

/**
 * Create a timeout wrapper for Azure Functions operations
 * @param {Function} operation - The operation to execute
 * @param {number} timeoutMs - Timeout in milliseconds (default: 3000)
 * @param {string} operationName - Name for error messages
 */
async function withTimeout(
	operation,
	timeoutMs = 3000,
	operationName = "Operation"
) {
	return new Promise(async (resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		try {
			const result = await operation();
			clearTimeout(timeout);
			resolve(result);
		} catch (error) {
			clearTimeout(timeout);
			reject(error);
		}
	});
}

/**
 * Validate required environment variables for Azure Functions
 * @param {string[]} requiredVars - Array of required environment variable names
 * @throws {Error} If any required variables are missing
 */
function validateEnvironmentVariables(requiredVars) {
	const missing = requiredVars.filter((varName) => !process.env[varName]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`
		);
	}
}

/**
 * Create a standardized Azure Functions response
 * @param {number} status - HTTP status code
 * @param {Object} body - Response body
 * @param {Object} headers - Additional headers (optional)
 */
function createFunctionResponse(status, body, headers = {}) {
	return {
		status,
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	};
}

/**
 * Safe logging that won't cause context warnings
 * @param {string} level - Log level (info, error, warn)
 * @param {string} message - Message to log
 * @param {Object} data - Additional data to log (optional)
 */
function safeLog(level, message, data = null) {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

	if (data) {
		console[level](logMessage, data);
	} else {
		console[level](logMessage);
	}
}

module.exports = {
	executeInBackground,
	withTimeout,
	validateEnvironmentVariables,
	createFunctionResponse,
	safeLog,
};
