#!/data/data/com.termux/files/usr/bin/bash

echo ""
echo "  🛩️  Stopping TermuxPilot..."

pkill -f "node.*pilot.js" 2>/dev/null
termux-wake-unlock 2>/dev/null

echo "  ✅ TermuxPilot stopped"
echo ""
