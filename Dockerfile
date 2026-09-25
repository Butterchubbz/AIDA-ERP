# ==============================================================================
# AIDA-ERP — MULTI-STAGE DOCKERFILE FOR MONOREPO
# ==============================================================================
# Stage 1: Build Workspace
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy root package definitions
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

# Install dependencies (including devDependencies for compilation)
RUN npm ci

# Copy remaining source code
COPY . .

# Compile and build the entire workspace
# This compiles @aida/shared, builds @aida/frontend (writing to backend/public),
# and compiles the Express backend TS files
RUN npm run build

# Prune development dependencies to keep the image small
RUN npm prune --production

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM node:20-alpine

WORKDIR /usr/src/app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3001

# Copy package descriptors and unified production node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/shared ./packages/shared

# Copy backend package elements
COPY --from=builder /usr/src/app/packages/backend/package*.json ./packages/backend/
COPY --from=builder /usr/src/app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /usr/src/app/packages/backend/public ./packages/backend/public

# If node_modules exist inside the backend package in builder, copy them
COPY --from=builder /usr/src/app/packages/backend/node_modules ./packages/backend/node_modules

# Expose the unified Express server port
EXPOSE 3001

# Boot the AIDA Express backend
CMD ["node", "packages/backend/dist/index.js"]
