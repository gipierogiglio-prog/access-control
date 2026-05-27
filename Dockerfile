FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json .
RUN npm install --include=dev
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json .
RUN npm install --omit=dev
COPY backend/server.js .
COPY --from=frontend /app/dist frontend/dist
EXPOSE 3001
ENV PORT=3001
RUN mkdir -p /data
CMD ["node", "server.js"]
