# GPath — instrucciones para agentes

## Alcance del repositorio

- Este repositorio contiene la web React/TypeScript en `src/`, la API Node.js en
  `server/` y sus pruebas en `tests/`.
- `K3s-Cortex` es un repositorio separado y queda fuera del alcance de este
  proyecto. No editarlo ni usarlo como destino de cambios de esta aplicación.
- Mantener la arquitectura actual: web, API y archivos estáticos. No incorporar
  Supabase, autenticación, cuentas de usuario ni una base de datos de aplicación.

## Flujo de trabajo

- No modificar `main`; trabajar en una rama de trabajo.
- No hacer merge ni push sin aprobación explícita del usuario.
- En solicitudes de análisis o planificación, no editar archivos ni ejecutar
  comandos que generen artefactos hasta que el usuario apruebe el plan.
- Preservar cambios existentes y limitar cada modificación al alcance solicitado.

## Producto y datos

- La demo usa ofertas ficticias. No presentarlas como vacantes activas,
  estadísticas del mercado, recomendaciones personalizadas ni datos recolectados.
- Si se amplían roles o filtros, mantener sincronizados el contrato de la API,
  los tipos de la UI, los datos de ejemplo, el copy y las pruebas.
- Cualquier filtro geográfico debe definir con claridad país, ciudad, remoto e
  híbrido. No etiquetar como LATAM una cobertura que no esté respaldada por los
  datos disponibles.
- El copy de la interfaz debe estar en español claro, con verbos concretos,
  tono conversacional y sin frases genéricas o promocionales que oculten el
  alcance real de la muestra.

## Verificación

Después de implementar un cambio aprobado, ejecutar:

```bash
npm test
npm run build
npm run test:e2e
```

Revisar también `git status` y el diff final. Si una prueba requiere un
servicio externo o cambia el entorno, documentar la condición en lugar de
introducir nuevas dependencias.
