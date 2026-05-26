function onTimerUpdatePlayerProgress(handle: number): void {
    var player = getPlayerByTimerHandle(handle);
    if (player) {
        //First Check to see if the player is playing
        if (player.Mode == "play") {
            player.Progress++;
            if (player.Duration > 0) {
                player.Remaining = player.Duration - player.Progress;
                player.ProgressBar = (Math.floor((player.Progress / player.Duration) * 100));
            }
            else {
                player.ProgressBar = 0;
                player.Remaining = 0;
            }

            updatePlayerProgressVariables(player);
            player.NowPlayingTimer.Start(onTimerUpdatePlayerProgress, 1000);
        }
    }
}

function onCommRx(data: string, handle: number): void {
    const server = getServerByConnectionHandle(handle);

    if(!server) { return; }

    const lines = data.split('\r\n');
    const httpData = data.split('\r\n\r\n');

    if (g_Print_Incoming_Raw) {
        System.Print("");
        System.Print(g_DriverName + "**********************OnCommRX Start************************************************************************************");
        System.Print("HTTPData.length =" + httpData.length);
        System.Print("Lines.length=" + lines.length);
        System.Print("server.ConnectionContentSize=" + server.ConnectionContentSize);
        printMaxLineSize(data);
        System.Print(g_DriverName + "**********************OnCommRX End*************************************************************************************");
        System.Print("");
    }

    if (lines.length == 3) {
        if (lines[1].indexOf("HTTP/1.1") > -1) {
            server.ConnectionIncomingData += lines[0];
        }
        else {
             //This should be now playing info
            parseIncomingJson(lines[1].replace(/\n|\r/g, ""), server);
            return;
        }
    }

    if (httpData.length > 1) {
        const extraData = httpData[0].split('\r\n');
        if (extraData.length > 1) {
            for (var d = 0; d < extraData.length; d++) {
                server.ConnectionIncomingData += extraData[d];
            }
        }
        server.ConnectionIncomingData += httpData[1];
    }
    else if (lines.length == 1) {
        server.ConnectionIncomingData += lines[0];
    }
    else if (lines.length == 2) {
        if (lines[1].length > 0) {
            if (lines[1].indexOf("HTTP") == -1) {
               server.ConnectionIncomingData = lines[1];
                server.ConnectionContentSize = parseInt(lines[0], 16);
            }
            else {
                server.ConnectionIncomingData += lines[0];
            }
        }
        else {
            server.ConnectionIncomingData += lines[0];
        }

    }
    else {
        server.ConnectionIncomingData += data;
    }

    const existingData = server.ConnectionIncomingData;

    //This should handle list and now playing data
    let processData = existingData.replace(/\n|\r/g, "");

    //System.Print(g_DriverName + ` processData.length: [${processData.length}], server.ConnectionContentSize: [${server.ConnectionContentSize}]`);

    if (processData.length == server.ConnectionContentSize) {
        server.ConnectionContentSize = 0;
        server.ConnectionIncomingData = "";
        parseIncomingJson(processData, server);
        return;
    }
    else if (processData.length > server.ConnectionContentSize && server.ConnectionContentSize > 0) {
        processData = processData.substring(0, server.ConnectionContentSize);
        server.ConnectionContentSize = 0;
        server.ConnectionIncomingData = "";
        parseUndelimitedJson(processData, server);
        return;
    }

    const openCount = (existingData.match(/[[]{/g) || []).length;
    const closeCount = (existingData.match(/}]/g) || []).length;
    if (openCount != 0 && closeCount != 0 && openCount == closeCount) {

        if (existingData.indexOf('play_random_favorite') > 0) {
            // handle random playlist

            server.ConnectionIncomingData = "";
            server.ConnectionContentSize = 0;
            
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

            System.Print(g_DriverName + ` Handling Random Playlist Request, server [${server.Ip}], player [${playerId}], requestedSubfolder [${requestedSubfolder}], folderTitle [${folderTitle}].`);

            if (folderTitle == "Favorites" && requestedSubfolder != "") {
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];

                    System.Print(g_DriverName + ` Examining result with name [${result.name}], hasItems [${result.hasitems}], isAudio [${result.isaudio}].`);

                    if (result.name.toUpperCase() == requestedSubfolder.toUpperCase() && result.hasitems && !result.isaudio) {
                        const json = `{"id": "${incomingJson["id"]}", "method": "slim.request", "params": ["", ["favorites", "items", 0, 100, "item_id:${result.id}"]]}`;

                        System.Print(g_DriverName + ` Found Favorites subfolder with name [${requestedSubfolder}], requesting contents.`);

                        sendJsonCommand(json, server, true);
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
                        playlistIds.push(result.id)
                    }
                }

                if (playlistIds.length > 0) {
                    const randomPlaylistIndex = Math.floor(Math.random() * playlistIds.length);
                    const randomPlaylistId = playlistIds[randomPlaylistIndex];
                    System.Print(g_DriverName + ` Playing random playlist [${randomPlaylistId}].`);
                    const json = `{"id": "play_playlist", "method": "slim.request", "params": ["${playerId}", ["favorites", "playlist", "play", "item_id:${randomPlaylistId}"]]}`;
                    sendJsonCommand(json, server, true);
                    return;
                }

                System.Print(g_DriverName + ` Found no eligible playlists in Favorites [${requestedSubfolder}] subfolder.`);
            }
        }

        /*
            Not sure the best way to frame this data.  
            it is possible for multiple json arrays to be here as well as other data we dont want,
            so clean it up before trying to parse it
        */
        const allData = existingData.split('\r\n');
        for (var i = 0; i < allData.length; i++) {
            const cleanJson = allData[i].substring(allData[i].indexOf("[{"), allData[i].lastIndexOf('}]') + 2);
            if (cleanJson.length > 10) {
                server.ConnectionIncomingData = "";
                server.ConnectionContentSize = 0;
                parseIncomingJson(cleanJson, server);
            }
        }
    }
    else {
        //If we haven't figured the data out after 100 tries,or we didn't find any open and closes, then clear out the data and reset the buffer count
        if (openCount == 0 && closeCount == 0 || server.BufferCount > 100) {
            server.ConnectionIncomingData = "";
            server.BufferCount = 0;
        }
        else {
            server.BufferCount++;
        }
        return;
    }
}

function onTimerSubscribeToPlayerStatus(handle: number): void {
    const player = getPlayerByTimerHandle(handle);

    if (!player) { return; }

    const json = '[{"id":-1,"data":{"response":"/' + player.Server.ClientId + '/slim/playerstatus/' + player.MacAddress + '","request":["' + player.MacAddress + '",["status","0",' + g_Max_Now_Playing_List_Size + ',"tags:uBJjdKlaAxcNory","subscribe:60"]]}' + ',"channel":"/slim/subscribe"}]'
    sendJsonCommand(json, player.Server);
}

function onTimerGetPlayers(handle: number): void {
    const server = getServerByConnectionHandle(handle);

    if (!server) { return; }

    // TODO: Figure out id = -1 argument
    const json = '[{"id":-1,"data":{"response":"/' + server.ClientId + '/slim/serverstatus","request":["",["serverstatus",0,999]]}' + ',"channel":"/slim/request"}]';
    sendJsonCommand(json, server);
}

function onConnection(handle: number): void {
    const server = getServerByConnectionHandle(handle);

    if (!server) { return; }

    //this will give us the clientid for this connection that will use for all future commands
    const json = '[{"channel":"/meta/handshake","version":"1.0","supportedConnectionTypes":["long-polling","streaming"]}]';
    sendJsonCommand(json, server);
}

function onDisconnect(handle: number): void {
    const server = getServerByConnectionHandle(handle);

    if (!server) { return; }

    //Enumerate all players and set their connected state to false
    updateConnectionState(server);
}

function onConnectionFailed(handle: number): void {
    const server = getServerByConnectionHandle(handle);

    if (!server) { return; }

    updateConnectionState(server);
}