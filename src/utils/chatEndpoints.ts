export const RUBROS_PUBLICOS = [

};

interface GetEndpointOptions {
  tipoChat?: "municipio" | "pyme";
  rubro?: string | null;
}

export function getAskEndpoint({ tipoChat, rubro }: GetEndpointOptions): string {
  const esPublico = rubro ? esRubroPublico(rubro) : false;
  if (esPublico) return "/ask/municipio";
  return tipoChat === "municipio" ? "/ask/municipio" : "/ask/pyme";
}
