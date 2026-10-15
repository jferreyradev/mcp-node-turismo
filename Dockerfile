FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV TURISMO_API_URL=http://api.tucumanturismo.gob.ar
ENV MCP_TRANSPORT=http

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3000

USER node

CMD ["node", "src/index.js", "--http", "3000"]
