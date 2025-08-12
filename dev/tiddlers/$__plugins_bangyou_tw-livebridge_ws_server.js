/*\
title: $:/plugins/bangyou/tw-livebridge/ws/server.js
type: application/javascript
module-type: startup

\*/
(function () {
    "use strict";

    exports.name = "ws-server";
    exports.platforms = ["node"];
    exports.after = ["load-modules"];
    exports.synchronous = true;

    exports.startup = function () {
        $tw.hooks.addHook("th-server-command-post-start", function (simpleServer, httpServer, serverName) {
            const WebSocket = require("ws");
            const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });
            console.log("WebSocket server running at /ws");

            const clients = new Set();

            wss.on("connection", (ws) => {
                console.log('Client connected');
                clients.add(ws);
                ws.on("message", (msg) => {
                    let data;
                    try {
                        data = JSON.parse(msg);
                    } catch (e) {
                        console.error("Invalid WS message", msg);
                        return;
                    }
                    console.log("Received:", data);

                    // Relay to all other clients
                    clients.forEach(client => {
                        console.log("Relaying to client:", client.readyState);
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(data));
                            console.log("Relayed to client:", data);
                        }
                    });

                });

                ws.on("close", () => {
                    clients.delete(ws);
                });

                ws.on("error", () => {
                    clients.delete(ws);
                });
            });
        });
    };

})();

