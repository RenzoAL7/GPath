# Uses Docker's bundled frontend; no external Dockerfile frontend is needed.
# Generate public/release.json once before building either target. CI downloads
# the same tested artifact for both images; there are no browser-side secrets.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node --input-type=module -e "import fs from 'node:fs'; import {parseRelease} from './shared/release.mjs'; parseRelease(JSON.parse(fs.readFileSync('public/release.json')))"
RUN npm run build:web

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production PORT=8081 RUNTIME_ENV=container
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node public/release.json ./public/release.json
USER 1000:1000
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8081/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--max-old-space-size=80", "server/index.mjs"]

# Keep web last so existing default Docker builds still produce the web image.
FROM nginxinc/nginx-unprivileged:1.28-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/api-route.conf /etc/nginx/api-route.conf
COPY --chown=101:101 --from=build /app/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
