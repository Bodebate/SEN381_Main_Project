# Use a stable Node.js runtime environment matching Angular's prerequisites
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy root configurations first to leverage layer caching
COPY package*.json ./

# Copy views configuration to allow unified native installation
COPY views/package*.json ./views/

# Clean install to fetch the Linux environment binaries natively inside the container
RUN npm install
RUN npm install --prefix views

# Copy the entire source code into the container
COPY . .

# Expose the ports used by your application (3000 for API, 4200 for Frontend)
EXPOSE 3000 4200

# Execute the Angular server directly out of the views context with performance hooks
CMD ["npm", "run", "start:live", "--prefix", "views", "--", "--host", "0.0.0.0", "--poll", "2000"]
