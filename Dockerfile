FROM node:18-alpine as builder

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.25-alpine

# Копируем конфиг роутинга
COPY nginx/static.conf /etc/nginx/conf.d/default.conf

# Удаляем дефолтную страницу Nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

# Фиксим права для Alpine
RUN chmod -R 755 /usr/share/nginx/html