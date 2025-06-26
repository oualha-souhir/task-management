const { app } = require("@azure/functions");
const openAiService = require("../services/openAiService");
const { createTaskModal } = require("../utils/modalBuilder");
const slackApiHelper = require("../utils/slackApiHelper");

async function openTaskModal(command, context) {
	const startTime = Date.now();

	try {
		// Immediate validation with minimal logging
		if (!command.trigger_id) {
			context.log("Missing trigger_id");
			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: "❌ Unable to open modal - missing trigger ID. Please try again.",
				},
			};
		}

		// Open modal immediately - no unnecessary logging or processing
		await slackApiHelper.openModal(command.trigger_id, createTaskModal());

		const duration = Date.now() - startTime;
		context.log(`Modal opened successfully in ${duration}ms`);

		// Return empty 200 response immediately
		return { status: 200 };
	} catch (error) {
		const duration = Date.now() - startTime;
		context.log(`Error after ${duration}ms: ${error.message}`);

		// Handle specific error types with immediate responses
		if (error.message === "EXPIRED_TRIGGER_ID") {
			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: "⏱️ Request expired. Please try `/task-test` again.",
				},
			};
		}

		if (error.message === "TIMEOUT") {
			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: "⏱️ Request timed out. Please try `/task-test` again.",
				},
			};
		}

		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `❌ Failed to open modal. Please try again.`,
			},
		};
	}
}

module.exports = { openTaskModal };
