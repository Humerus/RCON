var http = require("http"),
    express = require('express'),
    request = require('request'),
    session = require('express-session'),
    fs = require('fs'),
    sshClient = require('ssh2').Client,
    Rcon = require('rcon'),
    WebSocketServer = require('ws').Server,
    morgan = require('morgan');
    app = express(),
    server = http.createServer(app),
    wss = new WebSocketServer({
        server: server,
        path: "/ws"
    });

clients = {};

app.use(session({
    secret: 'swiggitySw00ty!',
    resave: true,
    saveUninitialized: true
}));

app.use(morgan("combined"));

app.use(express.static('static'));

app.get('/', function(req, res) {
    res.send("Home!");
});

wss.on("connection", function(ws) {
    var wsip = ws._socket.remoteAddress;
    ws.on("message", function(msg) {
        if (isJson(msg)) {
            var stuff = JSON.parse(msg);
            switch (stuff.type) {
                case "createSession":
                    if (wsip in clients) {
                        ws.send(JSON.stringify({
                            type: "sessionConnected",
                            msg: "You are still connected to a server!"
                        }));
                    } else {
                        clients[wsip] = new Rcon(stuff.msg.ip, stuff.msg.port, stuff.msg.password);
                        clients[wsip].on('auth', function() {
                            //console.log("Authed!");
                            ws.send(JSON.stringify({
                                type: "authed",
                                msg: true
                            }));
                        }).on('response', function(str) {
                            //console.log("Got response: " + str);
                            ws.send(JSON.stringify({
                                type: "response",
                                msg: str
                            }));
                        }).on('end', function() {
                            //console.log("Socket closed!");
                            if (wsip in clients && clients[wsip].hasAuthed) {
                                delete clients[wsip];
                                ws.send(JSON.stringify({
                                    type: "sessionClosed",
                                    msg: "Your session has ended"
                                }));
                            }
                        }).on('error', function(err) {
                            //console.log(err);
                            ws.send(JSON.stringify({
                                type: "authed",
                                msg: false
                            }));
                            ws.send(JSON.stringify({
                                type: "error",
                                msg: err.message
                            }));
                        });
                        clients[wsip].connect();
                    }
                    break;
                case "sendMessage":
                    if (wsip in clients) {
                        clients[wsip].send(stuff.msg);
                    } else {
                        ws.send(JSON.stringify({
                            type: "notConnected",
                            msg: "You are not connected to a server!"
                        }));
                    }
                    break;
                case "checkSession":
                    if (wsip in clients) {
                        ws.send(JSON.stringify({
                            type: "connected",
                            msg: "You are still connected to the server"
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: "notConnected",
                            msg: "You are not connected to a server!"
                        }));
                    }
                    break;
            }
        }
    });

    ws.on('close', function() {
        //console.log(wsip);
        if (wsip in clients) {
            clients[wsip].disconnect();
            delete clients[wsip];
        }
    });
});

function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

server.listen(8080);
console.log("Server started on :8080");
