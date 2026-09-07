# GPath — Growth Path

Explorador de requisitos de vacantes: el usuario elige Data Engineer, Backend o DevOps
y ve qué tecnologías se repiten, junto a las ofertas que sustentan los conteos.

**Estado: primera versión live.** Consulta feeds públicos de Greenhouse, muestra una
muestra acotada de ofertas por puesto y enlaza cada resultado con su publicación original.
Los conteos se calculan en la API; no son estadísticas de todo el mercado. Sin registro,
documentos personales, Supabase ni base relacional de aplicación.

## Ejecutar

Node.js 22.16+ y npm:

```bash
npm ci
npm run dev
```

Abrir http://127.0.0.1:5173. La API escucha en 8081; por defecto consulta
`/api/jobs?role=data` en modo live.

Para capturas y pruebas deterministas, ejecutar la API con `JOB_MODE=demo`; ese modo
usa las doce ofertas ficticias incluidas en el repositorio.

```bash
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

## Arquitectura y entrega

- Web React/TypeScript en nginx sin privilegios; API Node.js en otro contenedor.
- El Ingress de k3s enruta `/` a la web y `/api` a la API.
- Imágenes ARM64/amd64 en GHCR; CI propone sus digests en K3s-Cortex.
- La promoción exige revisar/fusionar el PR; CI no recibe kubeconfig ni hace deploy directo.
- Revertir el commit de promoción en Cortex es el mecanismo de rollback.
- La instalación inicial y la demo con imágenes importadas no prueban por sí solas GitOps.

Los paquetes existentes mantienen `ghcr.io/renzoal7/gitpath` y `gitpath-api`; no es
necesario renombrarlos para cambiar el producto. El repositorio se llama `RenzoAL7/GPath`.

## Siguiente etapa

Mover el refresco a un colector periódico y guardar snapshots validados en OCI Object
Storage. La versión actual consulta desde el API con una caché de quince minutos; no
presenta una muestra acotada como todo el mercado.

Detalles: [Growth Path](docs/growth-path.md).
Instalación y guía para principiantes: `K3s-Cortex/docs/primer-despliegue.md`.
El [Release Explorer anterior](docs/legacy-release-explorer.md), sus documentos de
operación y `oci-storage-plan.md` son históricos y no definen el producto actual.
