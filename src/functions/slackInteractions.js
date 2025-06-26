const { app } = require("@azure/functions");
const querystring = require("querystring");
const { handleTaskCreation } = require("../handlers/taskCreationHandler");
const { createTaskModal } = require("../utils/modalBuilder");
const slackApiHelper = require("../utils/slackApiHelper");

app.http("SlackInteractions", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/interactions",
	handler: async (request, context) => {
		try {
			context.log("Received Slack interaction request");

			// Parse the body as a URL-encoded string
			const rawBody = await request.text();
			const parsedBody = querystring.parse(rawBody);

			// Slack sends the payload as a JSON string in the "payload" field
			const payload = JSON.parse(parsedBody.payload);
			context.log("Slack interaction payload:", payload);

			if (
				payload.type === "view_submission" &&
				payload.view.callback_id === "create_task_modal"
			) {
				console.log("Handling view submission for task creation");
				context.res = {
					status: 200,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ response_action: "clear" }),
				};

				// Process in background
				setImmediate(async () => {
					await handleTaskCreation(payload, context);
				});
				return context.res;
			}

			// Handle button clicks for "Create Another Task"
			if (payload.type === "block_actions") {
				const action = payload.actions[0];

				if (action.action_id === "create_another_task") {
					// Validate trigger_id immediately
					if (!payload.trigger_id) {
						context.error("No trigger_id in payload for create_another_task");
						return {
							status: 200,
							jsonBody: {
								response_type: "ephemeral",
								text: "❌ Unable to open modal. Please use the `/create-task` command instead.",
							},
						};
					}

					try {
						await slackApiHelper.openModal(
							payload.trigger_id,
							createTaskModal()
						);
						return { status: 200 };
					} catch (error) {
						context.error("Error opening modal:", error.message);

						if (error.message === "EXPIRED_TRIGGER_ID") {
							return {
								status: 200,
								jsonBody: {
									response_type: "ephemeral",
									text: "⏱️ The button action expired. Please use the `/create-task` command to create a new task.",
								},
							};
						}

						return {
							status: 200,
							jsonBody: {
								response_type: "ephemeral",
								text: `❌ Failed to open modal: ${error.message}. Please try using the \`/create-task\` command instead.`,
							},
						};
					}
				}

				// Handle task status updates
				if (action.action_id === "update_task_status") {
					const taskId = action.value;
					const selectedStatus = action.selected_option.value;

					try {
						// Update task status in Wrike
						const { updateTaskStatus } = require("../services/wrikeService");
						await updateTaskStatus(taskId, selectedStatus);

						// Update the message to reflect the status change
						return {
							status: 200,
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								response_type: "in_channel",
								text: `✅ Task status updated to: ${selectedStatus}`,
								replace_original: false,
							}),
						};
					} catch (error) {
						context.error("Error updating task status:", error);
						return {
							status: 200,
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								response_type: "ephemeral",
								text: `❌ Failed to update task status: ${error.message}`,
							}),
						};
					}
				}
			}

			// Default response for unhandled interactions
			return {
				status: 200,
				jsonBody: {
					response_type: "ephemeral",
					text: "Interaction received but not handled.",
				},
			};
		} catch (error) {
			context.error("Error handling Slack interaction:", error);
			return {
				status: 500,
				jsonBody: {
					response_type: "ephemeral",
					text: `❌ Error handling interaction: ${error.message}`,
				},
			};
		}
	},
});
