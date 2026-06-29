const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const YOUTUBE_API_KEY = "process.env.YOUTUBE_API_KEY";

app.use(express.static(path.join(__dirname, 'public')));

const roomUsers = {};

io.on('connection', (socket) => {
    socket.on('join_room', ({ userName, roomCode }) => {
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userName = userName;

        if (!roomUsers[roomCode]) roomUsers[roomCode] = [];
        roomUsers[roomCode].push({ id: socket.id, name: userName });

        io.to(roomCode).emit('update_user_list', roomUsers[roomCode]);
    });

    socket.on('search_song', async (query) => {
        try {
            const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
                params: { part: 'snippet', maxResults: 1, q: query, type: 'video', key: YOUTUBE_API_KEY }
            });
            if (response.data.items.length > 0) {
                io.to(socket.roomCode).emit('receive_video', { 
                    videoId: response.data.items[0].id.videoId, 
                    videoTitle: response.data.items[0].snippet.title 
                });
            }
        } catch (err) { console.error("API Error:", err.message); }
    });

    socket.on('send_play', () => io.to(socket.roomCode).emit('receive_play'));
    socket.on('send_pause', () => io.to(socket.roomCode).emit('receive_pause'));

    // NEW: Handle chat messages
    socket.on('chat_message', (msg) => {
        io.to(socket.roomCode).emit('receive_message', { name: socket.userName, msg: msg });
    });

    socket.on('disconnect', () => {
        if (socket.roomCode && roomUsers[socket.roomCode]) {
            roomUsers[socket.roomCode] = roomUsers[socket.roomCode].filter(u => u.id !== socket.id);
            io.to(socket.roomCode).emit('update_user_list', roomUsers[socket.roomCode]);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
