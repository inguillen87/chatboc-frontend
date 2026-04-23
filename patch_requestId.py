import re

with open('src/utils/api.ts', 'r') as f:
    content = f.read()

# I want to return the request_id alongside the data if requested, or ensure it's logged and available.
# Actually, the epic says "incluir request_id / correlation_id en toda respuesta".
# Since apiFetch currently returns the raw `data` (which might be an array or object),
# modifying the return type directly might break hundreds of calls that expect `T`.
# However, for specific endpoints using Zod schema, the backend should be sending request_id inside the JSON,
# and if not, we can inject it if the response is an object.

inject_logic = """
    const responseRequestId = resolveResponseRequestId(response, data);

    // Si la respuesta es un objeto, le inyectamos el request_id / correlation_id para observabilidad.
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (responseRequestId) {
        (data as any).request_id = responseRequestId;
      }
    }
"""

content = content.replace(
    "const responseRequestId = resolveResponseRequestId(response, data);",
    inject_logic
)

with open('src/utils/api.ts', 'w') as f:
    f.write(content)
