#!/bin/bash

# Test Amplitude API Key
API_KEY="2d00252b4409bf740cf0b657745ea50b"

echo "Testing Amplitude API Key: $API_KEY"
echo "----------------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST https://api2.amplitude.com/2/httpapi \
  -H 'Content-Type: application/json' \
  -d "{
    \"api_key\": \"$API_KEY\",
    \"events\": [{
      \"event_type\": \"test_key_validation\",
      \"user_id\": \"test_user_$(date +%s)\",
      \"time\": $(date +%s)000
    }]
  }")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    echo "✅ SUCCESS: API key is VALID and working!"
    echo "The key can send events to Amplitude."
elif [ "$HTTP_STATUS" = "400" ]; then
    echo "❌ FAILED: API key is INVALID"
    echo "The key is either revoked, incorrect, or not activated."
    echo ""
    echo "Error details: $BODY"
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ FAILED: API key is UNAUTHORIZED"
    echo "The key exists but doesn't have permission."
else
    echo "⚠️  UNKNOWN: Received status $HTTP_STATUS"
    echo "Response: $BODY"
fi
