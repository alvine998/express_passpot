const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");
require("dotenv").config();

const { connectDB, sequelize } = require("./config/database");
const { User } = require("./models");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io); // Make socket instance accessible in controllers

// Connect and Sync Database
connectDB().then(() => {
  // Sync models (force: false means it won't drop tables if they exist)
  sequelize.sync({ force: false }).then(() => {
    console.log("Database & tables created!");
  });
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for Swagger UI
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/status", require("./routes/statusRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/calls", require("./routes/callRoutes"));
app.use("/api/news", require("./routes/newsRoutes"));
app.use("/api/friends", require("./routes/friendRoutes"));

// Swagger Documentation
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Basic Route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Passpot API (MySQL/Sequelize)" });
});

// Socket.io
const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Register user ID to socket mapping
  socket.on("register-user", async (userId) => {
    if (userId) {
      userSocketMap.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
      console.log(`User ${userId} registered with socket ${socket.id}`);

      // Notify friends that this user is online
      try {
        const user = await User.findByPk(userId, {
          include: [
            {
              model: User,
              as: "friends",
              attributes: ["id"],
              through: { attributes: [] },
            },
            {
              model: User,
              as: "addedBy",
              attributes: ["id"],
              through: { attributes: [] },
            },
          ],
        });

        if (user) {
          const allFriendIds = [
            ...user.friends.map((f) => f.id),
            ...user.addedBy.map((f) => f.id),
          ]; // Deduplication happens via Map lookup anyway if needed, but array is fine for iteration

          allFriendIds.forEach((friendId) => {
            const friendSocketId = userSocketMap.get(friendId.toString());
            if (friendSocketId) {
              // Notify friend that I am online
              io.to(friendSocketId).emit("user-online", {
                userId: userId.toString(),
              });

              // Notify ME that friend is online
              socket.emit("user-online", { userId: friendId.toString() });
            }
          });
        }
      } catch (err) {
        console.error("Error broadcasting online status:", err);
      }
    }
  });

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId.toString());
    console.log(`User ${socket.id} joined conversation: ${conversationId}`);
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(conversationId.toString());
    console.log(`User ${socket.id} left conversation: ${conversationId}`);
  });

  // WebRTC Signaling Handshake (using User IDs)
  socket.on("call-user", (data) => {
    console.log("[call-user] Received:", JSON.stringify(data));

    if (!data || !data.to) {
      console.log("[call-user] ERROR: Missing recipient 'to' field");
      socket.emit("call-error", { message: "Recipient ID required" });
      return;
    }

    const receiverSocketId = userSocketMap.get(data.to.toString());
    console.log("[call-user] Receiver socket ID:", receiverSocketId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-made", {
        offer: data.offer,
        from: socket.userId,
        callerName: data.callerName || "Unknown",
        type: data.type || "audio",
      });
      console.log("[call-user] call-made event sent to:", receiverSocketId);
    } else {
      console.log("[call-user] Receiver not connected, userId:", data.to);
      socket.emit("call-error", { message: "User is offline" });
    }
  });

  socket.on("make-answer", (data) => {
    console.log("[make-answer] Received:", JSON.stringify(data));

    if (!data || !data.to) {
      console.log("[make-answer] ERROR: Missing recipient 'to' field");
      return;
    }

    const callerSocketId = userSocketMap.get(data.to.toString());
    if (callerSocketId) {
      io.to(callerSocketId).emit("answer-made", {
        answer: data.answer,
        from: socket.userId,
      });
    }
  });

  socket.on("ice-candidate", (data) => {
    if (!data || !data.to) {
      console.log(
        "[ice-candidate] ERROR: Missing recipient 'to' field in data:",
        JSON.stringify(data),
      );
      return;
    }

    const targetSocketId = userSocketMap.get(data.to.toString());
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", {
        candidate: data.candidate,
        from: socket.userId,
      });
    } else {
      console.log("[ice-candidate] Target user offline or not found:", data.to);
    }
  });

  // Handle call rejection
  socket.on("reject-call", (data) => {
    if (data && data.to) {
      const callerSocketId = userSocketMap.get(data.to.toString());
      if (callerSocketId) {
        io.to(callerSocketId).emit("call-rejected", {
          from: socket.userId,
        });
      }
    }
  });

  // Handle call end
  socket.on("end-call", (data) => {
    console.log("[end-call] Received:", JSON.stringify(data));
    if (data && data.to) {
      const targetSocketId = userSocketMap.get(data.to.toString());
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-ended", {
          from: socket.userId,
        });
      } else {
        console.log("[end-call] Target socket not found for ID:", data.to);
      }
    } else {
      console.log("[end-call] ERROR: Missing 'to' field in event");
    }
  });

  socket.on("disconnect", async () => {
    if (socket.userId) {
      const userId = socket.userId;
      userSocketMap.delete(userId);
      console.log(`User ${userId} disconnected`);

      // Notify friends that this user is offline
      try {
        const user = await User.findByPk(userId, {
          include: [
            {
              model: User,
              as: "friends",
              attributes: ["id"],
              through: { attributes: [] },
            },
            {
              model: User,
              as: "addedBy",
              attributes: ["id"],
              through: { attributes: [] },
            },
          ],
        });

        if (user) {
          const allFriendIds = [
            ...user.friends.map((f) => f.id),
            ...user.addedBy.map((f) => f.id),
          ];

          allFriendIds.forEach((friendId) => {
            const friendSocketId = userSocketMap.get(friendId.toString());
            if (friendSocketId) {
              io.to(friendSocketId).emit("user-offline", {
                userId: userId.toString(),
              });
            }
          });
        }
      } catch (err) {
        console.error("Error broadcasting offline status:", err);
      }
    } else {
      console.log("User disconnected:", socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };
