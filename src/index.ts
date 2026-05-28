const g_Remote_Ids: number[] = Config.Get("SYSTEM::TwoWayDeviceList").split(' ').map(rid => parseInt(rid, 10));
const g_Max_Poll_Count = 25;
const g_Customized_Remote_Count = parseInt(Config.Get("TotalRemotes"), 10);
const g_Keyboard_Layer1 = new Array('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0');
const g_Keyboard_Layer2 = new Array('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0');
const g_Keyboard_Layer3 = new Array();
const g_RemotePlayers: RemotePlayer[] = [];
const g_DriverName = "Lyrion";
const g_DriverVersion = "2.0";
const g_Player_Count = parseInt(Config.Get("Total_Players"), 10);
const g_Default_Server_Ip = Config.Get("Defaul_Server_IP");
const g_Default_Server_Port = parseInt(Config.Get("Default_Server_TCP_Port"), 10);
const g_Player_Names_SysVarList = new SystemVarsList<string>("ConfiguredPlayersList");
const g_Max_Now_Playing_List_Size = 10;
const g_Socket_Connections = [];
const g_remotes: Remote[] = [];
const g_Players: Player[] = [];
const g_Servers: Server[] = [];
const g_serverHandlerMap = new GlobalHandlerMap<Server>();
const g_playerHandlerMap = new GlobalHandlerMap<Player>();


let g_Debug = Config.Get("DebugTrace") == "true";
let g_Print_Posts = Config.Get("DebugPrintPosts") == "true";
let g_Print_Incoming_Json = Config.Get("DebugPrintIncoming") == "true";
let g_Print_Incoming_Raw = Config.Get("DebugRAWIncoming") == "true";
let g_Print_Incoming_Menu = Config.Get("DebugMenuIncoming") == "true";

function Init(): void {
    dbg('Init');

    // Populate Remote List
    g_remotes.push(new Remote(0));  // Virtual Remote for RTI Processor

    for (let i = 0; i < g_Remote_Ids.length; i++) {
        const remote = new Remote(g_Remote_Ids[i]);
        dbg('Adding Remote with Id: ' + remote.Id);
        g_remotes.push(remote);

        var remoteName = System.GetViewName(i);
        for (var customizedRemoteId = 1; customizedRemoteId <= g_Customized_Remote_Count; customizedRemoteId++) {
            var customizedRemoteName = Config.Get("NameR" + customizedRemoteId);
            if (customizedRemoteName == remoteName) {
                dbg('Assigning configured remote macros');
                var KeyboardMaroID = parseInt(Config.Get("KeyboardPageMR" + customizedRemoteId), 10);
                var BrowseMacroID = parseInt(Config.Get("BrowsePageMR" + customizedRemoteId), 10);

                if (BrowseMacroID > 0) { remote.BroweslistPageMacro = BrowseMacroID; }
                if (KeyboardMaroID > 0) { remote.KeyboardPageMacro = KeyboardMaroID; }
            }
        }
    }

    // Populate Server List
    dbg('Adding default server with Ip: ' + g_Default_Server_Ip + ' and Port: ' + g_Default_Server_Port);
    const server = new Server(g_Default_Server_Ip, g_Default_Server_Port, onCommRx, onConnection, onDisconnect);
    g_Servers.push(server);
    g_serverHandlerMap.register(server.Connection.Handle, server);
    g_serverHandlerMap.register(server.StartUpTimer.Handle, server);

    // Populate Player List
    for (let playerId = 1; playerId <= g_Player_Count; playerId++) {
        const player = new Player(playerId, onTimerUpdatePlayerProgress);
        player.Server = g_Servers[0];

        dbg('Adding Player [' + playerId + ']');
        g_Players.push(player);
        player.Server.Players.push(player);
        g_playerHandlerMap.register(player.NowPlayingTimer.Handle, player);
    }

    // Populate RemotePlayer List
    for (let i = 0; i < g_remotes.length; i++) {
        const remote = g_remotes[i];
        for (let j = 0; j < g_Players.length; j++) {
            const player = g_Players[j];
            dbg('Adding RemotePlayer with RemoteId [' + remote.Id + '] and PlayerId [' + player.Id + ']');
            const remotePlayer = new RemotePlayer(remote, player);
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

System.Print("Initializing " + g_DriverName + " version " + g_DriverVersion);

printDebugModes();
Init();

//#region RTI event handlers

function onCommRx(data: string, handle: number): void {
    g_serverHandlerMap.getMappedValueFromHandle(handle)?.handleIncomingData(data);
}

function onConnection(handle: number): void {
    g_serverHandlerMap.getMappedValueFromHandle(handle)?.handleConnection();
}

function onConnectionFailed(handle: number): void {
    g_serverHandlerMap.getMappedValueFromHandle(handle)?.handleDisconnect();
}

function onDisconnect(handle: number): void {
    g_serverHandlerMap.getMappedValueFromHandle(handle)?.handleDisconnect();
}

function onTimerGetPlayers(handle: number): void {
    g_serverHandlerMap.getMappedValueFromHandle(handle)?.requestPlayerList();
}

function onTimerSubscribeToPlayerStatus(handle: number): void {
    g_playerHandlerMap.getMappedValueFromHandle(handle)?.subscribeToStatus();
}

function onTimerUpdatePlayerProgress(handle: number): void {
    g_playerHandlerMap.getMappedValueFromHandle(handle)?.tickProgress();
}

//#endregion
