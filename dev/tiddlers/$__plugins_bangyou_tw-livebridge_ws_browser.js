/*\
title: $:/plugins/bangyou/tw-livebridge/ws/browser.js
type: application/javascript
module-type: startup
\*/
(function () {
    "use strict";

    exports.name = "ws-client";
    exports.platforms = ["browser"];
    exports.after = ["startup"];
    exports.synchronous = true;

    exports.startup = function () {

        async function isNodeServerWiki() {
            try {
                const response = await fetch("/status", { method: "GET" });
                if (response.ok) {
                    const data = await response.json();
                    return !!data.space; // or check for other server-only properties
                }
                return false;
            } catch (err) {
                return false;
            }
        }
        if (!$tw.browser) {
            console.warn("WS client disabled: not running in browser");
            return;
        }
        const loc = window.location;
        if (loc.protocol === "file:") {
            console.warn("WS client disabled: running from local file");
            return;
        }

        // Validate hostname and port
        if (!loc.hostname) {
            console.warn("WS client disabled: hostname is empty");
            return;
        }
        (async function initWSClient() {
            const isServer = await isNodeServerWiki();
            if (!isServer) {
                console.log("WS Client disabled: not running with Node.js server");
                return;
            }
            // Use default port 80 if loc.port is empty
            const port = loc.port ? loc.port : (loc.protocol === "https:" ? "443" : "80");

            const wsUrl = `ws://${loc.hostname}:${port}/ws`;
            const ws = new WebSocket(wsUrl);

            ws.addEventListener("open", () => {
                console.log("Connected to WS server");
            });

            ws.addEventListener("message", (event) => {
                let data;
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    console.error("Invalid WS data", event.data);
                    return;
                }
                // console.log("WS message in browser:", data);

                if (data.type === "open-tiddler" && data.title) {
                    openTiddlerInStoryRiver(data.title);
                }
            });

            // Reconnect logic
            let reconnectAttempts = 0;
            const maxReconnectDelay = 30000; // 3 seconds

            function reconnectWS() {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
                console.warn(`WS disconnected. Reconnecting in ${delay / 1000}s...`);
                setTimeout(() => {
                    initWSClient();
                }, delay);
            }

            ws.addEventListener("close", reconnectWS);
            ws.addEventListener("error", (e) => {
                console.error("WS error:", e);
                ws.close();
            });
            // console.log($tw.rootWidget);
            $tw.rootWidget.addEventListener("tm-open-in-vscode", function (event) {
                const title = event.param;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "edit-tiddler", title }));
                } else {
                    console.warn("WebSocket not connected");
                }
                return true; // stops bubbling
            });
        })();

    };

    function openTiddlerInStoryRiver(title) {
        const openLinkFromInsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromInsideRiver").fields.text;
        const openLinkFromOutsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromOutsideRiver").fields.text;

        const currentTiddler = $tw.wiki.getTiddler("$:/storyList")?.fields?.currentTiddler || ""; // or some fallback

        const story = new $tw.Story({ wiki: $tw.wiki });

        if ($tw.wiki.tiddlerExists(title)) {
            story.addToStory(title, currentTiddler, {
                openLinkFromInsideRiver,
                openLinkFromOutsideRiver
            });
            story.addToHistory(title);
        } else {
            console.warn("Tiddler does not exist:", title);
        }
    }

})();
