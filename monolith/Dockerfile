# Use Node.js 20 LTS on Alpine (minimal image)
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifest first (layer cache optimization)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
