#!/data/data/com.termux/files/usr/bin/bash

echo ""
echo "  🛩️  TermuxPilot Launcher"
echo "  ──────────────────────"
echo ""

# Kill any existing instance
pkill -f "node.*pilot.js" 2>/dev/null
sleep 1

# Enable wake lock
termux-wake-lock 2>/dev/null

# Start in background
cd ~/termuxpilot
nohup node pilot.js > ~/termuxpilot/pilot.log 2>&1 &
PID=$!

echo "  ✅ TermuxPilot started (PID: $PID)"
echo "  📊 Dashboard: http://127.0.0.1:8000"
echo "  📝 Logs: ~/termuxpilot/pilot.log"
echo ""
echo "  Commands:"
echo "  ─────────"
echo "  pilot-stop    → Stop TermuxPilot"
echo "  pilot-logs    → View live logs"
echo "  pilot-status  → Check if running"
echo "  pilot-open    → Open dashboard"
echo ""

# Auto-open browser
sleep 2
am start -a android.intent.action.VIEW -d http://127.0.0.1:8000 2>/dev/null || termux-open-url http://127.0.0.1:8000 2>/dev/null

echo "  🌐 Dashboard opened in browser"
echo ""
