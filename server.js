global.__dirname = __dirname;

const {Server: wsServer} = require("ws");
const wsHandler = require("./ws-handler.js");
const port = process.env.PORT || 81;

const wss = new wsServer({port}); ///////////////////////////////

wss.on("connection", wsHandler);
