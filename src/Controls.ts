function printHomeMenuImpl(remotePlayer: RemotePlayer): void {
    let outputString = "";
    for (var i = 0; i < remotePlayer.Player.ParentMenu.ListItems.length; i++) {
        var Title = remotePlayer.Player.ParentMenu.ListItems[i].MenuTitle;
        outputString += Title + ":";
    }

    System.LogInfo(1, outputString.substring(0, outputString.length - 1));
}

function printNowPlayingUrlImpl(remotePlayer: RemotePlayer): void {
    System.LogInfo(1, remotePlayer.Player.Name + "  " + remotePlayer.Player.NowPlayingUrl);
}

function playerPowerImpl(remotePlayer: RemotePlayer, power: number): void {
    if (power == 3) { //Toggle
        if (remotePlayer.Player.PoweredOn) {
            power = 0;
        }
        else {
            power = 1;
        }
    }
    var JSON = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["power",' + power + ']]}' + ',"channel":"/slim/request"}]';
    sendJsonCommand(JSON, remotePlayer.Player.Server);
}

function playerVolumeImpl(remotePlayer: RemotePlayer, todo: string, volume: number): void {
    if (todo == "up") {
        remotePlayer.Player.Volume++;
        if (remotePlayer.Player.Volume > 100) { remotePlayer.Player.Volume = 100; }
        volume = remotePlayer.Player.Volume;

    }
    else if (todo == "down") {
        remotePlayer.Player.Volume--;
        if (remotePlayer.Player.Volume < 0) { remotePlayer.Player.Volume = 0; }
        volume = remotePlayer.Player.Volume;
    }

    let json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["mixer","volume",' + volume + ']]}' + ',"channel":"/slim/request"}]';

    if (todo.indexOf("muting") > -1) {
        let muteOff = "";
        if (todo.indexOf(" ") > -1) {
            muteOff = parseInt(todo.substring(todo.indexOf(" ")), 10).toString();
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["mixer","muting",' + muteOff + ']]}' + ',"channel":"/slim/request"}]';
        }
        else {
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["mixer","muting"' + ']]}' + ',"channel":"/slim/request"}]';
        }
    }
    sendJsonCommand(json, remotePlayer.Player.Server);
}

function jumptoPlayPositionImpl(remotePlayer: RemotePlayer, location: number): void {
    if (remotePlayer.Player.CanSeek == true) {
        var Position = Math.round((location / 100) * remotePlayer.Player.Duration);
        //Try to help with live feedback on the scrub bar so it doesn't move again after change(keeps it from jumping forward or backwards after the update)
        remotePlayer.Player.NowPlayingTimer.Stop();
        remotePlayer.Player.Progress = Position;
        remotePlayer.Player.Remaining = remotePlayer.Player.Duration - remotePlayer.Player.Progress;
        remotePlayer.Player.ProgressBar = (Math.floor((Position / remotePlayer.Player.Duration) * 100));
        const json = '[{ "id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '", "data": { "request": ["' + remotePlayer.Player.MacAddress + '", ["time", ' + Position + ']], "response": "/' + remotePlayer.Player.Server.ClientId + '/slim/request" }' + ', "channel": "/slim/request" }]';
        sendJsonCommand(json, remotePlayer.Player.Server);
    }
}

function transportImpl(remotePlayer: RemotePlayer, command: string): void {
    const startJson = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["';
    let action = "";
    switch (command) {
        case "play":
        case "pause":
        case "stop":
            action = command;
            break;
        case "next":
            action = 'button", "jump_fwd';
            break;
        case "previous":
            action = 'button", "jump_rew';
            break;
        case "pandora_love":
            action = 'pandora","rate","1';
            break;
        case "pandora_ban":
            action = 'pandora","rate","0';
            break;
        case "shuffle":
        case "repeat":
            action = 'button", "' + command;
            break;
    }
    const endJson = '"]]}' + ',"channel":"/slim/request"}]';
    const json = startJson + action + endJson;
    sendJsonCommand(json, remotePlayer.Player.Server);
}

function browseSubMenuTestImpl(remotePlayer: RemotePlayer): void {
        const json = '[{"id":"' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["opml_generic","items",0,100,"menu:opml_generic","item_id:f8c2a3df.0","useContextMenu:1"]]}' + ',"channel":"/slim/request"}]';
        sendJsonCommand(json, remotePlayer.Player.Server);
}

function syncListSelectionImpl(remotePlayer: RemotePlayer, index: number, syncType: string): void {
    const masterPlayer = remotePlayer.Player;
    const slavePlayerName = g_Player_Names_SysVarList.ReadAt(index);

    if (masterPlayer.Name == slavePlayerName) { return ;}

    let slavePlayer: Player | null = null;
    for (let i = 0; i > g_Players.length; i++) {
        if (g_Players[i].Name == slavePlayerName) {
            slavePlayer = g_Players[i];
            break;
        }
    }

    if (!slavePlayer) { return; }

    //We need to first make sure the player is attached to the same server as the master player to sync from
    if (masterPlayer.Server != slavePlayer.Server) { return; }

    let isAdd = true;
    switch (syncType) {
        case "Variable":
            isAdd = (SystemVars.Read("SyncP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id) == true);
            break;
        case "Sync":
            isAdd = true;
            break;
        case "ReleaseSync":
            isAdd = false;
            break;
        case "Toggle":  //Check to see if the player is synced.
            if (slavePlayer.SyncSlave == undefined) {
                slavePlayer.SyncSlave = false;
            }

            if (slavePlayer.IsSynced == true) {
                isAdd = false;
            }
            break;
    }

    //Remove Sync json
    let json = isAdd ?
        '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + masterPlayer.Server.ClientId + '/slim/request","request":["' + masterPlayer.MacAddress + '",["sync","' + slavePlayer.MacAddress + '"]]}' + ',"channel":"/slim/request"}]' :
        '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + masterPlayer.Server.ClientId + '/slim/request","request":["' + slavePlayer.MacAddress + '",["sync","' + '-' + '"]]}' + ',"channel":"/slim/request"}]';

    json = json.replace(/\//g, "\\/");
    sendJsonCommand(json, masterPlayer.Server);
}

function playListSelectionImpl(remotePlayer: RemotePlayer, index: number): void {
    //Check to see the mode we are in (Play or More options)
    const editMode = SystemVars.Read("PlayListSelectModeP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id);

    const lastItem = remotePlayer.LastPlayListSelectedItem;
    remotePlayer.NowPlayingList.Open();
    if (editMode == true) {
        remotePlayer.NowPlayingList.ModifyAt(lastItem, "(" + (lastItem + 1) + ") " + remotePlayer.Player.Playlist[lastItem].Title);

        if (remotePlayer.PlaylistItemSelected == false) {
            var NewItemTitle = remotePlayer.NowPlayingList.ReadAt(index);
            remotePlayer.NowPlayingList.ModifyAt(index, " --- " + NewItemTitle + " --- ");
            remotePlayer.LastPlayListSelectedItem = index;
            remotePlayer.PlaylistItemSelected = true;
        }
        else {
            remotePlayer.PlaylistItemSelected = false;
        }

    }
    else {
        remotePlayer.NowPlayingList.ModifyAt(lastItem, "(" + (lastItem + 1) + ") " + remotePlayer.Player.Playlist[lastItem].Title);
        const json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["playlist","index",' + index + ']]}' + ',"channel":"/slim/request"}]';
        sendJsonCommand(json, remotePlayer.Player.Server);
    }
    remotePlayer.NowPlayingList.Close();
}

function adjustPlaylistImpl(remotePlayer: RemotePlayer, todo: string): void {
    const fromLocation = remotePlayer.LastPlayListSelectedItem;
    let newLocation = fromLocation;
    let command = "move";
    switch (todo) {
        case "moveup":
        case "movedown":
        case "delete":
            if (todo == "movedown") {
                newLocation++;
                if (newLocation > remotePlayer.Player.Playlist.length - 1) {
                    newLocation--;
                }
            }
            else if (todo == "moveup") {
                if (newLocation > 0) {
                    newLocation--;
                }
            }
            else if (todo == "delete") {
                command = "delete";
            }
            /*
            0 = ItemID
            1 = OrigLocation
            2 = NewLocation
            3 = Move or Delete (Actual Command)
            */

            remotePlayer.NowPlayingList.Open();
            if (todo == "moveup" || todo == "movedown") {
                const title = " --- (##) " + remotePlayer.Player.Playlist[fromLocation].Title + " --- ";
                remotePlayer.Player.Playlist = moveArrayItem(remotePlayer.Player.Playlist, fromLocation, newLocation);
                remotePlayer.NowPlayingList.RemoveAt(fromLocation);
                remotePlayer.NowPlayingList.InsertAt(newLocation, title);
                remotePlayer.LastPlayListSelectedItem = newLocation;

                let topWindow = newLocation - 1;
                if (topWindow < 0) { topWindow = 0; }
                remotePlayer.NowPlayingList.SetIndexes(newLocation, topWindow);
            }
            remotePlayer.NowPlayingList.Close();
            let updated = false;

            const itemIdItemID = remotePlayer.Player.Playlist[newLocation].Id;
            remotePlayer.PlayListItemNewLocation = newLocation;
            for (let i = 0; i < remotePlayer.PlayListChangeCommands.length; i++) {
                if (remotePlayer.PlayListChangeCommands[i][0] == itemIdItemID) {
                    remotePlayer.PlayListItemOrigLocation = remotePlayer.PlayListChangeCommands[i][1];
                    remotePlayer.PlayListChangeCommands[i][2] = newLocation;
                    remotePlayer.PlayListChangeCommands[i][3] = command;
                    updated = true;
                    break;
                }
            }
            if (updated == false) { //We need to add a new item
                remotePlayer.PlayListChangeCommands.push([itemIdItemID, fromLocation, newLocation, command]);
            }
            if (g_Debug == true) {
                System.Print("");
                System.Print("g_Remote_Info[RemoteID].PlayListChangeCommands.length=" + remotePlayer.PlayListChangeCommands.length);
                for (let i = 0; i < remotePlayer.PlayListChangeCommands.length; i++) {
                    System.Print("ItemID=" + remotePlayer.PlayListChangeCommands[i][0]);
                    System.Print("OrigLocation=" + remotePlayer.PlayListChangeCommands[i][1]);
                    System.Print("New Location=" + remotePlayer.PlayListChangeCommands[i][2]);
                    System.Print("Command=" + remotePlayer.PlayListChangeCommands[i][3]);
                }
                System.Print("g_Remote_Info[RemoteID].LastPlayListSelectedItem=" + remotePlayer.LastPlayListSelectedItem);
            }
            break;

        case "save":
            break;
    }
}

function saveDefaultStartupImpl(remotePlayer: RemotePlayer): void {
    if (remotePlayer.Player.NowPlayingUrl.length > 0) {
        Persistence.Delete("VortexBoxDefault_" + remotePlayer.Player.MacAddress);
        Persistence.Write("VortexBoxDefault_" + remotePlayer.Player.MacAddress, remotePlayer.Player.NowPlayingUrl);
        Persistence.Save();
    }
}

function playDefaultStationImpl(remotePlayer: RemotePlayer): void {
    const url = Persistence.Read("VortexBoxDefault_" + remotePlayer.Player.MacAddress);
    if (url.length > 0) {
        playDirectUrlLImpl(remotePlayer, url);
    }
}

function playDirectUrlLImpl(remotePlayer: RemotePlayer, url: string): void {
    let json = ('[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["playlist","play","' + url + '"]]}' + ',"channel":"/slim/request"}]');
    json = json.replace(/\//g, "\\/");
    sendJsonCommand(json, remotePlayer.Player.Server);
}

function playRandomPlaylistImpl(remotePlayer: RemotePlayer, folder: string): void {
    const json = `{"id": "play_random_favorite::${remotePlayer.Player.MacAddress}::${folder}", "method": "slim.request", "params": ["", ["favorites", "items", 0, 100]] }`;
    sendJsonCommand(json, remotePlayer.Player.Server, true);
}

function browseTestImpl(remotePlayer: RemotePlayer, service: string): void {
    let isRpc = false;
    let json = "";
    switch (service) {
        case "artists":
        case "albums":
        case "years":
        case "genres":
        case "playlists":
        case "mediafolder":
        case "musicfolder":
        case "bmf":
            json = '{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","method":"slim.request","params":[ "", ["browselibrary","items",0,65000,"mode:' + service + '"]]}';
            break;
        case "myMusic":
        case "home":
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["menu","items",0,100,"direct:1"]]}' + ',"channel":"/slim/request"}]';
            break;
        case "new":
            json = '{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","method":"slim.request","params":["' + remotePlayer.Player.Server.ClientId + '",["browselibrary", "items", 0, 65000, "sort:new","mode:albums"]]}';
            isRpc = true;
            break;
        case "radios":
            json = '{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","method":"slim.request","params":["' + remotePlayer.Player.Server.ClientId + '",["radios", 0, 65000, "menu:radio"]]}';
            break;
        case "menu":
            break;
        default:
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["opml_generic","items",0,100,"userInterfaceIdiom:iPeng","menu:opml_generic","opml_url:http://www.mysqueezebox.com/api/shoutcast/v1/opml","useContextMenu:1"]]}' + ',"channel":"/slim/request"}]';
            break;
    }

    //Clear the buffer
    remotePlayer.Player.Server.ConnectionIncomingData = "";

    sendJsonCommand(json, remotePlayer.Player.Server, isRpc);
}

function subscribeTestImpl(remotePlayer: RemotePlayer): void {
    const json = '[{ "id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data": { "response": "/' + remotePlayer.Player.Server.ClientId + '/slim/serverstatus", "request": ["", ["serverstatus", 0, 255, "prefs:ignoredarticles,browseagelimit,noGenreFilter,PLUGIN_TRACKSTAT,audiodir", "playerprefs:playtrackalbum,digitalVolumeControl", "subscribe:60"]] }' + ', "channel": "/slim/subscribe" }]'
    sendJsonCommand(json, remotePlayer.Player.Server);
}
