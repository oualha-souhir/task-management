const { createTask } = require("../services/wrikeService");
const {
	sendTaskNotificationToChannel,
	sendTaskConfirmationToUser,
} = require("../services/slackNotificationService");
const { start } = require("repl");

async function handleTaskCreation(payload, context) {
	context.log("Handling view submission for task creation modal");

	// Extract task details from the modal submission
	const values = payload.view.state.values;
	const taskDetails = {
		title: values.task_title?.title_input?.value || "Untitled Task",
		description: values.task_description?.description_input?.value || "",
		startDate: values.task_start_date?.start_date_input?.selected_date || null,
		dueDate: values.task_due_date?.due_date_input?.selected_date || null,
		assignee: values.task_assignee?.assignee_input?.value || null,
	};

	const userId = payload.user.id;

	context.log("Creating task with details:", taskDetails);

	try {
		const result = await createTask(taskDetails);
		context.log("Task creation result:", result);

		// Extract task details from the result
		const taskData = result.data ? result.data[0] : result;
		const taskUrl = result.taskUrl || taskData.permalink;
		const taskId = result.taskId || taskData.id;

		// Send notifications (don't block modal closure on these)
		Promise.all([
			sendTaskNotificationToChannel(
				taskDetails,
				taskData,
				taskUrl,
				taskId,
				context
			).catch((err) =>
				context.warn("Channel notification failed:", err.message)
			),
			sendTaskConfirmationToUser(
				userId,
				taskDetails,
				taskData,
				taskUrl,
				context
			).catch((err) => context.warn("User confirmation failed:", err.message)),
		]);

		// Return success response that immediately closes the modal
		return {
			status: 200,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				response_action: "clear",
			}),
		};
	} catch (taskError) {
		context.error("Task creation failed:", taskError.message);

		// Return error response that keeps modal open with error message
		return {
			status: 200,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				response_action: "errors",
				errors: {
					task_title: `Failed to create task: ${taskError.message}`,
				},
			}),
		};
	}
}

module.exports = {
	handleTaskCreation,
};
