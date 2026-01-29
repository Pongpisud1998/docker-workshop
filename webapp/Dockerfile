# --- Stage 1: Build Stage ---
FROM node:18-alpine as build-stage

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
# Build command for production
RUN npm run build

# --- Stage 2: Production Stage ---
FROM nginx:stable-alpine as production-stage

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Project name is 'webapp'
COPY --from=build-stage /app/dist/webapp/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
