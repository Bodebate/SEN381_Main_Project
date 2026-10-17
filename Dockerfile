# Use a stable Node.js runtime environment
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy root and views configurations first for layer caching
COPY package*.json ./
COPY views/package*.json ./views/

# Install dependencies for both root and views
RUN npm install
RUN npm --prefix views install

# Copy the rest of the source code into the container
COPY . .

# Build the Angular frontend during the Docker image build phase
RUN npm run web:build

# Expose Render's expected port or default backends if needed
EXPOSE 3000 10000

# Start your node backend instantly
CMD ["node", "server.js"]