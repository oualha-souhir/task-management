const Task = require("../models/task");
const wrikeApi = require("../services/wrikeApi");
const { formatTaskBlocks } = require("../utils/messageFormatter");

module.exports = async ({ command, ack, body, client, say }) => {
	// Acknowledge the command request
	await ack();

	try {
		const args = command.text.split(" ");
		let tasks;
		const showMessage = {};

		if (args.includes("me")) {
			// Get tasks assigned to the current user
			tasks = await Task.find({
				assigneeSlackId: body.user_id,
				channelId: body.channel_id,
			});
			showMessage.text = "🔍 Here are your tasks:";
		} else {
			// Get all tasks in the current channel
			tasks = await Task.find({ channelId: body.channel_id });
			showMessage.text = "📋 Tasks in this channel:";
		}

		if (tasks.length === 0) {
			await client.chat.postEphemeral({
				channel: body.channel_id,
				user: body.user_id,
				text: "No tasks found.",
			});
			return;
		}

		// Format tasks for display
		showMessage.blocks = [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: showMessage.text,
				},
			},
			{
				type: "divider",
			},
			...(await formatTaskBlocks(tasks)),
		];

		// Send message to the channel
		await client.chat.postEphemeral({
			channel: body.channel_id,
			user: body.user_id,
			text: showMessage.text,
			blocks: showMessage.blocks,
		});
	} catch (error) {
		console.error("Error handling /task list command:", error);

		// Send an error message back to the user
		await client.chat.postEphemeral({
			channel: body.channel_id,
			user: body.user_id,
			text: "Sorry, there was an error processing your command. Please try again.",
		});
	}
};
