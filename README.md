# GPath — Growth Path

GPath analiza una oferta laboral que el usuario encontró por su cuenta. Se elige un
puesto objetivo, se indica un perfil temporal y se pega un enlace HTTPS público o el
texto de la vacante.

> Pega una oferta laboral y descubre qué piden, cuánto encajas y qué te falta para postular.

No hay cuentas, CV persistido, Supabase ni una base de datos de aplicación. El enlace
original solo se conserva cuando la entrada fue una URL; el texto manual no inventa
empresa, enlace, salario ni requisitos.

## Ejecutar

Requiere Node.js 22.16+ y npm:

\`\`\`bash
npm ci
npm run dev
\`\`\`

Abre <http://127.0.0.1:5173>. La API escucha en el puerto 8081. Para validar el
proyecto:

\`\`\`bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
\`\`\`

## Flujo de análisis

La pantalla principal admite exactamente una fuente por análisis:

- Un enlace HTTPS público de la oferta.
- Una descripción pegada manualmente si el enlace no se puede leer.

El backend limita tamaño y tiempo de lectura, no ejecuta scripts de la página, no usa
cookies y bloquea URL con credenciales, puertos no estándar, hosts locales y rangos de
red privada. Las redirecciones se vuelven a validar. Si no se puede leer una página,
la interfaz pide pegar la descripción.

Los enlaces de búsqueda de LinkedIn que incluyen `currentJobId` se convierten a la
ficha pública del puesto; una búsqueda sin un puesto seleccionado se rechaza. También
se conservan metadatos públicos `description` y `og:description`, porque algunas
plataformas como Workday entregan allí el contenido mientras cargan su interfaz con
JavaScript.

El endpoint es \`POST /api/analyze\` con JSON:

\`\`\`json
{
  "targetRole": "data-analyst",
  "profile": {
    "level": "junior",
    "skills": ["Python", "SQL"]
  },
  "description": "Texto de la oferta"
}
\`\`\`

\`targetRole\` acepta \`data-analyst\`, \`data-engineer\`, \`backend-developer\`,
\`cloud-devops\`, \`machine-learning\` u \`other\`. El perfil acepta niveles
\`practicante\`, \`internship\` o \`junior\` y una lista opcional de habilidades actuales.

Después de limpiar la oferta, el resultado muestra requisitos y evidencias textuales,
coincidencias, brechas, nivel, ubicación/modalidad y salario solo cuando aparecen en
el contenido. El puntaje orientativo es calculado de forma determinista en el backend:

| Factor visible | Peso base |
| --- | ---: |
| Habilidades técnicas coincidentes | 50% |
| Similitud semántica | 25% |
| Nivel de experiencia | 15% |
| Ubicación y modalidad | 10% |

Cuando un dato no se puede verificar, ese factor se excluye y los factores disponibles
se reponderan; nunca se inventa un valor. Los umbrales son alta compatibilidad
(75–100), compatibilidad parcial (45–74) y baja compatibilidad (0–44). Si no se
indican habilidades actuales, GPath dice **“Compatibilidad con el puesto objetivo”**:
no afirma una compatibilidad personal ni brechas del usuario.

La interfaz actual no solicita país ni modalidad preferida. Por eso la ubicación y la
modalidad se muestran como requisitos detectados en la oferta, pero no se usan como
preferencia personal para el puntaje. El campo \`preference\` se conserva únicamente
para clientes API antiguos.

La extracción y la explicación están separadas del cálculo. Un modelo puede proponer
estructura o redactar una explicación, pero sus requisitos, salario y evidencias deben
estar respaldados por el texto limpiado; el modelo no recibe ni decide el puntaje final.

## JobBERT, Qwen y OCI

Los modelos no están versionados ni se descargan durante el build o al iniciar la API.
El repositorio ignora pesos y cachés tanto para Git como para el contexto de Docker.

Por defecto, la configuración server-side espera rutas montadas:

\`\`\`text
MODEL_SOURCE=local
JOBBERT_MODEL_DIR=/models/jobbert-v3
QWEN_MODEL_PATH=/models/qwen3/Qwen3-1.7B-Q4_K_M.gguf
\`\`\`

Para un inicializador de despliegue con el bucket privado de OCI:

\`\`\`text
MODEL_SOURCE=oci
OCI_REGION=us-ashburn-1
OCI_BUCKET_NAME=Bucket-Rnz
JOBBERT_OBJECT=models/JobBERT-v3.tar.gz
QWEN_OBJECT=models/Qwen3-1.7B-Q4_K_M.gguf
OCI_AUTH_MODE=config
\`\`\`

\`server/model-assets.mjs\` valida esas rutas y nombres sin leer secretos, tocar la red
ni invocar la CLI de OCI. Un inicializador o sidecar, configurado fuera de este
repositorio, debe descargar, verificar y montar los objetos en \`/models\` antes de
exponerlos en solo lectura a la API. \`docker compose\` ya monta un volumen nombrado
externo en esa ruta, pero no lo llena.

Qwen GGUF y JobBERT requieren runtimes distintos. Cuando exista un servicio local de
inferencia compatible, configura \`MODEL_RUNTIME_URL\` solo del lado servidor. GPath
le envía solicitudes internas \`/extract\`, \`/similarity\` y \`/explain\`; el servicio
usa Qwen para extraer/redactar y JobBERT para la similitud. Sin ese servicio, GPath
declara en las limitaciones que usa extracción reglada, una similitud de respaldo y
una explicación basada en factores: nunca los presenta como JobBERT o Qwen.

## Entrega

La web React se sirve con nginx sin privilegios y la API Node.js se ejecuta en una
imagen separada. Las imágenes ARM64/amd64 se construyen en CI; la promoción de
despliegue sigue siendo una revisión aparte. Este repositorio no modifica ni usa
\`K3s-Cortex\` como destino de cambios.
