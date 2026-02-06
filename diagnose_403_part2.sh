#!/bin/bash

BASE_URL="https://chatbot-backend-2e14.onrender.com"
ENDPOINT="/ask/municipio"

echo "--- Test 6: With Invalid Authorization Header ---"
curl -v -X POST "?tenant_slug=municipio"   -H "Content-Type: application/json"   -H "X-Tenant: municipio"   -H "Authorization: Bearer invalid_jwt_token_example"   -d '{"pregunta":"", "action":"initial_greeting", "tipo_chat":"municipio"}'

echo "--- Test 7: With Origin https://chatboc.ar ---"
curl -v -X POST "?tenant_slug=municipio"   -H "Content-Type: application/json"   -H "X-Tenant: municipio"   -H "Origin: https://chatboc.ar"   -d '{"pregunta":"", "action":"initial_greeting", "tipo_chat":"municipio"}'
