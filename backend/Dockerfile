# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["node", "dist/server.js"]
