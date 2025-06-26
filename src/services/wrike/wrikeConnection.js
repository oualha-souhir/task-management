const WrikeClient = require("./wrikeClient");

class WrikeConnection {
    constructor() {
        this.client = new WrikeClient();
    }

    async testConnection() {
        try {
            console.log("Testing Wrike connection...");
            await this.client.get("/account");
            console.log("Wrike connection test successful");
            return true;
        } catch (error) {
            console.error("Wrike connection test failed:", {
                status: error.response?.status,
                message: error.message
            });

            if (error.response?.status === 401) {
                throw new Error("Wrike access token is invalid or expired. Please check your WRIKE_ACCESS_TOKEN environment variable.");
            }

            throw new Error(`Wrike connection failed: ${error.response?.data?.errorDescription || error.message}`);
        }
    }
}

module.exports = WrikeConnection;