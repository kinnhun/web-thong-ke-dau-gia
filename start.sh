#!/bin/bash

cd "$(dirname "$0")"

echo ""
echo "================================================"
echo "  Dang khoi dong du an..."
echo "  Frontend: http://localhost:1234"
echo "================================================"
echo ""

# Mo trinh duyet sau 3 giay
(sleep 3 && open "http://localhost:1234") &

# Chay du an
npm run start
