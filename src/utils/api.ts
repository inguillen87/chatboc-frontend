export async function apiFetch<T = any>(
  path: string,
  method: string = 'GET',
  data?: any,
  options: RequestInit = {}
): Promise<T> {
  const url = `${import.meta.env.VITE_API_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Logs para debug
  console.log("🔍 URL:", url);
  console.log("📦 Método:", method);
  console.log("🧾 Headers:", headers);
  console.log("📨 Data:", data);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error ${response.status}:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    console.log("✅ Respuesta:", json);
    return json;
  } catch (error) {
    console.error("🚨 Error en apiFetch:", error);
    throw error;
  }
}
