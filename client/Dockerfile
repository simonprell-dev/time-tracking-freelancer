FROM node:22-alpine AS build

WORKDIR /src
COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN VITE_API_URL=/api npm run build

FROM nginx:1.29-alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80

