ARG NODE_IMAGE=node:22.13.1-alpine
FROM ${NODE_IMAGE} AS builder

# builder
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:docker

FROM ${NODE_IMAGE}
WORKDIR /usr/src/app/output
ENV AWA_HELPER_CONTAINER=true
COPY --from=builder --chown=node:node /usr/src/app/output ./

RUN mkdir -p /usr/src/app/output/data /usr/src/app/output/config /usr/src/app/output/logs \
  && chown -R node:node /usr/src/app/output
VOLUME ["/usr/src/app/output/config", "/usr/src/app/output/logs", "/usr/src/app/output/data"]

EXPOSE 3456 2345
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "main.js", "--healthcheck"]
CMD [ "node", "main.js" ]
