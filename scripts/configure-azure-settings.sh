#!/bin/bash
# filepath: /Users/souhir/new-project/scripts/configure-azure-settings.sh

# Configure Azure Function App Settings
RESOURCE_GROUP="slack-wrike-rg"
FUNCTION_APP_NAME="slack-wrike-functions"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "🔧 Configuring Azure Function App settings..."

# Set environment variables one by one for reliability
echo "Setting SLACK_BOT_TOKEN..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN"

echo "Setting SLACK_SIGNING_SECRET..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET"

echo "Setting WRIKE_ACCESS_TOKEN..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WRIKE_ACCESS_TOKEN=$WRIKE_ACCESS_TOKEN"

echo "Setting WRIKE_API_URL..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WRIKE_API_URL=$WRIKE_API_URL"

echo "Setting MONGODB_URI..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "MONGODB_URI=$MONGODB_URI"

echo "Setting Node.js runtime settings..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "NODE_ENV=production" "WEBSITE_NODE_DEFAULT_VERSION=~20" "FUNCTIONS_WORKER_RUNTIME=node" "FUNCTIONS_EXTENSION_VERSION=~4"

echo "✅ All settings configured successfully!"
echo "🔄 Restarting function app to apply changes..."
az functionapp restart --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

echo "⏳ Waiting for restart to complete..."
sleep 60

echo "🧪 Testing endpoints..."
echo "Testing basic endpoint..."
curl -v https://slack-wrike-functions.azurewebsites.net/api/slack/events

echo ""
echo "Testing with challenge parameter..."
curl -X POST https://slack-wrike-functions.azurewebsites.net/api/slack/events \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test_challenge_123","type":"url_verification"}'

echo ""
echo "✅ Configuration complete!"