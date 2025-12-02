// src/utils/contexto_municipio.ts


// Define la estructura del contexto específico para municipios.
export interface MunicipioContext {
  estado_conversacion: 'inicio' | 'recolectando_info' | 'recolectando_datos_personales' | 'confirmando_reclamo' | 'reclamo_creado' | 'conversacion_general';
  datos_reclamo: {
    categoria: string | null;
    descripcion: string | null;
    ubicacion: string | null;
    nombre_ciudadano: string | null;
    telefono_ciudadano: string | null;
    email_ciudadano: string | null;
    dni_ciudadano: string | null;
  };
  historial_conversacion: Array<{ role: 'user' | 'bot'; text: string }>;
  id_ticket_creado: number | null;
}

// Estado inicial para el contexto de municipio.
export function getInitialMunicipioContext(): MunicipioContext {
  return {
    estado_conversacion: 'inicio',
    datos_reclamo: {
      categoria: null,
      descripcion: null,
      ubicacion: null,
      nombre_ciudadano: null,
      telefono_ciudadano: null,
      email_ciudadano: null,
      dni_ciudadano: null,
    },
    historial_conversacion: [],
    id_ticket_creado: null,
  };
}

// Lógica para actualizar el contexto basado en la interacción.
export function updateMunicipioContext(
  currentContext: MunicipioContext,
  interaction: { userInput?: string; llmResponse?: any; action?: string }
): MunicipioContext {
  const newContext = JSON.parse(JSON.stringify(currentContext)); // Deep copy

  // 1. Actualizar historial
  if (interaction.userInput) {
    newContext.historial_conversacion.push({ role: 'user', text: interaction.userInput });
  }
  if (interaction.llmResponse?.respuesta_usuario) {
    newContext.historial_conversacion.push({ role: 'bot', text: interaction.llmResponse.respuesta_usuario });
  }

  // 2. Extraer y actualizar datos del reclamo desde la respuesta del LLM
  if (interaction.llmResponse?.datos_estructura) {
    const { datos_estructura } = interaction.llmResponse;
    const reclamo = newContext.datos_reclamo;

    if (datos_estructura.categoria) reclamo.categoria = mapToKnownCategory(datos_estructura.categoria);
    if (datos_estructura.descripcion) reclamo.descripcion = datos_estructura.descripcion;
    if (datos_estructura.ubicacion) reclamo.ubicacion = datos_estructura.ubicacion;
    if (datos_estructura.nombre_usuario_detectado) reclamo.nombre_ciudadano = datos_estructura.nombre_usuario_detectado;
    if (datos_estructura.telefono_detectado) reclamo.telefono_ciudadano = datos_estructura.telefono_detectado;
    if (datos_estructura.email_detectado) reclamo.email_ciudadano = datos_estructura.email_detectado;
  }

  // 3. Actualizar el estado de la conversación
  if (interaction.llmResponse) {
    const { pedir_info, accion_backend, ticket_id } = interaction.llmResponse;
    if (ticket_id) {
      newContext.estado_conversacion = 'reclamo_creado';
      newContext.id_ticket_creado = ticket_id;
    } else if (accion_backend === 'crear_reclamo' && pedir_info) {
      newContext.estado_conversacion = 'recolectando_info';
    } else if (accion_backend === 'crear_reclamo' && !pedir_info) {
      newContext.estado_conversacion = 'confirmando_reclamo';
    }
  } else if (interaction.action === 'cancelar_reclamo') {
    return getInitialMunicipioContext(); // Resetea si el usuario cancela
  }

  return newContext;
}
