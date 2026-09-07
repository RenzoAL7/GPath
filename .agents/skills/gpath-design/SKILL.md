---
name: gpath-design
description: Editar o revisar la interfaz y los textos de GPath — Growth Path. Usar para cambios visuales, copy y estados de interacción de esta página; no para infraestructura o recolección de datos.
---

# Diseño de GPath

GPath permite elegir un puesto y consultar qué tecnologías aparecen en una muestra
de ofertas públicas. Es una herramienta de una sola página, no una landing de
marketing ni una explicación del repositorio. El público son personas que consultan
requisitos laborales; no necesitan entender la infraestructura.

## Texto

- Usar nombres concretos: «Puesto», «Ver requisitos», «Ofertas consultadas».
- Quitar lemas, invitaciones redundantes y títulos decorativos en mayúsculas.
  Evitar «El siguiente paso, con contexto» y «De dónde sale el resultado».
- No mostrar API, pods, GitOps ni futuros planes técnicos en el recorrido principal.
- Mantener visible el origen público y la fecha de consulta en live. El modo demo debe
  marcar sus datos como ficticios. No inventar empresas, vacantes activas, fechas de
  recolección o cifras de usuarios para darle credibilidad.
- Las ofertas live deben conservar un enlace a la publicación original; no convertir
  un conteo de muestra en una recomendación de contratación.
- Los errores deben decir qué falló y cómo reintentar. Si se conservan resultados
  anteriores, identificarlos; no reemplazar errores por datos de ejemplo silenciosos.

## Sistema visual

- Reutilizar `public/gpath-mark.svg` en cabecera y favicon. No volver a los símbolos
  de ramas de Git ni crear un segundo logo con texto y flechas.

- Reutilizar los tokens de `src/index.css`: azul #224d88, texto #182b42,
  secundario #5c6b7e, bordes #dce4ed, fondo #f3f6fa y blanco. Reservar naranja
  para avisos; no destacar arbitrariamente la primera tecnología cuando hay empates.
- Mantener Space Grotesk para títulos e IBM Plex Sans para cuerpo y cifras,
  con números tabulares. No agregar familias tipográficas.
- Priorizar selector y resultados sobre una cabecera grande. Usar listas para
  ofertas; no envolver cada dato en una tarjeta ni agregar iconos decorativos.
- Respetar el ancho máximo y los controles nativos con labels. Un botón principal
  por consulta, estados disabled/loading, foco visible y contraste suficiente.
- No añadir login, buscador, paginación, gráficos nuevos, imágenes o animaciones
  solo porque figuren en una lista genérica de recomendaciones. Evaluar su utilidad
  para esta tarea y el volumen real de datos antes de proponerlos.

## Verificar

Revisar primero `src/App.tsx`, `src/index.css` y `tests/e2e/growth.spec.ts`.
Mantener selección de roles, conteos y denominadores correctos, carga, error,
reintento y estado vacío. Probar teclado, escritorio y ancho 320 px; inspeccionar
capturas, no solo el resultado del build. Actualizar pruebas si cambian controles.

La publicación requiere el workflow existente y revisión del propietario. Esta
skill no autoriza merges, cambios en producción ni modificaciones de Argo CD.
