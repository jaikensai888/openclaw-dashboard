#!/bin/bash

# Openclaw Dashboard 一键启动脚本
# 用于开发环境测试

set -e

cd "$(dirname "$0")"

echo "🚀 启动 Openclaw Dashboard..."

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，请先安装: npm install -g pnpm"
    exit 1
fi

# 从 .env 读取 server 端口，默认 3001
SERVER_PORT=$(grep -E "^SERVER_PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "3001")
WEB_PORT=3000

# 获取本机 IP 地址
LOCAL_IP=$(hostname -I | awk '{print $1}')

# 清理旧进程函数
kill_port() {
    local port=$1
    local pids=$(lsof -t -i:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "  正在停止端口 $port (pid: $pids)..."
        kill -9 $pids 2>/dev/null || true
    fi
}

# Kill 旧进程 - 使用更激进的方式
echo "🧹 清理旧进程..."

# 先用 pkill 杀掉所有相关进程
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "tsx watch.*openclaw-dashboard" 2>/dev/null || true
sleep 1

# 然后用端口清理确保干净
kill_port $WEB_PORT
kill_port $SERVER_PORT
kill_port $((SERVER_PORT + 1))
kill_port 3003  # 防止之前启动失败的残留

# 等待端口完全释放
sleep 2

# 确认端口已释放
for port in $WEB_PORT $SERVER_PORT $((SERVER_PORT + 1)) 3003; do
    if lsof -t -i:$port &>/dev/null; then
        echo "⚠️  端口 $port 仍被占用，强制清理..."
        kill -9 $(lsof -t -i:$port) 2>/dev/null || true
        sleep 1
    fi
done

echo "✅ 端口清理完成"

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    pnpm install
fi

# 启动开发服务器
echo ""
echo "🔧 启动开发服务器..."
echo "   ├─ Server API: http://localhost:$SERVER_PORT"
echo "   ├─ WebSocket:  ws://localhost:$SERVER_PORT/ws"
echo "   └─ Web UI:     http://localhost:$WEB_PORT"
echo ""
echo "   局域网访问:"
echo "   ├─ Server API: http://$LOCAL_IP:$SERVER_PORT"
echo "   └─ Web UI:     http://$LOCAL_IP:$WEB_PORT"
echo ""
echo "   按 Ctrl+C 停止所有服务"
echo "-------------------------------------------"

# 清理函数 - 退出时杀死所有子进程
cleanup() {
    echo ""
    echo "🛑 正在停止所有服务..."
    jobs -p | xargs -r kill 2>/dev/null || true
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "tsx watch.*openclaw-dashboard" 2>/dev/null || true
    echo "✅ 已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 设置环境变量让 Next.js 监听所有网络接口
export HOSTNAME=0.0.0.0

# 后台启动 server
echo "[$(date '+%H:%M:%S')] 启动后端服务..."
pnpm --filter @openclaw-dashboard/server dev &
SERVER_PID=$!

# 等待 server 启动
echo "[$(date '+%H:%M:%S')] 等待后端服务就绪..."
for i in {1..30}; do
    if curl -s "http://localhost:$SERVER_PORT/api/v1/conversations" &>/dev/null; then
        echo "[$(date '+%H:%M:%S')] ✅ 后端服务已就绪"
        break
    fi
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] ❌ 后端服务启动失败"
        exit 1
    fi
    sleep 0.5
done

# 启动 web
echo "[$(date '+%H:%M:%S')] 启动前端服务..."
pnpm --filter @openclaw-dashboard/web dev &
WEB_PID=$!

# 等待前端启动
sleep 5
echo "[$(date '+%H:%M:%S')] ✅ 前端服务已启动"

# 显示最终状态
echo ""
echo "==========================================="
echo "  服务已启动，访问地址："
echo "  Web:  http://$LOCAL_IP:3000"
echo "  API:  http://$LOCAL_IP:3002/api/v1"
echo "==========================================="

# 等待任一子进程退出
wait
