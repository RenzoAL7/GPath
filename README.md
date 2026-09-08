# GPath — Growth Path

Explorador de tecnologías mencionadas en puestos de entrada: el usuario elige una familia o
uno de 20 puestos técnicos específicos con `Intern`, `Practicante` o `Internship`, filtra por región y revisa las ofertas que
sustentan los conteos.

**Estado: primera versión live.** La API consulta feeds públicos de Greenhouse, Lever y Ashby y conserva
una muestra acotada con enlaces a las publicaciones originales. `JOB_MODE=demo` ofrece 24
ejemplos ficticios para pruebas deterministas. Los conteos no son estadísticas de todo el
mercado. No hay registro, documentos personales, Supabase ni base relacional de aplicación.

## Ejecutar

Node.js 22.16+ y npm:

```bash
npm ci
npm run dev
```

Abrir http://127.0.0.1:5173. La API escucha en 8081; por defecto consulta, por ejemplo:

```text
/api/jobs?role=data-intern&region=latam&country=pe&workMode=onsite
```

Para capturas y pruebas deterministas, ejecutar la API con `JOB_MODE=demo`.

```bash
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

## Fuentes y filtros

- La API usa los endpoints públicos de ofertas de Greenhouse, Lever y Ashby; no consulta el
  HTML de otras páginas ni necesita credenciales para estos feeds de lectura.
- Las fuentes predeterminadas son cuatro tableros de Greenhouse, cuatro sitios de Lever y tres
  tableros de Ashby. Se pueden reemplazar con `GREENHOUSE_BOARDS`, `LEVER_SITES` y
  `ASHBY_BOARDS`; los nombres después de `:` son etiquetas visibles en el resultado.
- La API limita las ofertas por fuente y muestra su procedencia, fecha disponible y enlace
  original.
- Los filtros aceptan `region=all|latam`, país (`pe`, `mx`, `br`, `cl`, `co` o `unknown`) y
  modalidad (`remote`, `hybrid`, `onsite` o `unknown`). Los filtros se aplican antes de
  calcular los porcentajes y no hacen fallback silencioso a la muestra global.
- El modo demo conserva la misma forma de respuesta y usa ofertas ficticias etiquetadas.

## Arquitectura y entrega

- Web React/TypeScript en nginx sin privilegios; API Node.js en otro contenedor.
- El Ingress de k3s enruta `/` a la web y `/api` a la API.
- Imágenes ARM64/amd64 en GHCR; CI propone sus digests en K3s-Cortex.
- La promoción exige revisar/fusionar el PR; CI no recibe kubeconfig ni hace deploy directo.
- No se necesita Supabase, registro de usuarios ni base relacional. `K3s-Cortex` queda fuera
  del alcance de los cambios de este repositorio.

Los paquetes existentes mantienen `ghcr.io/renzoal7/gitpath` y `gitpath-api`; no es necesario
renombrarlos. El repositorio se llama `RenzoAL7/GPath`.
