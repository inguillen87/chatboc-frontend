const CUSTOMER_COPY_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /la interfaz muestra lo que el backend define con contratos backend-first sin hardcodear contenido local\.?/gi,
    "Chatboc muestra recorridos listos para atender, vender y resolver sin configuraciones complicadas.",
  ],
  [
    /contratos backend-first para no hardcodear experiencias/gi,
    "Experiencias listas para cada equipo",
  ],
  [
    /endpoint listo para renderizar CTAs/gi,
    "Botones claros para avanzar",
  ],
  [
    /payload JSON sin request_id visible/gi,
    "Informacion clara para seguimiento",
  ],
  [/payload JSON visible para frontend\.?/gi, "Informacion clara para el equipo."],
  [/API backend/gi, "Atencion conectada"],
  [/conversion CTAs/gi, "Acciones que convierten"],
  [/labels y reglas desde backend\.?/gi, "Mensajes y acciones claros para cada caso."],
  [/solo si hay datos para renderizar\.?/gi, "Se muestra cuando ayuda a resolver mejor."],
  [/problemas sin backend/gi, "Problemas al atender"],
  [/contratos y endpoints no deberian verse\.?/gi, "La experiencia debe sentirse simple y directa."],
  [/por contrato/gi, "guiado"],
];

const TECHNICAL_COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbackend-first\b/gi, "listo para operar"],
  [/\bbackend\b/gi, "Chatboc"],
  [/\bfrontend\b/gi, "sitio"],
  [/\binterfaz\b/gi, "experiencia"],
  [/\bcontratos\b/gi, "recorridos"],
  [/\bcontrato\b/gi, "recorrido"],
  [/\bhardcodear\b/gi, "configurar a mano"],
  [/\bhardcodeado\b/gi, "configurado a mano"],
  [/\bhardcodeada\b/gi, "configurada a mano"],
  [/\brenderizar\b/gi, "mostrar"],
  [/\brenderizable\b/gi, "visible"],
  [/\bendpoint\b/gi, "accion"],
  [/\bpayload\b/gi, "datos"],
  [/\brequest_id\b/gi, "codigo de soporte"],
  [/\bJSON\b/g, "informacion"],
  [/\bAPI\b/g, "integracion"],
  [/\bCTAs\b/g, "botones"],
  [/\btenant\b/gi, "organizacion"],
  [/\bwidget\b/gi, "chat web"],
  [/\bcheckout\b/gi, "cobro"],
  [/\bfreshness\b/gi, "estado"],
  [/\bfresh\b/gi, "al dia"],
  [/\banalytics\b/gi, "metricas"],
  [/\bSLA\b/g, "tiempos"],
  [/\bready\b/gi, "listo"],
  [/\blive preview\b/gi, "vista en vivo"],
  [/\bfollow up\b/gi, "seguimiento"],
];

export const cleanLandingCopy = (value: string) => {
  if (!value) return value;

  const customerCopy = CUSTOMER_COPY_PHRASE_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );

  return TECHNICAL_COPY_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    customerCopy,
  )
    .replace(/\bdatos informacion\b/gi, "informacion")
    .replace(/\brecorridos listo para operar\b/gi, "recorridos listos para operar")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
};
