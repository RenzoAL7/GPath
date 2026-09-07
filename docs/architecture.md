# Decisiones de GPath

## Problema y límite

Una landing estática no permite comprobar fácilmente qué revisión se sirve o cómo
conecta el código con el despliegue. GPath hace visible ese recorrido con una petición
real y metadatos acotados. Ayuda a revisar y entender **este sistema**, no pretende
ser observabilidad multi-cluster, un producto de analítica ni una plataforma de enseñanza.

La interfaz separa tres cosas: respuesta observada, configuración declarada y servicio
opcional no configurado. No asigna latencias inventadas a los saltos ni estados verdes
a componentes que no consulta.

## Responsabilidades

| Componente        | Hace                                                             | No hace                                                           |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Web (Nginx/React) | Sirve assets, muestra metadatos, permite una petición GET        | No contiene credenciales ni modifica infraestructura              |
| API (Node.js)     | Informa de su build, responde al probe y lee un catálogo acotado | No escribe datos, no ejecuta comandos ni accede a Kubernetes      |
| GitHub Actions    | Prueba, empaqueta y propone los digests en una PR                | No aplica YAML ni accede a la VM por SSH                          |
| K3s-Cortex        | Versiona el estado deseado y su revisión                         | No construye el código de la aplicación                           |
| Argo CD           | Reconcilia después del merge                                     | No se controla desde la web pública                               |
| Bucket opcional   | Guarda registros JSON de builds y un índice                      | No almacena cuentas, comentarios o datos aportados por visitantes |

## API mínima

| Ruta            | Respuesta                                                      | Dependencia externa       |
| --------------- | -------------------------------------------------------------- | ------------------------- |
| `/healthz`      | El proceso HTTP responde                                       | Ninguna                   |
| `/readyz`       | La configuración local es válida y puede atender tráfico       | Ninguna                   |
| `/api/release`  | Metadatos grabados al construir y entorno declarado            | Ninguna                   |
| `/api/probe`    | UUID, hora del servidor, revisión, uptime del proceso          | Ninguna                   |
| `/api/releases` | Índice opcional: connected, stale, unavailable, not-configured | OCI, solo si se configura |

Solo GET y HEAD. Los errores no incluyen trazas, claves ni URLs privadas. No se refleja
el contenido recibido. La API registra ID, status y duración; no URL, IP, cookies ni
Authorization. No existe una base de datos de peticiones. Los logs de otros componentes
(por ejemplo el futuro LB) se deben configurar y revisar por separado.

La readiness no depende del bucket: su caída no debe expulsar todas las réplicas del
Service ni provocar reinicios. Liveness comprueba el proceso, no una dependencia externa.

## Identidad de versión

`scripts/write-release.mjs` genera `public/release.json` con versión, commit, fecha,
ID de ejecución y marca de cambios locales. CI conserva **el mismo fichero** para web y
API. Un build local con cambios no se presenta como el commit limpio de producción.
El contrato reconstruye enlaces de GitHub permitidos y descarta campos inesperados.

La consulta de la web lee `/release.json` del servidor; no prueba que una pestaña abierta
desde antes del rollout ya haya recargado sus assets. Recarga la página para comprobar
la nueva interfaz. La API informa del proceso que atendió **esa** petición. Durante un
rolling update varias réplicas pueden responder con revisiones distintas. Un solo probe
no certifica todas las réplicas, Argo CD, los nodos o la disponibilidad histórica.

## Kubernetes sin complejidad extra

- Se preservan los nombres y selectores del frontend existente. La API tiene otro
  `app.kubernetes.io/name`, para que el Service de la web nunca seleccione un pod de API.
- Dos Deployments y dos Services ClusterIP. El Ingress separa `/api` de `/` sin quitar
  el prefijo de la ruta.
- Procesos no-root, capabilities eliminadas, sin escalada de privilegios, seccomp
  RuntimeDefault y sin token de ServiceAccount montado.
- Root filesystem de solo lectura; Nginx tiene únicamente `/tmp` escribible.
- Requests/limits y sondas de arranque/readiness/liveness. Dos réplicas permiten
  rolling updates pero no toleran la pérdida del único nodo.
- No se crea un Service LoadBalancer por aplicación: se reutilizará la entrada OCI
  existente hacia Traefik cuando se configure la red.

## Datos y credenciales

El bucket permanece privado. La API admite una URL HTTPS fija de Object Storage,
servidor a servidor, idealmente una PAR de solo lectura de **un único objeto**.
No admite URLs enviadas por usuarios, ni sigue redirecciones. Caché por proceso
de 60 s, timeout de 4 s, payload máximo de 128 KiB y hasta 50 registros.
Un fallo muestra la última copia con aviso si existe; si no, muestra indisponibilidad.

Una PAR es un secreto. No debe publicarse ni llevar prefijo `VITE_`. En k3s se
inyecta con un Secret opcional; no se almacena el valor en Git. Un Secret de
Kubernetes no equivale por sí solo a cifrado seguro en reposo: el hardening de
k3s y acceso a la VM sigue siendo responsabilidad de la infraestructura.

`npm run archive` es una operación **explícita del operador**, no del navegador ni
del build. Escribe registros identificados por contenido, no los sobrescribe, y
actualiza el índice con una precondición ETag. No borra objetos. Esto no implementa
retención WORM: otro principal con permisos de escritura podría modificarlos.

## Qué se deja fuera

Sin Supabase, autenticación, base de datos relacional, volumen persistente para datos
de aplicación, Redis, Kafka, Functions o modelos. No usar cada servicio disponible
es una decisión de alcance. El proyecto MLOps puede construirse después, independiente.

No hay SLO, monitoreo continuo, rate limiting distribuido ni alta disponibilidad de
nodo. Antes de abrirlo a Internet: revisar TLS, NSGs/firewall, health checks del LB,
pulls de GHCR, cuotas y acceso de la VM privada a Object Storage. No se ha afirmado
que esas tareas estén realizadas por esta refactorización.

Referencias: [arquitectura k3s](https://docs.k3s.io/architecture),
[auto-sync de Argo CD](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/),
[sondas de Kubernetes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/),
[PAR de OCI](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usingpreauthenticatedrequests.htm).
