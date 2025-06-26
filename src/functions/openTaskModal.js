const { app } = require("@azure/functions");
const openAiService = require("../services/openAiService");

const axios = require("axios");

async function openTaskModal(command, context) {
    try {
        context.log("Opening task creation modal...");

        const response = await axios.post(
            "https://slack.com/api/views.open",
            {
                trigger_id: command.trigger_id,
                view: {
                    type: "modal",
                    callback_id: "create_task_modal",
                    title: {
                        type: "plain_text",
                        text: "Create New Task",
                    },
                    blocks: [
                        {
                            type: "input",
                            block_id: "task_title",
                            element: {
                                type: "plain_text_input",
                                action_id: "title_input",
                                placeholder: {
                                    type: "plain_text",
                                    text: "Enter task title",
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
                                action_id: "description_input",
                                multiline: true,
                                placeholder: {
                                    type: "plain_text",
                                    text: "Enter task description",
                                },
                            },
                            label: {
                                type: "plain_text",
                                text: "Description",
                            },
                        },
                        {
                            type: "input",
                            block_id: "task_due_date",
                            element: {
                                type: "datepicker",
                                action_id: "due_date_input",
                                placeholder: {
                                    type: "plain_text",
                                    text: "Select a due date",
                                },
                            },
                            label: {
                                type: "plain_text",
                                text: "Due Date",
                            },
                        },
                        {
                            type: "input",
                            block_id: "task_assignee",
                            element: {
                                type: "plain_text_input",
                                action_id: "assignee_input",
                                placeholder: {
                                    type: "plain_text",
                                    text: "Enter assignee (suggested by AI)",
                                },
                            },
                            label: {
                                type: "plain_text",
                                text: "Assignee",
                            },
                        },
                    ],
                    submit: {
                        type: "plain_text",
                        text: "Create Task",
                    },
                },
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

        context.log("Modal opened successfully");
        return { status: 200 };
    } catch (error) {
        context.error("Error opening modal:", error);
        return {
            status: 500,
            jsonBody: {
                response_type: "ephemeral",
                text: `❌ Failed to open modal: ${error.message}`,
            },
        };
    }
}
module.exports = {
    openTaskModal,
};