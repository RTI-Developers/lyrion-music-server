class Server {
	Connection: TCP;
    ClientId: string;
	Players: Player[] = [];
    Ip: string;
    Port: number;
    ServerVersion: number = 0;
    ConnectionIncomingData: string = "";
    ConnectionContentSize: number = 0;
    BufferCount: number = 0;
    Connected: boolean = false;
    StartUpTimer: Timer = new Timer();

    constructor(
        ip: string,
        port: number,
        onCommRx: (data: string, handle: number) => void,
        onConnect: (handle: number) => void,
        onDisconnect: (handle: number) => void
    ) {
        this.Ip = ip;
        this.Port = port;

        this.Connection = new TCP(onCommRx, ip, port);
        this.Connection.UseHandleInCallbacks = true;
        this.Connection.OnConnectFunc = onConnect;
        this.Connection.OnDisconnectFunc = onDisconnect;

        //Used when a new client id has been made[reconnected] will go out and get a list of all the players from the server
        this.StartUpTimer.UseHandleInCallbacks = true;
    }

    sendJsonCommand(json: string, isRpc: boolean = false): void {
        dbg('sendJsonCommand sending Command: ' + json + ' to Server: ' + this.Ip);
        let command = "POST /cometd HTTP/1.1\r\n" +
                      "Content-Length: " + json.length + "\r\n" +
                      "Content-Type: application/json\r\n\r\n";

        if (isRpc) {
            command = "POST /jsonrpc.js HTTP/1.1\r\n" +
                      "Content-Length: " + json.length + "\r\n\r\n";
        }

        command += json + "\r\n\r\n";

        this.Connection.Write(command);

        if (g_Print_Posts) {
            System.Print("");
            System.Print(g_DriverName + "  **Sending the following Command with http header to " + this.Ip + "****");
            var test = command.split('\r\n');
            for (let i = 0; i < test.length; i++) {
                printMaxLineSize(test[i]);
            }
            System.Print(g_DriverName + "****End Post****");
            System.Print("");
        }
    }

    handleConnection(): void {
        const json = '[{"channel":"/meta/handshake","version":"1.0","supportedConnectionTypes":["long-polling","streaming"]}]';
        this.sendJsonCommand(json);
    }

    handleDisconnect(): void {
        for (let i = 0; i < this.Players.length; i++) {
            this.Players[i].Connected = false;
            this.Players[i].updateVariables();
        }
    }

    requestPlayerList(): void {
        const json = '[{"id":-1,"data":{"response":"/' + this.ClientId + '/slim/serverstatus","request":["",["serverstatus",0,999]]}' + ',"channel":"/slim/request"}]';
        this.sendJsonCommand(json);
    }

    handleIncomingData(data: string): void {
        const lines = data.split('\r\n');
        const httpData = data.split('\r\n\r\n');

        if (g_Print_Incoming_Raw) {
            System.Print("");
            System.Print(g_DriverName + "**********************OnCommRX Start************************************************************************************");
            System.Print("HTTPData.length =" + httpData.length);
            System.Print("Lines.length=" + lines.length);
            System.Print("ConnectionContentSize=" + this.ConnectionContentSize);
            printMaxLineSize(data);
            System.Print(g_DriverName + "**********************OnCommRX End*************************************************************************************");
            System.Print("");
        }

        if (lines.length == 3) {
            if (lines[1].indexOf("HTTP/1.1") > -1) {
                this.ConnectionIncomingData += lines[0];
            }
            else {
                this.parseIncomingJson(lines[1].replace(/\n|\r/g, ""));
                return;
            }
        }

        if (httpData.length > 1) {
            const extraData = httpData[0].split('\r\n');
            if (extraData.length > 1) {
                for (var d = 0; d < extraData.length; d++) {
                    this.ConnectionIncomingData += extraData[d];
                }
            }
            this.ConnectionIncomingData += httpData[1];
        }
        else if (lines.length == 1) {
            this.ConnectionIncomingData += lines[0];
        }
        else if (lines.length == 2) {
            if (lines[1].length > 0) {
                if (lines[1].indexOf("HTTP") == -1) {
                    this.ConnectionIncomingData = lines[1];
                    this.ConnectionContentSize = parseInt(lines[0], 16);
                }
                else {
                    this.ConnectionIncomingData += lines[0];
                }
            }
            else {
                this.ConnectionIncomingData += lines[0];
            }
        }
        else {
            this.ConnectionIncomingData += data;
        }

        const existingData = this.ConnectionIncomingData;

        let processData = existingData.replace(/\n|\r/g, "");

        if (processData.length == this.ConnectionContentSize) {
            this.ConnectionContentSize = 0;
            this.ConnectionIncomingData = "";
            this.parseIncomingJson(processData);
            return;
        }
        else if (processData.length > this.ConnectionContentSize && this.ConnectionContentSize > 0) {
            processData = processData.substring(0, this.ConnectionContentSize);
            this.ConnectionContentSize = 0;
            this.ConnectionIncomingData = "";
            this.parseUndelimitedJson(processData);
            return;
        }

        const openCount = (existingData.match(/[[]{/g) || []).length;
        const closeCount = (existingData.match(/}]/g) || []).length;
        if (openCount != 0 && closeCount != 0 && openCount == closeCount) {

            if (existingData.indexOf('play_random_favorite') > 0) {
                this.ConnectionIncomingData = "";
                this.ConnectionContentSize = 0;

                if (g_Print_Incoming_Raw) {
                    System.Print(g_DriverName + "***** Start Existing Data*******");
                    printMaxLineSize(existingData);
                    System.Print(g_DriverName + "***** End Existing Data*******");
                }

                const cleanJson = existingData.substring(existingData.indexOf("{"), existingData.lastIndexOf('}') + 1);
                let incomingJson = getJson(cleanJson);

                if (g_Print_Incoming_Json) {
                    System.Print(g_DriverName + "***** Start Incoming JSON Data*******");
                    printMaxLineSize(incomingJson);
                    System.Print(g_DriverName + "***** End Incoming JSON Data*******");
                }

                const playerId: string = incomingJson["id"].split("::")[1];
                const requestedSubfolder: string = incomingJson["id"].split("::")[2] ?? "";
                const folderTitle: string = incomingJson["result"]["title"];
                const results: FavoriteResponse[] = incomingJson["result"]["loop_loop"];

                System.Print(g_DriverName + ` Handling Random Playlist Request, server [${this.Ip}], player [${playerId}], requestedSubfolder [${requestedSubfolder}], folderTitle [${folderTitle}].`);

                if (folderTitle == "Favorites" && requestedSubfolder != "") {
                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];

                        System.Print(g_DriverName + ` Examining result with name [${result.name}], hasItems [${result.hasitems}], isAudio [${result.isaudio}].`);

                        if (result.name.toUpperCase() == requestedSubfolder.toUpperCase() && result.hasitems && !result.isaudio) {
                            const json = `{"id": "${incomingJson["id"]}", "method": "slim.request", "params": ["", ["favorites", "items", 0, 100, "item_id:${result.id}"]]}`;

                            System.Print(g_DriverName + ` Found Favorites subfolder with name [${requestedSubfolder}], requesting contents.`);

                            this.sendJsonCommand(json, true);
                            return;
                        }
                    }

                    System.Print(g_DriverName + ` Unable to find Favorites subfolder with name [${requestedSubfolder}].`);
                }
                else {
                    System.Print(g_DriverName + ` Searching for random playlist from Favorites subfolder [${requestedSubfolder}].`);

                    const playlistIds: string[] = [];

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];

                        if (result.type == "playlist" && result.hasitems && result.isaudio) {
                            System.Print(g_DriverName + ` Adding playlist [${result.name}] to potential random playlist options.`);
                            playlistIds.push(result.id);
                        }
                    }

                    if (playlistIds.length > 0) {
                        const randomPlaylistIndex = Math.floor(Math.random() * playlistIds.length);
                        const randomPlaylistId = playlistIds[randomPlaylistIndex];
                        System.Print(g_DriverName + ` Playing random playlist [${randomPlaylistId}].`);
                        const json = `{"id": "play_playlist", "method": "slim.request", "params": ["${playerId}", ["favorites", "playlist", "play", "item_id:${randomPlaylistId}"]]}`;
                        this.sendJsonCommand(json, true);
                        return;
                    }

                    System.Print(g_DriverName + ` Found no eligible playlists in Favorites [${requestedSubfolder}] subfolder.`);
                }
            }

            const allData = existingData.split('\r\n');
            for (var i = 0; i < allData.length; i++) {
                const cleanJson = allData[i].substring(allData[i].indexOf("[{"), allData[i].lastIndexOf('}]') + 2);
                if (cleanJson.length > 10) {
                    this.ConnectionIncomingData = "";
                    this.ConnectionContentSize = 0;
                    this.parseIncomingJson(cleanJson);
                }
            }
        }
        else {
            if (openCount == 0 && closeCount == 0 || this.BufferCount > 100) {
                this.ConnectionIncomingData = "";
                this.BufferCount = 0;
            }
            else {
                this.BufferCount++;
            }
        }
    }

    private parseIncomingJson(data: string): void {
        if (data == "[]") return;
        const httpIndex = data.indexOf(']HTTP/');
        if (httpIndex > -1) {
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
            if (incomingJson[1] != undefined) {
                incomingJson = incomingJson[1];
            }
            else {
                incomingJson = incomingJson[0];
            }

            if (incomingJson["data"] != undefined) {
                if (incomingJson["data"]["item_loop"] != undefined) {
                    parseMenu(incomingJson, this);
                }
                else if (incomingJson["data"]["players_loop"] != undefined) {
                    this.ServerVersion = incomingJson["data"]["version"];
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

                        player.MacAddress = playerData["playerid"].toLowerCase();
                        player.Connected = playerData.connected;

                        player.NowPlayingTimer.Stop();
                        player.NowPlayingTimer.Start(onTimerSubscribeToPlayerStatus, delay);
                        delay = delay + 1500;

                        const paddedPlayerId = padDigit(player.Id);
                        SystemVars.Write("ConnectedP" + paddedPlayerId, true);
                        SystemVars.Write("NotConnectedP" + paddedPlayerId, false);

                        const json = '[{"id":"' + player.Id + '_-1","data":{"response":"/' + this.ClientId + '/slim/request","request":["' + player.MacAddress + '",["menu","items",0,' + g_Max_Poll_Count + ',"menu:opml_generic","direct:1"]]}' + ',"channel":"/slim/request"}]';
                        this.sendJsonCommand(json);
                    }
                }
                else if (incomingJson["data"]["player_name"] != undefined) {
                    for (let i = 0; i < nowPlayingJson.length; i++) {
                        const statusData = nowPlayingJson[i];
                        if (statusData["data"] == undefined) { continue; }
                        let player: Player | null = null;
                        for (let j = 0; j < this.Players.length; j++) {
                            if (this.Players[j].Name == statusData["data"]["player_name"]) {
                                player = this.Players[j];
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
                    if (this.ClientId != clientId) {
                        this.ClientId = clientId;
                        const json = '[{"connectionType":"streaming","channel":"/meta/connect","clientId":"' + this.ClientId + '"}' + ',{"subscription":"/' + this.ClientId + '/**","channel":"/meta/subscribe","clientId":"' + this.ClientId + '"}]';
                        this.sendJsonCommand(json);
                        this.StartUpTimer.Start(onTimerGetPlayers, 2000);
                    }
                }
            }
        }
        else {
            System.Print("**********************Not JSON*********************************");
            printMaxLineSize(data);
            this.ConnectionIncomingData = "";
            this.BufferCount = 0;
            System.Print("**********************End Not JSON*********************************");
        }
    }

    private parseUndelimitedJson(existingData: string): void {
        const openCount = (existingData.match(/[[]{/g) || []).length;
        const closeCount = (existingData.match(/}]/g) || []).length;
        if (openCount != 0 && closeCount != 0 && openCount == closeCount) {
            const json = existingData.substring(existingData.indexOf("[{"), existingData.lastIndexOf('}]') + 2);
            this.parseIncomingJson(json);
        }
    }
}
