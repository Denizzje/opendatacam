FROM node:20-bookworm-slim

WORKDIR /var/local/opendatacam

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV NODE_OPTIONS=--openssl-legacy-provider

EXPOSE 8080 8070 8090

CMD ["node", "server.js"]
