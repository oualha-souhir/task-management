const Task = require("../models/task");
const wrikeApi = require("../services/wrikeApi");
const { updateTaskInSlack } = require("../services/slackMessageService");

module.exports = async ({ command, ack, body, client }) => {
	// Acknowledge the command request
	await ack();

	try {
		// Parse command arguments
		const args = command.text.trim().split(" ");

		if (args.length < 2) {
			await client.chat.postEphemeral({
				channel: body.channel_id,
				user: body.user_id,
				text: "Usage: /task assign [task_id] [@user]",
			});
			return;
		}

		const taskId = args[0];
		const assigneeId = args[1].replace(/[<@>]/g, ""); // Extract user ID from <@U123456>

		// Find the task in database
		const task = await Task.findOne({
			wrikeTaskId: taskId,
			channelId: body.channel_id,
		});

		if (!task) {
			await client.chat.postEphemeral({
				channel: body.channel_id,
				user: body.user_id,
				text: `Task with ID ${taskId} not found in this channel.`,
			});
			return;
		}

		// Get user info from Slack
		const userInfo = await client.users.info({
			user: assigneeId,
		});

		// Map Slack user to Wrike user (this would need a more sophisticated mapping in a real app)
		// For now, we'll assume the email is enough to identify the user in Wrike
		const wrikeUsers = await wrikeApi.getWrikeUsers();
		const wrikeUser = wrikeUsers.find(
			(user) =>
				user.profiles &&
				user.profiles.some(
					(profile) => profile.email === userInfo.user.profile.email
				)
		);

		if (!wrikeUser) {
			await client.chat.postEphemeral({
				channel: body.channel_id,
				user: body.user_id,
				text: `Could not find a matching Wrike user for ${userInfo.user.real_name}.`,
			});
			return;
		}

		// Update task in Wrike
		await wrikeApi.updateTask(task.wrikeTaskId, {
			assigneeWrikeId: wrikeUser.id,
		});

		// Update task in our database
		task.assigneeSlackId = assigneeId;
		task.assigneeWrikeId = wrikeUser.id;
		await task.save();

		// Update the task message in Slack
		await updateTaskInSlack(task);

		// Confirm the assignment
		await client.chat.postEphemeral({
			channel: body.channel_id,
			user: body.user_id,
			text: `Task successfully assigned to <@${assigneeId}>.`,
		});
	} catch (error) {
		console.error("Error handling /task assign command:", error);

		// Send an error message back to the user
		await client.chat.postEphemeral({
			channel: body.channel_id,
			user: body.user_id,
			text: "Sorry, there was an error processing your command. Please try again.",
		});
	}
};
