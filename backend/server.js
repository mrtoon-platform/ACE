const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Game = require('./gameLogic');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Room code -> { game, players: [{id, socketId}] }
const rooms = new Map();

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', (playerName) => {
        const roomCode = generateRoomCode();
        const actualName = playerName || 'Host';
        rooms.set(roomCode, {
            game: null,
            players: [{ id: 0, socketId: socket.id, name: actualName }],
            hostId: socket.id
        });
        socket.join(roomCode);
        socket.emit('room_created', {
            roomCode,
            playerIndex: 0,
            playerName: actualName,
            players: rooms.get(roomCode).players.map(p => ({ id: p.id, name: p.name }))
        });
    });

    socket.on('join_room', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        // Check if this is a rejoin
        const existingPlayer = room.players.find(p => p.name === playerName);
        if (existingPlayer) {
            existingPlayer.socketId = socket.id;
            socket.join(code);

            if (room.game && room.game.isStarted) {
                socket.emit('game_started', {
                    hand: room.game.players[existingPlayer.id].hand,
                    gameState: {
                        ...room.game.getState(),
                        playerNames: room.players.map(pl => pl.name)
                    },
                    rejoined: true,
                    playerName: existingPlayer.name,
                    playerIndex: existingPlayer.id
                });
            } else {
                socket.emit('joined_room', {
                    roomCode: code,
                    playerIndex: existingPlayer.id,
                    playerName: existingPlayer.name,
                    players: room.players.map(p => ({ id: p.id, name: p.name }))
                });
            }
            return;
        }

        if (room.players.length >= 6) {
            socket.emit('error', 'Room is full (max 6 players)');
            return;
        }

        if (room.game && room.game.isStarted) {
            socket.emit('error', 'Game already in progress');
            return;
        }

        const playerIndex = room.players.length;
        const actualName = playerName || `Player ${playerIndex + 1}`;
        room.players.push({ id: playerIndex, socketId: socket.id, name: actualName });
        socket.join(code);

        socket.emit('joined_room', {
            roomCode: code,
            playerIndex,
            playerName: actualName,
            isHost: false,
            players: room.players.map(p => ({ id: p.id, name: p.name }))
        });

        io.to(code).emit('player_joined', {
            playersCount: room.players.length,
            players: room.players.map(p => ({ id: p.id, name: p.name }))
        });
    });

    socket.on('start_game', (roomCode) => {
        const room = rooms.get(roomCode.toUpperCase());
        if (!room) return;
        if (room.hostId !== socket.id) {
            socket.emit('error', 'Only the host can start the game');
            return;
        }
        if (room.players.length < 3) {
            socket.emit('error', 'Need at least 3 players to start');
            return;
        }

        // Initialize game with actual player count
        room.game = new Game(room.players.length);
        room.game.deal();

        room.players.forEach((p, idx) => {
            io.to(p.socketId).emit('game_started', {
                hand: room.game.players[idx].hand,
                gameState: {
                    ...room.game.getState(),
                    playerNames: room.players.map(pl => pl.name)
                }
            });
        });
    });

    socket.on('play_card', (data) => {
        const { roomCode, playerIndex, cardIndex } = data;
        const room = rooms.get(roomCode.toUpperCase());

        if (!room || !room.game) return;

        const result = room.game.playCard(playerIndex, cardIndex);

        if (result.error) {
            socket.emit('error', result.error);
        } else {
            io.to(roomCode).emit('update_state', {
                gameState: {
                    ...result.gameState,
                    playerNames: room.players.map(p => p.name)
                },
                lastMove: result
            });

            if (result.trickResolved) {
                room.players.forEach((p, idx) => {
                    io.to(p.socketId).emit('update_hand', room.game.players[idx].hand);
                });
            } else {
                socket.emit('update_hand', room.game.players[playerIndex].hand);
            }
        }
    });

    socket.on('send_message', (data) => {
        const { roomCode, message, playerName } = data;
        io.to(roomCode.toUpperCase()).emit('receive_message', {
            message,
            playerName,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('rejoin_room', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode.toUpperCase());
        if (!room) return;

        const player = room.players.find(p => p.name === playerName);
        if (player) {
            player.socketId = socket.id;
            socket.join(roomCode.toUpperCase());

            if (room.game && room.game.isStarted) {
                socket.emit('game_started', {
                    hand: room.game.players[player.id].hand,
                    gameState: {
                        ...room.game.getState(),
                        playerNames: room.players.map(pl => pl.name)
                    },
                    rejoined: true,
                    playerName: player.name,
                    playerIndex: player.id
                });
            } else {
                socket.emit('joined_room', {
                    roomCode: roomCode.toUpperCase(),
                    playerIndex: player.id,
                    playerName: player.name,
                    players: room.players.map(p => ({ id: p.id, name: p.name }))
                });
            }
        }
    });

    socket.on('disconnect', () => {
        for (const [code, room] of rooms.entries()) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (!player) continue;

            // Only remove player if game hasn't started
            if (!room.game || !room.game.isStarted) {
                room.players = room.players.filter(p => p.socketId !== socket.id);
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else if (room.hostId === socket.id) {
                    room.hostId = room.players[0].socketId;
                    io.to(room.players[0].socketId).emit('you_are_host');
                }

                io.to(code).emit('player_joined', {
                    playersCount: room.players.length,
                    players: room.players.map(p => ({ id: p.id, name: p.name }))
                });
            } else {
                // Game in progress, don't remove, just log or notify
                console.log(`Player ${player.name} disconnected from active game ${code}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
