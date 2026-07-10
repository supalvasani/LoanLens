# Step 1: Build Stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci

# Copy code and compile React-Vite static assets
COPY . .
RUN npm run build

# Step 2: Serve Stage
FROM nginx:alpine

# Support running as non-root user in Nginx
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy built assets with appropriate permissions
COPY --chown=nginx:nginx --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with appropriate permissions
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Expose non-privileged port
EXPOSE 8080

# Switch to non-root execution
USER nginx

# Start command
CMD ["nginx", "-g", "daemon off;"]
