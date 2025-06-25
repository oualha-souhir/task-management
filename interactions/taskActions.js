const Task = require("../models/task");
const wrikeApi = require("../services/wrikeApi");
const { updateTaskInSlack } = require("../services/slackMessageService");

/**
 * Handle task status change button clicks
 */
const handleTaskStatusChange = async ({ action, ack, body, client }) => {
	// Acknowledge the action request
	await ack();

	try {
		// Extract status and task ID from the button value
		const [newStatus, taskId] = action.value.split("|");

		// Find the task in our database
		const task = await Task.findOne({ wrikeTaskId: taskId });

		if (!task) {
			console.error(`Task not found: ${taskId}`);
			return;
		}

		// Update status in Wrike
		await wrikeApi.updateTask(taskId, { status: newStatus });

		// Update our database
		task.status = newStatus;
		await task.save();

		// Update the message in Slack
		await updateTaskInSlack(task);

		// Notify the user who clicked the button
		await client.chat.postEphemeral({
			channel: body.channel.id,
			user: body.user.id,
			text: `Task status updated to: ${
				newStatus.charAt(0).toUpperCase() + newStatus.slice(1)
			}`,
		});
	} catch (error) {
		console.error("Error handling task status change:", error);

		// Send an error message back to the user
		await client.chat.postEphemeral({
			channel: body.channel.id,
			user: body.user.id,
			text: "Sorry, there was an error updating the task status. Please try again.",
		});
	}
};

module.exports = {
	handleTaskStatusChange,
};
