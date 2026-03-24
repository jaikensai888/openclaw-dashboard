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

  // 解析 NEXT_PUBLIC_WS_URL（优先使用 .env 中的配置）
  const wsUrlMatch = envContent.match(/^NEXT_PUBLIC_WS_URL=(.+)$/m);
  if (wsUrlMatch) {
    process.env.NEXT_PUBLIC_WS_URL = wsUrlMatch[1].trim();
  } else {
    process.env.NEXT_PUBLIC_WS_URL = `ws://localhost:${port}/ws`;
  }
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SERVER_PORT: process.env.NEXT_PUBLIC_SERVER_PORT || '3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  },
  // 允许局域网 IP 访问开发服务器
  allowedDevOrigins: ['192.168.0.74'],
};

module.exports = nextConfig;
