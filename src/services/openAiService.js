const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function suggestAssignee(taskDetails) {
    console.log('Suggesting assignee for task:', taskDetails);
    try {
        const response = await axios.post(OPENAI_API_URL, {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: `Suggest an assignee for the following task: ${taskDetails}`
                }
            ],
            max_tokens: 50
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const suggestion = response.data.choices[0].message.content.trim();
        return suggestion;
    } catch (error) {
        console.error('Error suggesting assignee:', error);
        throw new Error('Could not get assignee suggestion from OpenAI');
    }
}

module.exports = {
    suggestAssignee
};