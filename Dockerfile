# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# CSV exports are written here (a volume shared by the api and consumer containers)
RUN mkdir -p /app/exports && chown -R node:node /app/exports
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
