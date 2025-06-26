const axios = require("axios");
const slackApiHelper = require("../utils/slackApiHelper");

async function sendTaskNotificationToChannel(
	taskDetails,
	taskData,
	taskUrl,
	taskId,
	context
) {
	const taskChannelId = process.env.TASK_CHANNEL_ID || "C08KJ8R2JET";

	try {
		// First, check if we have the required scopes
		const authTestResponse = await axios.get(
			"https://slack.com/api/auth.test",
			{
				headers: {
					Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
				},
			}
		);

		if (!authTestResponse.data.ok) {
			throw new Error(`Auth test failed: ${authTestResponse.data.error}`);
		}

		const message = {
			channel: taskChannelId,
			blocks: [
				{
					type: "header",
					text: {
						type: "plain_text",
						text: ` Nouvelle tâche créée : ${taskId}`,
					},
				},
				{
					type: "section",
					fields: [
						{
							type: "mrkdwn",
							text: `*Titre:*\n${taskData.title || taskDetails.title}`,
						},
						{
							type: "mrkdwn",
							text: `*Description:*\n${
								taskDetails.description || "No description"
							}`,
						},
						{
							type: "mrkdwn",
							text: `*Personne assignée:*\n${taskDetails.assignee || "Not assigned"}`,
						},
						{
							type: "mrkdwn",
							text: `*Date de début:*\n${taskDetails.startDate || "No start date"}`,
						},
						{
							type: "mrkdwn",
							text: `*Échéance:*\n${taskDetails.dueDate || "No due date"}`,
						},
						{
							type: "mrkdwn",
							text: `*Statut:*\n🔵 New`,
						},
					],
				},
				{
					type: "actions",
					elements: [
						{
							type: "button",
							text: {
								type: "plain_text",
								text: "🔗 Lien vers Wrike",
							},
							url: taskUrl,
							style: "primary",
						},
						{
							type: "static_select",
							placeholder: {
								type: "plain_text",
								text: "Mettre à jour le statut",
							},
							action_id: "update_task_status",
							options: [
								{
									text: {
										type: "plain_text",
										text: "🔵 Nouveau",
									},
									value: "New",
								},
								{
									text: {
										type: "plain_text",
										text: "🟦 Planifié",
									},
									value: "Planned",
								},
								{
									text: {
										type: "plain_text",
										text: "🟢 En cours",
									},
									value: "InProgress",
								},
								{
									text: {
										type: "plain_text",
										text: "🟡 En révision",
									},
									value: "InReview",
								},
								{
									text: {
										type: "plain_text",
										text: "✅ Terminé",
									},
									value: "Completed",
								},
							],
						},
					],
				},
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: `Created on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
						},
					],
				},
			],
		};

		const response = await axios.post(
			"https://slack.com/api/chat.postMessage",
			message,
			{
				headers: {
					Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.data.ok) {
			if (response.data.error === "missing_scope") {
				throw new Error(
					`Missing required Slack scope 'chat:write'. Please add this scope to your Slack app at https://api.slack.com/apps and reinstall the app.`
				);
			}
			if (response.data.error === "channel_not_found") {
				throw new Error(
					`Channel not found. Please check TASK_CHANNEL_ID environment variable. Current value: ${taskChannelId}`
				);
			}
			if (response.data.error === "not_in_channel") {
				throw new Error(
					`Bot is not a member of channel ${taskChannelId}. Please invite the bot to the channel.`
				);
			}
			throw new Error(`Slack API error: ${response.data.error}`);
		}

		context.log("Task notification sent to channel successfully");
	} catch (error) {
		context.error("Error sending task notification to channel:", error.message);

		// Provide specific guidance based on the error
		if (error.message.includes("missing_scope")) {
			context.error(
				"SLACK CONFIGURATION REQUIRED: Your Slack bot needs the 'chat:write' scope. " +
					"Go to https://api.slack.com/apps, select your app, go to 'OAuth & Permissions', " +
					"add the 'chat:write' scope under 'Bot Token Scopes', and reinstall the app to your workspace."
			);
		} else if (error.message.includes("channel_not_found")) {
			context.error(
				"CHANNEL CONFIGURATION: Update TASK_CHANNEL_ID in your .env file with a valid channel ID."
			);
		} else if (error.message.includes("not_in_channel")) {
			context.error(
				"BOT INVITATION REQUIRED: Invite your Slack bot to the target channel."
			);
		}

		throw error;
	}
}

// Send a confirmation message to the user who created the task
async function sendTaskConfirmationToUser(
	userId,
	taskDetails,
	taskData,
	taskUrl,
	context
) {
	try {
		const blocks = [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `✅ *Task Created Successfully!*\n*${
						taskData.title
					}*\n📋 Task ID: ${taskData.id}\n📝 Description: ${
						taskDetails.description
					}\n👤 Assignee: ${
						taskDetails.assignee || "Not assigned"
					}\n📅 Due Date: ${taskDetails.dueDate || "No due date"}`,
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🔗 View in Wrike",
						},
						url: taskUrl,
						style: "primary",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "📋 Create Another Task",
						},
						action_id: "create_another_task",
						value: "create_task",
					},
				],
			},
		];

		await slackApiHelper.postMessage(
			userId,
			`Task "${taskData.title}" created successfully!`,
			blocks
		);

		context.log("Task confirmation sent to user successfully");
	} catch (error) {
		context.error("Failed to send user confirmation:", error);
		// Don't throw error here - this is optional
	}
}

module.exports = {
	sendTaskNotificationToChannel,
	sendTaskConfirmationToUser,
};
