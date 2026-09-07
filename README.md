# GPath — Growth Path

Explorador de tecnologías mencionadas en puestos de entrada: el usuario elige uno de seis
roles `Intern`, `Practicante` o `Internship`, filtra por región y revisa las ofertas que
sustentan los conteos.

**Estado: primera demo funcional.** Contiene 24 ofertas ficticias, señaladas en pantalla.
Los conteos se calculan en la API y admiten región, país y modalidad. No son vacantes activas
ni estadísticas del mercado.
Sin registro, documentos personales, Supabase ni base relacional de aplicación.

## Ejecutar

Node.js 22.16+ y npm:

```bash
npm ci
npm run dev
```

Abrir http://127.0.0.1:5173. La API escucha en 8081; la web consulta, por ejemplo,
`/api/jobs?role=data-intern&region=latam&country=pe&workMode=onsite`.

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

Conectar ofertas públicas Greenhouse mediante un colector periódico, validar y guardar
snapshots en OCI Object Storage, y servir el último snapshot válido con fecha y procedencia.
No recolectar en cada visita ni presentar una muestra acotada como todo el mercado.

Instalación y guía para principiantes: `K3s-Cortex/docs/primer-despliegue.md`.
