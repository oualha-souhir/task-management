#!/bin/bash
# filepath: /Users/souhir/new-project/test-deployment.sh

BASE_URL="https://slack-wrike-functions.azurewebsites.net"

echo "🧪 Testing deployed Azure Functions..."

# Test health check
echo "1️⃣ Testing health check..."
curl -s "$BASE_URL/api/health" | jq '.'

echo -e "\n2️⃣ Testing Slack events endpoint..."
curl -s -X POST "$BASE_URL/api/slack/events" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test_challenge"}' | jq '.'

echo -e "\n3️⃣ Testing slash commands endpoint..."
curl -s -X POST "$BASE_URL/api/slack/commands" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "command=/help&user_name=testuser&channel_name=general" | jq '.'

echo -e "\n✅ Deployment tests completed!"