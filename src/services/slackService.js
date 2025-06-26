const axios = require("axios");
const { createTaskModal } = require("../utils/modalBuilder");
// Helper function to create blocks
const createTaskBlocks = (taskDetails, taskId, taskUrl) => [
	{
		type: "header",
		text: { type: "plain_text", text: `Nouvelle tâche : ${taskId}` },
	},
	{
		type: "section",
		fields: [
			{ type: "mrkdwn", text: `*Titre:*\n${taskDetails.title}` },
			{
				type: "mrkdwn",
				text: `*Description:*\n${taskDetails.description || "None"}`,
			},
			{
				type: "mrkdwn",
				text: `*Personne assignée:*\n${taskDetails.assignee || "None"}`,
			},
			{
				type: "mrkdwn",
				text: `*Date de début:*\n${taskDetails.startDate || "None"}`,
			},
			{
				type: "mrkdwn",
				text: `*Date d'échéance:*\n${taskDetails.dueDate || "None"}`,
			},
		],
	},
	{
		type: "actions",
		elements: [
			{
				type: "button",
				text: { type: "plain_text", text: "🔗 Lien vers Wrike" },
				url: taskUrl,
				style: "primary",
			},
			{
				type: "static_select",
				placeholder: { type: "plain_text", text: "Mettre à jour le statut" },
				action_id: "update_task_status",
				options: [
					{
						text: { type: "plain_text", text: "🔵 Nouveau" },
						value: `${taskId}:New`,
					},
					{
						text: { type: "plain_text", text: "🔴 Bloqué" },
						value: `${taskId}:OnHold`,
					},
					{
						text: { type: "plain_text", text: "❌ Annulé" },
						value: `${taskId}:Cancelled`,
					},
					{
						text: { type: "plain_text", text: "🟡 En cours" },
						value: `${taskId}:InProgress`,
					},
					{
						text: { type: "plain_text", text: "✅ Complétée" },
						value: `${taskId}:Completed`,
					},
				],
			},
		],
	},
];
class SlackService {
	constructor() {
		this.client = axios.create({
			baseURL: "https://slack.com/api",
			headers: {
				Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
				"Content-Type": "application/json",
			},
			timeout: 1500,
			httpAgent: new (require("http").Agent)({
				keepAlive: true,
				maxSockets: 10,
			}),
			httpsAgent: new (require("https").Agent)({
				keepAlive: true,
				maxSockets: 10,
			}),
		});
	}

	async openModal(triggerId, view = createTaskModal()) {
		if (!triggerId) throw new Error("Missing trigger_id");
		const response = await this.client.post("/views.open", {
			trigger_id: triggerId,
			view,
		});
		if (!response.data.ok)
			throw new Error(
				response.data.error === "expired_trigger_id"
					? "EXPIRED_TRIGGER_ID"
					: `Failed to open modal: ${response.data.error}`
			);
		return response.data;
	}

	async postMessage(channel, text, blocks) {
		const response = await this.client.post("/chat.postMessage", {
			channel,
			text,
			blocks,
		});
		if (!response.data.ok)
			throw new Error(`Failed to post message: ${response.data.error}`);
		return response.data;
	}

	async notifyChannel(taskDetails, taskId, taskUrl, context) {
		try {
			            const blocks = createTaskBlocks(taskDetails, taskId, taskUrl);

			await this.postMessage(
				process.env.TASK_CHANNEL_ID || "C0936RVC91T",
				`Nouvelle tâche créée : ${taskId}`,
				blocks
			);
		} catch (error) {
			context.error("Channel notification failed:", error.message);
		}
	}

	async notifyUser(userId, taskDetails, taskId, taskUrl, context) {
		try {
			            const blocks = createTaskBlocks(taskDetails, taskId, taskUrl);

			await this.postMessage(
				userId,
				`Task "${taskDetails.title}" created successfully in project!`,
				blocks
			);
		} catch (error) {
			context.error("User notification failed:", error.message);
		}
	}
}

module.exports = { SlackService };
