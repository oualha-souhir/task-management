const axios = require("axios");
const WRIKE_CONFIG = require("./wrikeConfig");

class WrikeClient {
    constructor() {
        this.baseURL = WRIKE_CONFIG.API_BASE_URL;
        this.token = WRIKE_CONFIG.ACCESS_TOKEN;
        this.timeout = WRIKE_CONFIG.TIMEOUT;
    }

    getHeaders() {
        return {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
        };
    }

    async get(endpoint) {
        return axios.get(`${this.baseURL}${endpoint}`, {
            headers: this.getHeaders(),
            timeout: this.timeout
        });
    }

    async post(endpoint, data) {
        return axios.post(`${this.baseURL}${endpoint}`, data, {
            headers: this.getHeaders(),
            timeout: this.timeout
        });
    }

    async put(endpoint, data) {
        return axios.put(`${this.baseURL}${endpoint}`, data, {
            headers: this.getHeaders(),
            timeout: this.timeout
        });
    }
}

module.exports = WrikeClient;