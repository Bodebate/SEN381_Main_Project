# Use a stable Node.js runtime environment matching your stack
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy root package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the rest of the backend code (models, routes, server.js, app.js, etc.)
COPY . .

# Expose the port Render expects
EXPOSE 3000

# Start the Node.js backend server directly
CMD ["node", "server.js"]
