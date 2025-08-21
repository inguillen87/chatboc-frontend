import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs/promises';
import path from 'path';

// Placeholder for a function that validates a JWT and returns user info
// In a real app, this would involve a library like 'jsonwebtoken' and a secret key
const validateAuth = (req: VercelRequest): { id: string; tipo_chat: 'municipio' | 'pyme'; rol: 'admin' | 'empleado' | 'user' } | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  // In a real scenario, we would decode and verify the token.
  // For this implementation, we will simulate a decoded token.
  // This is a placeholder and insecure.
  // TODO: Replace with actual JWT validation logic.
  const token = authHeader.split(' ')[1];
  if (token === "VALID_TOKEN_ADMIN_MUNICIPIO_1") {
    return { id: '1', tipo_chat: 'municipio', rol: 'admin' };
  }
  if (token === "VALID_TOKEN_EMPLEADO_PYME_2") {
    return { id: '2', tipo_chat: 'pyme', rol: 'empleado' };
  }
  return null;
};

// Main handler for the serverless function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  // 1. Authenticate the user
  const userInfo = validateAuth(req);
  if (!userInfo) {
    return res.status(401).json({ error: 'Authentication failed. Invalid or missing token.' });
  }

  // 2. Authorize the user (only admin or empleado can create events)
  if (userInfo.rol !== 'admin' && userInfo.rol !== 'empleado') {
    return res.status(403).json({ error: 'Forbidden. User does not have sufficient privileges.' });
  }

  try {
    // 3. Validate incoming event data (body) - Placeholder
    const eventData = req.body;
    if (!eventData || !eventData.title || !eventData.startDate) {
      return res.status(400).json({ error: 'Bad Request. Missing required event fields.' });
    }

    // 4. Determine the correct file path based on user type and ID
    const baseDir = userInfo.tipo_chat === 'municipio' ? 'municipios' : 'pymes';
    const tenantDir = path.join(process.cwd(), 'data', baseDir, userInfo.id);
    const filePath = path.join(tenantDir, 'events.json');

    // 5. Ensure the directory exists
    await fs.mkdir(tenantDir, { recursive: true });

    // 6. Read existing events, add the new one, and write back
    let events = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      events = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist yet, which is fine. It will be created.
      if (error.code !== 'ENOENT') throw error;
    }

    // Add new event with server-side data
    const newEvent = {
      ...eventData,
      id: new Date().toISOString() + Math.random(), // Simple unique ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'published', // Default status
    };
    events.push(newEvent);

    await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf-8');

    // 7. Return the newly created event
    return res.status(201).json(newEvent);

  } catch (error) {
    console.error('Error processing event creation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
