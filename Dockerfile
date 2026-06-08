# Stage 1: Build Stage
FROM node:20.18.1-alpine3.20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Stage
FROM nginx:1.26.2-alpine3.20 AS production
# Copy custom nginx config if needed, or use default
# COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# No CMD needed for nginx alpine as it starts automatically
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -f http://localhost/ || exit 1