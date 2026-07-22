# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files và install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Security: tạo user không có quyền root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production node_modules từ stage trước
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs src/ ./src/
COPY --chown=nodejs:nodejs package.json ./

# Chuyển sang user không có quyền root
USER nodejs

# Expose port của Express server
EXPOSE 5000

# Biến môi trường mặc định
ENV NODE_ENV=production \
    PORT=5000

# Health check: AWS ECS/EC2 có thể dùng để monitor container
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

# Khởi động server
CMD ["node", "src/server.js"]
