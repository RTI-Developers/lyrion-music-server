const g_Remote_Ids: number[] = Config.Get("SYSTEM::TwoWayDeviceList").split(' ').map(rid => parseInt(rid, 10));
/** Maximum number of menu/browse items returned per slim.request call (Lyrion API count parameter) */
const g_Max_Browse_Items = 25;
const g_Customized_Remote_Count = parseInt(Config.Get("TotalRemotes"), 10);
const g_Keyboard_Layer1 = new Array('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0');
const g_Keyboard_Layer2 = new Array('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0');
const g_Keyboard_Layer3 = new Array('!', '@', '#', '$', '%', '&', '~', '*', '\\', '/', '?', '^', '_', '`', ';', ':', '|', '=', '\u00e9', '\u00f1', '[', ']', '{', '}', '\u00e7', '\u00fc', '.', ',', '+', '-', '<', '>', '(', ')', "'", '"');
const g_RemotePlayers: RemotePlayer[] = [];
const g_DriverName = "Lyrion";
const g_DriverVersion = "2.0";
const g_Player_Count = parseInt(Config.Get("Total_Players"), 10);
const g_Default_Server_Ip = Config.Get("Default_Server_IP");
const g_Default_Server_Port = parseInt(Config.Get("Default_Server_TCP_Port"), 10);
const g_Player_Names_SysVarList = new SystemVarsList<string>("ConfiguredPlayersList");
const g_Max_Now_Playing_List_Size = 10;
const g_Socket_Connections = [];
const g_remotes: Remote[] = [];
const g_Players: Player[] = [];
const g_Servers: Server[] = [];
const g_serverHandleMap = new GlobalHandleMap<Server>();
const g_playerHandleMap = new GlobalHandleMap<Player>();

function Init(): void {
    g_logger.logInfo('Init', LogInfoLevel.Low);

    // Populate Remote List
    for (let i = 0; i < g_Remote_Ids.length; i++) {
        const remoteName = System.GetViewName(i);
        let browselistPageMacro: number | undefined;
        let keyboardPageMacro: number | undefined;

        for (var customizedRemoteId = 1; customizedRemoteId <= g_Customized_Remote_Count; customizedRemoteId++) {
            if (Config.Get("NameR" + customizedRemoteId) == remoteName) {
                g_logger.logInfo('Assigning configured remote macros for ' + remoteName, LogInfoLevel.High);
                const browseId = parseInt(Config.Get("BrowsePageMR" + customizedRemoteId), 10);
                const keyboardId = parseInt(Config.Get("KeyboardPageMR" + customizedRemoteId), 10);
                if (browseId > 0) { browselistPageMacro = browseId; }
                if (keyboardId > 0) { keyboardPageMacro = keyboardId; }
                break;
            }
        }

        const remote = new Remote(g_Remote_Ids[i], browselistPageMacro, keyboardPageMacro);
        g_logger.logInfo('Adding Remote with Id: ' + remote.Id, LogInfoLevel.High);
        g_remotes.push(remote);
    }

    // Populate Server List
    g_logger.logInfo('Adding default server with Ip: ' + g_Default_Server_Ip + ' and Port: ' + g_Default_Server_Port, LogInfoLevel.Low);
    const server = new Server(g_Default_Server_Ip, g_Default_Server_Port, new Logger(g_DriverName + 'Server [' + g_Default_Server_Ip + ']', g_debug), onCommRx, onConnection, onDisconnect);
    g_Servers.push(server);
    g_serverHandleMap.register(server.Connection.Handle, server);
    g_serverHandleMap.register(server.StartUpTimer.Handle, server);

    // Populate Player List
    for (let playerId = 1; playerId <= g_Player_Count; playerId++) {
        const player = new Player(playerId, new Logger(g_DriverName + 'Player [' + playerId + ']', g_debug), onTimerUpdatePlayerProgress, onPlaylistReady);
        player.Server = g_Servers[0];

        g_logger.logInfo('Adding Player [' + playerId + ']', LogInfoLevel.High);
        g_Players.push(player);
        player.Server.Players.push(player);
        g_playerHandleMap.register(player.NowPlayingTimer.Handle, player);
    }

    // Populate RemotePlayer List
    for (let i = 0; i < g_remotes.length; i++) {
        const remote = g_remotes[i];
        for (let j = 0; j < g_Players.length; j++) {
            const player = g_Players[j];
            g_logger.logInfo('Adding RemotePlayer with RemoteId [' + remote.Id + '] and PlayerId [' + player.Id + ']', LogInfoLevel.High);
            const remotePlayer = new RemotePlayer(remote, player, new Logger(g_DriverName + 'RemotePlayer [R' + remote.Id + ':P' + player.Id + ']', g_debug));
            g_RemotePlayers.push(remotePlayer);
            setKeyBoardLayoutImpl(remotePlayer, remotePlayer.KeyboardLayout);
        }
    }

    // Populate Player SysVarList
    g_Player_Names_SysVarList.Open();
    for (let i = 0; i < g_Players.length; i++) {
        const player = g_Players[i];
        g_Player_Names_SysVarList.Insert(player.Name);
    }
    g_Player_Names_SysVarList.Close();

}

const g_debug = Config.Get("DebugTrace") == "true";
const g_logger = new Logger(g_DriverName, g_debug);

g_logger.logInfo('Initializing ' + g_DriverName + ' version ' + g_DriverVersion, LogInfoLevel.Low);
Init();

//#region RTI event handlers

function onCommRx(data: string, handle: number): void {
    g_serverHandleMap.getMappedValueFromHandle(handle)?.handleIncomingData(data);
}

function onConnection(handle: number): void {
    g_serverHandleMap.getMappedValueFromHandle(handle)?.handleConnection();
}

function onConnectionFailed(handle: number): void {
    g_serverHandleMap.getMappedValueFromHandle(handle)?.handleDisconnect();
}

function onDisconnect(handle: number): void {
    g_serverHandleMap.getMappedValueFromHandle(handle)?.handleDisconnect();
}

function onTimerGetPlayers(handle: number): void {
    g_serverHandleMap.getMappedValueFromHandle(handle)?.requestPlayerList();
}

function onTimerSubscribeToPlayerStatus(handle: number): void {
    g_playerHandleMap.getMappedValueFromHandle(handle)?.subscribeToStatus();
}

function onTimerUpdatePlayerProgress(handle: number): void {
    g_playerHandleMap.getMappedValueFromHandle(handle)?.tickProgress();
}

function onPlaylistReady(playerId: number, titles: string[]): void {
    for (let i = 0; i < g_RemotePlayers.length; i++) {
        const remotePlayer = g_RemotePlayers[i];
        if (remotePlayer.Player.Id !== playerId) { continue; }
        remotePlayer.NowPlayingList.Open();
        remotePlayer.NowPlayingList.RemoveAll();
        for (let j = 0; j < titles.length; j++) {
            remotePlayer.NowPlayingList.Insert(titles[j]);
        }
        remotePlayer.NowPlayingList.Close();
    }
}

//#endregion
