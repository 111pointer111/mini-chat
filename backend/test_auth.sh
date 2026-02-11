#!/bin/bash

BASE_URL="http://localhost:5000/api/auth"

echo "Testing Health Check..."
curl -s http://localhost:5000/health | json_pp

echo -e "\n\nTesting Register..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "password123"}')
echo $REGISTER_RESPONSE | json_pp

echo -e "\n\nTesting Login..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}')
echo $LOGIN_RESPONSE | json_pp

# Extract token (simple method, assuming json_pp or similar might not be available for parsing in script logic easily without jq)
# Using python for reliable parsing
TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -n "$TOKEN" ]; then
  echo -e "\n\nTesting Get Me (Protected Route)..."
  curl -s -X GET $BASE_URL/me \
    -H "Authorization: Bearer $TOKEN" | json_pp
else
  echo -e "\n\nCould not get token, skipping Get Me test."
fi
