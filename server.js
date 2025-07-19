const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);
  
  socket.on("create-room", (callback) => {
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomId] = {
      players: [{ id: socket.id, symbol: "X" }],
      board: Array(9).fill(null),
      currentPlayer: "X",
      isGameOver: false,
      winner: null,
    };
    socket.join(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
    callback({ roomId, playerSymbol: "X" });
  });

  // Join an existing room
  socket.on("join-room", (roomId, callback) => {
    const room = rooms[roomId];
    if (room && room.players.length === 1) {
      room.players.push({ id: socket.id, symbol: "O" });
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
      // Notify both players that the game can start
      io.to(roomId).emit("game-start", room);
      callback({ success: true, playerSymbol: "O" });
    } else {
      callback({ success: false, message: "Room not found or is full." });
    }
  });

  socket.on("make-move", ({ roomId, index, playerSymbol }) => {
    // --- THIS IS THE LINE TO ADD ---
    console.log(
      `[Server] Received 'make-move' from ${playerSymbol} for room ${roomId} at index ${index}`
    );
    // -------------------------------

    const room = rooms[roomId];
    if (
      !room ||
      room.isGameOver ||
      room.currentPlayer !== playerSymbol ||
      room.board[index]
    ) {
      // Add a log here too, to see WHY it's failing
      console.log(
        `[Server] Invalid move rejected. Reason: room=${!!room}, isGameOver=${
          room?.isGameOver
        }, isCurrentPlayer=${
          room?.currentPlayer === playerSymbol
        }, isCellEmpty=${!room?.board[index]}`
      );
      return; // Invalid move
    }

    room.board[index] = playerSymbol;
    const winner = calculateWinner(room.board);

    if (winner) {
      room.isGameOver = true;
      room.winner = winner;
    } else {
      room.currentPlayer = room.currentPlayer === "X" ? "O" : "X";
    }

    // Broadcast the updated game state to everyone in the room
    io.to(roomId).emit("game-update", room);
  });
  socket.on("play-again", ({ roomId }) => {
    console.log(`[Server] Received 'play-again' request for room ${roomId}`);
    const room = rooms[roomId];

    if (room) {
      // Reset the game state but keep the players
      room.board = Array(9).fill(null);
      room.currentPlayer = "X"; // Player X always starts the new game
      room.isGameOver = false;
      room.winner = null;

      console.log(
        `[SERVER] Broadcasting 'game-update' to room ${roomId} with fresh board.`
      );
      // -------------------

      // Notify both players in the room of the new game state
      io.to(roomId).emit("game-update", room);
      console.log(`[Server] Room ${roomId} has been reset for a new game.`);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex > -1) {
        // Notify the other player that their opponent left
        socket.to(roomId).emit("opponent-left");
        delete rooms[roomId]; // Clean up the room
        console.log(`Room ${roomId} closed due to disconnect.`);
        break;
      }
    }
  });
});

// Helper function (can be copied from our client)
const calculateWinner = (board) => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
};

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
