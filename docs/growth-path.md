# Growth Path — ofertas públicas

Una pantalla: elegir Data Engineer, Backend o DevOps y explorar requisitos.
`GET /api/jobs?role=data|backend|devops` consulta feeds públicos de Greenhouse,
selecciona una muestra acotada por título, descarga el detalle de cada puesto y
calcula las tecnologías que aparecen en su descripción. Cada oferta conserva el
enlace original para comprobarla o postular directamente en el portal de la empresa.

## Verificación

```bash
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run dev
```

La ejecución local por defecto corre en http://127.0.0.1:5173, con API en 8081 y
modo live. Docker separa web y API; su compose usa demo para pruebas deterministas;
k3s usa los manifiestos de K3s-Cortex. No se necesita Supabase, registro de usuarios
ni base relacional. Los endpoints de release son operativos; no son la página.

## Fuente y límites

La primera versión real usa cuatro boards públicos configurados por defecto: Stripe,
Vercel, Cloudflare y Datadog. Se puede cambiar la lista con `GREENHOUSE_BOARDS`, sin
exponer credenciales. Greenhouse documenta que los endpoints GET de Job Board son
[públicos](https://docs.greenhouse.io/job-board.html) y que `content` incluye la
descripción del puesto.

El API consulta como máximo seis ofertas por fuente y guarda el resultado en memoria
durante quince minutos. Si una fuente falla, conserva las demás y lo indica en la
respuesta; si todas fallan, devuelve un error y no inventa resultados. La muestra no
es una fotografía de todo el mercado laboral y los porcentajes no miden elegibilidad.

La caché en memoria es suficiente para esta VM y esta primera versión. OCI Object
Storage queda como una siguiente mejora si necesitamos histórico, auditoría o un
refresco programado; no se añade una base de datos solo para servir esta página.

## GitOps

Mantener las imágenes `ghcr.io/renzoal7/gitpath` y `gitpath-api` evita mover paquetes.
La fuente se llama ahora `RenzoAL7/GPath`. Al fusionar el cambio de la aplicación,
la CI publica ambas imágenes y abre un PR de promoción por digest en Cortex; ese PR
requiere revisión antes de que Argo CD sincronice. La demo con imágenes importadas
es una prueba manual, no una entrega GitOps verificada.

Los documentos del antiguo Release Explorer y `oci-storage-plan.md` son históricos;
no definen el nuevo producto.
