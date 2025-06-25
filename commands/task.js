const wrikeApi = require("../services/wrikeApi");
const ChannelProject = require("../models/channelProject");
const Task = require("../models/task");

module.exports = async ({ command, ack, body, client }) => {
	// Acknowledge the command request
	await ack();

	try {
		// Check if channel is linked to a Wrike project
		const channelProject = await ChannelProject.findOne({
			channelId: body.channel_id,
		});

		if (!channelProject) {
			// If channel isn't linked, ask to link it first
			await client.chat.postEphemeral({
				channel: body.channel_id,
				user: body.user_id,
				text: "This channel isn't linked to a Wrike project yet. Please use `/task link` to connect it to a project first.",
			});
			return;
		}

		// Open a modal for task creation
		await client.views.open({
			trigger_id: body.trigger_id,
			view: {
				type: "modal",
				callback_id: "task_creation_modal",
				title: {
					type: "plain_text",
					text: "Create Task",
				},
				submit: {
					type: "plain_text",
					text: "Create",
				},
				close: {
					type: "plain_text",
					text: "Cancel",
				},
				private_metadata: JSON.stringify({
					channelId: body.channel_id,
					projectId: channelProject.projectId,
				}),
				blocks: [
					{
						type: "input",
						block_id: "task_title",
						element: {
							type: "plain_text_input",
							action_id: "title",
							placeholder: {
								type: "plain_text",
								text: "Task title",
							},
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
							placeholder: {
								type: "plain_text",
								text: "Task description",
							},
						},
						label: {
							type: "plain_text",
							text: "Description",
						},
						optional: true,
					},
					{
						type: "input",
						block_id: "task_due_date",
						element: {
							type: "datepicker",
							action_id: "due_date",
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
		console.error("Error handling /task command:", error);

		// Send an error message back to the user
		await client.chat.postEphemeral({
			channel: body.channel_id,
			user: body.user_id,
			text: "Sorry, there was an error processing your command. Please try again.",
		});
	}
};
