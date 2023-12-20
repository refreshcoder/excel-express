# 使用 Node.js 的官方基础镜像
FROM node:14

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json 到工作目录
COPY package*.json ./

# 安装应用程序依赖
RUN npm install

# 复制应用程序的所有文件到工作目录
COPY . .

# 暴露应用程序运行的端口（根据你的Express应用程序配置）
EXPOSE 3300

# 定义启动命令
CMD ["node", "index.js"]
