const { app } = require("@azure/functions");
const { verifySlackSignature } = require("../utils/verification");

app.http("SlackEvents", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "slack/events",
  handler: async (request, context) => {
    context.log("SlackEvents triggered");

    if (request.method === "GET") {
      return {
        status: 200,
        jsonBody: { message: "Slack Events endpoint active" },
      };
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    if (!signature || !timestamp) {
      context.error("Missing Slack signature or timestamp");
      return { status: 401, jsonBody: { error: "Missing signature or timestamp" } };
    }

    if (!process.env.SLACK_SIGNING_SECRET) {
      context.error("SLACK_SIGNING_SECRET not configured");
      return { status: 500, jsonBody: { error: "Server configuration error" } };
    }

    if (!verifySlackSignature(rawBody, signature, timestamp, process.env.SLACK_SIGNING_SECRET)) {
      context.error("Invalid Slack signature");
      return { status: 401, jsonBody: { error: "Invalid signature" } };
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      context.error("Invalid JSON payload");
      return { status: 400, jsonBody: { error: "Invalid JSON" } };
    }

    if (payload.type === "url_verification") {
      return { status: 200, body: payload.challenge, headers: { "Content-Type": "text/plain" } };
    }

    return {
      status: 200,
      jsonBody: { message: "Event processed", eventType: payload.event?.type || "unknown" },
    };
  },
});