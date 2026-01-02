#!/bin/bash
# Start Time Capsule with HTTPS

echo "Starting Time Capsule with HTTPS..."
echo "Make sure to accept the self-signed certificate warning in your browser!"
echo ""

# Start Backend with HTTPS
cd backend
TLS_CERT="./certs/cert.pem"
TLS_KEY="./certs/key.pem"
export TLS_CERT
export TLS_KEY
go run cmd/api/main.go &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"
echo "Backend: https://localhost:8080"
cd ..

# Start Frontend with HTTPS
cd frontend
node https-server.js &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"
echo "Frontend: https://localhost:3443"
cd ..

echo ""
echo "=========================================="
echo "Time Capsule is running with HTTPS!"
echo "=========================================="
echo "Frontend: https://localhost:3443"
echo "Backend:  https://localhost:8080"
echo ""
echo "From other machines on your network:"
echo "Frontend: https://$(hostname -I | awk '{print $1}'):3443"
echo "Backend:  https://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=========================================="

# Handle Ctrl+C to stop both servers
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

wait
