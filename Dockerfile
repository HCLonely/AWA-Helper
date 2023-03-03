FROM node:18-alpine AS builder

# builder
WORKDIR /usr/src/app
COPY . .
RUN npm install && npm run build:docker

FROM node:18-alpine
WORKDIR /usr/src/app/dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./

VOLUME ["/usr/src/app/dist/config", "/usr/src/app/dist/logs"]

EXPOSE 3456
CMD [ "node", "index.js" ]
# docker run -d --name awa-helper -p 3456:3456 -v /data/awa-helper/config:/usr/src/app/dist/config -v /data/awa-helper/logs:/usr/src/app/dist/logs hclonely/awa-helper
