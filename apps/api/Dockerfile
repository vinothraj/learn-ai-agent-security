# Build from the repository root:  docker build -f apps/api/Dockerfile -t laas-api .
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/api --include-workspace-root=false --omit=dev
COPY packages/shared packages/shared
COPY apps/api apps/api
USER node
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["npx", "tsx", "apps/api/src/server.ts"]
