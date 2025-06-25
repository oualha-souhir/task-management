const { formatTaskBlocks } = require("../utils/messageFormatter");
const { WebClient } = require("@slack/web-api");

// Initialize Slack client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Post a new task message to a Slack channel
 */
const postTaskToSlack = async (task, channelId) => {
	try {
		const blocks = await formatTaskBlocks([task]);

		const messageText = `New task created: ${task.title}`;

		const result = await slackClient.chat.postMessage({
			channel: channelId,
			text: messageText,
			blocks: blocks,
		});

		return result.ts; // Return the message timestamp for future reference
	} catch (error) {
		console.error("Error posting task to Slack:", error);
		throw error;
	}
};

/**
 * Update an existing task message in Slack
 */
const updateTaskInSlack = async (task) => {
	try {
		const blocks = await formatTaskBlocks([task]);

		const messageText = `Task updated: ${task.title}`;

		await slackClient.chat.update({
			channel: task.channelId,
			ts: task.slackTs,
			text: messageText,
			blocks: blocks,
		});
	} catch (error) {
		console.error("Error updating task in Slack:", error);
		throw error;
	}
};

module.exports = {
	postTaskToSlack,
	updateTaskInSlack,
};
