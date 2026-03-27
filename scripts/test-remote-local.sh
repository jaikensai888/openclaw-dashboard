#!/bin/bash

# 完整的本地测试脚本
# 启动 dashboard-remote-server 和 Dashboard 进行端到端测试

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_ROOT="/home/palel/claude-project/openclaw-dashboard/.worktrees/remote-connection"

# 创建测试工作目录
TEST_WORKSPACE="$WORKTREE_ROOT/.test-workspace"

echo "================================================"
echo "  OpenClaw 远程连接本地测试"
echo "================================================"
echo ""

# 检查是否在 worktree 中
if [[ ! -d "$WORKTREE_ROOT/.git" ]]; then
    echo "错误: 请在 remote-connection worktree 中运行此脚本"
    exit 1
fi

# 创建测试目录
echo "创建测试工作目录..."
mkdir -p "$TEST_WORKSPACE"
mkdir -p "$TEST_WORKSPACE/logs"
mkdir -p "$TEST_WORKSPACE/workspace"

# 创建测试文件
echo "# 测试文件" > "$TEST_WORKSPACE/workspace/test.txt"
echo "这是一个测试文件的内容。" >> "$TEST_WORKSPACE/workspace/test.txt"
echo "创建于: $(date)" >> "$TEST_WORKSPACE/workspace/test.txt"

# 创建测试日志文件
echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: 测试日志行 1" > "$TEST_WORKSPACE/logs/app.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: 测试日志行 2" >> "$TEST_WORKSPACE/logs/app.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: 测试日志行 3" >> "$TEST_WORKSPACE/logs/app.log"

echo ""
echo "================================================"
echo "  测试环境已准备就绪"
echo "================================================"
echo ""
echo "测试工作目录: $TEST_WORKSPACE"
echo ""
echo "目录结构:"
ls -la "$TEST_WORKSPACE"
echo ""
echo "================================================"
echo "  启动步骤"
echo "================================================"
echo ""
echo "步骤 1: 启动 dashboard-remote-server (新终端)"
echo ""
echo "  cd $WORKTREE_ROOT/packages/dashboard-remote-server"
echo "  PORT=3001 \\"
echo "  AUTH_TOKEN=test-token-123 \\"
echo "  ALLOWED_ROOTS=$TEST_WORKSPACE \\"
echo "  pnpm dev"
echo ""
echo "步骤 2: 启动 Dashboard (新终端)"
echo ""
echo "  cd $WORKTREE_ROOT"
echo "  pnpm dev"
echo ""
echo "步骤 3: 在 Dashboard 中添加测试服务器"
echo ""
echo "  名称: 本地测试"
echo "  直连 URL: ws://127.0.0.1:3001"
echo "  认证 Token: test-token-123"
echo ""
echo "================================================"

# 询问是否自动启动
read -p "是否自动启动 dashboard-remote-server? (y/N) " -n 1 -r
AUTO_START="${REPLY:-n}"

if [[ "$AUTO_START" =~ ^[Yy]$ ]]; then
    echo ""
    echo "启动 dashboard-remote-server..."
    echo ""

    cd "$WORKTREE_ROOT/packages/dashboard-remote-server"
    PORT=3001 \
    AUTH_TOKEN=test-token-123 \
    ALLOWED_ROOTS="$TEST_WORKSPACE" \
    pnpm dev
fi
