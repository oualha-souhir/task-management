const axios = require("axios");
const { createTaskModal } = require("../utils/modalBuilder");

async function handleBlockActions(payload, context) {
	const action = payload.actions[0];

	if (action.action_id === "create_another_task") {
		return await handleCreateAnotherTask(payload, context);
	}

	if (action.action_id === "update_task_status") {
		return await handleTaskStatusUpdate(action, context);
	}

	return {
		status: 200,
		jsonBody: {
			response_type: "ephemeral",
			text: "Action not recognized.",
		},
	};
}

async function handleCreateAnotherTask(payload, context) {
	try {
		const response = await axios.post(
			"https://slack.com/api/views.open",
			{
				trigger_id: payload.trigger_id,
				view: createTaskModal(),
			},
			{
				headers: {
					Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.data.ok) {
			throw new Error(`Failed to open modal: ${response.data.error}`);
		}

		return { status: 200 };
	} catch (error) {
		context.error("Error opening modal:", error);
		return {
			status: 200,
			jsonBody: {
				response_type: "ephemeral",
				text: `❌ Failed to open modal: ${error.message}`,
			},
		};
	}
}

async function handleTaskStatusUpdate(action, context) {
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

module.exports = {
	handleBlockActions,
};
