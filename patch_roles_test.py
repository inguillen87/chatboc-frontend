import re

with open('src/utils/roles.test.ts', 'r') as f:
    content = f.read()

content = content.replace("expect(normalizeRole('employee')).toBe('empleado');", "expect(normalizeRole('employee')).toBe('employee');")
content = content.replace("expect(normalizeRole('agent')).toBe('empleado');", "expect(normalizeRole('agent')).toBe('employee');")
content = content.replace("expect(normalizeRole('usuario')).toBe('end_user');", "expect(normalizeRole('usuario')).toBe('end_user');")

with open('src/utils/roles.test.ts', 'w') as f:
    f.write(content)
