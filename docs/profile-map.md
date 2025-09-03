# Mapa de ubicación en el perfil de administrador

La página `/perfil` incorpora Google Maps para mostrar la ubicación de la empresa o municipio.
El mapa se renderiza únicamente si el backend provee la dirección o las coordenadas `latitud` y `longitud`.
Si no hay datos de ubicación, el componente permanece oculto según las pautas de `AGENTS.md`.

- La selección de dirección utiliza `AutocompleteInput`, que consulta MapTiler y, si es necesario, OpenStreetMap.
- Al elegir una dirección, se muestra un mapa interactivo con un marcador arrastrable para ajustar la posición.
- Es necesario definir la variable `VITE_Maps_API_KEY` en el archivo `.env` para cargar dicho script.
- Al guardar el perfil, las coordenadas finales enviadas por el backend determinan la ubicación.
- No se personaliza ningún texto por municipio o pyme; todo el contenido visible proviene del backend.

Esta funcionalidad es idéntica tanto para administradores de municipios como para comercios.
