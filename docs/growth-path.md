# Growth Path — primera demo

Una pantalla: elegir Data Engineer, Backend o DevOps y explorar requisitos.
`GET /api/jobs?role=data|backend|devops` calcula las frecuencias sobre 12 ofertas
ficticias (4 por rol). La UI y la API identifican la muestra como demo; no son ofertas
activas, no hay links de postulación y no se inventa una fecha de recolección.

## Verificación

```bash
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run dev
```

La demo local corre en http://127.0.0.1:5173, con API en 8081. Docker separa web
y API; k3s usa los manifiestos de K3s-Cortex. No se necesita Supabase, registro de
usuarios ni base relacional. Los endpoints de release son operativos; no son la página.

## Próximo paso, aún NO implementado

CronJob con empresas permitidas y API pública Greenhouse → validación y deduplicación
→ snapshot versionado en OCI Object Storage → API que lee el último snapshot válido.
No disparar el colector por cada visita. Registrar fecha, empresas y tamaño de muestra;
ante fallo conservar el último snapshot y marcarlo como antiguo. No presentar los
porcentajes como estadísticas de todo el mercado laboral ni inferir elegibilidad en Perú.

## GitOps

Mantener las imágenes `ghcr.io/renzoal7/gitpath` y `gitpath-api` evita mover paquetes.
La fuente se llama ahora `RenzoAL7/GPath`. Publicar primero los nuevos archivos Cortex
y después la CI de GPath. El workflow abre un PR de promoción por digest; no lo fusiona.
La demo con imágenes importadas es una prueba manual, no una entrega GitOps verificada.

Los documentos del antiguo Release Explorer y `oci-storage-plan.md` son históricos;
no definen el nuevo producto. Antes de este pivot se guardó una copia privada temporal
del trabajo local para no perder los cambios sin commit.
