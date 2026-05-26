function sendJsonCommand(json: string, server: Server, isRpc: boolean = false): void {
    dbg('sendJsonCommand sending Command: ' + json + ' to Server: ' + server.Ip);
    let command = "POST /cometd HTTP/1.1\r\n" +
                  "Content-Length: " + json.length + "\r\n" +
                  "Content-Type: application/json\r\n\r\n";

    if (isRpc) {
        command = "POST /jsonrpc.js HTTP/1.1\r\n" +
                  "Content-Length: " + json.length + "\r\n\r\n"
    }

    command += json + "\r\n\r\n";

    server.Connection.Write(command);

    if (g_Print_Posts) {
        System.Print("");
        System.Print(g_DriverName + "  **Sending the following Command with http header to " + server.Ip + "****");
        var test = command.split('\r\n');
        for (let i = 0; i < test.length; i++) {
            printMaxLineSize(test[i]);
        }
        System.Print(g_DriverName + "****End Post****");
        System.Print("");
    }
}

function parseIncomingJson(data: string, server: Server): void {
    if (data == "[]") return;  //cometd will return a blank arrary
    const httpIndex = data.indexOf(']HTTP/');
    if (httpIndex > -1) {
        //System.Print("HTTP Data Found in JSON so strip it out");
        data = data.substring(0, httpIndex + 1);
    }
    if (g_Print_Incoming_Json) {
        System.Print(g_DriverName + "***** Start Incoming JSON Data*******");
        printMaxLineSize(data);
        System.Print(g_DriverName + "***** End Incoming JSON Data*******");
    }

    let incomingJson = getJson(data);
    const nowPlayingJson = incomingJson;
    if (incomingJson != false) {
        //All data is returned in a array item, if there are 2 items in the parent array from testing it looks like the data we want to parse is in the 2nd item
        if (incomingJson[1] != undefined) {
            incomingJson = incomingJson[1];
        }
        else {
            incomingJson = incomingJson[0];
        }

        if (incomingJson["data"] != undefined) {
            if (incomingJson["data"]["item_loop"] != undefined) {
                //PrintOutResults(Data);
                parseMenu(incomingJson, server);
            }
            else if (incomingJson["data"]["players_loop"] != undefined) {
                server.ServerVersion = incomingJson["data"]["version"];
                let delay = 5000;
                for (let i = 0; i < incomingJson["data"]["players_loop"].length; i++) {
                    const playerData = incomingJson["data"]["players_loop"][i];
                    const playerName = playerData["name"];

                    let player: Player | null = null;
                    for (let i = 0; i < g_Players.length; i++) {
                        if (g_Players[i].Name == playerName) {
                            player = g_Players[i];
                            break;
                        }
                    }

                    if (!player) {
                        dbg("Didn't find match for Player with name: " + playerName);
                        continue;
                    }

                    //The Player is setup to be controlled
                    player.MacAddress = playerData["playerid"].toLowerCase();
                    player.Connected = playerData.connected;

                    //We need to subscribe to this player, so we get feedback
                    player.NowPlayingTimer.Stop();
                    player.NowPlayingTimer.Start(onTimerSubscribeToPlayerStatus, delay);
                    //slow down the subscription requests.  With out adding in a delay here, the server subscription wasn't working for all players
                    delay = delay + 1500;

                    const paddedPlayerId = padDigit(player.Id);
                    SystemVars.Write("ConnectedP" + paddedPlayerId, true);
                    SystemVars.Write("NotConnectedP" + paddedPlayerId, false);

                    //Now go get the Parent Menu for this player.
                    const json = '[{"id":"' + player.Id + '_-1","data":{"response":"/' + server.ClientId + '/slim/request","request":["' + player.MacAddress + '",["menu","items",0,' + g_Max_Poll_Count + ',"menu:opml_generic","direct:1"]]}' + ',"channel":"/slim/request"}]';
                    sendJsonCommand(json, server);
                }
            }
            else if (incomingJson["data"]["player_name"] != undefined) {
                //There could be data here for more the one player, so recheck. This happens when players are synced
                for (let i = 0; i < nowPlayingJson.length; i++) {
                    const statusData = nowPlayingJson[i];
                    if (statusData["data"] == undefined) { continue; }
                    let player: Player | null = null;
                    for (let j = 0; j < server.Players.length; j++) {
                        if (server.Players[j].Name == statusData["data"]["player_name"]) {
                            player = server.Players[j];
                            break;
                        }
                    }
                    if (player) { player.applyStatusUpdate(statusData); }
                }
            }
        }
        else {
            if (incomingJson["clientId"] != undefined) {
                const clientId = incomingJson["clientId"];
                //System.Print("Found a new ClientID=" + ClientID);
                if (server.ClientId != clientId) {
                    server.ClientId = clientId;
                    //Tell CometD that we want to be notified of data (this must be sent before we can subscribe to any players)
                    const json = '[{"connectionType":"streaming","channel":"/meta/connect","clientId":"' + server.ClientId + '"}' + ',{"subscription":"/' + server.ClientId + '/**","channel":"/meta/subscribe","clientId":"' + server.ClientId + '"}]';
                    //System.Print("JSON=" + JSON);
                    sendJsonCommand(json, server);
                    //The above command is supposed to send a acknowledgement however I'm nto seeing one, so I'm going to assume that we are good, and start subscribing to all setup players for this connection
                    //We have a client ID, so go get a list of the players attached to this server
                    server.StartUpTimer.Start(onTimerGetPlayers, 2000);
                }
            }
        }
    }
    else {
        System.Print("**********************Not JSON*********************************");
        printMaxLineSize(data);
        server.ConnectionIncomingData = "";
        server.BufferCount = 0;
        System.Print("**********************End Not JSON*********************************");
    }
}

function parseUndelimitedJson(existingData: string, server: Server): void {
    const openCount = (existingData.match(/[[]{/g) || []).length;
    const closeCount = (existingData.match(/}]/g) || []).length;
    if (openCount != 0 && closeCount != 0 && openCount == closeCount) {
        //We should only have a single json string here
        const json = existingData.substring(existingData.indexOf("[{"), existingData.lastIndexOf('}]') + 2);
        parseIncomingJson(json, server);
    }
}

