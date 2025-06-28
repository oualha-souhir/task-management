const WRIKE_CONFIG = {
  API_BASE_URL: process.env.WRIKE_API_URL || "https://app-eu.wrike.com/api/v4",
  ACCESS_TOKEN: process.env.WRIKE_ACCESS_TOKEN,
  DEFAULT_FOLDER_ID: "IEABCJBLI5SD6PQZ",
  TIMEOUT: 10000,
  CUSTOM_FIELDS: {
    ASSIGNEE: "IEABCJBLJUAIPZS4",
    DESCRIPTION: "IEABCJBLJUAIPZS3",
  },
};

// Mapping of Slack channel IDs to Wrike folder IDs
const CHANNEL_TO_WRIKE_PROJECT = {
  "C08FBSXM29H": "IEABCJBLI5SLSYUB", // tech
  "C08KJ8R2JET": "IEABCJBLI5SLSYSU", // tech1
//   "C08KJ8R2JET": "IEABCJBLI5SD6PQZ", // Example: Another channel to another Wrike project

};
//  Available folders: {
// [2025-06-26T20:45:22.806Z]   count: 9,
// [2025-06-26T20:45:22.806Z]   folders: [
// [2025-06-26T20:45:22.806Z]     { id: 'IEABCJBLI7777777', title: 'Root', scope: 'WsRoot' },
// [2025-06-26T20:45:22.806Z]     { id: 'IEABCJBLI7777776', title: 'Recycle Bin', scope: 'RbRoot' },
// [2025-06-26T20:45:22.806Z]     { id: 'IEABCJBLI5SLSYUB', title: 'project2', scope: 'WsFolder' },
// [2025-06-26T20:45:22.806Z]     { id: 'IEABCJBLI5SLSYSU', title: 'project1', scope: 'WsFolder' },
// [2025-06-26T20:45:22.806Z]     {
// [2025-06-26T20:45:22.806Z]       id: 'IEABCJBLI5SD6PQZ',
// [2025-06-26T20:45:22.806Z]       title: 'Task management',
// [2025-06-26T20:45:22.806Z]       scope: 'WsFolder'
// [2025-06-26T20:45:22.806Z]     },
// [2025-06-26T20:45:22.806Z]     { id: 'IEABCJBLI5SD6PQG', title: 'Personal', scope: 'WsFolder' },
// [2025-06-26T20:45:22.807Z]     {
// [2025-06-26T20:45:22.807Z]       id: 'IEABCJBLI5SD6PQX',
// [2025-06-26T20:45:22.807Z]       title: 'Task Management',
// [2025-06-26T20:45:22.807Z]       scope: 'WsFolder'
// [2025-06-26T20:45:22.807Z]     },
// [2025-06-26T20:45:22.807Z]     {
// [2025-06-26T20:45:22.807Z]       id: 'IEABCJBLI5SD6PTE',
// [2025-06-26T20:45:22.807Z]       title: 'Task management',
// [2025-06-26T20:45:22.807Z]       scope: 'WsFolder'
// [2025-06-26T20:45:22.807Z]     },
// [2025-06-26T20:45:22.807Z]     { id: 'IEABCJBLI5SKEUV5', title: 'tasks', scope: 'WsFolder' }
// [2025-06-26T20:45:22.807Z]   ]
// [2025-06-26T20:45:22.807Z] }
module.exports = { WRIKE_CONFIG, CHANNEL_TO_WRIKE_PROJECT };