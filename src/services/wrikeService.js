const axios = require("axios");
const { createTask1 } = require("../functions/slackSlashCommands");

const WRIKE_API_BASE_URL = process.env.WRIKE_API_URL || "https://app-eu.wrike.com/api/v4";


async function testWrikeConnection() {
    try {
        
        console.log("Wrike API base URL:", WRIKE_API_BASE_URL);
        // Validate token format first
       
        console.log("Using Wrike API base URL:", WRIKE_API_BASE_URL);
        
        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;
        console.log("Testing Wrike connection with token:", WRIKE_ACCESS_TOKEN);

        const response = await axios.get(`${WRIKE_API_BASE_URL}/account`, {
            headers: {
                Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            timeout: 10000,
        });

        console.log("Wrike connection test successful:", response.data);
        return true;
    } catch (error) {
        console.error("Error testing Wrike connection - token status:", process.env.WRIKE_ACCESS_TOKEN ? "Token present" : "Token missing");

        console.error("Wrike connection test failed:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        if (error.response?.status === 401) {
            throw new Error("Wrike access token is invalid or expired. Please check your WRIKE_ACCESS_TOKEN environment variable.");
        }

        throw new Error(`Wrike connection failed: ${error.response?.data?.errorDescription || error.message}`);
    }
}

// ...existing code...

// ...existing code...

// Create task with a specific folder ID
// ...existing code...

// ...existing code...

// Create task with a specific folder ID
async function createTaskWithFolder(taskDetails, folderId) {
    console.log(`Creating task in folder ${folderId} with details:`, taskDetails);

    try {
        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;
        
        // First, let's verify the folder exists and we have access to it
        console.log("Verifying folder access...");
        const folderResponse = await axios.get(
            `${WRIKE_API_BASE_URL}/folders/${folderId}`,
            {
                headers: {
                    Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            }
        );
        
        console.log("Folder details:", JSON.stringify(folderResponse.data, null, 2));
        
        // Create task with description and custom fields
        let taskPayload = {
            title: taskDetails.title,
            description: taskDetails.description || "", // Ensure description is included
        };

        // Add custom fields including assignee
        if (taskDetails.assignee || taskDetails.description) {
            taskPayload.customFields = [];
            
            // Map assignee to the Assignee custom field (ID: IEABCJBLJUAIPZS4)
            if (taskDetails.assignee) {
                taskPayload.customFields.push({
                    id: "IEABCJBLJUAIPZS4", // Assignee custom field ID from your logs
                    value: taskDetails.assignee
                });
            }
            
            // Map description to the Description custom field (ID: IEABCJBLJUAIPZS3) 
            // This is in addition to the main description field
            if (taskDetails.description) {
                taskPayload.customFields.push({
                    id: "IEABCJBLJUAIPZS3", // Description custom field ID from your logs
                    value: taskDetails.description
                });
            }
        }

        console.log("Creating task with payload:", JSON.stringify(taskPayload, null, 2));

        const response = await axios.post(
            `${WRIKE_API_BASE_URL}/folders/${folderId}/tasks`,
            taskPayload,
            {
                headers: {
                    Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                timeout: 15000,
            }
        );

        console.log("Task created successfully:", response.data);
        const taskId = response.data.data[0].id;
        const taskPermalink = response.data.data[0].permalink;
        
        console.log(`Task created with ID: ${taskId}`);
        console.log(`View task at: ${taskPermalink}`);
        console.log("Task details:", JSON.stringify(response.data.data[0], null, 2));
        console.log("Original taskDetails:", taskDetails);
        
        // If there's a due date, update the task with dates
        if (taskDetails.dueDate) {
            try {
                console.log("Adding due date to task...");
                const datePayload = {
                    dates: {
                        type: 'Planned',
                        duration: 1,
                        start: taskDetails.dueDate,
                        due: taskDetails.dueDate
                    }
                };

                await axios.put(
                    `${WRIKE_API_BASE_URL}/tasks/${taskId}`,
                    datePayload,
                    {
                        headers: {
                            Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        timeout: 15000,
                    }
                );

                console.log("Task updated with due date successfully");
            } catch (dateError) {
                console.warn("Failed to set due date, but task was created:", dateError.message);
                // Don't fail the entire operation if just the date update fails
            }
        }

        return {
            ...response.data,
            taskUrl: taskPermalink,
            taskId: taskId
        };
    } catch (error) {
        console.error("Error creating task with folder:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        if (error.response?.status === 401) {
            throw new Error("Wrike access token is invalid or expired");
        }

        if (error.response?.status === 403) {
            throw new Error("Access denied to the specified folder. Please check folder permissions.");
        }

        if (error.response) {
            throw new Error(
                `Failed to create task: ${error.response.status} - ${
                    error.response.data?.errorDescription || 
                    error.response.data?.error || 
                    error.response.statusText
                }`
            );
        }
        throw new Error(`Failed to create task: ${error.message}`);
    }
}

// ...existing code...

// ...existing code...

// Enhanced function to get available folders
async function getAvailableFolders() {
    try {
        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;

        // Get all folders the user has access to
        const foldersResponse = await axios.get(`${WRIKE_API_BASE_URL}/folders`, {
            headers: {
                Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            timeout: 10000,
        });

        const folders = foldersResponse.data.data;
        console.log("Available folders:", folders.map(f => ({
            id: f.id,
            title: f.title,
            project: f.project
        })));

        return folders;
    } catch (error) {
        console.error("Error getting available folders:", error.message);
        throw error;
    }
}



// ...existing code...

// Enhanced function to get better folder
async function getDefaultFolder() {
    try {
        // Test connection first
        await testWrikeConnection();

        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;

        // Get all available folders
        const folders = await getAvailableFolders();
        
        // Filter for project folders first (these are the best for task creation)
        const projectFolders = folders.filter(folder => 
            folder.project !== undefined && 
            folder.project !== null &&
            !folder.title.includes('Recycle') &&
            folder.scope !== 'RbFolder'
        );

        if (projectFolders.length > 0) {
            console.log("Using project folder:", projectFolders[0].title, "ID:", projectFolders[0].id);
            return projectFolders[0].id;
        }

        // Fallback to regular folders (excluding Root and Recycle Bin)
        const regularFolders = folders.filter(folder => 
            !folder.title.includes('Recycle') &&
            !folder.title.includes('Root') &&
            folder.scope !== 'RbFolder' &&
            folder.scope !== 'WsRoot'
        );

        if (regularFolders.length > 0) {
            console.log("Using regular folder:", regularFolders[0].title, "ID:", regularFolders[0].id);
            return regularFolders[0].id;
        }

        // If no suitable folders found, throw an error
        throw new Error("No suitable folders found for task creation. Please create a project or folder in Wrike first.");
    } catch (error) {
        console.error("Error in getDefaultFolder:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        
        if (error.response?.status === 401) {
            throw new Error("Wrike access token is invalid or expired");
        }
        
        throw new Error(`Failed to get Wrike folders: ${error.response?.status || error.message}`);
    }
}

// ...existing code...
// ...existing code...

// Function to get custom fields (columns) for tasks
async function getCustomFields() {
    try {
        console.log("Getting Wrike custom fields...");
        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;

        const response = await axios.get(`${WRIKE_API_BASE_URL}/customfields`, {
            headers: {
                Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            timeout: 10000,
        });

        const customFields = response.data.data;
        console.log("Available custom fields (columns):");
        customFields.forEach(field => {
            console.log(`- ${field.title} (ID: ${field.id}, Type: ${field.type})`);
        });

        return customFields;
    } catch (error) {
        console.error("Error getting custom fields:", error.message);
        throw error;
    }
}

// Function to get workflow columns/statuses
async function getWorkflowStatuses() {
    try {
        console.log("Getting Wrike workflow statuses...");
        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;

        const response = await axios.get(`${WRIKE_API_BASE_URL}/workflows`, {
            headers: {
                Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            timeout: 10000,
        });

        const workflows = response.data.data;
        console.log("Available workflows and statuses:");
        workflows.forEach(workflow => {
            console.log(`Workflow: ${workflow.name}`);
            workflow.customStatuses.forEach(status => {
                console.log(`  - ${status.name} (ID: ${status.id}, Color: ${status.color})`);
            });
        });

        return workflows;
    } catch (error) {
        console.error("Error getting workflow statuses:", error.message);
        throw error;
    }
}

// Function to get folder schema (shows what fields/columns are available)
async function getFolderSchema(folderId) {
    try {
        console.log(`Getting schema for folder ${folderId}...`);
        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;

        const response = await axios.get(`${WRIKE_API_BASE_URL}/folders/${folderId}`, {
            headers: {
                Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            params: {
                fields: '["customFields","project","workflow"]'
            },
            timeout: 10000,
        });

        const folder = response.data.data[0];
        console.log("Folder schema:");
        console.log("- Title:", folder.title);
        console.log("- Custom Fields:", folder.customFields);
        console.log("- Project:", folder.project);
        console.log("- Workflow:", folder.workflow);

        return folder;
    } catch (error) {
        console.error("Error getting folder schema:", error.message);
        throw error;
    }
}

// Enhanced function to show all available columns/fields
async function showAllColumns() {
    try {
        console.log("=== WRIKE COLUMNS/FIELDS ANALYSIS ===");
        
        // Test connection first
        await testWrikeConnection();

        // Get custom fields
        console.log("\n1. CUSTOM FIELDS:");
        const customFields = await getCustomFields();
        
        // Get workflow statuses
        console.log("\n2. WORKFLOW STATUSES:");
        const workflows = await getWorkflowStatuses();
        
        // Get folder schema for the current folder
        console.log("\n3. FOLDER SCHEMA:");
        const folderId = "IEABCJBLI5SD6PQZ"; // Using your current folder ID
        const folderSchema = await getFolderSchema(folderId);
        
        // Standard task fields that are always available
        console.log("\n4. STANDARD TASK FIELDS:");
        const standardFields = [
            "id", "title", "description", "status", "importance", 
            "dates", "permalink", "priority", "followedByMe", 
            "followerIds", "superParentIds", "parentIds", 
            "childIds", "authorIds", "responsibleIds", 
            "sharerIds", "createdDate", "updatedDate", 
            "briefDescription", "customStatusId"
        ];
        standardFields.forEach(field => {
            console.log(`- ${field}`);
        });

        return {
            customFields,
            workflows,
            folderSchema,
            standardFields
        };
    } catch (error) {
        console.error("Error showing columns:", error.message);
        throw error;
    }
}

async function createTask(taskDetails) {
    console.log("Creating task in Wrike with details:", taskDetails);
    console.log("Using Wrike API base URL:", WRIKE_API_BASE_URL);

    try {
        // First, test if the token is valid
        await testWrikeConnection();

        // Try to get a folder and create the task
        const folderId = "IEABCJBLI5SD6PQZ" || "IEABCJBLI5SD6PQG" || "IEABCJBLI5SD6PQX" || "IEABCJBLI5SD6PTE";
        console.log("Using folder ID:", folderId);
		await createTaskWithFolder(taskDetails, folderId);
		// return createTask1(taskDetails.title, command, context);

    } catch (error) {
        console.error("Error in createTask:", error.message);
        
        // Provide specific error messages based on the type of error
        if (error.message.includes("token is invalid") || error.message.includes("expired")) {
            throw new Error("Wrike integration error: Your access token is invalid or expired. Please update your WRIKE_ACCESS_TOKEN environment variable with a valid token.");
        }
        
        if (error.message.includes("not_authorized")) {
            throw new Error("Wrike integration error: Access denied. Please check that your Wrike token has the necessary permissions to create tasks.");
        }

        if (error.message.includes("logical folder")) {
            throw new Error("Wrike integration error: Cannot create tasks in the Root folder. Please create a project or regular folder in Wrike first.");
        }

        if (error.message.includes("No suitable folders found")) {
            throw new Error("Wrike integration error: No suitable folders found for task creation. Please create a project or folder in Wrike first.");
        }
        
        throw new Error(`Failed to create task in Wrike: ${error.message}`);
    }
}

// ...existing code...

async function updateTask(taskId, updates) {
    try {
        await testWrikeConnection();

        const WRIKE_ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;

        const response = await axios.put(
            `${WRIKE_API_BASE_URL}/tasks/${taskId}`,
            updates,
            {
                headers: {
                    Authorization: `Bearer ${WRIKE_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                timeout: 10000,
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error updating task:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        if (error.response?.status === 401) {
            throw new Error("Wrike access token is invalid or expired");
        }

        throw new Error(`Failed to update task in Wrike: ${error.message}`);
    }
}

module.exports = {
    createTask,
    updateTask,
    getDefaultFolder,
    testWrikeConnection,
    createTaskWithFolder,
};