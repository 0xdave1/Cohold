FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_ENABLE_P2P_TRANSFERS=true
ARG NEXT_PUBLIC_ENABLE_REAL_TIME=true
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_P2P_TRANSFERS=$NEXT_PUBLIC_ENABLE_P2P_TRANSFERS
ENV NEXT_PUBLIC_ENABLE_REAL_TIME=$NEXT_PUBLIC_ENABLE_REAL_TIME

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
