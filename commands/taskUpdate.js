const Task = require("../models/task");
const wrikeApi = require("../services/wrikeApi");

module.exports = async ({ command, ack, body, client }) => {
	// Acknowledge the command request
	await ack();

	try {
		// Parse command arguments to get task ID
		const args = command.text.trim().split(" ");

		if (args.length < 1) {
			await client.chat.postEphemeral({
				channel: body.channel_id,
				user: body.user_id,
				text: "Usage: /task update [task_id]",
			});
			return;
		}

		const taskId = args[0];

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

		// Open a modal for task update
		await client.views.open({
			trigger_id: body.trigger_id,
			view: {
				type: "modal",
				callback_id: "task_update_modal",
				title: {
					type: "plain_text",
					text: "Update Task",
				},
				submit: {
					type: "plain_text",
					text: "Update",
				},
				close: {
					type: "plain_text",
					text: "Cancel",
				},
				private_metadata: JSON.stringify({
					taskId: task.wrikeTaskId,
					slackTs: task.slackTs,
					channelId: body.channel_id,
				}),
				blocks: [
					{
						type: "input",
						block_id: "task_title",
						element: {
							type: "plain_text_input",
							action_id: "title",
							initial_value: task.title,
						},
						label: {
							type: "plain_text",
							text: "Title",
						},
					},
					{
						type: "input",
						block_id: "task_description",
						element: {
							type: "plain_text_input",
							action_id: "description",
							multiline: true,
							initial_value: task.description || "",
						},
						label: {
							type: "plain_text",
							text: "Description",
						},
						optional: true,
					},
					{
						type: "input",
						block_id: "task_status",
						element: {
							type: "static_select",
							action_id: "status",
							initial_option: {
								text: {
									type: "plain_text",
									text:
										task.status.charAt(0).toUpperCase() + task.status.slice(1),
								},
								value: task.status,
							},
							options: [
								{
									text: {
										type: "plain_text",
										text: "Active",
									},
									value: "active",
								},
								{
									text: {
										type: "plain_text",
										text: "Completed",
									},
									value: "completed",
								},
								{
									text: {
										type: "plain_text",
										text: "Deferred",
									},
									value: "deferred",
								},
								{
									text: {
										type: "plain_text",
										text: "Cancelled",
									},
									value: "cancelled",
								},
							],
						},
						label: {
							type: "plain_text",
							text: "Status",
						},
					},
					{
						type: "input",
						block_id: "task_due_date",
						element: {
							type: "datepicker",
							action_id: "due_date",
							initial_date: task.dueDate
								? new Date(task.dueDate).toISOString().split("T")[0]
								: undefined,
							placeholder: {
								type: "plain_text",
								text: "Select a due date",
							},
						},
						label: {
							type: "plain_text",
							text: "Due Date",
						},
						optional: true,
					},
					{
						type: "input",
						block_id: "task_assignee",
						element: {
							type: "users_select",
							action_id: "assignee",
							initial_user: task.assigneeSlackId,
							placeholder: {
								type: "plain_text",
								text: "Assign to someone",
							},
						},
						label: {
							type: "plain_text",
							text: "Assign To",
						},
						optional: true,
					},
				],
			},
		});
	} catch (error) {
		console.error("Error handling /task update command:", error);

		// Send an error message back to the user
		await client.chat.postEphemeral({
			channel: body.channel_id,
			user: body.user_id,
			text: "Sorry, there was an error processing your command. Please try again.",
		});
	}
};
