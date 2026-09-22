# GrowPath — instrucciones para agentes

## Alcance

- Este repositorio contiene la interfaz React/TypeScript en src/, la API Node.js en
  server/ y sus pruebas en tests/.
- GrowPath analiza una oferta laboral pública o una descripción pegada por la persona
  usuaria. El flujo es: leer oferta, revisar requisitos y ver análisis.
- No convertirlo en un agregador de vacantes, una landing genérica ni un panel de
  infraestructura.
- No añadir cuentas, autenticación, CV persistido, base de datos de aplicación ni
  recomendaciones de vacantes.

## Producto y datos

- Mantener una única fuente por análisis: URL HTTPS pública o descripción manual.
- Mostrar requisitos, datos y recomendaciones solo cuando estén respaldados por el
  contenido de la oferta.
- Conservar las evidencias textuales, limitaciones, errores claros y la alternativa
  de pegar la descripción cuando un enlace no se puede leer.
- El cálculo orientativo debe ser determinista; un modelo opcional no puede inventar
  requisitos, salario o evidencias ni modificar el puntaje final.
- La capa de modelos es únicamente server-side. No versionar pesos ni exponer rutas,
  secretos o credenciales al navegador.

## Interfaz

- Escribir en español claro, concreto y conversacional.
- Mantener visible el puesto analizado antes de mostrar el análisis general.
- Permitir retroceder entre pasos sin perder la oferta ya leída.
- Conservar estados de carga, error, reintento, foco visible y diseño usable en móvil.
- Reutilizar los tokens y tipografías existentes. No añadir imágenes, animaciones o
  secciones decorativas sin una utilidad clara para revisar una oferta.

## Flujo de trabajo

- No modificar main; usar una rama de trabajo.
- Preservar cambios existentes y no mezclar trabajo ajeno con el solicitado.
- No hacer push, merge ni abrir una PR sin autorización explícita.
- Después de un cambio aprobado, ejecutar las verificaciones y revisar el diff antes
  de proponer un commit.

## Verificación

Después de implementar un cambio aprobado, ejecutar:

~~~bash
npm test
npm run build
npm run test:e2e
docker compose config --quiet
git diff --check
~~~

Probar teclado, escritorio y un ancho de 320 px. Inspeccionar las capturas reales
antes de afirmar que la interfaz se ve bien.
