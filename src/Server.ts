class Server {
    private bodyBytesExpected: number = 0;
    private rawBuffer: string = "";

    public readonly Connection: TCP;
    public readonly Ip: string;
	public readonly Players: Player[] = [];
    public readonly Port: number;
    public readonly StartUpTimer: Timer = new Timer();

    public ClientId: string = "";

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

    public sendJsonCommand(json: string, isRpc: boolean = false): void {
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

    public handleConnection(): void {
        this.resetParserState();
        SystemVars.Write("ServerConnected", true);
        const request: LyrionHandshakeRequest = { channel: "/meta/handshake", version: "1.0", supportedConnectionTypes: ["long-polling", "streaming"] };
        this.sendJsonCommand(JSON.stringify([request]));
    }

    public handleDisconnect(): void {
        SystemVars.Write("ServerConnected", false);
        for (let i = 0; i < this.Players.length; i++) {
            this.Players[i].Connected = false;
            this.Players[i].NowPlayingTimer.Stop();
            this.Players[i].updateVariables();
        }
    }

    public requestPlayerList(): void {
        const json = buildSlimRequestJson(
            undefined,
            undefined,
            this.ClientId,
            "slim/serverstatus",
            "",
            [LyrionCmd.ServerStatus, 0, 999]);
        this.sendJsonCommand(json);
    }

    public handleIncomingData(data: string): void {
        if (g_Print_Incoming_Raw) {
            System.Print("");
            System.Print(g_DriverName + "**********************OnCommRX Start************************************************************************************");
            System.Print("CLBody=" + this.bodyBytesExpected + " Buffer=" + this.rawBuffer.length + " Incoming=" + data.length);
            printMaxLineSize(data);
            System.Print(g_DriverName + "**********************OnCommRX End*************************************************************************************");
            System.Print("");
        }
        this.rawBuffer += data;
        this.processBuffer();
    }

    private resetParserState(): void {
        this.rawBuffer = "";
        this.bodyBytesExpected = 0;
    }

    private processBuffer(): void {
        while (this.rawBuffer.length > 0) {
            if (this.bodyBytesExpected > 0) {
                // Waiting for the rest of a Content-Length body
                if (this.rawBuffer.length < this.bodyBytesExpected) return;
                const body = this.rawBuffer.substring(0, this.bodyBytesExpected);
                this.rawBuffer = this.rawBuffer.substring(this.bodyBytesExpected);
                this.bodyBytesExpected = 0;
                this.parseIncomingJson(body);
            } else if (this.rawBuffer.indexOf('HTTP/') === 0) {
                // New HTTP response — consume headers
                const sep = this.rawBuffer.indexOf('\r\n\r\n');
                if (sep === -1) return;
                const headers = this.rawBuffer.substring(0, sep);
                this.rawBuffer = this.rawBuffer.substring(sep + 4);
                const clIdx = headers.indexOf('Content-Length:');
                if (clIdx > -1) {
                    const lineEnd = headers.indexOf('\r\n', clIdx);
                    const clStr = lineEnd > -1
                        ? headers.substring(clIdx + 15, lineEnd)
                        : headers.substring(clIdx + 15);
                    this.bodyBytesExpected = parseInt(clStr, 10);
                }
                // Transfer-Encoding: chunked — chunks follow and are parsed as chunk frames below
            } else {
                // Chunk frame: <hex size>\r\n<data>\r\n
                const crlfIdx = this.rawBuffer.indexOf('\r\n');
                if (crlfIdx === -1) return;
                const chunkSize = parseInt(this.rawBuffer.substring(0, crlfIdx), 16);
                if (isNaN(chunkSize) || chunkSize < 0) {
                    // Skip unrecognised line
                    this.rawBuffer = this.rawBuffer.substring(crlfIdx + 2);
                    continue;
                }
                if (chunkSize === 0) {
                    // Terminal chunk — consume size line + trailing CRLF
                    this.rawBuffer = this.rawBuffer.substring(crlfIdx + 2);
                    if (this.rawBuffer.indexOf('\r\n') === 0) {
                        this.rawBuffer = this.rawBuffer.substring(2);
                    }
                    continue;
                }
                const needed = crlfIdx + 2 + chunkSize + 2;
                if (this.rawBuffer.length < needed) return;
                const chunkData = this.rawBuffer.substring(crlfIdx + 2, crlfIdx + 2 + chunkSize);
                this.rawBuffer = this.rawBuffer.substring(crlfIdx + 2 + chunkSize + 2);
                this.parseIncomingJson(chunkData);
            }
        }
    }

    private isCustomCommandResponse(data: string) : boolean {
        return (data.indexOf('play_random_favorite') > 0);
    }

    private handleCustomCommandResponse(data: string): void {
        if (data.indexOf('play_random_favorite') > 0) {
            const cleanJson = data.substring(data.indexOf("{"), data.lastIndexOf('}') + 1);

            if (g_Print_Incoming_Json) {
                System.Print(g_DriverName + "***** Start Incoming JSON Data*******");
                printMaxLineSize(cleanJson);
                System.Print(g_DriverName + "***** End Incoming JSON Data*******");
            }

            const rpcResponse = parseLyrionRpc(cleanJson);
            if (rpcResponse === false) {
                System.Print(g_DriverName + " Failed to parse play_random_favorite RPC response.");
                return;
            }

            const idParts = rpcResponse.id.split("::");
            const playerId: string = idParts[1];
            const requestedSubfolder: string = idParts[2] ?? "";
            const folderTitle: string = rpcResponse.result.title ?? "";
            const results: LyrionFavoriteItem[] = rpcResponse.result.loop_loop ?? [];

            System.Print(g_DriverName + ` Handling Random Playlist Request, server [${this.Ip}], player [${playerId}], requestedSubfolder [${requestedSubfolder}], folderTitle [${folderTitle}].`);

            if (folderTitle == "Favorites" && requestedSubfolder != "") {
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];

                    System.Print(g_DriverName + ` Examining result with name [${result.name}], hasItems [${result.hasitems}], isAudio [${result.isaudio}].`);

                    if (result.name.toUpperCase() == requestedSubfolder.toUpperCase() && result.hasitems && !result.isaudio) {
                        const json = buildRpcRequestJson(rpcResponse.id, "", [LyrionCmd.Favorites, LyrionFavoritesCmd.Items, 0, 100, "item_id:" + result.id]);

                        System.Print(g_DriverName + ` Found Favorites subfolder with name [${requestedSubfolder}], requesting contents.`);

                        this.sendJsonCommand(json, true);
                        return;
                    }
                }

                System.Print(g_DriverName + ` Unable to find Favorites subfolder with name [${requestedSubfolder}].`);
            } else {
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
                    const json = buildRpcRequestJson("play_playlist", playerId, [LyrionCmd.Favorites, LyrionFavoritesCmd.Playlist, LyrionPlaylistCmd.Play, "item_id:" + randomPlaylistId]);
                    this.sendJsonCommand(json, true);
                    return;
                }

                System.Print(g_DriverName + ` Found no eligible playlists in Favorites [${requestedSubfolder}] subfolder.`);
            }
        }
    }

    private parseIncomingJson(data: string): void {
        if (data == "[]") return;

        if (this.isCustomCommandResponse(data)) {
            this.handleCustomCommandResponse(data);
            return;
        }

        if (g_Print_Incoming_Json) {
            System.Print(g_DriverName + "***** Start Incoming JSON Data*******");
            printMaxLineSize(data);
            System.Print(g_DriverName + "***** End Incoming JSON Data*******");
        }

        const messages = parseLyrionCometd(data);
        if (messages === false) {
            System.Print("**********************Not JSON*********************************");
            printMaxLineSize(data);
            System.Print("**********************End Not JSON*********************************");
            return;
        }

        const incomingMsg = messages.length > 1 ? messages[1] : messages[0];

        if (incomingMsg.data !== undefined) {
            if (isLyrionMenuData(incomingMsg.data)) {
                parseMenu(incomingMsg, this);
            }
            else if (isLyrionServerStatus(incomingMsg.data)) {
                const serverData = incomingMsg.data;
                SystemVars.Write("ServerVersion", serverData.version);
                let delay = 5000;
                for (let i = 0; i < serverData.players_loop.length; i++) {
                    const playerData = serverData.players_loop[i];
                    const playerName = playerData.name;

                    let player: Player | null = null;
                    for (let j = 0; j < g_Players.length; j++) {
                        if (g_Players[j].Name == playerName) {
                            player = g_Players[j];
                            break;
                        }
                    }

                    if (!player) {
                        dbg("Didn't find match for Player with name: " + playerName);
                        continue;
                    }

                    player.MacAddress = playerData.playerid.toLowerCase();
                    player.Connected = playerData.connected === 1;

                    player.NowPlayingTimer.Stop();
                    player.NowPlayingTimer.Start(onTimerSubscribeToPlayerStatus, delay);
                    delay = delay + 1500;

                    const paddedPlayerId = padDigit(player.Id);
                    SystemVars.Write("ConnectedP" + paddedPlayerId, true);
                    SystemVars.Write("NotConnectedP" + paddedPlayerId, false);

                    const json = buildSlimRequestJson(
                        player.Id,
                        undefined,
                        this.ClientId,
                        g_Slim_Request,
                        player.MacAddress,
                        [LyrionCmd.Menu, "items", 0, g_Max_Poll_Count, "menu:opml_generic", "direct:1"]);
                    this.sendJsonCommand(json);
                }
            }
            else if (isLyrionPlayerStatus(incomingMsg.data)) {
                for (let i = 0; i < messages.length; i++) {
                    const statusMsg = messages[i];
                    if (statusMsg.data === undefined || !isLyrionPlayerStatus(statusMsg.data)) { continue; }
                    const statusInfo = statusMsg.data;
                    let player: Player | null = null;
                    for (let j = 0; j < this.Players.length; j++) {
                        if (this.Players[j].Name == statusInfo.player_name) {
                            player = this.Players[j];
                            break;
                        }
                    }
                    if (player) { player.applyStatusUpdate(statusInfo); }
                }
            }
        }
        else {
            if (incomingMsg.clientId !== undefined) {
                const clientId = incomingMsg.clientId;
                if (this.ClientId != clientId) {
                    this.ClientId = clientId;
                    const connect: LyrionMetaConnectRequest = { connectionType: "streaming", channel: "/meta/connect", clientId: this.ClientId };
                    const subscribe: LyrionMetaSubscribeRequest = { subscription: "/" + this.ClientId + "/**", channel: "/meta/subscribe", clientId: this.ClientId };
                    this.sendJsonCommand(JSON.stringify([connect, subscribe]));
                    this.StartUpTimer.Start(onTimerGetPlayers, 2000);
                }
            }
        }
    }
}
