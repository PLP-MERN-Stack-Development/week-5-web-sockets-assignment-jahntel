// chat-backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Use CORS middleware to allow connections from your React app
app.use(cors({
    origin: 'http://localhost:3000', // Replace with your React app's URL if different
    methods: ['GET', 'POST']
}));

// Initialize Socket.io server
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Allow connections from your React app
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;

// Store connected users and their details
const onlineUsers = {}; // { socketId: { userId, username, room } }
const userSockets = {}; // { userId: socketId }

io.on('connection', (socket) => {
    const { userId, username } = socket.handshake.query;

    if (userId && username) {
        onlineUsers[socket.id] = { userId, username, room: 'global' };
        userSockets[userId] = socket.id; // Store socket ID by userId

        console.log(`User connected: ${username} (ID: ${userId}) - Socket ID: ${socket.id}`);

        // Notify all clients about the new online user
        io.emit('userOnline', { userId, username });
        // Send the full list of online users to the newly connected client
        socket.emit('onlineUsers', Object.values(onlineUsers).map(u => ({ userId: u.userId, username: u.username, status: 'online' })));

        // Join the default 'global' room
        socket.join('global');
    } else {
        console.log('Anonymous user connected (missing userId or username)');
    }

    // Handle joining a room
    socket.on('joinRoom', (roomName) => {
        const prevRoom = onlineUsers[socket.id]?.room;
        if (prevRoom && prevRoom !== roomName) {
            socket.leave(prevRoom);
            console.log(`${username} left room: ${prevRoom}`);
            // Optionally, notify others in the previous room
        }
        socket.join(roomName);
        if (onlineUsers[socket.id]) {
            onlineUsers[socket.id].room = roomName;
        }
        console.log(`${username} joined room: ${roomName}`);
        // Optionally, notify others in the new room
    });

    // Handle leaving a room
    socket.on('leaveRoom', (roomName) => {
        socket.leave(roomName);
        console.log(`${username} left room: ${roomName}`);
        if (onlineUsers[socket.id]) {
            onlineUsers[socket.id].room = null; // Or set to a default like 'disconnected'
        }
    });

    // Handle global messages
    socket.on('sendMessage', (message) => {
        console.log('Message received:', message);
        // Add a unique ID for the message on the server side
        const messageWithId = { ...message, id: Date.now().toString() + Math.random().toString(36).substring(2, 9) };
        io.to(message.room).emit('message', messageWithId); // Emit to all clients in the same room
    });

    // Handle private messages
    socket.on('privateMessage', ({ recipientId, ...message }) => {
        const recipientSocketId = userSockets[recipientId];
        if (recipientSocketId) {
            const messageWithId = { ...message, id: Date.now().toString() + Math.random().toString(36).substring(2, 9), room: `private:${recipientId}` };
            io.to(recipientSocketId).emit('privateMessage', messageWithId);
            // Also send to the sender's own private chat view
            io.to(socket.id).emit('privateMessage', messageWithId);
            console.log(`Private message from ${message.senderName} to ${recipientId}`);
        } else {
            console.log(`User ${recipientId} not found or offline for private message.`);
            // Optionally, send an error back to the sender
        }
    });

    // Handle typing indicator
    socket.on('typing', ({ userId: typingUserId, username: typingUsername, room }) => {
        socket.to(room).emit('typing', { userId: typingUserId, username: typingUsername });
    });

    socket.on('stopTyping', ({ userId: typingUserId, username: typingUsername, room }) => {
        socket.to(room).emit('stopTyping', { userId: typingUserId, username: typingUsername });
    });

    // Handle read receipts
    socket.on('readReceipt', ({ messageId, readerId, readerName }) => {
        // Broadcast the read receipt to all clients, or specifically to the sender of the message
        io.emit('readReceipt', { messageId, readerId, readerName });
        console.log(`Message ${messageId} read by ${readerName}`);
    });

    // Handle message reactions
    socket.on('messageReaction', ({ messageId, reaction, reactorId, reactorName }) => {
        // Broadcast the reaction to all clients
        io.emit('messageReaction', { messageId, reaction, reactorId, reactorName });
        console.log(`Message ${messageId} reacted with ${reaction} by ${reactorName}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const disconnectedUser = onlineUsers[socket.id];
        if (disconnectedUser) {
            delete onlineUsers[socket.id];
            delete userSockets[disconnectedUser.userId];
            console.log(`User disconnected: ${disconnectedUser.username} (ID: ${disconnectedUser.userId})`);
            io.emit('userOffline', { userId: disconnectedUser.userId, username: disconnectedUser.username });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Socket.io server listening on port ${PORT}`);
});
