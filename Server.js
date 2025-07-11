
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // Allow requests from your React app
    methods: ['GET', 'POST'],
  },
});

// Use CORS middleware for Express routes (if you have any, useful for API endpoints)
app.use(cors());

// Basic Express route (optional, but good for testing server)
app.get('/', (req, res) => {
  res.send('Socket.IO Server is running!');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`⚡️ User connected: ${socket.id}`);

  // Listen for a 'test_message' event from the client
  socket.on('test_message', (data) => {
    console.log(`Received message from client ${socket.id}: ${data}`);
    // Emit a 'response_message' back to the client
    socket.emit('response_message', `Server received: "${data}"`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000; // Use port 5000 for the server

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
