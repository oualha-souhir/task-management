function createTaskModal(channelId = "") {
  return {
    type: "modal",
    callback_id: "create_task_modal",
    private_metadata: channelId, // Store channel ID for task creation
    title: { type: "plain_text", text: "Créer une nouvelle tâche" },
    submit: { type: "plain_text", text: "Créer une tâche" },
    blocks: [
      {
        type: "input",
        block_id: "task_title",
        element: { type: "plain_text_input", action_id: "title_input" },
        label: { type: "plain_text", text: "Titre" },
      },
      {
        type: "input",
        block_id: "task_description",
        element: { type: "plain_text_input", action_id: "description_input", multiline: true },
        label: { type: "plain_text", text: "Description" },
      },
      {
        type: "input",
        block_id: "task_start_date",
        element: { type: "datepicker", action_id: "start_date_input" },
        label: { type: "plain_text", text: "Date de début" },
      },
      {
        type: "input",
        block_id: "task_due_date",
        element: { type: "datepicker", action_id: "due_date_input" },
        label: { type: "plain_text", text: "Échéance" },
      },
      {
        type: "input",
        block_id: "task_assignee",
        element: { 
          type: "users_select", 
          action_id: "assignee_input",
          placeholder: { type: "plain_text", text: "Sélectionner un utilisateur" }
        },
        label: { type: "plain_text", text: "Personne assignée" },
        optional: true,
      },
    ],
  };
}

module.exports = { createTaskModal };