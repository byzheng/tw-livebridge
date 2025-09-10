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
        let ws;
        async function initWSClient() {
            const isServer = await isNodeServerWiki();
            if (!isServer) {
                console.log("WS Client disabled: not running with Node.js server");
                return;
            }
            // Use default port 80 if loc.port is empty
            const port = loc.port ? loc.port : (loc.protocol === "https:" ? "443" : "80");

            const wsUrl = `ws://${loc.hostname}:${port}/ws`;

            if (ws && ws.readyState === WebSocket.OPEN) {
                return;
            }

            ws = new WebSocket(wsUrl);

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
            const MAX_RECONNECT_ATTEMPTS = 10;
            // Limit reconnect attempts to 10
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error(`WS reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Giving up.`);
                return;
            }
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
        };

        initWSClient();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!ws || ws.readyState === WebSocket.CLOSED) {
                    console.log("Page visible again - attempting WS reconnect");
                    initWSClient();
                }
            }
        });

    };

    async function openTiddlerInStoryRiver(title) {
        $tw.syncer.syncFromServer();

        await new Promise(resolve => setTimeout(resolve, 1000));


        const openLinkFromInsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromInsideRiver").fields.text;
        const openLinkFromOutsideRiver = $tw.wiki.getTiddler("$:/config/Navigation/openLinkFromOutsideRiver").fields.text;

        const story = new $tw.Story({ wiki: $tw.wiki });

        if (!$tw.wiki.tiddlerExists(title)) {
            console.warn("Tiddler does not exist:", title);
            return;
        }

        // Get the currently selected tiddler in the river
        let currentTiddler = null;
        const historyList = $tw.wiki.getTiddler("$:/HistoryList");
        if (historyList && historyList.fields && historyList.fields["current-tiddler"]) {
            currentTiddler = historyList.fields["current-tiddler"];
        }
        //console.log(isTiddlerElementInView(title));
        const tiddlersInStoryRiver = $tw.wiki.getTiddlerList("$:/StoryList");
        // Check if tiddler is already open in the story river
        if (tiddlersInStoryRiver.includes(title)) {
            return;
        }




        story.addToStory(title, currentTiddler, {
            openLinkFromInsideRiver,
            openLinkFromOutsideRiver
        });
        story.addToHistory(title);

    }

    function isTiddlerElementInView(title) {
        // Find the tiddler div in the StoryRiver by data-tiddler-title
        const selector = `div[data-tiddler-title="${title.replace(/"/g, '\\"')}"]`;
        const el = document.querySelector(selector);

        if (!el) {
            // Not even rendered
            return false;
        }

        // Check if element is within the viewport
        const rect = el.getBoundingClientRect();
        const inViewport = (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );

        return inViewport;
    }


})();
