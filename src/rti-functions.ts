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

    SystemVars.Write(variable, result);
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

function getPlayerStatus(playerId: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    const json = buildSlimRequestJson(
        player.Id,
        undefined,
        player.Server.ClientId,
        g_Slim_Request,
        player.MacAddress,
        [LyrionCmd.Menu, "items", 0, g_Max_Browse_Items, "direct:1"]);
    player.Server.sendJsonCommand(json);
}

function printHomeMenu(playerId: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    let outputString = "";
    for (var i = 0; i < player.ParentMenu.ListItems.length; i++) {
        var Title = player.ParentMenu.ListItems[i].MenuTitle;
        outputString += Title + ":";
    }
    g_logger.logInfo(outputString.substring(0, outputString.length - 1), LogInfoLevel.Low);
}

function printNowPlayingUrl(playerId: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    g_logger.logInfo(player.Name + '  ' + player.NowPlayingUrl, LogInfoLevel.Low);
}

function playerPower(playerId: number, power: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    if (power == 3) {
        power = player.PoweredOn ? 0 : 1;
    }
    const json = buildSlimRequestJson(
        player.Id,
        undefined,
        player.Server.ClientId,
        g_Slim_Request,
        player.MacAddress,
        [LyrionCmd.Power, power]);
    player.Server.sendJsonCommand(json);
}

function playerVolume(playerId: number, todo: string, volume: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }

    if (todo == "up") {
        player.Volume++;
        if (player.Volume > 100) { player.Volume = 100; }
        volume = player.Volume;
    }
    else if (todo == "down") {
        player.Volume--;
        if (player.Volume < 0) { player.Volume = 0; }
        volume = player.Volume;
    }

    const clientId = player.Server.ClientId;
    const mac = player.MacAddress;
    let json: string;

    if (todo.indexOf("muting") > -1) {
        if (todo.indexOf(" ") > -1) {
            const muteOff = parseInt(todo.substring(todo.indexOf(" ")), 10);
            json = buildSlimRequestJson(
                player.Id,
                undefined,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.Mixer, LyrionMixerCmd.Muting, muteOff]);
        }
        else {
            json = buildSlimRequestJson(
                player.Id,
                undefined,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.Mixer, LyrionMixerCmd.Muting]);
        }
    }
    else {
        json = buildSlimRequestJson(
            player.Id,
            undefined,
            clientId,
            g_Slim_Request,
            mac,
            [LyrionCmd.Mixer, LyrionMixerCmd.Volume, volume]);
    }
    player.Server.sendJsonCommand(json);
}

function jumptoPlayPosition(playerId: number, location: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    if (player.CanSeek == true) {
        var Position = Math.round((location / 100) * player.Duration);
        player.NowPlayingTimer.Stop();
        player.Progress = Position;
        player.Remaining = player.Duration - player.Progress;
        player.ProgressBar = (Math.floor((Position / player.Duration) * 100));
        const json = buildSlimRequestJson(
            player.Id,
            undefined,
            player.Server.ClientId,
            g_Slim_Request,
            player.MacAddress,
            [LyrionCmd.Time, Position]);
        player.Server.sendJsonCommand(json);
    }
}

function transport(playerId: number, command: string): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    const clientId = player.Server.ClientId;
    const mac = player.MacAddress;
    let cmd: LyrionCommandArray;
    switch (command) {
        case "play":
            cmd = [LyrionCmd.Play];
            break;
        case "pause":
            cmd = [LyrionCmd.Pause];
            break;
        case "stop":
            cmd = [LyrionCmd.Stop];
            break;
        case "next":
            cmd = [LyrionCmd.Button, LyrionButtonCmd.JumpForward];
            break;
        case "previous":
            cmd = [LyrionCmd.Button, LyrionButtonCmd.JumpRewind];
            break;
        case "pandora_love":
            cmd = [LyrionCmd.Pandora, "rate", "1"];
            break;
        case "pandora_ban":
            cmd = [LyrionCmd.Pandora, "rate", "0"];
            break;
        case "shuffle":
            cmd = [LyrionCmd.Button, LyrionButtonCmd.Shuffle];
            break;
        case "repeat":
            cmd = [LyrionCmd.Button, LyrionButtonCmd.Repeat];
            break;
        default:
            return;
    }
    player.Server.sendJsonCommand(buildSlimRequestJson(
        player.Id,
        undefined,
        clientId,
        g_Slim_Request,
        mac,
        cmd));
}

function syncListSelection(playerId: number, index: number, syncType: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

    const masterPlayer = remotePlayer.Player;
    const slavePlayerName = g_Player_Names_SysVarList.ReadAt(index);

    if (masterPlayer.Name == slavePlayerName) { return; }

    let slavePlayer: Player | null = null;
    for (let i = 0; i < g_Players.length; i++) {
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

    const json = isAdd
        ? buildSlimRequestJson(
            remotePlayer.Player.Id,
            remotePlayer.Remote.Id,
            masterPlayer.Server.ClientId,
            g_Slim_Request,
            masterPlayer.MacAddress,
            [LyrionCmd.Sync, slavePlayer.MacAddress])
        : buildSlimRequestJson(
            remotePlayer.Player.Id,
            remotePlayer.Remote.Id,
            masterPlayer.Server.ClientId,
            g_Slim_Request,
            slavePlayer.MacAddress,
            [LyrionCmd.Sync, "-"]);
    masterPlayer.Server.sendJsonCommand(json);
}

function browseSelectionAction(playerId: number, mode: string, index: number, remoteId: number) {
    g_logger.logInfo('Browse Selection Action: playerId ' + playerId + ', mode ' + mode + ', RemoteID ' + remoteId, LogInfoLevel.High, 'browseSelectionAction');
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);
    const command = remotePlayer.CurrentList.ListItems[index].Actions[0].GoCmd;
    const goParams = remotePlayer.CurrentList.ListItems[index].Actions[0].GoParams;
    remotePlayer.CurrentList.Top = index;

    if (command.some(function(c) { return c.indexOf("jiveblankcommand") > -1; })) {
        remotePlayer.applyBrowseMode(0);
        remotePlayer.ListBack();
        return;
    }

    if (goParams.some(function(p) { return p.indexOf("__TAGGEDINPUT__") > -1; })) {
        remotePlayer.CurrentList.Selected = index;
        SystemVars.Write("ShowingKeyboardP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
        if (remotePlayer.Remote.KeyboardPageMacro) {
            System.RunSystemMacro(remotePlayer.Remote.KeyboardPageMacro);
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

        const clientId = remotePlayer.Player.Server.ClientId;
        const mac = remotePlayer.Player.MacAddress;
        let commands: string[] = [];
        let params: string[] = [];

        if (mode == "Favorite") {
            const itemId = getItemIdValue(remotePlayer.CurrentList.ListItems[index].Actions[0].Params);
            let json: string;
            if (SystemVars.Read("BrowseListTitleP" + paddedPlayerId + "%" + remotePlayer.Remote.Id).toLowerCase() == "favorites") {
                json = buildSlimRequestJson(
                    remotePlayer.Player.Id,
                    remotePlayer.Remote.Id,
                    clientId,
                    g_Slim_Request,
                    mac,
                    [
                        LyrionCmd.Favorites, LyrionFavoritesCmd.Delete,
                        "title:" + remotePlayer.CurrentList.ListItems[index].FavoritesTitle,
                        "url:" + remotePlayer.CurrentList.ListItems[index].FavoritesUrl,
                        itemId, "useContextMenu:1", "type:audio"
                    ]);
                remotePlayer.BrowseList.Open();
                remotePlayer.BrowseList.RemoveAt(index);
                remotePlayer.BrowseList.Close();
                remotePlayer.applyBrowseMode(0);
            }
            else {
                json = buildSlimRequestJson(
                    remotePlayer.Player.Id,
                    remotePlayer.Remote.Id,
                    clientId,
                    g_Slim_Request,
                    mac,
                    [
                        LyrionCmd.Favorites, LyrionFavoritesCmd.Add,
                        "title:" + remotePlayer.CurrentList.ListItems[index].FavoritesTitle,
                        "url:" + remotePlayer.CurrentList.ListItems[index].FavoritesUrl
                    ]);
            }
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
                params = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].PlayParams.slice();
                if (remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams.length > 0) {
                    params = params.concat(remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams);
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
                params = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].AddParams.slice();
                if (remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams.length > 0) {
                    params = params.concat(remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams);
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
                params = remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel].AddHoldParams.slice();
                if (remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams.length > 0) {
                    params = params.concat(remotePlayer.CurrentList.ListItems[index].Actions[0].CommonParams);
                }
            }
        }
        const json = buildSlimRequestJson(
            remotePlayer.Player.Id,
            remotePlayer.Remote.Id,
            clientId,
            g_Slim_Request,
            mac,
            (commands as LyrionCommandArray).concat(params as LyrionCommandArray));
        remotePlayer.Player.Server.sendJsonCommand(json);
    }
    else {
        remotePlayer.Offset = 0;
        remotePlayer.BrowseListSelect(index);
        remotePlayer.applyBrowseMode(0);
    }
}

function browseBack(playerId: number, remoteId: number): void {
    g_logger.logInfo('Browse Back: playerId ' + playerId + ', RemoteID ' + remoteId, LogInfoLevel.High, 'browseBack');
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }
    remotePlayer.applyBrowseMode(0);
    remotePlayer.ListBack();
}

function playListSelection(playerId: number, index: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    const json = buildSlimRequestJson(
        player.Id,
        undefined,
        player.Server.ClientId,
        g_Slim_Request,
        player.MacAddress,
        [LyrionCmd.Playlist, LyrionPlaylistCmd.Index, index]);
    player.Server.sendJsonCommand(json);
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

    const clientId = remotePlayer.Player.Server.ClientId;
    const mac = remotePlayer.Player.MacAddress;
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
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.BrowseLibrary, "items", 0, g_Max_Browse_Items, "sort:new", "mode:" + service]);
            break;
        case "myMusic":
        case "home":
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.Menu, "items", 0, g_Max_Browse_Items, "direct:1"]);
            break;
        case "new":
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.BrowseLibrary, "items", 0, g_Max_Browse_Items, "sort:new", "mode:albums"]);
            isRpc = true;
            break;
        case "radios":
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.Radios, 0, g_Max_Browse_Items, "menu:radio"]);
            break;
        default:
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [service, "items", 0, g_Max_Browse_Items, "menu:" + service]);
            break;
    }

    remotePlayer.Player.Server.sendJsonCommand(json, isRpc);
}

function saveDefaultStartup(playerId: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    if (player.NowPlayingUrl.length > 0) {
        Persistence.Delete("VortexBoxDefault_" + player.MacAddress);
        Persistence.Write("VortexBoxDefault_" + player.MacAddress, player.NowPlayingUrl);
        Persistence.Save();
    }
}

function playDefaultStation(playerId: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    const url = Persistence.Read("VortexBoxDefault_" + player.MacAddress);
    if (url.length > 0) {
        playDirectUrlForPlayer(player, url);
    }
}

function playDirectUrl(playerId: number, url: string): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    playDirectUrlForPlayer(player, url);
}

function playRandomPlaylist(playerId: number, folder: string): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    const json = buildRpcRequestJson("play_random_favorite::" + player.MacAddress + "::" + folder, "", [LyrionCmd.Favorites, LyrionFavoritesCmd.Items, 0, 100]);
    player.Server.sendJsonCommand(json, true);
}

function browseTest(playerId: number, service: string, remoteId: number): void {
    const remotePlayer = getRemotePlayer(remoteId, playerId);
    if (remotePlayer == null) { return; }

    const clientId = remotePlayer.Player.Server.ClientId;
    const mac = remotePlayer.Player.MacAddress;
    const rpcId = buildRequestId(remotePlayer.Player.Id, remotePlayer.Remote.Id);
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
            json = buildRpcRequestJson(rpcId, "", [LyrionCmd.BrowseLibrary, "items", 0, 65000, "mode:" + service]);
            break;
        case "myMusic":
        case "home":
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.Menu, "items", 0, 100, "direct:1"]);
            break;
        case "new":
            json = buildRpcRequestJson(rpcId, clientId, [LyrionCmd.BrowseLibrary, "items", 0, 65000, "sort:new", "mode:albums"]);
            isRpc = true;
            break;
        case "radios":
            json = buildRpcRequestJson(rpcId, clientId, [LyrionCmd.Radios, 0, 65000, "menu:radio"]);
            break;
        case "menu":
            break;
        default:
            json = buildSlimRequestJson(
                remotePlayer.Player.Id,
                remotePlayer.Remote.Id,
                clientId,
                g_Slim_Request,
                mac,
                [LyrionCmd.OpmlGeneric, "items", 0, 100, "userInterfaceIdiom:iPeng", "menu:opml_generic", "opml_url:http://www.mysqueezebox.com/api/shoutcast/v1/opml", "useContextMenu:1"]);
            break;
    }

    remotePlayer.Player.Server.sendJsonCommand(json, isRpc);
}

function subscribeTest(playerId: number): void {
    const player = getPlayer(playerId);
    if (player == null) { return; }
    const json = buildSlimSubscribeJson(player.Id, undefined, player.Server.ClientId, "slim/serverstatus", "", [LyrionCmd.ServerStatus, 0, 255, "prefs:ignoredarticles,browseagelimit,noGenreFilter,PLUGIN_TRACKSTAT,audiodir", "playerprefs:playtrackalbum,digitalVolumeControl", "subscribe:60"]);
    player.Server.sendJsonCommand(json);
}

function printBuffer(_playerId: number): void {
    g_logger.logInfo('printBuffer: HTTP parser buffer is internal (two-state machine).', LogInfoLevel.Low);
}

function syncPlayerToPlayer(slavePlayerId: number, masterPlayerId: number, todo: string): void {
    const slavePlayer = getPlayer(slavePlayerId);
    const masterPlayer = getPlayer(masterPlayerId);

    if (!slavePlayer || !masterPlayer) { return; }

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

    const json = isAdd
        ? buildSlimRequestJson(
            slavePlayer.Id,
            undefined,
            masterPlayer.Server.ClientId,
            g_Slim_Request,
            masterPlayer.MacAddress,
            [LyrionCmd.Sync, slavePlayer.MacAddress])
        : buildSlimRequestJson(
            slavePlayer.Id,
            undefined,
            masterPlayer.Server.ClientId,
            g_Slim_Request,
            slavePlayer.MacAddress,
            [LyrionCmd.Sync, "-"]);
    masterPlayer.Server.sendJsonCommand(json);
}

function browseSelection(playerId: number, index: number, remoteId: number): void {
    g_logger.logInfo('Browse Selection: PlayerId: ' + playerId + ', Index ' + index + ', RemoteId ' + remoteId, LogInfoLevel.High, 'browseSelection');

    const paddedPlayerId = padDigit(playerId);

    const favoritesMode = SystemVars.Read("FavoritesModeP" + paddedPlayerId + "%" + remoteId);
    const playMode = SystemVars.Read("PlayModeP" + paddedPlayerId + "%" + remoteId);
    const addEndMode = SystemVars.Read("AddEndModeP" + paddedPlayerId + "%" + remoteId);
    const addNextMode = SystemVars.Read("AddNextModeP" + paddedPlayerId + "%" + remoteId);
    const selectMode = SystemVars.Read("SelectModeP" + paddedPlayerId + "%" + remoteId);

    let mode: string;

    if (favoritesMode == true) { mode = "Favorite"; }
    else if (playMode == true) { mode = "Play"; }
    else if (addEndMode == true) { mode = "AddEnd"; }
    else if (addNextMode == true) { mode = "AddNext"; }
    else if (selectMode == true) { mode = "Select"; }
    else {
        setBrowseMode(playerId, 0, remoteId);
        mode = "Select";
    }

    browseSelectionAction(playerId, mode, index, remoteId);
}

function playDirectUrlForPlayer(player: Player, url: string): void {
    const json = buildSlimRequestJson(
        player.Id,
        undefined,
        player.Server.ClientId,
        g_Slim_Request,
        player.MacAddress,
        [LyrionCmd.Playlist, LyrionPlaylistCmd.Play, url]);
    player.Server.sendJsonCommand(json);
}
