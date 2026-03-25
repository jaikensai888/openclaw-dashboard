/** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

// 读取根目录 .env 文件 (apps/web -> apps -> root)
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf-8');

  // 解析 SERVER_PORT
  const portMatch = envContent.match(/^SERVER_PORT=(\d+)/m);
  const port = portMatch ? portMatch[1] : '3002';
  process.env.NEXT_PUBLIC_SERVER_PORT = port;

  // 解析 NEXT_PUBLIC_API_URL（优先使用 .env 中的配置）
  const apiUrlMatch = envContent.match(/^NEXT_PUBLIC_API_URL=(.+)$/m);
  if (apiUrlMatch) {
    process.env.NEXT_PUBLIC_API_URL = apiUrlMatch[1].trim();
  } else {
    process.env.NEXT_PUBLIC_API_URL = `http://localhost:${port}/api/v1`;
  }

  // 注意：不设置 NEXT_PUBLIC_WS_URL 的默认值
  // 让前端代码在运行时动态检测 hostname，避免硬编码 localhost
  // 只有在 .env 中明确设置了 NEXT_PUBLIC_WS_URL 时才使用
  const wsUrlMatch = envContent.match(/^NEXT_PUBLIC_WS_URL=(.+)$/m);
  if (wsUrlMatch) {
    process.env.NEXT_PUBLIC_WS_URL = wsUrlMatch[1].trim();
  }
  // 不设置默认值，让 useWebSocket.ts 中的运行时检测生效
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SERVER_PORT: process.env.NEXT_PUBLIC_SERVER_PORT || '3002',
    // 不设置 NEXT_PUBLIC_WS_URL，让前端代码在运行时动态生成
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1',
  },
  // 允许局域网 IP 访问开发服务器
  allowedDevOrigins: ['192.168.0.74'],
};

module.exports = nextConfig;
