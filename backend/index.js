const express = require("express");
const socketio = require("socket.io");
const http = require("http");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public"))); 

// Store connected users
const connectedUsers = new Map();

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    socket.on("user-joined", (userData) => {
        connectedUsers.set(socket.id, userData);
        io.emit("user-joined", Array.from(connectedUsers.values()));
    });

    socket.on("send-location", (data) => {
        const userData = connectedUsers.get(socket.id);
        if (userData) {
            io.emit("recive-location", {
                username: userData.username,
                ...data,
            });
        }
    });

    socket.on("disconnect", () => {
        connectedUsers.delete(socket.id);
        io.emit("user-left", Array.from(connectedUsers.values()));
    });
});

app.get("/", (req, res) => {
    res.render("index");
});

server.listen(8000, () => console.log("Server running on http://localhost:8000"));




