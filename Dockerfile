FROM node:18-alpine as builder

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "run", "dev"]