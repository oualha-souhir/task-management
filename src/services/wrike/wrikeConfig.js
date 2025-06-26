const WRIKE_CONFIG = {
    API_BASE_URL: process.env.WRIKE_API_URL || "https://app-eu.wrike.com/api/v4",
    ACCESS_TOKEN: process.env.WRIKE_ACCESS_TOKEN,
    DEFAULT_FOLDER_ID: "IEABCJBLI5SD6PQZ",
    TIMEOUT: 10000,
    CUSTOM_FIELDS: {
        ASSIGNEE: "IEABCJBLJUAIPZS4",
        DESCRIPTION: "IEABCJBLJUAIPZS3"
    }
};

module.exports = WRIKE_CONFIG;