const axios = require("axios");
require("dotenv").config();

async function debugWrikeAPI() {
	const token = process.env.WRIKE_ACCESS_TOKEN;

	console.log("🔍 Debugging Wrike API...");
	console.log("Token present:", !!token);

	if (!token) {
		console.error("❌ No WRIKE_ACCESS_TOKEN found");
		return;
	}

	const headers = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	try {
		// Test 1: Account info
		console.log("\n1️⃣ Testing account access...");
		const accountResponse = await axios.get(
			"https://app-eu.wrike.com/api/v4/account",
			{ headers }
		);
		console.log("✅ Account access successful");
		console.log("Account:", accountResponse.data.data[0].name);

		// Test 2: Spaces
		console.log("\n2️⃣ Testing spaces...");
		try {
			const spacesResponse = await axios.get(
				"https://app-eu.wrike.com/api/v4/spaces",
				{ headers }
			);
			console.log("✅ Spaces accessible:", spacesResponse.data.data.length);
			spacesResponse.data.data.forEach((space) => {
				console.log(`  - ${space.title} (${space.id})`);
			});
		} catch (spaceError) {
			console.log("⚠️ Spaces not accessible:", spaceError.response?.status);
		}

		// Test 3: Contacts
		console.log("\n3️⃣ Testing contacts...");
		try {
			const contactsResponse = await axios.get(
				"https://app-eu.wrike.com/api/v4/contacts",
				{ headers }
			);
			console.log("✅ Contacts accessible:", contactsResponse.data.data.length);
		} catch (contactError) {
			console.log("⚠️ Contacts not accessible:", contactError.response?.status);
		}

		// Test 4: Simple task creation
		console.log("\n4️⃣ Testing simple task creation...");
		try {
			const taskResponse = await axios.post(
				"https://app-eu.wrike.com/api/v4/tasks",
				{
					title: "Debug Test Task",
					description: "Test task from debug script",
					status: "Active",
				},
				{ headers }
			);

			console.log("✅ Task creation successful!");
			const task = taskResponse.data.data[0];
			console.log("Task ID:", task.id);

			// Clean up
			await axios.delete(`https://app-eu.wrike.com/api/v4/tasks/${task.id}`, {
				headers,
			});
			console.log("🗑️ Test task cleaned up");
		} catch (taskError) {
			console.log("❌ Task creation failed:");
			console.log("Status:", taskError.response?.status);
			console.log("Error:", taskError.response?.data);
		}
	} catch (error) {
		console.error("❌ Debug failed:", error.response?.data || error.message);
	}
}

debugWrikeAPI();
