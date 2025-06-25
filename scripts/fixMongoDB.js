require("dotenv").config();

function parseMongoUri(uri) {
	// Extract components from MongoDB URI
	const regex = /mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)(\?.*)?/;
	const match = uri.match(regex);

	if (!match) {
		console.error("❌ Invalid MongoDB URI format");
		return null;
	}

	return {
		username: match[1],
		password: match[2],
		cluster: match[3],
		database: match[4],
		options: match[5] || "",
	};
}

function generateNewMongoUri() {
	const currentUri = process.env.MONGODB_URI;
	console.log("🔍 Analyzing current MongoDB URI...");

	const parsed = parseMongoUri(currentUri);
	if (!parsed) return;

	console.log("Current configuration:");
	console.log(`  Username: ${parsed.username}`);
	console.log(`  Password: ${parsed.password.substring(0, 3)}***`);
	console.log(`  Cluster: ${parsed.cluster}`);
	console.log(`  Database: ${parsed.database}`);

	console.log("\n📋 Steps to fix MongoDB authentication:");
	console.log("1. Go to https://cloud.mongodb.com");
	console.log("2. Select your project and cluster");
	console.log('3. Go to "Database Access" in the left sidebar');
	console.log('4. Find or create user "supportit"');
	console.log('5. If user exists, click "Edit" and reset password');
	console.log('6. If user doesn\'t exist, click "Add New Database User":');
	console.log("   - Authentication Method: Password");
	console.log("   - Username: supportit");
	console.log("   - Password: Generate a new secure password");
	console.log(
		'   - Database User Privileges: "Read and write to any database"'
	);
	console.log("   - Built-in Role: readWrite@admin");

	console.log("\n🔧 Alternative: Create a new connection string:");
	console.log('1. In MongoDB Atlas, go to "Database" → "Connect"');
	console.log('2. Choose "Connect your application"');
	console.log('3. Select "Node.js" driver');
	console.log("4. Copy the new connection string");
	console.log("5. Replace the password placeholder with your actual password");

	console.log("\n📝 Your new URI should look like:");
	console.log(
		`mongodb+srv://NEW_USERNAME:NEW_PASSWORD@${parsed.cluster}/${parsed.database}${parsed.options}`
	);
}

generateNewMongoUri();
