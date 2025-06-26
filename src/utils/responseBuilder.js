class ResponseBuilder {
  static success() {
    return { status: 200 };
  }

  static ephemeralError(message) {
    return { status: 200, jsonBody: { response_type: "ephemeral", text: `❌ ${message}` } };
  }

  static expiredTriggerResponse() {
    return {
      status: 200,
      jsonBody: { response_type: "ephemeral", text: "⏱️ Action expired. Use `/task-test` to create a new task." },
    };
  }
}

module.exports = { ResponseBuilder };