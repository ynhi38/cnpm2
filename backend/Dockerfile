FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "src/server.js"]
