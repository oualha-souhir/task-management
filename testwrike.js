const axios = require('axios');
const wrikeService = require('./src/services/wrikeService');
wrikeService.debugCustomStatuses();
// Configuration
const WRIKE_API_TOKEN = 'eyJ0dCI6InAiLCJhbGciOiJIUzI1NiIsInR2IjoiMiJ9.eyJkIjoie1wiYVwiOjExMjMzNzEsXCJpXCI6MjQyODY3LFwiY1wiOjE5ODk4NzQsXCJ1XCI6MjIwNjI4NjMsXCJyXCI6XCJFVVwiLFwic1wiOltcIldcIixcIkZcIixcIklcIixcIlVcIixcIktcIixcIkNcIixcIkRcIixcIk1cIixcIkFcIixcIkxcIixcIlBcIl0sXCJ6XCI6W10sXCJ0XCI6MH0iLCJpYXQiOjE3NTA5Njk1NzZ9.YVyDf3UfGGlRqV42g53ijyOSiWlR_f8imyXWv1JSqHI'; // Replace with your Wrike API token
const WRIKE_BASE_URL = 'https://www.wrike.com/api/v4';

// Function to fetch all folder IDs
async function fetchAllFolderIds() {
  let allFolderIds = [];
  let nextPageToken = null;

  try {
    do {
      const requestUrl = `${WRIKE_BASE_URL}/folders${nextPageToken ? `?pageToken=${nextPageToken}` : ''}`;
      console.log(`Requesting URL: ${requestUrl}`);

      // Make API request to get folders
      const response = await axios.get(requestUrl, {
        headers: {
          Authorization: `Bearer ${WRIKE_API_TOKEN}`,
          'Accept': 'application/json', // Explicitly request JSON
        },
        params: {
          fields: ['id', 'title'],
        },
      });

      // Log response status and headers
      console.log(`Response Status: ${response.status}`);
      console.log(`Response Headers:`, response.headers);

      // Extract folder IDs from the response
      const folders = response.data.data;
      if (!folders || folders.length === 0) {
        console.log('No folders found in this batch.');
      } else {
        const folderIds = folders.map(folder => ({
          id: folder.id,
          title: folder.title,
        }));
        allFolderIds = allFolderIds.concat(folderIds);
        console.log(`Fetched ${folderIds.length} folders in this batch. Total so far: ${allFolderIds.length}`);
      }

      // Check for pagination
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Log all folder IDs
    if (allFolderIds.length > 0) {
      console.log('\nAll Folder IDs:');
      allFolderIds.forEach(folder => {
        console.log(`ID: ${folder.id}, Title: ${folder.title}`);
      });
    } else {
      console.log('No folders found in the account.');
    }

    return allFolderIds;
  } catch (error) {
    console.error('Error fetching folders:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    console.error('Headers:', error.response?.headers);
    console.error('Request URL:', error.config?.url);
    return [];
  }
}

// Example usage
(async () => {
  console.log('Starting folder fetch...');
  const folderIds = await fetchAllFolderIds();
  console.log(`Total folders fetched: ${folderIds.length}`);
})();