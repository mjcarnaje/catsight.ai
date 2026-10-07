# dev:  Vite dev server (docker-compose.yml)
# prod: static build served by nginx, which also proxies the API (docker-compose.prod.yml)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS build
ARG VITE_PUBLIC_URL=https://catsight.mjcarnaje.com
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
