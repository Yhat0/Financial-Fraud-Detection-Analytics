# Build estatico del tablero y servido con nginx. VITE_* se hornean en build time
# (el navegador del host llama a la API por http://localhost:5055/api/v1).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:5055/api/v1
ARG VITE_API_KEY=dev-key-change-me
ENV VITE_API_URL=$VITE_API_URL VITE_API_KEY=$VITE_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
