#!/bin/bash

echo "🔄 Force redeploying Azure Functions..."

# Set variables
RESOURCE_GROUP="slack-wrike-rg"
FUNCTION_APP_NAME="slack-wrike-functions"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "1️⃣ Stopping function app..."
az functionapp stop --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

echo "2️⃣ Setting critical environment variables individually..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WRIKE_ACCESS_TOKEN=$WRIKE_ACCESS_TOKEN"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WRIKE_API_URL=$WRIKE_API_URL"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "MONGODB_URI=$MONGODB_URI"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "NODE_ENV=production"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "FUNCTIONS_WORKER_RUNTIME=node"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WEBSITE_NODE_DEFAULT_VERSION=~20"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "FUNCTIONS_EXTENSION_VERSION=~4"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WEBSITE_RUN_FROM_PACKAGE=1"

echo "3️⃣ Starting function app..."
az functionapp start --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

echo "4️⃣ Waiting for app to start..."
sleep 30

echo "5️⃣ Restarting to ensure all changes are applied..."
az functionapp restart --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

echo "6️⃣ Final wait for startup..."
sleep 60

echo "✅ Environment variables configured! Testing endpoints..."

echo "🧪 Testing health endpoint..."
curl -s https://slack-wrike-functions.azurewebsites.net/api/health | jq '.' || echo "Health endpoint not responding yet..."

echo ""
echo "🧪 Testing events endpoint..."
curl -s https://slack-wrike-functions.azurewebsites.net/api/slack/events | jq '.' || echo "Events endpoint not responding yet..."

echo ""
echo "🧪 Testing with challenge..."
curl -X POST https://slack-wrike-functions.azurewebsites.net/api/slack/events \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test123","type":"url_verification"}' || echo "Challenge test not responding yet..."

echo ""
echo "🔍 Verifying environment variables are set..."
az functionapp config appsettings list \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?name=='SLACK_BOT_TOKEN']"

echo ""
echo "✅ Configuration script completed!"
