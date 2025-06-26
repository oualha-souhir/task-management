const crypto = require("crypto");

/**
 * Verify Slack request signature
 * @param {string} rawBody - Raw request body
 * @param {string} signature - Slack signature from headers
 * @param {string} timestamp - Request timestamp from headers
 * @param {string} signingSecret - Slack signing secret
 */
function verifySlackSignature(rawBody, signature, timestamp, signingSecret) {
	console.log("Verifying Slack signature...");
	try {
		// Check if request is too old (5 minutes)
		const currentTime = Math.floor(Date.now() / 1000);
		if (Math.abs(currentTime - timestamp) > 300) {
			console.warn("Request too old:", currentTime - timestamp, "seconds");
			return false;
		}

		// Create signature
		const sigBaseString = `v0:${timestamp}:${rawBody}`;
		const mySignature =
			"v0=" +
			crypto
				.createHmac("sha256", signingSecret)
				.update(sigBaseString, "utf8")
				.digest("hex");

		// Compare signatures
		return crypto.timingSafeEqual(
			Buffer.from(mySignature, "utf8"),
			Buffer.from(signature, "utf8")
		);
	} catch (error) {
		console.error("Error verifying Slack signature:", error);
		return false;
	}
}

/**
 * Middleware to verify Slack requests
 */
function createSlackVerificationMiddleware(signingSecret) {
	console.log("Creating Slack verification middleware...");
	return (rawBody, headers) => {
		if (process.env.NODE_ENV === "development" && !signingSecret) {
			// Skip verification in development if no signing secret
			return true;
		}

		const signature = headers["x-slack-signature"];
		const timestamp = headers["x-slack-request-timestamp"];

		if (!signature || !timestamp) {
			return false;
		}

		return verifySlackSignature(rawBody, signature, timestamp, signingSecret);
	};
}

module.exports = {
	verifySlackSignature,
	createSlackVerificationMiddleware,
};
