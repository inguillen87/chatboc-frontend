#!/bin/bash

BASE_URL="https://chatbot-backend-2e14.onrender.com"
ENDPOINT="/ask/municipio"

echo "--- Test 1: Minimal Request (GET) ---"
curl -s -o /dev/null -w "%{http_code}" "?tenant_slug=municipio"
echo ""

echo "--- Test 2: Minimal Request (POST) with JSON ---"
curl -s -w "\n%{http_code}" -X POST "?tenant_slug=municipio"   -H "Content-Type: application/json"   -H "X-Tenant: municipio"   -d '{"pregunta":"", "action":"initial_greeting", "tipo_chat":"municipio"}'
echo ""

echo "--- Test 3: POST with X-Anon-Id ---"
curl -s -w "\n%{http_code}" -X POST "?tenant_slug=municipio"   -H "Content-Type: application/json"   -H "X-Tenant: municipio"   -H "X-Anon-Id: test-anon-123"   -d '{"pregunta":"", "action":"initial_greeting", "tipo_chat":"municipio"}'
echo ""

echo "--- Test 4: POST with Invalid Auth Token ---"
curl -s -w "\n%{http_code}" -X POST "?tenant_slug=municipio"   -H "Content-Type: application/json"   -H "X-Tenant: municipio"   -H "Authorization: Bearer invalid_token_123"   -d '{"pregunta":"", "action":"initial_greeting", "tipo_chat":"municipio"}'
echo ""

echo "--- Test 5: POST without X-Tenant Header (only query param) ---"
curl -s -w "\n%{http_code}" -X POST "?tenant_slug=municipio"   -H "Content-Type: application/json"   -d '{"pregunta":"", "action":"initial_greeting", "tipo_chat":"municipio"}'
echo ""
