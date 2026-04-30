# 1. Use a lightweight, hardened Node base image
FROM docker.io/node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the package.json that Nx auto-generates during the build
# This specific package.json only contains your production dependencies!
COPY dist/apps/backend-api/package*.json ./

# 4. Install only production dependencies to keep the image lean and secure
RUN npm ci --omit=dev

# 5. Copy the compiled NestJS application code
COPY dist/apps/backend-api .

# 6. Expose the standard NestJS port
EXPOSE 3000

# 7. Start the API
CMD ["node", "main.js"]