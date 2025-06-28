const axios = require("axios");
const { createTaskModal } = require("../utils/modalBuilder");

// Helper function to create blocks with current status
const createTaskBlocks = (
	channelId,
	taskDetails,
	taskId,
	taskUrl,
	currentStatus = null,
	includeStatusDropdown = true
) => [
	{
		type: "header",
		text: { type: "plain_text", text: `🎯 Nouvelle tâche : ${taskId}` },
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
				text: `*Personne assignée:*\n<@${
					taskDetails.assigneeUserId || "None"
				}>`,
			},
			{
				type: "mrkdwn",
				text: `*Projet:*\n<#${channelId || "None"}>`,
			},
			{
				type: "mrkdwn",
				text: `*Date de début:*\n${
					new Date(taskDetails.startDate).toLocaleString("fr-FR", {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
					}) || "None"
				}`,
			},
			{
				type: "mrkdwn",
				text: `*Date d'échéance:*\n${
					new Date(taskDetails.dueDate).toLocaleString("fr-FR", {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
					}) || "None"
				}`,
			},
			...(currentStatus
				? [
						{
							type: "mrkdwn",
							text: `*Statut actuel:*\n${getStatusDisplay(currentStatus)}`,
						},
				  ]
				: []),
		],
	},
	{
		type: "actions",
		elements: [
			{
				type: "button",
				text: { type: "plain_text", text: "🔗 Ouvrir dans Wrike" },
				url: taskUrl,
				style: "primary",
			},
			...(includeStatusDropdown
				? [
						{
							type: "static_select",
							placeholder: {
								type: "plain_text",
								text: "Mettre à jour le statut",
							},
							action_id: "update_task_status",
							initial_option: currentStatus
								? {
										text: {
											type: "plain_text",
											text: getStatusDisplay(currentStatus),
										},
										value: `${taskId}:${currentStatus}`,
								  }
								: undefined,
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
				  ]
				: []),
		],
	},
];

// Helper function to get status display text
const getStatusDisplay = (status) => {
	const statusMap = {
		New: "🔵 Nouveau",
		OnHold: "🔴 Bloqué",
		Cancelled: "❌ Annulé",
		InProgress: "🟡 En cours",
		Completed: "✅ Complétée",
	};
	return statusMap[status] || status;
};

class SlackService {
	constructor() {
		this.client = axios.create({
			baseURL: "https://slack.com/api",
			headers: {
				Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
				"Content-Type": "application/json",
			},
			timeout: 10000,
			httpAgent: new (require("http").Agent)({
				keepAlive: true,
				maxSockets: 10,
				timeout: 60000,
			}),
			httpsAgent: new (require("https").Agent)({
				keepAlive: true,
				maxSockets: 10,
				timeout: 60000,
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

	async updateMessage(channel, timestamp, text, blocks) {
		const response = await this.client.post("/chat.update", {
			channel,
			ts: timestamp,
			text,
			blocks,
		});
		if (!response.data.ok)
			throw new Error(`Failed to update message: ${response.data.error}`);
		return response.data;
	}

	async notifyChannel(channelId, taskDetails, taskId, taskUrl, context) {
		try {
			const blocks = createTaskBlocks(
				channelId,
				taskDetails,
				taskId,
				taskUrl,
				null,
				true
			); // Include dropdown

			const response = await this.postMessage(
				channelId,
				`Nouvelle tâche créée : ${taskId}`,
				blocks
			);

			// Store message timestamp for future updates
			return {
				channel: channelId,
				timestamp: response.ts,
				messageId: response.ts,
			};
		} catch (error) {
			context.error("Channel notification failed:", error.message);
			throw error;
		}
	}

	async notifyUser(userId, taskDetails, taskId, taskUrl, context) {
		try {
			const blocks = createTaskBlocks(
				taskDetails.channelId,
				taskDetails,
				taskId,
				taskUrl,
				null,
				false
			); // Exclude dropdown

			const response = await this.postMessage(
				userId,
				`Task "${taskDetails.title}" created successfully in project!`,
				blocks
			);

			// Store message timestamp for future updates
			return {
				channel: userId,
				timestamp: response.ts,
				messageId: response.ts,
			};
		} catch (error) {
			context.error("User notification failed:", error.message);
			throw error;
		}
	}
	async notifyStatusUpdate(
		taskDetails,
		taskId,
		taskUrl,
		oldStatus,
		newStatus,
		context
	) {
		console.log("oldStatus", oldStatus.previousStatus);
		console.log("newStatus", newStatus);

		try {
			const blocks = [];
			// createTaskBlocks(
			// 	taskDetails.channelId,
			// 	taskDetails,
			// 	taskId,
			// 	taskUrl,
			// 	null,
			// 	false
			// ); // Exclude dropdown

			const statusMessage = `🔄 *Statut de la tâche ${taskId} mis à jour: ${getStatusDisplay(
				oldStatus.previousStatus
			)} → ${getStatusDisplay(newStatus)}*`;

			blocks[0] = {
				type: "section",
				text: {
					type: "mrkdwn",
					text: statusMessage,
				},
			};

			blocks[1] = {
				type: "actions",
				elements: [
					{
						type: "button",
						text: { type: "plain_text", text: "🔗 Ouvrir dans Wrike" },
						url: taskUrl,
						style: "primary",
					},
				],
			};

			// Send notification to channel
			await this.postMessage(
				taskDetails.channelId,
				`Statut de la tâche ${taskId} mis à jour`,
				blocks
			);
			// Send notification to assignee if exists
			if (taskDetails.assigneeUserId) {
				const assigneeBlocks = [...blocks];

				await this.postMessage(
					taskDetails.assigneeUserId,
					`Votre tâche "${taskDetails.title}" a été mise à jour`,
					assigneeBlocks
				);
			}
		} catch (error) {
			context.error("Status update notification failed:", error.message);
		}
	}

	async updateTaskMessage(
		messageInfo,
		taskDetails,
		taskId,
		taskUrl,
		newStatus,
		context
	) {
		try {
			if (!messageInfo || !messageInfo.timestamp) {
				context.warn("No message info available for update");
				return;
			}

			const updatedBlocks = createTaskBlocks(
				taskDetails.channelId,
				taskDetails,
				taskId,
				taskUrl,
				newStatus
			);

			await this.updateMessage(
				messageInfo.channel,
				messageInfo.timestamp,
				`Nouvelle tâche : ${taskId} (Statut: ${getStatusDisplay(newStatus)})`,
				updatedBlocks
			);
		} catch (error) {
			context.error("Failed to update task message:", error.message);
		}
	}

	async getUserDisplayName(userId) {
		try {
			const response = await this.client.get(`/users.info?user=${userId}`);
			console.log("Slack API response:", response.data);

			if (!response.data.ok) {
				const error = new Error(`Slack API error: ${response.data.error}`);
				error.data = response.data;
				throw error;
			}

			const user = response.data.user;
			console.log(
				"User display name:",
				user.display_name || user.real_name || user.name
			);

			return user.display_name || user.real_name || user.name;
		} catch (error) {
			// Enhanced error logging for scope issues
			if (error.response?.data?.error === "missing_scope") {
				console.error("Missing required scope for users.info API call:", {
					needed: error.response.data.needed,
					provided: error.response.data.provided,
				});
			}
			throw error;
		}
	}

	async notifyAssignee(assigneeUserId, taskDetails, taskId, taskUrl, context) {
		try {
			const blocks = [
				{
					type: "header",
					text: {
						type: "plain_text",
						text: `🎯 Nouvelle tâche assignée : ${taskId}`,
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `Bonjour ! Une nouvelle tâche vous a été assignée.`,
					},
				},
				{
					type: "section",
					fields: [
						{ type: "mrkdwn", text: `*Titre:*\n${taskDetails.title}` },
						{
							type: "mrkdwn",
							text: `*Description:*\n${
								taskDetails.description || "Aucune description"
							}`,
						},

						{
							type: "mrkdwn",
							text: `*Date de début:*\n${
								new Date(taskDetails.startDate).toLocaleString("fr-FR", {
									weekday: "long",
									year: "numeric",
									month: "long",
									day: "numeric",
								}) || "Non définie"
							}`,
						},
						{
							type: "mrkdwn",
							text: `*Date d'échéance:*\n${
								new Date(taskDetails.dueDate || "Non définie").toLocaleString(
									"fr-FR",
									{
										weekday: "long",
										year: "numeric",
										month: "long",
										day: "numeric",
									}
								) || "Non définie"
							}`,
						},
					],
				},
				{
					type: "actions",
					elements: [
						{
							type: "button",
							text: { type: "plain_text", text: "🔗 Ouvrir dans Wrike" },
							url: taskUrl,
							style: "primary",
						},
					],
				},
			];

			const response = await this.postMessage(
				assigneeUserId,
				`Nouvelle tâche assignée : ${taskDetails.title}`,
				blocks
			);

			return {
				channel: assigneeUserId,
				timestamp: response.ts,
				messageId: response.ts,
			};
		} catch (error) {
			context.error("Assignee notification failed:", error.message);
			throw error;
		}
	}
}

module.exports = { SlackService, getStatusDisplay };
