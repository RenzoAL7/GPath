# GrowPath — Analizador de ofertas

<p align="center">
  <img src="public/gpath-mark.svg" width="96" alt="Logo de GrowPath" />
</p>

<p align="center">
  <strong>Tu ruta rápida para entender una oferta antes de postular.</strong>
</p>

GrowPath lee una oferta laboral pública o una descripción pegada manualmente y la
convierte en una guía clara: requisitos técnicos, datos detectados, evidencias,
una lectura rápida y pasos concretos para prepararte. No requiere cuenta, CV ni una base de
datos.

## Qué resuelve

- Acepta una sola fuente por análisis: un enlace HTTPS público o el texto de la oferta.
- Extrae tecnologías, requisitos deseables, nivel, ubicación, modalidad y salario solo
  cuando están presentes en el contenido.
- Muestra evidencias textuales para que puedas comprobar de dónde salió cada hallazgo.
- Te permite volver entre **Revisar requisitos** y **Ver análisis** sin perder la
  información ya leída.
- Genera una orientación breve y concreta: para quién puede ser el puesto, qué puede
  aportar y qué conviene demostrar en una entrevista.

## Inicio rápido

Necesitas Node.js 22.16 o superior y npm.

```bash
npm ci
npm run dev
```

Luego abre http://127.0.0.1:5173. La API se inicia en el puerto 8081.

Para ejecutar la aplicación con contenedores:

```bash
docker compose up --build
```

La versión de contenedores queda disponible en http://127.0.0.1:8080.

## Cómo funciona

1. Pegas el enlace público de una oferta o su descripción.
2. GrowPath valida y lee una única fuente.
3. Revisas los requisitos y las evidencias detectadas.
4. Abres el análisis para ver una guía de preparación basada en esa oferta.

Si una página requiere iniciar sesión, bloquea la lectura o no entrega contenido
público, puedes pegar la descripción manualmente.

## Seguridad y privacidad

El lector de ofertas acepta únicamente URLs HTTPS públicas. Rechaza credenciales en
la URL, hosts locales, redes privadas, puertos no estándar y redirecciones inseguras.
No ejecuta scripts de la página ni usa cookies.

GrowPath no crea cuentas ni almacena el texto de una oferta como historial de usuario.
La respuesta se calcula durante la solicitud y el registro técnico evita guardar la
URL o la descripción enviada.

## API

El endpoint principal es:

```text
POST /api/analyze
```

Envía exactamente una de estas fuentes: <code>url</code> o <code>description</code>.

```json
{
  "targetRole": "other",
  "profile": {
    "level": "junior",
    "skills": []
  },
  "url": "https://empresa.com/carreras/analista-de-datos"
}
```

Para usar texto manual, reemplaza <code>url</code> por <code>description</code>. La
interfaz ya envía el contexto técnico por defecto; no necesitas configurar roles o un
perfil para usarla.

La API responde con requisitos detectados, evidencias, datos de la oferta,
compatibilidad orientativa, limitaciones y la información necesaria para la guía
visible en la interfaz.

También están disponibles:

```text
GET /healthz
GET /readyz
GET /api/release
GET /api/probe
```

Los endpoints heredados de catálogos de vacantes y archivos de versiones no forman
parte del producto actual.

## Arquitectura

```text
src/
  App.tsx                 Interfaz React del flujo de tres pasos
  index.css               Sistema visual y diseño responsive
server/
  app.mjs                 Rutas HTTP del analizador y health checks
  analyzer.mjs            Extracción, evidencia y cálculo determinista
  public-offer.mjs        Lectura segura de ofertas públicas
  model-assets.mjs        Configuración segura de modelos opcionales
  model-runtime.mjs       Adaptador para un runtime local de inferencia
shared/
  release.mjs             Metadatos verificables de la compilación
tests/
  *.test.mjs              Pruebas unitarias y de contrato
  e2e/                    Flujos reales en escritorio y móvil
```

La web usa React, TypeScript y Vite. La API usa Node.js y se empaqueta por separado
con nginx en Docker. El flujo de CI valida pruebas, build, navegador y contenedores
antes de publicar imágenes.

## Modelos opcionales

La aplicación funciona sin descargar modelos. En ese caso emplea extracción reglada,
similitud de respaldo y explicaciones basadas en datos verificables.

Si existe un runtime local compatible, puedes configurarlo solo del lado servidor:

```text
MODEL_SOURCE=local
JOBBERT_MODEL_DIR=/models/jobbert-v3
QWEN_MODEL_PATH=/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf
MODEL_RUNTIME_URL=http://model-runtime:8090
```

Los pesos no se versionan en Git ni se incluyen en las imágenes. Incluso con el
runtime opcional, los requisitos, salario y evidencias deben estar respaldados por el
texto de la oferta; el modelo no decide el puntaje final.

## Calidad

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
docker compose config --quiet
```

Las pruebas de navegador cubren el flujo de enlace y texto manual, validaciones,
retroceso entre pasos y tamaños de escritorio y móvil.

## Límites del producto

- El análisis es orientativo; no reemplaza leer la oferta completa ni garantiza una
  contratación.
- Los datos solo se muestran cuando pueden verificarse en el contenido disponible.
- Una oferta protegida por inicio de sesión puede requerir que pegues la descripción.
- GrowPath no recomienda vacantes, no rastrea usuarios y no afirma conocer todo el
  mercado laboral.

---

Hecho para ayudarte a revisar una oferta con calma antes de decidir postular.
