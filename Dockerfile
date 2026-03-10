FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src

RUN npm run build

# ---

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/agents ./dist/agents

RUN mkdir -p data/traces

CMD ["node", "dist/index.js"]
