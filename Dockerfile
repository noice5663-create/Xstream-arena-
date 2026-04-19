# Use the official Node.js 20 LTS (Bookworm Slim) as the base image
FROM node:20-bookworm-slim

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Install FFmpeg (and CA certificates for secure downloads)
# Clean up the apt cache afterwards to keep the image size small
RUN apt-get update && \
    apt-get install -y ffmpeg ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and optionally package-lock.json first
# This caches the npm install step unless dependencies change
COPY package*.json ./

# Install dependencies 
# Using regular install since there's native typescript/tsx execution involved
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend assets (Vite)
RUN npm run build

# Expose the port the server runs on
EXPOSE 3000

# Start the application using the package.json start script
CMD ["npm", "start"]
