# Task Management System

A Slack bot integrated with Wrike for task management.

## Environment Setup

1. Copy the environment template:

   ```bash
   cp .env.template .env
   ```

2. Fill in your actual credentials in `.env`:

   - **SLACK_BOT_TOKEN**: Get from Slack App settings
   - **SLACK_SIGNING_SECRET**: Get from Slack App settings
   - **SLACK_APP_TOKEN**: Get from Slack App settings
   - **WRIKE_ACCESS_TOKEN**: Get from Wrike API settings
   - **MONGODB_URI**: Your MongoDB Atlas connection string

3. For Azure Functions local development, also update `local.settings.json` with the same values.

## Security Notes

- Never commit `.env` files to git
- Regenerate all tokens if they're accidentally exposed
- Use Azure Key Vault for production deployments

## Development

```bash
npm install
func start
```

## Deployment

See `azure-deploy.md` for deployment instructions.
# task-management
# task-management
# task-management
# task-management
# task-management
# task-management
# task-management
