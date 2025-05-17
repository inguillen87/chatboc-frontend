export async function apiFetch<T = any>(
  path: string,
  method: string = "GET",
  data?: any,
  options: RequestInit = {}
): Promise<T> {
  const base = import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "";
  const cleanPath = path.replace(/^\/+/, "");
  const url = `${base}/${cleanPath}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const config: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  };

  console.log("📤 API Request:", method, url, data || "No data");

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    console.log("✅ API Response:", json);
    return json;
  } catch (err) {
    console.error("❌ Error conectando con el servidor:", err);
    throw new Error("⚠️ No se pudo conectar con el servidor.");
  }
}
