# Use a stable Node.js runtime environment
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy root and views configurations
COPY package*.json ./
COPY views/package*.json ./views/

# Install dependencies
RUN npm install
RUN npm install --prefix views

# Copy source code
COPY . .

# Build the Angular frontend during the Docker image build phase
RUN npm run web:build

# Expose Render's expected port or default backends if needed
EXPOSE 3000 10000

# Use a production-ready static server or your node backend to start instantly
CMD ["node", "server.js"]