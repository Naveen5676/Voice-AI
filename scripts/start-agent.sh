#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}/agent"
export PORT="${PORT:-8080}"

echo "Starting LiveKit Agent on port ${PORT}..."
python src/agent.py start
