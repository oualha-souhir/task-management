const axios = require("axios");

class SlackApiHelper {
	constructor() {
		this.baseURL = "https://slack.com/api";
		this.headers = {
			Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
			"Content-Type": "application/json",
		};

		// Create reusable axios instance with optimized settings
		this.axiosInstance = axios.create({
			baseURL: this.baseURL,
			headers: this.headers,
			timeout: 1500, // Reduced to 1.5 seconds
			maxRedirects: 0,
			httpAgent: new (require("http").Agent)({
				keepAlive: true,
				maxSockets: 10,
				timeout: 1000,
			}),
			httpsAgent: new (require("https").Agent)({
				keepAlive: true,
				maxSockets: 10,
				timeout: 1000,
			}),
		});
	}

	async openModal(triggerId, view) {
		// Validate trigger ID is present
		if (!triggerId) {
			throw new Error("Trigger ID is required to open modal");
		}

		try {
			const startTime = Date.now();

			const response = await this.axiosInstance.post("/views.open", {
				trigger_id: triggerId,
				view: view,
			});

			const duration = Date.now() - startTime;
			console.log(`Modal open request took ${duration}ms`);

			if (!response.data.ok) {
				// Handle specific Slack API errors
				if (response.data.error === "expired_trigger_id") {
					throw new Error("EXPIRED_TRIGGER_ID");
				}
				throw new Error(`Failed to open modal: ${response.data.error}`);
			}

			return response.data;
		} catch (error) {
			if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
				throw new Error("TIMEOUT");
			}
			if (error.message === "EXPIRED_TRIGGER_ID") {
				throw error; // Re-throw as-is for specific handling
			}
			throw new Error(`Slack API error: ${error.message}`);
		}
	}

	async postMessage(channel, text, blocks = null) {
		try {
			const payload = {
				channel: channel,
				text: text,
			};

			if (blocks) {
				payload.blocks = blocks;
			}

			const response = await this.axiosInstance.post(
				"/chat.postMessage",
				payload
			);

			if (!response.data.ok) {
				throw new Error(`Failed to post message: ${response.data.error}`);
			}

			return response.data;
		} catch (error) {
			throw new Error(`Slack API error: ${error.message}`);
		}
	}
	async postSlackMessageWithRetry(url, body, token, context, retries = 3) {
		console.log("** postSlackMessageWithRetry");
		let lastError = null;
		console.log(`Sending Slack message: ${JSON.stringify(body)}`);
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				const response = await axios.post(url, body, {
					headers: { Authorization: `Bearer ${token}` },
				});

				// Log successful response for debugging
				if (attempt > 1) {
					console.log(`Success on retry attempt ${attempt}`);
				}

				// Return the actual response.data, not the full axios response
				return response.data;
			} catch (error) {
				lastError = error;
				console.log(`Attempt ${attempt} failed: ${error.message}`);

				if (attempt < retries) {
					// Wait with exponential backoff before retrying (100ms, 200ms, 400ms, etc.)
					await new Promise((resolve) =>
						setTimeout(resolve, 100 * Math.pow(2, attempt - 1))
					);
				}
			}
		}

		// All retries failed
		throw lastError || new Error("All retries failed with unknown error");
	}
}

module.exports = new SlackApiHelper();
