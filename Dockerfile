FROM node:22-alpine

WORKDIR /app

RUN npm install --omit=dev --no-audit --no-fund --no-save ws@8.21.0

COPY backend ./backend

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "backend/server.mjs"]
