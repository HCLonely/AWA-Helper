FROM node:18-alpine AS builder

# builder
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build:docker

FROM node:18-alpine
WORKDIR /usr/src/app/output
# COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/output ./

VOLUME ["/usr/src/app/output/config", "/usr/src/app/output/logs"]

EXPOSE 3456 2345
CMD [ "node", "main.js" ]
