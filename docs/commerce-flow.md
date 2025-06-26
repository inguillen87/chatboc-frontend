# Flujo comercial y pedidos

Este documento resume las pautas para manejar intenciones de compra y armado de pedidos en Chatboc.

## 1. Detección de intenciones
- El bot debe reconocer cuando el usuario solicita ver el catálogo, descargarlo o hacer consultas de precios.
- También debe identificar solicitudes de ofertas, promociones y la intención de armar un pedido real.
- Al reconocer estas intenciones, se responde con el contenido que entregue el backend sin textos hardcodeados.

## 2. Catálogo disponible siempre
- Los productos, precios y ofertas tienen que estar accesibles aunque no haya agentes en línea.
- Se deben mostrar listados en texto y permitir la descarga directa de los archivos (PDF o Excel) recibidos desde el backend.
- Si no se encuentran resultados, ofrecer sugerencias o enlaces proporcionados por el servidor.

## 3. Armado de pedidos paso a paso
- Guiar al usuario para seleccionar productos por nombre o código y pedir la cantidad deseada.
- Mostrar el total parcial y permitir agregar o quitar productos antes de confirmar.
- El usuario puede cancelar o modificar el pedido en cualquier momento antes de finalizar.
- Al confirmar, se guarda el detalle o se envía al backend según lo indique la API.

## 4. Sugerencias de acciones
- Tras cada respuesta se pueden incluir botones para **agregar al pedido**, **ver más productos**, **descargar catálogo** o **hablar con un agente**.
- Todas estas opciones las provee el backend y deben respetarse las indicaciones del archivo `AGENTS.md` para mantener la interfaz genérica.

Estas pautas aseguran un flujo de compras coherente y disponible en todo momento, sin personalizaciones locales.
