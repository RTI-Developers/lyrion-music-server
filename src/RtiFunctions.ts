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

    if (remotePlayer == null) {
        return;
    }
    setKeyBoardLayoutImpl(remotePlayer, layout);
}

function enterKeyBoardInput(playerId: number, key: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }
    enterKeyBoardInputImpl(remotePlayer, key);
}

function sendSpecificKey(playerId: number, key: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }
    sendSpecificKeyImpl(remotePlayer, key);
}

function hideKeyboard(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }
    hideKeyboardImpl(remotePlayer);
}

function setBrowseMode(playerId: number, mode: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    setBrowseModeImpl(remotePlayer, mode);
}

function setPlaylistMode(playerId: number, mode: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    setPlaylistModeImpl(remotePlayer, mode);
}

function setShowMoreOptionsPopup(playerId: number, mode: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    setShowMoreOptionsPopupImpl(remotePlayer, mode);
}

function getPlayerStatus(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    getPlayerStatusImpl(remotePlayer);
}

function printHomeMenu(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    printHomeMenuImpl(remotePlayer);
}

function printNowPlayingUrl(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    printNowPlayingUrlImpl(remotePlayer);
}

function playerPower(playerId: number, power: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    playerPowerImpl(remotePlayer, power);
}

function playerVolume(playerId: number, todo: string, volume: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    playerVolumeImpl(remotePlayer, todo, volume);
}

function jumptoPlayPosition(playerId: number, location: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    jumptoPlayPositionImpl(remotePlayer, location);
}

function transport(playerId: number, command: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    transportImpl(remotePlayer, command);
}

function browseSubMenuTest(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    browseSubMenuTestImpl(remotePlayer);
}

function syncListSelection(playerId: number, index: number, syncType: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    syncListSelectionImpl(remotePlayer, index, syncType);
}

function browseSelectionAction(playerId: number, mode: string, index: number, remoteId: number) {
    dbg('Browse Selection Action: playerId ' + playerId + ', mode ' + mode + ', RemoteID ' + remoteId);

    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    browseSelectionActionImpl(remotePlayer, mode, index);
}

function browseBack(playerId: number, remoteId: number): void {
    dbg('Browse Back: playerId ' + playerId + ', RemoteID ' + remoteId);
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    browseBackImpl(remotePlayer);
}

function playListSelection(playerId: number, index: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    playListSelectionImpl(remotePlayer, index);
}

function adjustPlaylist(playerId: number, todo: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    adjustPlaylistImpl(remotePlayer, todo);
}

function jumpToBrowseLocation(playerId: number, service: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    jumpToBrowseLocationImpl(remotePlayer, service);
}

function saveDefaultStartup(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    saveDefaultStartupImpl(remotePlayer);
}

function playDefaultStation(playerId: number, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    playDefaultStationImpl(remotePlayer);
}

function playDirectUrl(playerId: number, url: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    playDirectUrlLImpl(remotePlayer, url);
}

function playRandomPlaylist(playerId: number, folder: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    playRandomPlaylistImpl(remotePlayer, folder);
}

function browseTest(playerId: number, service: string, remoteId: number): void {

    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    browseTestImpl(remotePlayer, service);
}

function subscribeTest(playerId: number, remoteId: number): void {

    const remotePlayer = getRemotePlayer(remoteId, playerId);

    if (remotePlayer == null) {
        return;
    }

    subscribeTestImpl(remotePlayer);
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

    if(!slaveRemotePlayer || !masterRemotePlayer) { return; }

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
    sendJsonCommand(json, masterPlayer.Server);
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
