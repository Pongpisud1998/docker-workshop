# Stage 1: Build the Angular application
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration development

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist/webapp/browser /usr/share/nginx/html
# Copy custom nginx config if available, otherwise default
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
