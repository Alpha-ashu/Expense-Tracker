FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Generate Prisma client types
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

# Run DB migrations first, then start the server.
# If DATABASE_URL is not reachable the container exits early with a clear error.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
