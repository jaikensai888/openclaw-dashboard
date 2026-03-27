#!/bin/bash

# 本地远程连接功能测试脚本
# 用法: ./scripts/test-local-remote.sh

set -e

echo "================================================"
echo "  本地远程连接功能测试"
echo "================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "项目根目录: $PROJECT_ROOT"
echo ""

# 创建测试工作空间
TEST_WORKSPACE="/tmp/openclaw-test-workspace"
echo -e "${YELLOW}步骤 1: 创建测试工作空间${NC}"
mkdir -p "$TEST_WORKSPACE"
echo "  创建目录: $TEST_WORKSPACE"
echo ""

# 创建测试文件
echo -e "${YELLOW}步骤 2: 创建测试文件${NC}"
echo "Hello, this is a test file from remote server!" > "$TEST_WORKSPACE/test.txt"
echo '{"name": "test", "value": 123}' > "$TEST_WORKSPACE/config.json"
mkdir -p "$TEST_WORKSPACE/subdir"
echo "Subdirectory content" > "$TEST_WORKSPACE/subdir/nested.txt"
echo "  创建测试文件完成"
echo ""

# 启动 dashboard-remote-server
echo -e "${YELLOW}步骤 3: 启动 dashboard-remote-server${NC}"
echo ""
echo "环境变量:"
echo "  PORT=3001"
echo "  AUTH_TOKEN=test-token-123"
echo "  ALLOWED_ROOTS=$TEST_WORKSPACE"
echo ""

cd "$PROJECT_ROOT/packages/dashboard-remote-server"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装 dashboard-remote-server 依赖..."
    pnpm install
fi

# 构建项目
echo "构建 dashboard-remote-server..."
pnpm run build

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  dashboard-remote-server 启动中...${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "WebSocket URL: ws://127.0.0.1:3001"
echo "认证 Token: test-token-123"
echo "允许访问的目录: $TEST_WORKSPACE"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
PORT=3001 \
AUTH_TOKEN=test-token-123 \
ALLOWED_ROOTS="$TEST_WORKSPACE" \
node dist/index.js
