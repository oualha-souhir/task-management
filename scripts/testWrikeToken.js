const axios = require("axios");
require("dotenv").config();

async function testWrikeToken() {
	const token = process.env.WRIKE_ACCESS_TOKEN;
	console.log("🔑 Using Wrike access token:", token);
	if (!token) {
		console.error("❌ WRIKE_ACCESS_TOKEN not found in environment variables");
		return;
	}

	try {
		console.log("🔍 Testing Wrike access token...");

		// Test basic API access
		const response = await axios.get(
			"https://app-eu.wrike.com/api/v4/account",
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		console.log("✅ Token is valid!");
		console.log("Account info:", {
			id: response.data.data[0].id,
			name: response.data.data[0].name,
			dateFormat: response.data.data[0].dateFormat,
			subscription: response.data.data[0].subscription,
		});

		// Test workspace access
		const workspacesResponse = await axios.get(
			"https://app-eu.wrike.com/api/v4/folders",
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		console.log("✅ Workspace access confirmed!");
		console.log(
			`Found ${workspacesResponse.data.data.length} folders/projects`
		);

		// Show first few folders
		workspacesResponse.data.data.slice(0, 3).forEach((folder) => {
			console.log(`  - ${folder.title} (${folder.scope})`);
		});
	} catch (error) {
		console.error("❌ Token test failed:");
		if (error.response) {
			console.error("Status:", error.response.status);
			console.error("Error:", error.response.data);

			if (error.response.status === 401) {
				console.error("\n💡 This usually means:");
				console.error("  1. Token is invalid or expired");
				console.error("  2. Token doesn't have required permissions");
				console.error("  3. App needs to be approved by workspace admin");
			}
		} else {
			console.error("Error:", error.message);
		}
	}
}

testWrikeToken();
