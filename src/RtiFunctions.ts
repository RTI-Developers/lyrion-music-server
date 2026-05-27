function setSyncType(playerId: number, todo: string, remoteId: number): void {
    const paddedPlayerId = padDigit(playerId);
    if (todo == "Toggle") {
        var Existing = (SystemVars.Read("SyncP" + paddedPlayerId + "%" + remoteId) == true);
        if (Existing == true) {
            todo = "ReleaseSync";
        }
        else {
            todo = "Sync";
        }
    }
    SystemVars.Write("SyncP" + paddedPlayerId + "%" + remoteId, todo == "Sync");
    SystemVars.Write("ReleaseSyncP" + paddedPlayerId + "%" + remoteId, todo == "ReleaseSync");
}

function showHideSyncPopup(playerId: number, todo: string, remoteId: number): void {
    const paddedPlayerId = padDigit(playerId);
    const variable = "SyncPopupVisibleP" + paddedPlayerId + "%" + remoteId;

    let result = false;
    if (todo == "Toggle") {
        if (SystemVars.Read(variable) == true) {
            result = false;
        }
        else {
            result = true;
        }
    }
    else if (todo == "true") {
        result = true;
    }
    else {
        result = false;
    }

    SystemVars.Write(variable, todo);
}

/*
 allow the following:
 0 - last displayed
 1 - lowercase
 2 - uppercase
 3 - symbols
 4 - cycle thru 1,2,3
 5 - cycle thru 1,2
 6 - cycle 1,3
*/
function setKeyBoardLayout(playerId: number, layout: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    setKeyBoardLayoutImpl(remotePlayer, layout);
}

function enterKeyBoardInput(playerId: number, key: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    enterKeyBoardInputImpl(remotePlayer, key);
}

function sendSpecificKey(playerId: number, key: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    sendSpecificKeyImpl(remotePlayer, key);
}

function hideKeyboard(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    hideKeyboardImpl(remotePlayer);
}

function setBrowseMode(playerId: number, mode: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    remotePlayer.applyBrowseMode(mode);
}

function setPlaylistMode(playerId: number, mode: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);

    if (mode == 99) {
        var ExistingMode = parseInt(SystemVars.Read("PlayListModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id), 10);
        ExistingMode++;
        if (ExistingMode > 1) { ExistingMode = 0; }
        mode = ExistingMode;
    }
    SystemVars.Write("PlayListModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, mode);
    switch (mode) {
        case 0:
            SystemVars.Write("PlayListPlayModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            SystemVars.Write("PlayListSelectModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
            remotePlayer.unselectNowPlayingItem();
            break;
        case 1:
            SystemVars.Write("PlayListPlayModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
            SystemVars.Write("PlayListSelectModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
    }
}

function setShowMoreOptionsPopup(playerId: number, mode: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);

    if (mode == "99") {
        let existingMode = SystemVars.Read("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id);
        if (existingMode == true) { existingMode = "false"; }
        else { existingMode = "true"; }
        mode = existingMode;
    }
    switch (mode) {
        case "true":
            SystemVars.Write("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
        case "false":
            SystemVars.Write("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
            break;
    }
}

function getPlayerStatus(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["menu","items",0,' + g_Max_Poll_Count + ',"direct:1"]]}' + ',"channel":"/slim/request"}]';
    remotePlayer.Player.Server.sendJsonCommand(json);
}

function printHomeMenu(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    let outputString = "";
    for (var i = 0; i < remotePlayer.Player.ParentMenu.ListItems.length; i++) {
        var Title = remotePlayer.Player.ParentMenu.ListItems[i].MenuTitle;
        outputString += Title + ":";
    }
    System.LogInfo(1, outputString.substring(0, outputString.length - 1));
}

function printNowPlayingUrl(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    System.LogInfo(1, remotePlayer.Player.Name + "  " + remotePlayer.Player.NowPlayingUrl);
}

function playerPower(playerId: number, power: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    if (power == 3) {
        power = remotePlayer.Player.PoweredOn ? 0 : 1;
    }
    var JSON = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["power",' + power + ']]}' + ',"channel":"/slim/request"}]';
    remotePlayer.Player.Server.sendJsonCommand(JSON);
}

function playerVolume(playerId: number, todo: string, volume: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

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
        if (todo.indexOf(" ") > -1) {
            const muteOff = parseInt(todo.substring(todo.indexOf(" ")), 10).toString();
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["mixer","muting",' + muteOff + ']]}' + ',"channel":"/slim/request"}]';
        }
        else {
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["mixer","muting"' + ']]}' + ',"channel":"/slim/request"}]';
        }
    }
    remotePlayer.Player.Server.sendJsonCommand(json);
}

function jumptoPlayPosition(playerId: number, location: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    if (remotePlayer.Player.CanSeek == true) {
        var Position = Math.round((location / 100) * remotePlayer.Player.Duration);
        remotePlayer.Player.NowPlayingTimer.Stop();
        remotePlayer.Player.Progress = Position;
        remotePlayer.Player.Remaining = remotePlayer.Player.Duration - remotePlayer.Player.Progress;
        remotePlayer.Player.ProgressBar = (Math.floor((Position / remotePlayer.Player.Duration) * 100));
        const json = '[{ "id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '", "data": { "request": ["' + remotePlayer.Player.MacAddress + '", ["time", ' + Position + ']], "response": "/' + remotePlayer.Player.Server.ClientId + '/slim/request" }' + ', "channel": "/slim/request" }]';
        remotePlayer.Player.Server.sendJsonCommand(json);
    }
}

function transport(playerId: number, command: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
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
    remotePlayer.Player.Server.sendJsonCommand(startJson + action + endJson);
}

function browseSubMenuTest(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const json = '[{"id":"' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["opml_generic","items",0,100,"menu:opml_generic","item_id:f8c2a3df.0","useContextMenu:1"]]}' + ',"channel":"/slim/request"}]';
    remotePlayer.Player.Server.sendJsonCommand(json);
}

function syncListSelection(playerId: number, index: number, syncType: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

    const masterPlayer = remotePlayer.Player;
    const slavePlayerName = g_Player_Names_SysVarList.ReadAt(index);

    if (masterPlayer.Name == slavePlayerName) { return; }

    let slavePlayer: Player | null = null;
    for (let i = 0; i > g_Players.length; i++) {
        if (g_Players[i].Name == slavePlayerName) {
            slavePlayer = g_Players[i];
            break;
        }
    }

    if (!slavePlayer) { return; }
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
        case "Toggle":
            if (slavePlayer.SyncSlave == undefined) {
                slavePlayer.SyncSlave = false;
            }
            if (slavePlayer.IsSynced == true) {
                isAdd = false;
            }
            break;
    }

    let json = isAdd ?
        '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + masterPlayer.Server.ClientId + '/slim/request","request":["' + masterPlayer.MacAddress + '",["sync","' + slavePlayer.MacAddress + '"]]}' + ',"channel":"/slim/request"}]' :
        '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + masterPlayer.Server.ClientId + '/slim/request","request":["' + slavePlayer.MacAddress + '",["sync","' + '-' + '"]]}' + ',"channel":"/slim/request"}]';

    json = json.replace(/\//g, "\\/");
    masterPlayer.Server.sendJsonCommand(json);
}

function browseSelectionAction(playerId: number, mode: string, index: number, remoteId: number) {
    dbg('Browse Selection Action: playerId ' + playerId + ', mode ' + mode + ', RemoteID ' + remoteId);
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);
    const command = remotePlayer.CurrentList.ListItems[index].Actions[0].GoCmd;
    const params = remotePlayer.CurrentList.ListItems[index].Actions[0].GoParams;
    remotePlayer.CurrentList.Top = index;

    if (command.indexOf("jiveblankcommand") > -1) {
        remotePlayer.applyBrowseMode(0);
        remotePlayer.ListBack();
        return;
    }

    if (params.indexOf("__TAGGEDINPUT__") > -1) {
        remotePlayer.CurrentList.Selected = index;
        SystemVars.Write("ShowingKeyboardP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
        if (remotePlayer.KeyboardPageMacro > 0) {
            System.RunSystemMacro(remotePlayer.KeyboardPageMacro);
        }
        return;
    }
    else {
        SystemVars.Write("ShowingKeyboardP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    }

    if (mode != "Select") {
        if (remotePlayer.CurrentList.ListItems[index].FavoritesUrl.length > 0) {
            remotePlayer.Player.NowPlayingUrl = remotePlayer.CurrentList.ListItems[index].FavoritesUrl;
        }

        let json = "";
        let commands = "";
        let params = "";
        if (mode == "Favorite") {
            if (SystemVars.Read("BrowseListTitleP" + paddedPlayerId + "%" + remotePlayer.Remote.Id).toLowerCase() == "favorites") {
                const itemId = getItemIdValue(remotePlayer.CurrentList.ListItems[index].Actions[0].Params);
                json = '[{"id": "' + paddedPlayerId + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["favorites","delete","title:' + remotePlayer.CurrentList.ListItems[index].FavoritesTitle + '","url:' + remotePlayer.CurrentList.ListItems[index].FavoritesUrl + '",' + itemId + ',"useContextMenu:1","type:audio"' + ']]}' + ',"channel":"/slim/request"}]';
                remotePlayer.BrowseList.Open();
                remotePlayer.BrowseList.RemoveAt(index);
                remotePlayer.BrowseList.Close();
                remotePlayer.applyBrowseMode(0);
            }
            else {
                json = '[{"id": "' + paddedPlayerId + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["favorites","add","title:' + remotePlayer.CurrentList.ListItems[index].FavoritesTitle + '","url:' + remotePlayer.CurrentList.ListItems[index].FavoritesUrl + '"]]}' + ',"channel":"/slim/request"}]';

            }

            json = json.replace(/\//g, "\\/");
            remotePlayer.Player.Server.sendJsonCommand(json);
            return;
        }
        else if (mode == "Play") {
            if (remotePlayer.CurrentList.ListItems[index].Actions[0].PlayCmd.length > 0) {
                commands = remotePlayer.CurrentList.ListItems[index].Actions[0].PlayCmd;
                params = remotePlayer.CurrentList.ListItems[index].Actions[0].PlayParams;
            }
            else {
                commands = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].PlayCmd;
                params = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].PlayParams;
                if (remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams.length > 0) {
                    params += ',' + remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams;
                }
            }
        }
        else if (mode == "AddEnd") {
            if (remotePlayer.CurrentList.ListItems[index].Actions[0].AddCmd.length > 0) {
                commands = remotePlayer.CurrentList.ListItems[index].Actions[0].AddCmd;
                params = remotePlayer.CurrentList.ListItems[index].Actions[0].AddParams;
            }
            else {
                commands = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].AddCmd;
                params = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].AddParams;
                if (remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams.length > 0) {
                    params += ',' + remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams;
                }
            }
        }
        else if (mode == "AddNext") {
            if (remotePlayer.CurrentList.ListItems[index].Actions[0].AddHoldCmd.length > 0) {
                commands = remotePlayer.CurrentList.ListItems[index].Actions[0].AddHoldCmd;
                params = remotePlayer.CurrentList.ListItems[index].Actions[0].AddHoldParams;
            }
            else {
                commands = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].AddHoldCmd;
                params = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].AddHoldParams;

                if (remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams.length > 0) {
                    params += ',' + remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams;
                }
            }
        }
        json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",[' + commands + ',' + params + ']]}' + ',"channel":"/slim/request"}]';
        json = json.replace(/\//g, "\\/");
        remotePlayer.Player.Server.sendJsonCommand(json);
    }
    else {
        remotePlayer.Offset = 0;
        remotePlayer.BrowseListSelect(index);
        remotePlayer.applyBrowseMode(0);
    }
}

function browseBack(playerId: number, remoteId: number): void {
    dbg('Browse Back: playerId ' + playerId + ', RemoteID ' + remoteId);
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    remotePlayer.applyBrowseMode(0);
    remotePlayer.ListBack();
}

function playListSelection(playerId: number, index: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

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
        remotePlayer.Player.Server.sendJsonCommand(json);
    }
    remotePlayer.NowPlayingList.Close();
}

function adjustPlaylist(playerId: number, todo: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

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
            if (updated == false) {
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

function jumpToBrowseLocation(playerId: number, service: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);

    SystemVars.Write("MoreOptionsAvailableP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    SystemVars.Write("MoreOptionsNotAvailableP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
    SystemVars.Write("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);

    remotePlayer.applyBrowseMode(0);

    remotePlayer.ListLevel = 0;
    remotePlayer.History = [];

    remotePlayer.CurrentList.ListItems = remotePlayer.Player.ParentMenu.ListItems;
    remotePlayer.ListLevel = 1;

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
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary", "items", 0,' + g_Max_Poll_Count + ', "sort:new","mode:' + service + '"]]}' + ',"channel":"/slim/request"}]';
            break;
        case "myMusic":
        case "home":
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["menu","items",0,' + g_Max_Poll_Count + ',"direct:1"]]}' + ',"channel":"/slim/request"}]';
            break;
        case "new":
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary", "items", 0,' + g_Max_Poll_Count + ', "sort:new","mode:albums"]]}' + ',"channel":"/slim/request"}]';
            isRpc = true;
            break;
        case "radios":
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["radios", 0,' + g_Max_Poll_Count + ', "menu:radio"]]}' + ',"channel":"/slim/request"}]';
            break;
        default:
            json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["' + service + '","items",0,' + g_Max_Poll_Count + ',"menu:' + service + '"]]}' + ',"channel":"/slim/request"}]';
            break;
    }

    remotePlayer.Player.Server.ConnectionIncomingData = "";
    remotePlayer.Player.Server.sendJsonCommand(json, isRpc);
}

function saveDefaultStartup(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    if (remotePlayer.Player.NowPlayingUrl.length > 0) {
        Persistence.Delete("VortexBoxDefault_" + remotePlayer.Player.MacAddress);
        Persistence.Write("VortexBoxDefault_" + remotePlayer.Player.MacAddress, remotePlayer.Player.NowPlayingUrl);
        Persistence.Save();
    }
}

function playDefaultStation(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const url = Persistence.Read("VortexBoxDefault_" + remotePlayer.Player.MacAddress);
    if (url.length > 0) {
        playDirectUrlForPlayer(remotePlayer, url);
    }
}

function playDirectUrl(playerId: number, url: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    playDirectUrlForPlayer(remotePlayer, url);
}

function playRandomPlaylist(playerId: number, folder: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const json = `{"id": "play_random_favorite::${remotePlayer.Player.MacAddress}::${folder}", "method": "slim.request", "params": ["", ["favorites", "items", 0, 100]] }`;
    remotePlayer.Player.Server.sendJsonCommand(json, true);
}

function browseTest(playerId: number, service: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

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

    remotePlayer.Player.Server.ConnectionIncomingData = "";
    remotePlayer.Player.Server.sendJsonCommand(json, isRpc);
}

function subscribeTest(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const json = '[{ "id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data": { "response": "/' + remotePlayer.Player.Server.ClientId + '/slim/serverstatus", "request": ["", ["serverstatus", 0, 255, "prefs:ignoredarticles,browseagelimit,noGenreFilter,PLUGIN_TRACKSTAT,audiodir", "playerprefs:playtrackalbum,digitalVolumeControl", "subscribe:60"]] }' + ', "channel": "/slim/subscribe" }]';
    remotePlayer.Player.Server.sendJsonCommand(json);
}

function changeDebugMode(debugItem: string, todo: string): void {
    switch (debugItem) {
        case "JSON":
            if (todo == "2") {
                if (g_Print_Incoming_Json == true) {
                    g_Print_Incoming_Json = false;
                }
                else {
                    g_Print_Incoming_Json = true;
                }
            }
            else {
                g_Print_Incoming_Json = (todo == "1");
            }
            break;
        case "RAW":
            if (todo == "2") {
                if (g_Print_Incoming_Raw == true) {
                    g_Print_Incoming_Raw = false;
                }
                else {
                    g_Print_Incoming_Raw = true;
                }
            }
            else {
                g_Print_Incoming_Raw = (todo == "1");
            }
            break;
        case "POST":
            if (todo == "2") {
                if (g_Print_Posts == true) {
                    g_Print_Posts = false;
                }
                else {
                    g_Print_Posts = true;
                }
            }
            else {
                g_Print_Posts = (todo == "1");
            }
        case "MENU":
            if (todo == "2") {
                if (g_Print_Incoming_Menu == true) {
                    g_Print_Incoming_Menu = false;
                }
                else {
                    g_Print_Incoming_Menu = true;
                }
            }
            else {
                g_Print_Incoming_Menu = (todo == "1");
            }
            break;
    }
    printDebugModes();
}

function printBuffer(playerId: number, remoteId: number): void {
    const server = getRemotePlayer(remoteId, playerId)?.Player?.Server;
    if (!server) { return; }
    System.Print("**********************Existing Buffer Data*********************************");
    System.Print("**********************Requested By Remote " + remoteId + "********************************");
    printMaxLineSize(server.ConnectionIncomingData);
    server.ConnectionIncomingData = "";
    server.BufferCount = 0;
    System.Print("**********************End Existing Buffer Data*********************************");
}

function syncPlayerToPlayer(slavePlayerId: number, masterPlayerId: number, todo: string, remoteId: number): void {
    const slaveRemotePlayer = getRemotePlayer(remoteId, slavePlayerId);
    const masterRemotePlayer = getRemotePlayer(remoteId, masterPlayerId);

    if (!slaveRemotePlayer || !masterRemotePlayer) { return; }

    const slavePlayer = slaveRemotePlayer.Player;
    const masterPlayer = masterRemotePlayer.Player;

    let isAdd = true;
    switch (todo) {
        case "ReleaseSync":
            isAdd = false;
            break;
        case "Toggle":
            if (slavePlayer.IsSynced == true) {
                isAdd = false;
            }
            break;
    }

    let json = isAdd ?
        '[{"id": "' + slavePlayer.Id + "_" + remoteId + '","data":{"response":"/' + masterPlayer.Server.ClientId + '/slim/request","request":["' + masterPlayer.MacAddress + '",["sync","' + slavePlayer.MacAddress + '"]]}' + ',"channel":"/slim/request"}]' :
        '[{"id": "' + slavePlayer.Id + "_" + remoteId + '","data":{"response":"/' + masterPlayer.Server.ClientId + '/slim/request","request":["' + slavePlayer.MacAddress + '",["sync","' + '-' + '"]]}' + ',"channel":"/slim/request"}]';

    json = json.replace(/\//g, "\\/");
    masterPlayer.Server.sendJsonCommand(json);
}

function browseSelection(playerId: number, index: number, remoteId: number): void {
    dbg('Browse Selection: PlayerId: ' + playerId + ', Index ' + index + ', RemoteId ' + remoteId);

    const paddedPlayerId = padDigit(playerId);

    const favoritesMode = SystemVars.Read("FavoritesModeP" + paddedPlayerId + "%" + remoteId);
    const playMode = SystemVars.Read("PlayModeP" + paddedPlayerId + "%" + remoteId);
    const addEndMode = SystemVars.Read("AddEndModeP" + paddedPlayerId + "%" + remoteId);
    const addNextMode = SystemVars.Read("AddNextModeP" + paddedPlayerId + "%" + remoteId);
    const selectMode = SystemVars.Read("SelectModeP" + paddedPlayerId + "%" + remoteId);

    let mode;

    if (favoritesMode == true) { mode = "Favorite"; }
    else if (playMode == true) { mode = "Play"; }
    else if (addEndMode == true) { mode = "AddEnd"; }
    else if (addNextMode == true) { mode = "AddNext"; }
    else if (selectMode == true) { mode = "Select"; }
    else {
        setBrowseMode(playerId, 0, remoteId);
        browseSelection(playerId, index, remoteId);
    }

    browseSelectionAction(playerId, mode, index, remoteId);
}

function playDirectUrlForPlayer(remotePlayer: RemotePlayer, url: string): void {
    let json = ('[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["playlist","play","' + url + '"]]}' + ',"channel":"/slim/request"}]');
    json = json.replace(/\//g, "\\/");
    remotePlayer.Player.Server.sendJsonCommand(json);
}
