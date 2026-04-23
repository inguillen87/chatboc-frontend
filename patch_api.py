import re

with open('src/utils/api.ts', 'r') as f:
    content = f.read()

# Add Zod import
import_zod = "import { ZodType } from 'zod';\n"
if "import { ZodType }" not in content:
    content = import_zod + content

# Add schema to ApiFetchOptions
content = re.sub(
    r'interface ApiFetchOptions \{',
    r'interface ApiFetchOptions {\n  schema?: ZodType<any, any, any>;',
    content
)

# In apiFetch, validate data if schema is provided
# We need to find the place where `return data as T;` is.
validation_logic = """
    if (options.schema) {
      const parseResult = options.schema.safeParse(data);
      if (!parseResult.success) {
        throw new ApiError(
          `Error de validación del esquema para la respuesta de ${path}`,
          response.status,
          parseResult.error.format(),
          responseRequestId
        );
      }
      return parseResult.data as T;
    }

    return data as T;
"""
content = re.sub(
    r'return data as T;',
    validation_logic,
    content
)

# Fix error messages to include request_id and standardized errors?
# "normalizar errores"
# "incluir request_id / correlation_id en toda respuesta"

with open('src/utils/api.ts', 'w') as f:
    f.write(content)
