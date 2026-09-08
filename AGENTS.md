# GPath — instrucciones para agentes

## Alcance

- Este repositorio contiene la web React/TypeScript en `src/`, la API Node.js en
  `server/` y sus pruebas en `tests/`.
- GPath es una herramienta de una sola página para consultar tecnologías
  mencionadas en ofertas públicas. No convertirla en una landing genérica, un
  tutorial de Git o un panel de infraestructura.
- `K3s-Cortex` es un repositorio separado y queda fuera del alcance. No editarlo ni
  usarlo como destino de cambios de esta aplicación.

## Producto y datos

- Mantener seis puestos de entrada: `Intern`, `Practicante` o `Internship`.
- El modo live debe mostrar la procedencia, fecha de consulta y enlace a la oferta
  original. El modo demo usa ofertas ficticias y debe decirlo claramente.
- No presentar una muestra acotada como estadísticas de todo el mercado ni inventar
  empresas, vacantes activas, fechas o cifras de usuarios.
- Mantener sincronizados roles, filtros, contrato de API, ubicaciones normalizadas,
  copy y pruebas. No hacer fallback silencioso a datos globales cuando se filtra.
- Cualquier filtro geográfico debe separar país específico, remoto LATAM y ubicación
  desconocida.
- No incorporar Supabase, autenticación, cuentas de usuario ni una base de datos de
  aplicación.

## Interfaz

- Usar nombres concretos como «Puesto», «Ver tecnologías» y «Ofertas consultadas».
- Evitar lemas, invitaciones redundantes y copy genérico. Escribir en español claro,
  con verbos concretos y tono conversacional.
- Mantener selector, conteos, denominadores, foco visible, estados de carga, error,
  reintento y cero resultados.
- Reutilizar los tokens y las tipografías existentes. No añadir imágenes o
  animaciones sin una razón específica para esta herramienta.

## Flujo de trabajo

- No modificar `main`; trabajar en una rama de trabajo.
- Después de implementar y verificar una rama lista, preparar un commit local para
  que el usuario pueda hacer push y abrir una PR a `main`.
- No hacer push, merge ni abrir la PR sin aprobación explícita del usuario.
- Preservar cambios existentes y limitar cada modificación al alcance solicitado.
- En solicitudes de análisis o planificación, no editar archivos ni ejecutar
  comandos que generen artefactos hasta que el usuario apruebe el plan.

## Verificación

Después de implementar un cambio aprobado, ejecutar:

```bash
npm test
npm run build
npm run test:e2e
```

Probar teclado, escritorio y ancho de 320 px; inspeccionar las capturas reales.
Revisar `git status` y el diff final. No afirmar que la web pública cambió hasta
verificar el despliegue.
