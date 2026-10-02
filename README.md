# GrowPath — Analizador de ofertas

<p align="center">
  <img src="public/gpath-mark.svg" width="96" alt="Logo de GrowPath" />
</p>

<p align="center">
  <strong>Tu ruta rápida para entender una oferta antes de postular.</strong>
</p>

GrowPath organiza una oferta laboral en tres pasos: leerla, revisar los requisitos y
las evidencias detectadas, y consultar un análisis general con ideas para prepararte.
Puedes pegar un enlace HTTPS público o la descripción de la oferta. No necesitas una
cuenta ni subir tu CV.

## Qué encontrarás

- Un enlace HTTPS público o una descripción pegada manualmente por cada análisis.
- Requisitos técnicos y deseables, además del nivel, la ubicación, la modalidad y el
  salario cuando aparecen en la oferta.
- Fragmentos de la oferta que respaldan los hallazgos para que puedas revisarlos.
- Una lectura rápida, una explicación de para quién puede encajar el puesto, qué puede
  aportarte y qué podrías demostrar.
- Navegación entre los pasos para volver a revisar la oferta sin perder lo leído.

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

## Flujo de uso

1. **Lee una oferta.** Pega el enlace público. Si no se puede abrir, selecciona
   **No puedo abrir el enlace** y pega su descripción.
2. **Revisa lo detectado.** Comprueba el puesto, los requisitos, los datos disponibles y
   las evidencias textuales de la oferta.
3. **Consulta el análisis.** Lee el resumen general y las ideas para prepararte usando
   únicamente la información disponible de esa oferta.

El lector necesita contenido público. Si la página requiere iniciar sesión, bloquea la
lectura o no entrega texto, puedes pegar la descripción manualmente.

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

La web usa React, TypeScript y Vite, y se sirve con Nginx. La API se ejecuta en un
contenedor Node.js. En cada pull request, CI valida las pruebas, la compilación, los
flujos de navegador y los contenedores. Al integrar cambios en `main`, publica las
imágenes web y API multi-arquitectura en GHCR y propone por separado un pull request de
promoción GitOps para revisión.

## Modelos opcionales

La aplicación funciona sin modelos: no descarga pesos ni inicia un runtime de
inferencia. Usa extracción reglada y explicaciones basadas en datos verificables.

Un despliegue puede conectar un runtime compatible ya disponible y configurar las
rutas de los modelos solo del lado servidor:

```text
MODEL_SOURCE=local
JOBBERT_MODEL_DIR=/models/jobbert-v3
QWEN_MODEL_PATH=/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf
MODEL_RUNTIME_URL=http://model-runtime:8090
```

Los pesos no se versionan en Git ni se incluyen en las imágenes. La configuración no
los descarga ni inicia el servicio de inferencia. Incluso con un runtime opcional, los
requisitos, el salario y las evidencias deben estar respaldados por el texto de la
oferta; el modelo no decide el puntaje final.

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
