FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS node

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

FROM mcr.microsoft.com/playwright:v1.58.2-noble@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d

COPY --from=node /usr/local /usr/local
COPY --from=node /root/.cache/node/corepack /root/.cache/node/corepack
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /work
