class ResponseBuilder {
	static ephemeralError(message) {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `❌ ${message}`,
			},
		};
	}

	static ephemeralWarning(message) {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `⚠️ ${message}`,
			},
		};
	}

	static ephemeralInfo(message) {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `ℹ️ ${message}`,
			},
		};
	}

	static expiredTriggerResponse() {
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: "⏱️ This action has expired. Please use the `/create-task` command to create a new task.",
			},
		};
	}

	static success() {
		return { status: 200 };
	}
}

module.exports = ResponseBuilder;
