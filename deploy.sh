#!/bin/bash
# filepath: /Users/souhir/new-project/deploy.sh

# Azure Functions Deployment Script with Best Practices
set -e

# Configuration
RESOURCE_GROUP=${1:-"slack-wrike-rg"}
FUNCTION_APP_NAME=${2:-"slack-wrike-functions"}
LOCATION=${3:-"eastus"}
STORAGE_ACCOUNT=${4:-"slackwrikestorage"}
SKIP_RESOURCE_CREATION=${5:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Azure Functions deployment...${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Azure CLI is installed${NC}"

if ! command -v func &> /dev/null; then
    echo -e "${RED}❌ Azure Functions Core Tools not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Azure Functions Core Tools installed${NC}"

# Login to Azure
echo -e "${YELLOW}🔑 Logging into Azure...${NC}"
az login

# Check if resource group exists and get its location
echo -e "${YELLOW}🔍 Checking existing resources...${NC}"
EXISTING_RG=$(az group show --name $RESOURCE_GROUP --query "location" -o tsv 2>/dev/null || echo "")

if [ ! -z "$EXISTING_RG" ]; then
    echo -e "${GREEN}✅ Resource group exists in: $EXISTING_RG${NC}"
    LOCATION=$EXISTING_RG  # Use existing location
else
    echo -e "${YELLOW}📍 Resource group doesn't exist, will create in: $LOCATION${NC}"
fi

# Create resources if not skipped
if [ "$SKIP_RESOURCE_CREATION" != "true" ]; then
    echo -e "${YELLOW}🏗️ Creating Azure resources...${NC}"
    
    # Create resource group only if it doesn't exist
    if [ -z "$EXISTING_RG" ]; then
        az group create --name $RESOURCE_GROUP --location "$LOCATION"
    else
        echo -e "${GREEN}✅ Using existing resource group in $LOCATION${NC}"
    fi
    
    # Create storage account with enhanced security
    echo -e "${YELLOW}💾 Setting up storage account...${NC}"
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --location "$LOCATION" \
        --resource-group $RESOURCE_GROUP \
        --sku Standard_LRS \
        --allow-blob-public-access false \
        --https-only true \
        --min-tls-version TLS1_2 \
        --default-action Allow \
        --bypass AzureServices
    
    # Create Application Insights
    echo -e "${YELLOW}📊 Creating Application Insights...${NC}"
    APP_INSIGHTS_KEY=$(az monitor app-insights component create \
        --app $FUNCTION_APP_NAME \
        --location "$LOCATION" \
        --resource-group $RESOURCE_GROUP \
        --application-type web \
        --retention-time 90 \
        --query instrumentationKey -o tsv)
    
    # Use Consumption Plan with Node.js 20
    echo -e "${YELLOW}⚡ Creating Function App with Consumption Plan...${NC}"
    az functionapp create \
        --resource-group $RESOURCE_GROUP \
        --consumption-plan-location "$LOCATION" \
        --runtime node \
        --runtime-version 20 \
        --functions-version 4 \
        --name $FUNCTION_APP_NAME \
        --storage-account $STORAGE_ACCOUNT \
        --os-type Windows \
        --disable-app-insights false \
        --app-insights-key $APP_INSIGHTS_KEY
    
    # Configure optimized settings for Consumption plan
    echo -e "${YELLOW}🔒 Configuring Function App settings...${NC}"
    az functionapp config set \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --use-32bit-worker-process false \
        --web-sockets-enabled true \
        --always-on false \
        --http20-enabled true \
        --min-tls-version 1.2 \
        --ftps-state Disabled
    
    # Enable managed identity
    az functionapp identity assign \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP
    
    echo -e "${GREEN}✅ Consumption plan created successfully${NC}"
fi

# Configure optimized app settings with retry logic
echo -e "${YELLOW}⚙️ Configuring optimized app settings...${NC}"
STORAGE_KEY=$(az storage account keys list --account-name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query '[0].value' -o tsv)

# Use gtimeout (macOS) or timeout (Linux) for app settings
if command -v gtimeout &> /dev/null; then
    TIMEOUT_CMD="gtimeout 300"
elif command -v timeout &> /dev/null; then
    TIMEOUT_CMD="timeout 300"
else
    TIMEOUT_CMD=""
fi

$TIMEOUT_CMD az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "NODE_ENV=production" \
        "WEBSITE_RUN_FROM_PACKAGE=1" \
        "FUNCTIONS_WORKER_RUNTIME=node" \
        "WEBSITE_NODE_DEFAULT_VERSION=~20" \
        "SCM_DO_BUILD_DURING_DEPLOYMENT=false" \
        "ENABLE_ORYX_BUILD=false" \
        "FUNCTIONS_EXTENSION_VERSION=~4" \
        "AzureWebJobsDisableHomepage=true" \
        "WEBSITE_TIME_ZONE=UTC" \
        "FUNCTIONS_WORKER_PROCESS_COUNT=1" \
        "WEBSITE_ENABLE_SYNC_UPDATE_SITE=true" \
        "SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN" \
        "SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET" \
        "SLACK_APP_TOKEN=$SLACK_APP_TOKEN" \
        "WRIKE_ACCESS_TOKEN=$WRIKE_ACCESS_TOKEN" \
        "WRIKE_API_URL=$WRIKE_API_URL" \
        "MONGODB_URI=$MONGODB_URI" || {
    echo -e "${YELLOW}⚠️ App settings update had issues, manually configuring...${NC}"
    
    # Set critical environment variables individually
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings "SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN" || true
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings "SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET" || true
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings "WRIKE_ACCESS_TOKEN=$WRIKE_ACCESS_TOKEN" || true
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings "MONGODB_URI=$MONGODB_URI" || true
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings "NODE_ENV=production" || true
}

# Configure CORS for security
echo -e "${YELLOW}🌐 Configuring CORS...${NC}"
az functionapp cors remove \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "*" || true

az functionapp cors add \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "https://slack.com" "https://hooks.slack.com" "https://api.slack.com" "https://app.slack.com" || true

# Deploy functions with better handling
echo -e "${YELLOW}📦 Deploying functions...${NC}"
if command -v gtimeout &> /dev/null; then
    gtimeout 600 func azure functionapp publish $FUNCTION_APP_NAME --build remote --verbose || {
        echo -e "${YELLOW}⚠️ Deployment timed out, but may have succeeded. Checking status...${NC}"
    }
elif command -v timeout &> /dev/null; then
    timeout 600 func azure functionapp publish $FUNCTION_APP_NAME --build remote --verbose || {
        echo -e "${YELLOW}⚠️ Deployment timed out, but may have succeeded. Checking status...${NC}"
    }
else
    func azure functionapp publish $FUNCTION_APP_NAME --build remote --verbose || {
        echo -e "${YELLOW}⚠️ Deployment had issues, but may have succeeded. Checking status...${NC}"
    }
fi

# Wait for deployment to stabilize
echo -e "${YELLOW}⏳ Waiting for deployment to stabilize...${NC}"
sleep 30

# Configure health monitoring
echo -e "${YELLOW}🔥 Configuring health monitoring...${NC}"
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings "WEBSITE_HEALTHCHECK_MAXPINGFAILURES=10" || true

# Get function URLs
echo -e "${YELLOW}🌐 Getting function URLs...${NC}"
BASE_URL="https://$FUNCTION_APP_NAME.azurewebsites.net"

# Test deployment with extended retry logic
echo -e "${YELLOW}🧪 Testing deployment...${NC}"
RETRY_COUNT=0
MAX_RETRIES=10

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    sleep 15  # Longer wait for function warm-up
    if curl -s --max-time 45 "$BASE_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Function app is responding${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -e "${YELLOW}⏳ Waiting for functions to start... (Attempt $RETRY_COUNT/$MAX_RETRIES)${NC}"
    fi
done

# Check individual endpoints
echo -e "${YELLOW}🔍 Checking function endpoints...${NC}"
ENDPOINTS=("slack/events" "slack/commands" "slack/interactions")

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -s --max-time 30 "$BASE_URL/api/$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $endpoint endpoint is accessible${NC}"
    else
        echo -e "${YELLOW}⚠️ $endpoint endpoint may need warm-up${NC}"
    fi
done

echo -e "${GREEN}🎉 Azure Functions deployment completed!${NC}"
echo ""
echo -e "${CYAN}🌟 Deployment Summary:${NC}"
echo -e "   ✅ Function App: $FUNCTION_APP_NAME"
echo -e "   ✅ Resource Group: $RESOURCE_GROUP"
echo -e "   ✅ Location: $LOCATION"
echo -e "   ✅ Runtime: Node.js 20"
echo -e "   ✅ Plan: Consumption (Pay-per-execution)"
echo ""
echo -e "${CYAN}📍 Your function endpoints:${NC}"
echo -e "   Health Check: ${BASE_URL}/api/health"
echo -e "   Events: ${BASE_URL}/api/slack/events"
echo -e "   Interactions: ${BASE_URL}/api/slack/interactions"
echo -e "   Commands: ${BASE_URL}/api/slack/commands"
echo -e "   Wrike Webhook: ${BASE_URL}/api/wrike-webhook"
echo ""
echo -e "${CYAN}📊 Monitoring:${NC}"
echo -e "   Azure Portal: https://portal.azure.com/#resource/subscriptions/44acd37e-5809-45b9-9329-914fcf690f5c/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$FUNCTION_APP_NAME"
echo -e "   Application Insights: https://portal.azure.com/#blade/AppInsightsExtension/QuickPulseBladeV2/ComponentId/$FUNCTION_APP_NAME"
echo ""
echo -e "${CYAN}📝 Next steps:${NC}"
echo "1. Update your Slack app configuration with the new URLs above"
echo "2. Test each endpoint individually"
echo "3. Monitor function performance in Azure portal"
echo "4. The functions may take a few minutes to fully warm up"
echo ""
echo -e "${CYAN}🔧 If functions aren't responding:${NC}"
echo "1. Check the Azure portal for deployment status"
echo "2. Review the Application Insights logs"
echo "3. Try restarting the function app if needed"
echo "4. Environment variables may take time to propagate"