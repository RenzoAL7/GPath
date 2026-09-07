# GPath — Growth Path

Para cambios en la interfaz o sus textos, leer
`.agents/skills/gpath-design/SKILL.md` y aplicar sus criterios al alcance solicitado.

La página consulta requisitos por puesto. No convertirla en una landing genérica,
un tutorial de Git o un panel de infraestructura. El modo live usa ofertas públicas
y debe mostrar su procedencia; el modo demo usa ofertas ficticias y debe decirlo.
No agregar autenticación ni una base de datos para cambios de diseño.

Validación: `npm test`, `npm run build` y `npm run test:e2e`. No afirmar que la web
pública cambió hasta verificar el despliegue; dejar las PRs para revisión del usuario
y no fusionarlas sin su autorización.
