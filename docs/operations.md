# Operación

## Comprobar sin tocar OCI

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

También se puede probar con un Chromium local mediante
`PLAYWRIGHT_EXECUTABLE_PATH` apuntando al ejecutable. Playwright abre un perfil de
prueba aislado, no el perfil personal del navegador.

El comando `dev` ocupa 5173 y 8081. Los procesos fallan si el puerto API está ocupado.
La URL del proxy de desarrollo usa 8081; no cambies solo el puerto de la API.
La preview de Vite también enruta `/api` a 8081 y necesita `npm run dev:api` en otra terminal.
Para desarrollo, no uses `VITE_*` para ningún secreto.

## Contenedores

```sh
npm run release
docker compose up --build -d --wait
node scripts/smoke.mjs
docker compose ps
```

URL local: http://127.0.0.1:8080. Los contenedores no guardan datos. `docker compose down`
detiene y elimina solo los contenedores/red de este proyecto, no el bucket ni la VM.

`public/release.json` debe existir antes del build Docker y se copia igual a ambos
targets. No generes dos metadatos distintos entre los builds de web y API. El tag
`sha-...` facilita búsqueda; Kubernetes utiliza el digest publicado, no confía en que
ese tag sea inmutable.

Las imágenes base usan tags de versión, no digests fijados. CI reconstruye y prueba
pero no garantiza builds bit-a-bit reproducibles. Fijar/actualizar digests de bases
y añadir escaneo de imágenes es una mejora posterior, no una propiedad ya lograda.

## Activación por GitOps

Sigue el orden de primera promoción en el README. Para validar los manifiestos localmente,
desde K3s-Cortex:

```sh
kubectl kustomize apps/gpath/overlays/release-explorer
```

Este comando no contacta el cluster. Antes de activar, la PR debe reemplazar ambos
`release-not-published` por digests reales y cambiar el path de la Application.
Si el overlay no está aún en el remoto de K3s-Cortex, la promoción falla de forma
explícita y no modifica el overlay antiguo. Publica los manifiestos y vuelve a ejecutar CI.

`CORTEX_REPO_TOKEN` necesita permiso de contenidos/PR en K3s-Cortex; no permiso OCI
ni de Kubernetes. GHCR se autentica en Actions con `GITHUB_TOKEN`. Comprueba la
visibilidad del nuevo paquete API; no des por hecho que un paquete hereda acceso público.

Después de integrar la PR, inspecciona Argo CD y, con el contexto Kubernetes correcto:

```sh
kubectl -n gpath get deployments,pods,services,ingress
kubectl -n gpath rollout status deployment/gpath --timeout=120s
kubectl -n gpath rollout status deployment/gpath-api --timeout=120s
```

No se ejecutaron estos comandos sobre OCI durante la refactorización. El LB/TLS
sigue pendiente. Revisa que `/api/probe` responda JSON, no el HTML de la SPA.

Para rollback, revierte en K3s-Cortex el commit de la promoción y revisa la PR.
No uses `kubectl set image` como mecanismo normal: Argo CD con self-heal puede
revertir ese cambio manual. Volver al overlay anterior también retira la API nueva;
eso debe ser un rollback deliberado, no una edición accidental del path.

## Archivo opcional en OCI

No es requisito para la primera entrega. No se crea ni modifica ningún bucket al
iniciar la web. El plan antiguo de almacenamiento no se utiliza.

1. Conserva tu bucket privado. Usa solamente el prefijo `gpath/releases/`.
2. Inicializa **una sola vez** `gpath/releases/index.json` con `docs/empty-catalog.json`.
   No sobrescribas un índice existente. Con la identidad OCI CLI del operador y
   sustituyendo los nombres de ejemplo:

   ```sh
   oci os object put --namespace-name TU_NAMESPACE --bucket-name TU_BUCKET \
     --name gpath/releases/index.json --file docs/empty-catalog.json \
     --no-overwrite --no-multipart --content-type application/json
   ```

3. Crea una PAR con acceso **ObjectRead** al objeto exacto `gpath/releases/index.json`,
   con fecha de expiración acotada. No uses una PAR de escritura ni de todo el bucket.
4. Para probar localmente, coloca su URL en `.env.local` como `RELEASE_CATALOG_URL`.
   Nunca la pegues en el README, frontend o una captura. Reinicia la API.
5. En k3s, usa un Secret `gpath-archive` en namespace `gpath` con clave `catalog-url`,
   suministrado fuera de Git. Los manifiestos ya lo admiten, pero el Secret no se ha creado.
   Un cambio de Secret usado como variable requiere reiniciar los pods para aplicarse.
6. Verifica salida de la VM privada a Object Storage (rutas Service Gateway/NAT,
   DNS y reglas), sin hacer público el bucket. La web debe mostrar `connected`
   con un índice vacío, o `unavailable` si la PAR/red falla.

Para publicar un build, descarga el artefacto **gpath-release** de una ejecución
exitosa de Actions. Conserva ese `release.json`; no lo reconstruyas localmente.
Configura en `.env.local` `OCI_RELEASE_BUCKET` y `OCI_RELEASE_NAMESPACE`. Después:

```sh
npm run archive -- /ruta/al/release.json
```

Esta operación sí escribe al bucket usando tu OCI CLI configurado, por lo que se
ejecuta solo cuando quieras publicar. Requiere lectura/head y escritura de objetos
en el destino. Rechaza metadatos locales/sucios, no borra objetos y no necesita dar
permisos de escritura a la API. El registro tiene una clave con hash de contenido;
el índice guarda los 50 builds más recientes. Los registros históricos permanecen
en el bucket: una política de retención/costes es una decisión futura del operador.

El índice se lee y actualiza usando ETag. Si otro escritor lo cambia entre ambas
operaciones, el comando falla sin pisar el nuevo índice; vuelve a ejecutar el mismo
comando. Puede quedar un registro todavía no incluido en el índice: es seguro
reintentar. La caché de la API tarda hasta 60 s en reflejar un cambio y es independiente
por réplica. No se afirma que el archivo demuestre el éxito del despliegue.

La integración real del bucket requiere esa configuración y no ha sido validada
contra OCI por las pruebas locales. La lectura, degradación y contrato se prueban
con respuestas controladas, nunca con credenciales en los tests.

## Lectura rápida de fallos

| Síntoma                        | Comprobar primero                                                               |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Web visible, API no disponible | Service/endpoints de API y ruta `/api` de Traefik                               |
| API devuelve HTML              | Ingress está enviando `/api` a la SPA                                           |
| Builds diferentes              | Rollout parcial, réplicas de distintas versiones; recargar y consultar otra vez |
| Archivo no configurado         | Es normal sin `RELEASE_CATALOG_URL`; no requiere base de datos                  |
| Archivo no disponible          | PAR expirada, objeto/contrato, salida OCI; los errores no exponen la URL        |
| Imagen no descargada           | Digest publicado, permisos GHCR, arquitectura ARM, salida de red                |
| PR de promoción falla          | Scaffold nuevo en K3s-Cortex y permisos de `CORTEX_REPO_TOKEN`                  |
