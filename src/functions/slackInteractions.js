const { app } = require("@azure/functions");

const querystring = require("querystring");
const { createTask } = require("../services/wrikeService");

app.http("SlackInteractions", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "slack/interactions",
	handler: async (request, context) => {
		try {
			console.log("Received Slack interaction request");
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
				context.log("Handling view submission for task creation modal");

				// Extract task details from the modal submission

                const values = payload.view.state.values;
                const taskDetails = {
                    title: values.task_title?.title_input?.value || "Untitled Task",
                    description: values.task_description?.description_input?.value || "",
                    dueDate: values.task_due_date?.due_date_input?.selected_date || null,
                    assignee: values.task_assignee?.assignee_input?.value || null,
                };

                context.log("Creating task with details:", taskDetails);

				try {
					const result = await createTask(taskDetails);

					context.log("Task creation result:", result);

					// Get task details for response
					const taskData = result.data[0];
					const taskUrl = result.taskUrl || taskData.permalink;

					// Send success response
					return {
						status: 200,
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							response_action: "clear",
							text: `✅ Task "${taskData.title}" created successfully!\n📋 Task ID: ${taskData.id}\n🔗 View in Wrike: ${taskUrl}`,
						}),
					};
				} catch (taskError) {
					context.log("Task creation failed:", taskError.message);

					return {
						status: 200,
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							response_action: "errors",
							errors: {
								title_block: `Failed to create task: ${taskError.message}`,
							},
						}),
					};
				}
			}
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

