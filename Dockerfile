ARG NODE_IMAGE=node:22.23.2-alpine
# The bundled JavaScript is architecture-independent. Run build tools natively.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS builder

# builder
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:docker
RUN mkdir -p output/data output/config output/logs

FROM ${NODE_IMAGE}
WORKDIR /usr/src/app
ENV AWA_HELPER_CONTAINER=true
COPY --from=builder --chown=node:node /usr/src/app/output ./output
WORKDIR /usr/src/app/output

VOLUME ["/usr/src/app/output/config", "/usr/src/app/output/logs", "/usr/src/app/output/data"]

EXPOSE 2345
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "healthcheck.js"]
CMD [ "node", "index.js" ]
