# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install ALL dependencies (including devDependencies required for building)
RUN npm ci

# Copy application source files
COPY . .

# Build the application (compiles the Vite frontend and bundles server.ts)
RUN npm run build

# ---

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Define production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built artifacts from builder stage (the whole dist folder, which contains index.html, assets, and server.cjs)
COPY --from=builder /app/dist ./dist

# Expose port 3000
EXPOSE 3000

# Start the Node Express + Vite fullstack server
CMD ["npm", "start"]
