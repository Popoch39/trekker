# Image de production de l'API. A construire depuis la RACINE du monorepo :
#   docker build -f apps/api/Dockerfile -t trekker-api .

# --- 1. Contexte minimal -----------------------------------------------------
# `turbo prune` ne garde que `api` et ses dependances workspace, ce qui evite
# d'invalider le cache d'install a chaque changement dans un autre package.
FROM node:22-alpine AS pruner
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@2 prune api --docker

# --- 2. Dependances + build --------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable

# Les manifestes d'abord : cette couche n'est reconstruite que si une
# dependance change.
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ .
# Compile @repo/contracts et @repo/db avant api (dependsOn ^build).
RUN pnpm turbo run build --filter=api

# Retire les devDependencies pour ne copier que le runtime dans l'image finale.
RUN pnpm prune --prod

# --- 3. Runtime --------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /repo

ENV NODE_ENV=production

# dumb-init reprend correctement PID 1 : les signaux SIGTERM atteignent Node,
# ce qui declenche les shutdown hooks Nest (fermeture du pool pg).
RUN apk add --no-cache dumb-init

# Utilisateur non privilegie (l'image node fournit deja `node`).
USER node

COPY --from=builder --chown=node:node /repo/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/packages ./packages
COPY --from=builder --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
