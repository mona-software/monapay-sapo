FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S monapay && adduser -S -G monapay monapay
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown -R monapay:monapay /app
USER monapay
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
