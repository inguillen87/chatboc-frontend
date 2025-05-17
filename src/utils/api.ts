export async function apiFetch(
  path: string,
  method: string = "GET",
  body?: any,
  options: {
    headers?: Record<string, string>;
    baseUrl?: string;
  } = {}
) {
  const baseUrl = options.baseUrl || import.meta.env.VITE_API_URL || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const url = `${baseUrl}${path}`;

  console.log("🔍 URL:", url);
  console.log("📦 Método:", method);
  console.log("🧾 Headers:", headers);
  if (body) console.log("📨 Data:", body);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    console.log("✅ Respuesta:", data);

    if (!response.ok) {
      console.error("❌ Error HTTP:", response.status, data);
      throw new Error(`Error ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error("❌ Error conectando con el servidor:", error);
    throw error;
  }
}
