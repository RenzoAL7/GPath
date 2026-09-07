# Histórico: Release Explorer (reemplazado por Growth Path)

Un proyecto pequeño para demostrar una entrega GitOps de extremo a extremo.
La página permite consultar qué build responde, enviar una petición real a una API
y explorar las decisiones de entrega. No es un curso de Git ni un panel de administración.

**Público:** alguien que revisa el proyecto —incluido su autor— y quiere relacionar
código, imágenes y manifiestos sin entregar datos personales ni acceder al cluster.

## Qué funciona sin servicios externos

- Web React + TypeScript y API Node.js sin dependencias de runtime de npm.
- `GET /api/probe`: ID de petición, revisión, hora y uptime del proceso que responde.
- Correspondencia entre el build servido por la web y el de la API.
- Recorrido GitOps con enlaces a la evidencia, identificado como diseño, no monitorización.
- Estados explícitos: cargando, API no disponible, builds diferentes y archivo no configurado.
- Sin cuentas, Supabase, claves en el navegador ni base de datos de aplicación.

## Probarlo

Node.js 22.16+ (o una versión posterior compatible) y npm:

```sh
npm ci
npm run dev
```

Abre http://127.0.0.1:5173. Este comando genera el manifiesto del build y levanta
Vite y la API en `127.0.0.1:8081`. Detén ambos con Ctrl+C. No necesita `.env.local`.
`npm run build` compila; `npm run build:web` reutiliza un manifiesto ya generado.

Con Docker Desktop iniciado:

```sh
npm run release
docker compose up --build -d --wait
node scripts/smoke.mjs
```

Abre http://127.0.0.1:8080. Hay dos contenedores; solo la web publica un puerto local.
La API no expone ningún puerto del host. Para detenerlos: `docker compose down`.
En Compose, Nginx enruta `/api`; en Kubernetes lo hace Traefik.

## Arquitectura prevista en OCI

```text
Navegador → OCI Load Balancer → Traefik (k3s, VM privada)
                                ├─ /     → Service web → Nginx + React
                                └─ /api  → Service api → Node.js
                                                        └─ OCI Object Storage (opcional)
```

El load balancer, DNS y TLS quedan fuera de esta refactorización. No se ha aplicado
ningún manifiesto al cluster ni desplegado recursos OCI al modificar este código.

```text
Gitpath → pruebas → imágenes GHCR (web + API)
                      ↓ PR con ambos digests
                 K3s-Cortex → revisión/merge → Argo CD → k3s
```

CI no recibe kubeconfig y la página no tiene permisos de Kubernetes. El workflow
publica dos imágenes multi-arquitectura y propone una PR; **ya no la fusiona automáticamente**.
Los digests fijan el contenido exacto. Revertir la promoción en Git es el rollback.

## Primera promoción: orden importante

1. Publicar primero la nueva carpeta `apps/gitpath/api` y el overlay
   `apps/gitpath/overlays/release-explorer` del repo **K3s-Cortex**. No cambiar todavía
   el `source.path` de `gitpath-prod`: sigue apuntando a `overlays/prod`.
2. Publicar esta refactorización en **Gitpath**. CI valida, construye y publica
   `ghcr.io/renzoal7/gitpath` y `ghcr.io/renzoal7/gitpath-api`.
3. Revisar la PR que CI propone en K3s-Cortex. Incluye los **dos digests reales** y
   el cambio de overlay de Argo CD en el mismo commit de promoción.
4. Integrarla cuando k3s, el acceso a GHCR y la entrada de red estén preparados.
   Confirmar el resultado en Argo CD y probar la API; un build verde no garantiza el despliegue.

El overlay nuevo contiene `release-not-published` hasta esa primera PR:
**es deliberadamente inactivo; no lo apliques tal cual**. El overlay anterior se conserva
para evitar un cambio prematuro y permitir volver al despliegue anterior.

Se reutiliza el secreto de Actions `CORTEX_REPO_TOKEN`, limitado al repo de infraestructura
(contents y pull requests: write). El nuevo paquete `gitpath-api` debe ser público como el
frontend, o debe configurarse explícitamente un imagePullSecret antes de promocionarlo.
No pongas un token de GHCR dentro de la imagen.

## Verificar

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador usan la web compilada y una API real. Las respuestas de fallo
y de catálogo OCI se simulan únicamente en tests. Hay pruebas de contrato, caché,
fallos de OCI, metadatos y promoción por digest. CI también levanta los contenedores y
ejecuta `scripts/smoke.mjs` antes de publicar.

## Alcance y decisiones

- Dos servicios, no un conjunto innecesario de microservicios.
- GHCR reutiliza el registro existente; no hace falta añadir OCIR ni Container Instances.
- No se añade Functions: no existe aún un trabajo que justifique otro runtime.
- OCI Object Storage es un archivo opcional de metadatos JSON, no una base de datos.
- MLOps, modelos y entrenamiento quedan fuera de este proyecto.
- Dos réplicas en **un nodo** no son alta disponibilidad frente a pérdida de la VM.
- El datastore interno de Kubernetes no es una base de datos de la aplicación.

Consulta [decisiones de arquitectura](docs/architecture.md) y
[operación y archivo OCI](docs/operations.md).
El antiguo `docs/oci-storage-plan.md` queda como documento histórico, no como plan vigente.
El curso/simulador anterior se conserva en el historial Git; no se ha reescrito ni borrado el repo.
