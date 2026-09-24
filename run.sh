#!/usr/bin/env bash
set -e

PORT=${1:-8000}
echo "============================================================"
echo " Starting CRESTON PREMIUM COLLECTIONS Store Engine"
echo " Motto: Quality, Style, Trust"
echo " Port:  http://localhost:${PORT}"
echo " Admin: http://localhost:${PORT}/admin.html"
echo "============================================================"

python3 server/app.py "$PORT"
