# Backend Dockerfile
FROM node:20-bookworm-slim

WORKDIR /app

# textract 处理 PDF / Office 文档依赖的系统组件
RUN apt-get update && apt-get install -y --no-install-recommends \
    antiword \
    catdoc \
    poppler-utils \
    unrtf \
 && rm -rf /var/lib/apt/lists/*

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
