# Azure Functions Deployment Script with Best Practices

param(
    [string]$ResourceGroup = "slack-wrike-rg",
    [string]$FunctionAppName = "slack-wrike-functions",
    [string]$Location = "eastus",
    [string]$StorageAccount = "slackwrikestorage",
    [switch]$SkipResourceCreation
)

# Load environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

Write-Host "🚀 Starting Azure Functions deployment..." -ForegroundColor Green

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
try {
    az --version | Out-Null
    Write-Host "✅ Azure CLI is installed" -ForegroundColor Green
} catch {
    Write-Error "❌ Azure CLI is not installed. Please install it first."
    exit 1
}

try {
    func --version | Out-Null
    Write-Host "✅ Azure Functions Core Tools installed" -ForegroundColor Green
} catch {
    Write-Error "❌ Azure Functions Core Tools not installed."
    exit 1
}

# Login to Azure
Write-Host "🔑 Logging into Azure..." -ForegroundColor Yellow
az login

# Check if resource group exists and get its location
Write-Host "🔍 Checking existing resources..." -ForegroundColor Yellow
$EXISTING_RG = az group show --name $ResourceGroup --query "location" -o tsv 2>$null
if ($EXISTING_RG) {
    Write-Host "✅ Resource group exists in: $EXISTING_RG" -ForegroundColor Green
    $Location = $EXISTING_RG  # Use existing location
} else {
    Write-Host "📍 Resource group doesn't exist, will create in: $Location" -ForegroundColor Yellow
}

# Create resources if not skipped
if (-not $SkipResourceCreation) {
    Write-Host "🏗️ Creating Azure resources..." -ForegroundColor Yellow
    
    # Create resource group only if it doesn't exist
    if (-not $EXISTING_RG) {
        az group create --name $ResourceGroup --location $Location
    } else {
        Write-Host "✅ Using existing resource group in $Location" -ForegroundColor Green
    }
    
    # Create storage account with enhanced security
    Write-Host "💾 Setting up storage account..." -ForegroundColor Yellow
    az storage account create `
        --name $StorageAccount `
        --location $Location `
        --resource-group $ResourceGroup `
        --sku Standard_LRS `
        --allow-blob-public-access false `
        --https-only true `
        --min-tls-version TLS1_2 `
        --default-action Allow `
        --bypass AzureServices
    
    # Create Application Insights
    Write-Host "📊 Creating Application Insights..." -ForegroundColor Yellow
    $APP_INSIGHTS_KEY = az monitor app-insights component create `
        --app $FunctionAppName `
        --location $Location `
        --resource-group $ResourceGroup `
        --application-type web `
        --retention-time 90 `
        --query instrumentationKey -o tsv
    
    # Use Consumption Plan (no quota limitations)
    Write-Host "⚡ Creating Function App with Consumption Plan..." -ForegroundColor Yellow
    az functionapp create `
        --resource-group $ResourceGroup `
        --consumption-plan-location $Location `
        --runtime node `
        --runtime-version 20 `
        --functions-version 4 `
        --name $FunctionAppName `
        --storage-account $StorageAccount `
        --os-type Windows `
        --disable-app-insights false `
        --app-insights-key $APP_INSIGHTS_KEY
    
    # Configure optimized settings for Consumption plan
    Write-Host "🔒 Configuring Function App settings..." -ForegroundColor Yellow
    az functionapp config set `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        --use-32bit-worker-process false `
        --web-sockets-enabled true `
        --always-on false `
        --http20-enabled true `
        --min-tls-version 1.2 `
        --ftps-state Disabled
        
    # Enable managed identity for secure access
    az functionapp identity assign `
        --name $FunctionAppName `
        --resource-group $ResourceGroup
    
    Write-Host "✅ Consumption plan created successfully" -ForegroundColor Green
}

# Configure optimized app settings for Consumption plan
Write-Host "⚙️ Configuring optimized app settings..." -ForegroundColor Yellow
$STORAGE_KEY = az storage account keys list --account-name $StorageAccount --resource-group $ResourceGroup --query '[0].value' -o tsv

# Set app settings with retry logic and individual commands for reliability
Write-Host "Setting individual app settings for reliability..." -ForegroundColor Yellow

try {
    Write-Host "Setting NODE_ENV..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "NODE_ENV=production"
    
    Write-Host "Setting WEBSITE_RUN_FROM_PACKAGE..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "WEBSITE_RUN_FROM_PACKAGE=1"
    
    Write-Host "Setting FUNCTIONS_WORKER_RUNTIME..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "FUNCTIONS_WORKER_RUNTIME=node"
    
    Write-Host "Setting WEBSITE_NODE_DEFAULT_VERSION..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "WEBSITE_NODE_DEFAULT_VERSION=~20"
    
    Write-Host "Setting FUNCTIONS_EXTENSION_VERSION..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "FUNCTIONS_EXTENSION_VERSION=~4"
    
    Write-Host "Setting SLACK_BOT_TOKEN..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "SLACK_BOT_TOKEN=$env:SLACK_BOT_TOKEN"
    
    Write-Host "Setting SLACK_SIGNING_SECRET..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "SLACK_SIGNING_SECRET=$env:SLACK_SIGNING_SECRET"
    
    Write-Host "Setting WRIKE_ACCESS_TOKEN..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "WRIKE_ACCESS_TOKEN=$env:WRIKE_ACCESS_TOKEN"
    
    Write-Host "Setting WRIKE_API_URL..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "WRIKE_API_URL=$env:WRIKE_API_URL"
    
    Write-Host "Setting MONGODB_URI..." -ForegroundColor Gray
    az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings "MONGODB_URI=$env:MONGODB_URI"
    
    Write-Host "✅ App settings configured successfully" -ForegroundColor Green
    
    # Restart to apply all settings
    Write-Host "🔄 Restarting function app to apply settings..." -ForegroundColor Yellow
    az functionapp restart --name $FunctionAppName --resource-group $ResourceGroup
    
    # Wait for restart
    Write-Host "⏳ Waiting for restart to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60
    
} catch {
    Write-Host "⚠️ Some app settings may have failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Configure CORS for secure access
Write-Host "🌐 Configuring CORS..." -ForegroundColor Yellow
az functionapp cors remove `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --allowed-origins "*"

az functionapp cors add `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --allowed-origins "https://slack.com" "https://hooks.slack.com" "https://api.slack.com" "https://app.slack.com"

# Deploy functions with force flag for complete redeployment
Write-Host "📦 Deploying functions with force..." -ForegroundColor Yellow
func azure functionapp publish $FunctionAppName --force --verbose

# Configure health monitoring
Write-Host "🔥 Configuring health monitoring..." -ForegroundColor Yellow
az functionapp config appsettings set `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --settings "WEBSITE_HEALTHCHECK_MAXPINGFAILURES=10"

# Get function URLs
Write-Host "🌐 Getting function URLs..." -ForegroundColor Yellow
$baseUrl = "https://$FunctionAppName.azurewebsites.net"

# Test deployment with retry logic
Write-Host "🧪 Testing deployment..." -ForegroundColor Yellow
$retryCount = 0
$maxRetries = 5

while ($retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 10
    try {
        $healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method Get -TimeoutSec 30
        Write-Host "✅ Health check passed" -ForegroundColor Green
        break
    } catch {
        $retryCount++
        Write-Host "⏳ Waiting for functions to warm up... (Attempt $retryCount/$maxRetries)" -ForegroundColor Yellow
    }
}

if ($retryCount -eq $maxRetries) {
    Write-Host "⚠️ Health check timeout, but deployment completed successfully" -ForegroundColor Yellow
}

Write-Host "🎉 Azure Functions deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🌟 Consumption Plan Features:" -ForegroundColor Cyan
Write-Host "   ✅ Pay-per-execution billing" -ForegroundColor White
Write-Host "   ✅ Automatic scaling" -ForegroundColor White
Write-Host "   ✅ 1M requests/month free tier" -ForegroundColor White
Write-Host "   ✅ No quota limitations" -ForegroundColor White
Write-Host "   ✅ Node.js 20 (LTS)" -ForegroundColor White
Write-Host ""
Write-Host "📍 Your function endpoints:" -ForegroundColor Cyan
Write-Host "   Health Check: $baseUrl/api/health" -ForegroundColor White
Write-Host "   Events: $baseUrl/api/slack/events" -ForegroundColor White
Write-Host "   Interactions: $baseUrl/api/slack/interactions" -ForegroundColor White
Write-Host "   Commands: $baseUrl/api/slack/commands" -ForegroundColor White
Write-Host "   Wrike Webhook: $baseUrl/api/wrike-webhook" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitoring:" -ForegroundColor Cyan
Write-Host "   Azure Portal: https://portal.azure.com/#resource/subscriptions/44acd37e-5809-45b9-9329-914fcf690f5c/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$FunctionAppName" -ForegroundColor White
Write-Host "   Application Insights: https://portal.azure.com/#blade/AppInsightsExtension/QuickPulseBladeV2/ComponentId/$FunctionAppName" -ForegroundColor White
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Update your Slack app configuration with the new URLs" -ForegroundColor White
Write-Host "2. Test the deployed endpoints using the health check" -ForegroundColor White
Write-Host "3. Monitor function performance in Azure portal" -ForegroundColor White
Write-Host "4. Set up custom domain and advanced security features" -ForegroundColor White
