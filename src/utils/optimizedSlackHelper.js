const axios = require("axios");
const Agent = require('agentkeepalive');
const { HttpsAgent } = require('agentkeepalive');

class OptimizedSlackHelper {
    constructor() {
        // Create persistent agents for connection reuse
        this.httpAgent = new Agent({
            maxSockets: 100,
            maxFreeSockets: 10,
            timeout: 60000,
            freeSocketTimeout: 30000,
        });

        this.httpsAgent = new HttpsAgent({
            maxSockets: 100,
            maxFreeSockets: 10,
            timeout: 60000,
            freeSocketTimeout: 30000,
        });

        this.client = axios.create({
            baseURL: "https://slack.com/api",
            timeout: 1200, // 1.2 seconds
            headers: {
                Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                "Content-Type": "application/json",
            },
            httpAgent: this.httpAgent,
            httpsAgent: this.httpsAgent,
            maxRedirects: 0,
        });
    }

    async openModal(triggerId, view) {
        if (!triggerId) {
            throw new Error("MISSING_TRIGGER_ID");
        }

        try {
            const response = await this.client.post('/views.open', {
                trigger_id: triggerId,
                view: view,
            });

            if (!response.data.ok) {
                if (response.data.error === "expired_trigger_id") {
                    throw new Error("EXPIRED_TRIGGER_ID");
                }
                throw new Error(response.data.error);
            }

            return response.data;
        } catch (error) {
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                throw new Error("TIMEOUT");
            }
            throw error;
        }
    }
}

module.exports = new OptimizedSlackHelper();
