export const steps = [
  {
    name: 'Código',
    tool: 'GitHub',
    tag: '01 / SOURCE',
    title: 'Un cambio con identidad.',
    description:
      'Cada versión parte de un commit. El código, las pruebas y la definición de los contenedores viven juntos; las credenciales no.',
    artifact: 'Commit SHA',
    detail:
      'La revisión queda grabada dentro de ambas imágenes. Si hay cambios locales sin commit, la web lo indica.',
    href: 'https://github.com/RenzoAL7/Gitpath',
    link: 'Ver repositorio',
  },
  {
    name: 'Validación',
    tool: 'GitHub Actions',
    tag: '02 / CHECK',
    title: 'Primero las pruebas.',
    description:
      'La propuesta de entrega valida el contrato de la API, los fallos del archivo de versiones y la interfaz antes de publicar imágenes.',
    artifact: 'Pruebas + build',
    detail:
      'Un workflow fallido no debe promocionar una versión. Publicar una imagen tampoco demuestra que se haya desplegado.',
    href: 'https://github.com/RenzoAL7/Gitpath/actions',
    link: 'Ver ejecuciones',
  },
  {
    name: 'Imágenes',
    tool: 'GHCR',
    tag: '03 / PACKAGE',
    title: 'Dos servicios. Una versión.',
    description:
      'La web y la API se empaquetan por separado, con la misma revisión. Las imágenes multi-arquitectura permiten usar la VM ARM de OCI.',
    artifact: 'web + api · SHA-256',
    detail:
      'El repositorio de infraestructura fija cada imagen por digest: una referencia al contenido exacto, no una etiqueta que puede moverse.',
    href: 'https://github.com/RenzoAL7/Gitpath/blob/main/Dockerfile',
    link: 'Ver contenedores',
  },
  {
    name: 'Promoción',
    tool: 'K3s-Cortex',
    tag: '04 / DECLARE',
    title: 'El despliegue también se revisa.',
    description:
      'Una pull request cambia los dos digests en el repositorio de infraestructura. Se revisa y se integra cuando la versión está lista.',
    artifact: 'Pull request de promoción',
    detail:
      'Para volver a una versión anterior se revierte la promoción en Git. La página es de consulta: no tiene permisos para cambiar el cluster.',
    href: 'https://github.com/RenzoAL7/K3s-Cortex/tree/main/apps/gitpath',
    link: 'Ver estado deseado',
  },
  {
    name: 'Reconciliación',
    tool: 'Argo CD · k3s',
    tag: '05 / RECONCILE',
    title: 'Git declara. Argo CD reconcilia.',
    description:
      'Argo CD compara los manifiestos de Git con Kubernetes y aplica los cambios. Las sondas controlan si cada proceso puede recibir tráfico.',
    artifact: 'Deployments + Services',
    detail:
      'GPath consulta su propia API, no la API de Kubernetes. No afirma que Argo esté sincronizado ni que todos los nodos estén sanos.',
    href: 'https://github.com/RenzoAL7/K3s-Cortex/blob/main/clusters/rnz-prod/gitpath-application.yaml',
    link: 'Ver aplicación de Argo CD',
  },
]
