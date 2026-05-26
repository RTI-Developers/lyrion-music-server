const g_DriverUniqueName = "GoFuckYourSelfS1Digital";
const g_LogLevel = 0;
const g_Remote_Ids: number[] = Config.Get("SYSTEM::TwoWayDeviceList").split(' ').map(rid => parseInt(rid, 10));
const g_Max_Poll_Count = 25;
const g_Total_Players = parseInt(Config.Get("Total_Players"), 10);
const g_Customized_Remote_Count = parseInt(Config.Get("TotalRemotes"), 10);
const g_Keyboard_Layer1 = new Array('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0');
const g_Keyboard_Layer2 = new Array('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0');
const g_Keyboard_Layer3 = new Array();
const g_RemotePlayers: RemotePlayer[] = [];
const g_Check_Trial_Expired = new ScheduledEvent(timeTrialExpired, "Periodic", "Minutes", 1);
const g_DriverName = "Squeezebox";
const g_DriverVersion = "0.93";
const g_Player_Count = parseInt(Config.Get("Total_Players"), 10);
const g_Default_Server_Ip = Config.Get("Defaul_Server_IP");
const g_Default_Server_Port = parseInt(Config.Get("Default_Server_TCP_Port"), 10);
const g_Player_Names_SysVarList = new SystemVarsList<string>("ConfiguredPlayersList");
const g_Max_Now_Playing_List_Size = 10;
const g_Use_Extra_Music_Server_Info = Config.Get("UseMusicInfoAddOn") == "true";
const g_Extra_Music_Tcp_Port = parseInt(Config.Get("MusicInfoAddOnTCPPort"), 10);
const g_Socket_Connections = [];
const g_remotes: Remote[] = [];
const g_Players: Player[] = [];
const g_Servers: Server[] = [];


let g_Music_Info_Connection: TCP;
let g_Debug = Config.Get("DebugTrace") == "true";
let g_Print_Posts = Config.Get("DebugPrintPosts") == "true";
let g_Print_Incoming_Json = Config.Get("DebugPrintIncoming") == "true";
let g_Print_Incoming_Raw = Config.Get("DebugRAWIncoming") == "true";
let g_Print_Incoming_Menu = Config.Get("DebugMenuIncoming") == "true";
let g_Trial_Time_In_Minutes = 30;

let g_Trial_Expired = false;
let g_Valid_Serial_Number = false;

SystemVars.Write("TrialTimeExpired", false);
SystemVars.Write("ValidSerial", false);

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
    g_Servers.push(new Server(g_Default_Server_Ip, g_Default_Server_Port));

    for (let playerId = 1; playerId <= g_Player_Count; playerId++) {
        dbg('Configuring Server for playerId: ' + playerId);
        const useAlternateServer = (Config.Get('Use_Alt_Server_P' + padDigit(playerId)) == "true");

        if (useAlternateServer) {
            dbg('Player uses alternate server');
            const serverIp = Config.Get('Server_IP_P' + padDigit(playerId));
            const serverPort = parseInt(Config.Get('Server_TCP_Port_P' + padDigit(playerId)), 10);
            if (!getServerByIpAndPort(serverIp, serverPort)) {
                const alternateServer = new Server(serverIp, serverPort);
                dbg('Adding Server with IP [' + serverIp + '] and Port [' + serverPort + ']');
                g_Servers.push(alternateServer);
            }
        }
    }

    // Populate Player List
    for (let playerId = 1; playerId <= g_Player_Count; playerId++) {
        const player = new Player(playerId);
        player.UseDefaultServer = (Config.Get('Use_Alt_Server_P' + padDigit(playerId)) == "false");
        player.Name = Config.Get('NameP' + padDigit(playerId));

        const useAlternateServer = (Config.Get('Use_Alt_Server_P' + padDigit(playerId)) == "true");

        if (useAlternateServer) {
            const serverIp = Config.Get('Server_IP_P' + padDigit(playerId));
            const serverPort = parseInt(Config.Get('Server_TCP_Port_P' + padDigit(playerId)), 10);
            player.Server = getServerByIpAndPort(serverIp, serverPort)!;
        }
        else {
            player.Server = g_Servers[0];
        }

        dbg('Adding Player [' + playerId + ']');
        g_Players.push(player);
        player.Server.Players.push(player);
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

    if (g_Use_Extra_Music_Server_Info) {
        dbg('Starting extra music connection');
        startExtraMusicConnection();
    }
}

function setKeyBoardKeys(remotePlayer: RemotePlayer): void {
    const layer = remotePlayer.KeyboardLayout;
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);
    for (var k = 0; k < g_Keyboard_Layer1.length; k++) {
        switch (layer) {
            case 2:
                SystemVars.Write("KeyBoardP" + paddedPlayerId + "Key" + k + "%" + remotePlayer.Remote.Id, g_Keyboard_Layer2[k]);
                SystemVars.Write("KeyBoardUpperCaseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
                SystemVars.Write("NotShowingSymbolsP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
                SystemVars.Write("ShowingSymbolsP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
                break;
            case 3:
                SystemVars.Write("KeyBoardP" + paddedPlayerId + "Key" + k + "%" + remotePlayer.Remote.Id, g_Keyboard_Layer3[k]);
                SystemVars.Write("KeyBoardUpperCaseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
                SystemVars.Write("ShowingSymbolsP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
                SystemVars.Write("NotShowingSymbolsP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
                break;
            case 1:
            default:
                SystemVars.Write("KeyBoardP" + paddedPlayerId + "Key" + k + "%" + remotePlayer.Remote.Id, g_Keyboard_Layer1[k]);
                SystemVars.Write("KeyBoardUpperCaseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
                SystemVars.Write("ShowingSymbolsP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
                SystemVars.Write("NotShowingSymbolsP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
                break;
        }
    }
}

function setKeyBoardLayoutImpl(remotePlayer: RemotePlayer, layout: number): void {
    var CurrentLayout = remotePlayer.KeyboardLayout;

    switch (layout) {
        case 0:
            setKeyBoardKeys(remotePlayer);
            break;
        case 1:
        case 2:
        case 3:
            remotePlayer.KeyboardLayout = layout;
            setKeyBoardKeys(remotePlayer);
            break;
        case 4:
            switch (CurrentLayout) {
                case 1:
                    CurrentLayout = 2;

                    break;
                case 2:
                    CurrentLayout = 3;
                    break;
                case 3:
                default:
                    CurrentLayout = 1;
                    break;
            }
            remotePlayer.KeyboardLayout = CurrentLayout;
            setKeyBoardKeys(remotePlayer);
            break;
        case 5:
            switch (CurrentLayout) {
                case 1:
                    CurrentLayout = 2;
                    break;
                case 2:
                default:
                    CurrentLayout = 1;
                    break;
            }
            remotePlayer.KeyboardLayout = CurrentLayout;
            setKeyBoardKeys(remotePlayer);
            break;
        case 6:
            switch (CurrentLayout) {
                case 1:
                case 2:
                    CurrentLayout = 3;
                    break;
                default:
                    CurrentLayout = 1;
                    break;
            }
            remotePlayer.KeyboardLayout = CurrentLayout;
            setKeyBoardKeys(remotePlayer);
            break;
        default:
            break;
    }
}

function enterKeyBoardInputImpl(remotePlayer: RemotePlayer, key: number): void {
    const layer = remotePlayer.KeyboardLayout;
    let sendNow = false;

    switch (key) {
        case 101: //"return":
            sendNow = true;
            break;
        case 102: //"delete":
            remotePlayer.KeyboardData = remotePlayer.KeyboardData.substring(0, remotePlayer.KeyboardData.length - 1);
            break;
        case 103: //"clear":
            remotePlayer.KeyboardData = "";
            break;
        case 104: //"space":
            remotePlayer.KeyboardData += " ";
            break;
        default:
            switch (layer) {
                case 2:
                    remotePlayer.KeyboardData += g_Keyboard_Layer2[key];
                    break;
                case 3:
                    remotePlayer.KeyboardData += g_Keyboard_Layer3[key];
                    break;
                case 1:
                default:
                    remotePlayer.KeyboardData += g_Keyboard_Layer1[key];
                    break;
            }
            break;
    }

    if (sendNow == true) {
        //Figure out the Remote mode(Search, Playlist modifiy, create station
        const commands = remotePlayer.CurrentList.ListItems[remotePlayer.CurrentList.Selected].Actions[0].GoCmd;
        let params = remotePlayer.CurrentList.ListItems[remotePlayer.CurrentList.Selected].Actions[0].GoParams;
        params = params.replace('__TAGGEDINPUT__', remotePlayer.KeyboardData) + ',"useContextMenu:1"';
        let json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",[' + commands + ',0,' + g_Max_Poll_Count + ',' + params + ']]}' + ',"channel":"/slim/request"}]';
        json = json.replace(/\//g, "\\/");

        remotePlayer.BrowseList.Open();
        remotePlayer.BrowseList.RemoveAll();
        remotePlayer.BrowseList.Insert("Searching..");
        remotePlayer.BrowseList.Close();

        remotePlayer.CurrentList.MenuTitle = SystemVars.Read("BrowseListTitleP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id);
        this.ListLevel++;
        sendJsonCommand(json, remotePlayer.Player.Server);

        remotePlayer.KeyboardData = "";
        hideKeyboardImpl(remotePlayer);

    }
    SystemVars.Write("KeyboardTextP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, remotePlayer.KeyboardData);
}

function sendSpecificKeyImpl(remotePlayer: RemotePlayer, key: string): void {
    remotePlayer.KeyboardData += key;
    SystemVars.Write("KeyboardTextP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, remotePlayer.KeyboardData);
}

function hideKeyboardImpl(remotePlayer: RemotePlayer): void {
    SystemVars.Write("ShowingKeyboardP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, false);
}

function loadRemotesParentList(player: Player): void {
    for (let i = 0; i < g_RemotePlayers.length; i++) {
        const remotePlayer = g_RemotePlayers[i];

        if (remotePlayer.Player == player) {
            remotePlayer.CurrentList.ListItems = player.ParentMenu.ListItems;
            loadNewParentBrowseList(remotePlayer);
        }
    }
}

function loadNewParentBrowseList(remotePlayer: RemotePlayer): void {
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);

    //if there is a custom home menu for this player, then load it
    SystemVars.Write("BrowseListTitleP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, remotePlayer.Player.ParentMenu.MenuTitle);
    SystemVars.Write("BrowseListAtParentP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
    remotePlayer.BrowseList.Open();
    remotePlayer.BrowseList.RemoveAll();

    const newNames = remotePlayer.Player.CustomMenuNewNames;

    dbg('Adding ' + remotePlayer.CurrentList.ListItems.length + ' items to browse list for Remote: ' + remotePlayer.Remote.Id + ', Player: ' + remotePlayer.Player.Id);
    for (var i = 0; i < remotePlayer.CurrentList.ListItems.length; i++) {
        if (newNames.length > 0) {
            remotePlayer.CurrentList.ListItems[i].MenuTitle = newNames[i];
        }
        const title = remotePlayer.CurrentList.ListItems[i].MenuTitle;
        remotePlayer.BrowseList.Insert(title);
    }
    remotePlayer.BrowseList.SetIndexes(0, 0);
    remotePlayer.BrowseList.SetMarked(0);
    remotePlayer.BrowseList.Close();
    dbg('Browse list now contains ' + remotePlayer.BrowseList.Size + ' items');
}

//This should only be called on driver startup or when the driver reconnects to the servers
function parseParentMenu(json: string, server: Server): void {
    const parentHomeTitle = "Home";
    const serverParent: BrowseListItem = getEmptyBrowseListItem();
    serverParent.MenuTitle = parentHomeTitle;

    const ids = json["id"].split("_");
    dbg('parseParentMenu ids value is: ' + ids);

    let remotePlayer: RemotePlayer | null = null;
    if (ids.length >= 2) {
        const playerId = parseInt(ids[0], 10);
        const remoteId = parseInt(ids[1], 10);

        if (remoteId >= 0) {
            remotePlayer = getRemotePlayer(remoteId, playerId);
        }
    }

    //Store the Connection Location so we dont have to look it up later
    for (let i = 0; i < json["data"]["item_loop"].length; i++) {
        const node = json["data"]["item_loop"][i]["node"];
        const title = json["data"]["item_loop"][i]["text"];
        const id = json["data"]["item_loop"][i]["id"];
        if (node == "home" || node == "" || node == "myMusic") {
            if (title.indexOf("Search") == -1 && title != "App Gallery" && title != "Library Views" && title.indexOf("Turn Off") == -1 && title != "TuneIn Radio" || id == "myMusicSearch") { //&& Title != "Random Mix"
                if (json["data"]["item_loop"][i]["actions"] != undefined) {
                    const menuItem = getEmptyBrowseListItem();
                    const actionItems = getEmptyActionItems();
                    const item = json["data"]["item_loop"][i]["actions"];
                    menuItem.MenuTitle = title;
                    if (id == "myMusicSearch") {
                        menuItem.MenuTitle = "Local Music Search";
                    }
                    if (item["go"] != undefined) {
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, item["go"]["cmd"]);
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, item["go"]["params"]);
                        menuItem.Actions.push(actionItems);
                        serverParent.ListItems.push(menuItem);
                    }
                }
            }
        }
    }

    //Update Parent menu for all players connected to this server, check to see if they have a custom menu
    //Only update the players parent if it is empty
    for (let i = 0; i < server.Players.length; i++) {
        const player = server.Players[i];

        if (player.CustomMenuNewNames.length > 0) {
            //Remove All List Items because we are doing a custom menu   
            var customParent = getEmptyBrowseListItem();
            customParent.MenuTitle = parentHomeTitle;

            const originalNames = player.CustomMenuNames;
            const newNames = player.CustomMenuNewNames;

            for (let j = 0; j < originalNames.length; j++) {
                var newMenuItemLocation = findMenuItem(originalNames[j], serverParent.ListItems);
                if (newMenuItemLocation != null) {
                    customParent.ListItems.push(newMenuItemLocation);
                }
                player.ParentMenu = customParent;
            }
        }
    }

    //Need to check to see if the ID > 0.. if it is we are updating a specific remote
    if (remotePlayer) {
        remotePlayer.CurrentList.ListItems = remotePlayer.Player.ParentMenu.ListItems;
        //Now check to see if there is a custom home menu for this player
        loadNewParentBrowseList(remotePlayer);
    } else {
        //Now update All player menus that are using this server
        for (let i = 0; i < server.Players.length; i++) {
            const player = server.Players[i];
            if (!player.ParentMenu) {
                player.ParentMenu = serverParent;
            }
            loadRemotesParentList(player);
        }
    }
}

function parseMenu(json: string, server: Server): void {
    if (json["data"] != undefined) {
        //First look to see if this is the parent
        if (json["data"]["item_loop"][0]["node"] != undefined) {
            if (g_Print_Incoming_Menu) System.Print("Parent Menu");
            parseParentMenu(json, server);
        }
        else {
            if (g_Print_Incoming_Menu) System.Print("Submenu");
            parseSubMenu(json, server);
        }
    }
    else {
        if (g_Debug) {
            System.Print("Dont know what to do ParseMenu");
            System.Print("----------ParseMenu JSON--------------");
            printMaxLineSize(json);
            System.Print("----------END ParseMenu JSON--------------");
        }
    }
}

//Expects the RemotePlayer key in the json as ID
function parseSubMenu(json: string, server: Server): void {
    const ids = json["id"].split("_");

    let remotePlayer: RemotePlayer | null = null;
    let browseListRequestCorrelation: number | null = null;
    if (ids.length >= 3) {
        const playerId = parseInt(ids[0], 10);
        const remoteId = parseInt(ids[1], 10);
        browseListRequestCorrelation = parseInt(ids[2], 10);
        remotePlayer = getRemotePlayer(remoteId, playerId);
    }

    const totalItems = parseInt(json["data"]["count"], 10);
    const offset = parseInt(json["data"]["offset"], 10);
    const itemCount = parseInt(json["data"]["item_loop"].length, 10);
    const itemsCollected = offset + itemCount;

    if (g_Print_Incoming_Menu) {
        System.Print("remotePlayer.ListLevel=" + remotePlayer?.ListLevel);
        System.Print("totalItems=" + totalItems);
        System.Print("itemsCollected=" + itemsCollected);
        System.Print("itemCount=" + itemCount);
        System.Print("offset=" + offset);
    }

    if (!remotePlayer) {
        dbg('parseSubMenu: failed to find matching remotePlayer')
        return;
    }

    if (!browseListRequestCorrelation || remotePlayer.BrowseListRequestCorrelation != browseListRequestCorrelation) {
        dbg('parseSubMenu: json browseListRequestCorrelation value did not match current remotePlayer.BrowseListRequestCorrelation value');
        return;
    }

    //First look for to see if the player name is specifed.  if it is, we think this can only be the now plyaing list
    if (json["data"]["player_name"] != undefined) {
        //System.Print("Now Playing List");
        if (json["data"]["item_loop"] != undefined) {
            remotePlayer.NowPlayingList.Open();
            remotePlayer.NowPlayingList.RemoveAll();
            for (let i = 0; i < json["data"].item_loop.length; i++) {
                remotePlayer.NowPlayingList.Insert(json["data"]["item_loop"][i]["track"]);
            }
            remotePlayer.NowPlayingList.Close();
        }
        return;
    }

    //Not all lists return with a list title, so we will manually set it whenever a list item is selected or search
    // if (json["data"]["title"] != undefined) {
    //     //System.Print("g_Remote_Info[" + RemoteID + "].CurrentList.ListItems[" + g_Remote_Info[RemoteID].CurrentList.Selected + "].MenuTitle=" + g_Remote_Info[RemoteID].CurrentList.ListItems[g_Remote_Info[RemoteID].CurrentList.Selected].MenuTitle);
    //     if (remotePlayer.CurrentList.ListItems[remotePlayer.CurrentList.Selected].MenuTitle.length == 0) {
    //         remotePlayer.CurrentList.ListItems[remotePlayer.CurrentList.Selected].MenuTitle = json["data"]["title"];
    //         SystemVars.Write("BrowseListTitleP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, json["data"]["title"].toString());
    //     }

    //     //Pandora Hack to skip showing the create channel list
    //     if (remotePlayer.Player.ShouldSkipFirstPandoraMenu == true) {
    //         if (json["data"]["title"].toString().toLowerCase() == "pandora") {
    //             if (json["data"]["item_loop"] != null) {
    //                 for (let i = 0; i < json["data"]["item_loop"].length; i++) {
    //                     const item = json["data"]["item_loop"][i];
    //                     if (item["text"] == "Your Stations") {
    //                         const actionItems = getEmptyActionItems();
    //                         const goCMD = getMenuDetails(actionItems.GoCmd, item["actions"]["go"]["cmd"]);
    //                         const goParams = getMenuDetails(actionItems.GoParams, item["actions"]["go"]["params"]);
    //                         const toSend = ('[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' +
    //                                                                       server.ClientId +
    //                                                                       '/slim/request","request":["' +
    //                                                                       remotePlayer.Player.MacAddress.toLowerCase() +
    //                                                                       '",[' + goCMD + ',' +
    //                                                                       goParams + ']]}' + ',"channel":"/slim/request"}]');
    //                         sendJsonCommand(toSend, server);
    //                         break;
    //                     }
    //                 }
    //                 //We dont want to do anything else because we are by passing this list
    //                 return;
    //             }
    //         }
    //     }
    // }

    const moreOptions = getEmptyActionItems();

    remotePlayer.BrowseList.Open();
    let moreOptionsAvailable = false;
    if (json["data"]["base"] != undefined) {
        if (json["data"]["base"]["actions"]['set-preset-0'] != undefined) {
            //if(g_Print_Incoming_Menu) System.Print("Should Be showing more options");
            SystemVars.Write("MoreOptionsAvailableP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, true);
            moreOptionsAvailable = true;

            moreOptions.AddParams = getMenuDetails(moreOptions.AddParams, json["data"]["base"]["actions"]["add"]["params"]);
            moreOptions.AddCmd = getMenuDetails(moreOptions.AddCmd, json["data"]["base"]["actions"]["add"]["cmd"]);

            moreOptions.PlayParams = getMenuDetails(moreOptions.PlayParams, json["data"]["base"]["actions"]["play"]["params"]);
            moreOptions.PlayCmd = getMenuDetails(moreOptions.PlayCmd, json["data"]["base"]["actions"]["play"]["cmd"]);

            moreOptions.AddHoldParams = getMenuDetails(moreOptions.AddHoldParams, json["data"]["base"]["actions"]['add-hold']["params"]);
            moreOptions.AddHoldCmd = getMenuDetails(moreOptions.AddHoldCmd, json["data"]["base"]["actions"]['add-hold']["cmd"]);

            if (json["data"]["base"]["actions"]["go"] != undefined) {
                moreOptions.GoParams = getMenuDetails(moreOptions.PlayParams, json["data"]["base"]["actions"]["go"]["params"]);
                moreOptions.GoCmd = getMenuDetails(moreOptions.PlayCmd, json["data"]["base"]["actions"]["go"]["cmd"]);
            }
            remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel] = moreOptions;
        }
    }

    //If the Offset is 0 and there are more items to get then we are at the start of the list
    if (offset == 0 && totalItems >= itemCount || totalItems == 0) {
        remotePlayer.BrowseList.RemoveAll();
    }

    if (json["data"]["item_loop"] != null) {
        const count = parseInt(json["data"]["count"], 10);
        if (count == 0) {
            if (json["data"]["window"]["textarea"] != undefined) {
                remotePlayer.BrowseList.RemoveAll();
                const menuItem = getEmptyBrowseListItem();
                menuItem.MenuTitle = json["data"]["window"]["textarea"];
                remotePlayer.ListAppend(menuItem);
                remotePlayer.BrowseList.Close();
                return;
            }
        }

        for (let i = 0; i < json["data"]["item_loop"].length; i++) {
            var item = json["data"]["item_loop"][i];
            var shouldProcess = true;
            //If we dont have a action for the item then dont show it(this was introduced in LMS 7.9 while browsing local music collections
            if (item["action"] != undefined) {
                if (item["action"] == "none") {
                    // Process = false;
                    //Need to clear out the selected item list items
                    //g_Remote_Info[RemoteID].CurrentList.ListItems.splice(i, 1);
                }
            }
            if (item["text"].toLowerCase() == "on mysqueezebox.com" && remotePlayer.Player.ShouldHideMySqueezebox) {
                shouldProcess = false;
            }

            if (shouldProcess) {
                var menuItem = getEmptyBrowseListItem();
                var actionItems = getEmptyActionItems();
                menuItem.MenuTitle = System.ConvertFromUTF8(item["text"]);

                if (item["presetParams"] != undefined) {
                    //System.Print("presetParams exist");
                    if (item["presetParams"]["favorites_url"] != undefined) {
                        menuItem.FavoritesUrl = replaceAll(item["presetParams"]["favorites_url"], '"', "");
                        menuItem.FavoritesTitle = item["presetParams"]["favorites_title"];
                        if (System.LogLevel==1) {
                            System.LogInfo(1, menuItem.FavoritesTitle + " url:" + menuItem.FavoritesUrl);
                        }
                    }
                }

                actionItems.CommonParams = getMenuDetails(actionItems.CommonParams, item["commonParams"]);
                actionItems.Params = getMenuDetails(actionItems.Params, item["params"]);

                if (item["actions"] != undefined) {
                    if (item["actions"]["play"] != undefined || item["actions"]['add-hold'] != undefined || item["actions"]["add"] != undefined || item["actions"]["more"] != undefined) {
                        moreOptionsAvailable = true;
                    }
                    if (item["actions"]["play"] != undefined) {
                        actionItems.PlayCmd = getMenuDetails(actionItems.PlayCmd, item["actions"]["play"]["cmd"]);
                        actionItems.PlayParams = getMenuDetails(actionItems.PlayCmd, item["actions"]["play"]["params"]);
                    }
                    if (item["actions"]['add-hold'] != undefined) {
                        actionItems.AddHoldCmd = getMenuDetails(actionItems.AddHoldCmd, item["actions"]['add-hold']["cmd"]);
                        actionItems.AddHoldParams = getMenuDetails(actionItems.AddHoldParams, item["actions"]['add-hold']["params"]);
                    }
                    if (item["actions"]["add"] != undefined) {
                        actionItems.AddCmd = getMenuDetails(actionItems.AddCmd, item["actions"]["add"]["cmd"]);
                        actionItems.AddParams = getMenuDetails(actionItems.AddParams, item["actions"]["add"]["params"]);
                    }
                    if (item["actions"]["go"] != undefined) {
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, item["actions"]["go"]["cmd"]);
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, item["actions"]["go"]["params"]);
                    }
                    if (item["actions"]["more"] != undefined) {
                        actionItems.MoreCmd = getMenuDetails(actionItems.MoreCmd, item["actions"]["more"]["cmd"]);
                        actionItems.MoreParams = getMenuDetails(actionItems.MoreParams, item["actions"]["more"]["params"]);
                    }
                }

                if (item["goAction"] == "play" || item["goAction"] == "playControl") {
                    //Change the Go Command to the play command
                    menuItem.PlayOnly = true;
                    //First check to see if this item has a play command.. if it does then use it instead of the base
                    if (item["actions"] != undefined) {
                        if (item["actions"]["play"] != undefined) {
                            actionItems.GoCmd = actionItems.PlayCmd;
                            actionItems.GoParams = actionItems.PlayParams;
                        }
                        else if (item["goAction"] == "playControl") {//We dont have a play command for this item, so get the play command from more options and append the params from this item because it is a play only option
                            //This was added to compensate for the difference with BMF in LMS 7.9..
                            if (actionItems.GoCmd.length > 0) {
                                actionItems.GoCmd = actionItems.PlayCmd;
                                actionItems.GoParams = actionItems.PlayParams;
                            }
                            else {
                                actionItems.GoCmd = moreOptions.PlayCmd;
                                actionItems.GoParams = moreOptions.PlayParams + ',"touchToPlay:' + item["params"]["item_id"] + '","isContextMenu:1","item_id:' + item["params"]["item_id"] + '"';
                            }
                        }
                    }
                    else {
                        actionItems.GoCmd = "";
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, json["data"]["base"]["actions"]["play"]["cmd"]);
                        actionItems.GoParams = "";
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, json["data"]["base"]["actions"]["play"]["params"]);
                        if (item["params"] != undefined) {
                            actionItems.GoParams = getMenuDetails(actionItems.GoParams, item["params"]);
                        }
                        if (item["commonParams"] != undefined) {
                            actionItems.GoParams = getMenuDetails(actionItems.GoParams, item["commonParams"]);
                        }
                        if (item["playallParams"] != undefined) {
                            //playallParams
                            actionItems.GoParams = getMenuDetails(actionItems.GoParams, item["playallParams"]);

                            //WTF is up with all of these inconsistancies!!!  if this is a Artist, Album root selection, we need to remove some items so this will work correctly  FUCK ME!! 
                            //Hack fix that will need to be readdressed
                            //System.Print("********************************** ActionItems.GoParams=" + ActionItems.GoParams);
                            var Params = actionItems.GoParams.split(',');
                            actionItems.GoParams = "";
                            for (var p = 0; p < Params.length; p++) {
                                if (Params[p].indexOf('"sort') == -1 && Params[p].indexOf('"track_id') == -1) {
                                    actionItems.GoParams += Params[p] + ",";
                                }
                            }
                            actionItems.GoParams = actionItems.GoParams.substring(0, actionItems.GoParams.length - 1);
                        }
                    }
                }

                //If there is a go command then add it if it hasn't already been added this is duplicate data, so may need to come back and come up with a better way to store or retrieve this data.
                if (json["data"]["base"] != null) {
                    if (json["data"]["base"]["actions"]["go"] != undefined && actionItems.GoCmd.length == 0) {
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, json["data"]["base"]["actions"]["go"]["cmd"]);
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, json["data"]["base"]["actions"]["go"]["params"]);

                        if (actionItems.Params.length > 0) {
                            actionItems.GoParams += ',' + actionItems.Params;
                        }
                        if (actionItems.CommonParams.length > 0) {
                            actionItems.GoParams += ',' + actionItems.CommonParams;
                        }
                    }
                }
                if (actionItems.CommonParams.length == 0) {
                    actionItems.CommonParams = getItemIdValuePair(actionItems.GoParams);
                }
                //CommonParams

                //typical more checks needed...wtf new found issues with local music browseing my folder in LMS 7.9
                menuItem.Actions.push(actionItems);
                menuItem.MoreOptionsAvailable = moreOptionsAvailable;
                remotePlayer.ListAppend(menuItem);
            }
        }
    }

    SystemVars.Write("BrowseListSizeP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, remotePlayer.BrowseList.Size);
    SystemVars.Write("MoreOptionsAvailableP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, moreOptionsAvailable);
    SystemVars.Write("MoreOptionsNotAvailableP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, (moreOptionsAvailable == false));
    SystemVars.Write("ShowingMoreOptionsBrowseP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, false);

    remotePlayer.CurrentList.MoreOptionsAvailable = moreOptionsAvailable;
    remotePlayer.BrowseList.Close();

    if (offset == 0 && totalItems >= itemCount || totalItems == 0) {
        remotePlayer.CurrentList.ListItems[remotePlayer.CurrentList.Selected].MoreOptionsAvailable = moreOptionsAvailable;
    }
    
    dbg('Finished parsing submenu page.  itemsCollected: ' + itemsCollected + ' of totalItems: ' + totalItems);
    if (itemsCollected < totalItems) {  //We have to get more pages..
        //get the last selected item, so we know what command to send if we have a offset
        //System.Print("Go get more items");

        remotePlayer.Offset = itemsCollected;
        const toSend = ('[{"id": "' + json["id"] + '","data":{"response":"/' + server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress.toLowerCase() + '",[' + remotePlayer.BrowseListParentActionItems.GoCmd + ',' + remotePlayer.Offset + ',' + g_Max_Poll_Count + ',' + remotePlayer.BrowseListParentActionItems.GoParams + ']]}' + ',"channel":"/slim/request"}]');
        sendJsonCommand(toSend, server);
    }
    else {
        //We have the entire list loaded
        remotePlayer.CurrentList.Offset = 0;
    }
}

function getMenuDetails(menuItem: string, item: object): string {
    if (item != undefined) {
        var params = "";

        if (menuItem.length > 0) {
            params += ",";
        }

        for (var param in item) {
            params += isInteger(param) ? '"' + item[param] + '",' : '"' + param + ":" + item[param] + '",';
        }

        if (params.length > 1) {
            params = params.substring(0, params.length - 1);
        }

        menuItem += params;
    }

    return menuItem;
}

function updatePlayerState(json: string, server: Server): void {
    //if there is more then one data object, then we have synced players, so enumerate the data objects.
    if (json["data"] == undefined) { return; }

    let player: Player | undefined = undefined;
    for (let i = 0; i < server.Players.length; i++) {
        if (server.Players[i].Name == json["data"]["player_name"]) {
            player = server.Players[i];
            break;
        }
    }

    if (!player) { return; }
    
    //current_title
    let updateVars = false;
    const paddedPlayerId = padDigit(player.Id);
    const info = json["data"];
    const playerConnected = info["player_connected"] == "1";

    if (player.Mode != info["mode"] || player.Connected != playerConnected) {
        updateVars = true;
    }

    var syncedPlayers = player.SyncedPlayers.length;
    if (json["data"]["sync_master"] != undefined) {
        player.SyncedPlayers = [];

        //First Push the Master to the SyncedPlayersList
        let masterPlayer: Player | undefined = undefined;
        for (let i = 0; i < server.Players.length; i++) {
            if (server.Players[i].MacAddress == json["data"]["sync_master"]) {
                masterPlayer = server.Players[i];
                break;
            }
        }
    
        if (masterPlayer) {
            player.SyncedPlayers.push(masterPlayer);
        }

        if (json["data"]["sync_master"] == player.MacAddress) {
            player.IsSynced = true;
            player.IsSyncMaster = true;
            player.IsSyncSlave = false;
        }
        else {
            player.IsSyncMaster = false;
        }

        //Now look for the synced slave players
        if (json["data"]["sync_slaves"] != undefined) {
            const syncList = json["data"]["sync_slaves"].split(",");
            for (let i = 0; i < syncList.length; i++) {
                let slavePlayer: Player | undefined = undefined;
                for (let j = 0; j < server.Players.length; j++) {
                    if (server.Players[j].MacAddress == syncList[i]) {
                        slavePlayer = server.Players[j];
                        break;
                    }
                }

                if (slavePlayer) {
                    player.SyncedPlayers.push(slavePlayer);
                    slavePlayer.IsSynced = true;
                    slavePlayer.IsSyncMaster = false;
                    slavePlayer.IsSyncSlave = true;
                }
            }
        }
    }
    else {
        player.IsSynced = false;
        player.IsSyncMaster = false;
        player.IsSyncSlave = false;
        player.SyncedPlayers = [];
    }

    if (syncedPlayers != player.SyncedPlayers.length) {
        updateVars = true;
    }

    var volume = parseInt(info["mixer volume"], 10);
    if (volume != player.Volume) {
        updateVars = true;
    }
    player.Volume = volume;
    if (volume < 1) {
        player.Muted = true;
    }
    else {
        player.Muted = false;
    }

    if (info["current_title"] != undefined) {
        player.StationName = info["current_title"];
    }
    else {
        player.StationName = "";
    }

    if (info["mode"] != player.Mode) {
        switch (info["mode"]) {
            case "play":
                System.SignalEvent("PlayingP" + paddedPlayerId);
                break;
            case "pause":
                System.SignalEvent("PausedP" + paddedPlayerId);
                break;
            case "stop":
                System.SignalEvent("StoppedP" + paddedPlayerId);
                break;
        }
    }

    player.Connected = playerConnected;

    if (player.IsSyncSlave) {
        //We are done so pass this on and up date all their data with the synced master
        //Maybe just return here, all synced players wil have been previously updated when the master was loaded.
        //System.Print("Synced Player " + player.Name);
        if (updateVars) {
            SystemVars.Write("VolumeLevelP" + paddedPlayerId, player.Volume);
        }
        //We should have already updated everything else for this player, so just update the volume level
        return;
    }

    player.Mode = info["mode"];

    if (info["mode"] != "play") {
        player.NowPlayingTimer.Stop();
    }
    else {
        player.NowPlayingTimer.Stop();
        player.NowPlayingTimer.Start(onTimerUpdatePlayerProgress, 1000);
    }

    player.Progress = parseInt(info["time"], 10);

    if (info["duration"] != undefined) {
        player.Duration = parseInt(info["duration"], 10);
        player.Remaining = player.Duration - player.Progress;
    }
    else {
        player.Duration = 0;
        player.Remaining = 0;
    }

    if (info["can_seek"] != undefined && player.Duration > 0) {
        player.CanSeek = (info["can_seek"] == "1");
    }
    else {
        player.CanSeek = false;
    }

    player.PlaylistLastCurrentIndex = player.PlaylistCurrentIndex;  //Used to unmark last selected item
    player.PlaylistCurrentIndex = parseInt(info["playlist_cur_index"], 10);

    const shuffleType = parseInt(info["playlist shuffle"], 10);
    const repeatType = parseInt(info["playlist repeat"], 10);
    const poweredOn = (info["power"] == "1");

    if (poweredOn != player.PoweredOn) {
        if (poweredOn == true) {
            System.SignalEvent("PONP" + paddedPlayerId);
        }
        else {
            System.SignalEvent("POFFP" + paddedPlayerId);
        }
    }

    //Need to check this....
    if (player.ShuffleType != shuffleType || player.RepeatType != repeatType || player.PoweredOn != poweredOn) {
        updateVars = true;
    }

    player.RepeatType = repeatType;
    player.Repeat = (player.RepeatType > 0);
    player.ShuffleType = shuffleType;
    player.Shuffle = (player.ShuffleType > 0);
    player.PoweredOn = poweredOn;

    player.PlaylistCount = parseInt(info["playlist_tracks"], 10);

    if (info["playlist_timestamp"] != player.PlaylistTimestamp) {
        //System.Print("Resetting Playlist");
        player.Playlist = [];
        player.PlaylistReset = true;
        player.PlaylistLastCurrentIndex = 0; //Set to 0 because we are reloading the list, it will be corrected on the next now playing pull

        //System.Print("**************************  " + Info.playlist_timestamp + "   **************************************");
        //System.Print("**************************  " + player.Playlist_Timestamp + "   **************************************");
        //System.Print("**************************  " + Info.remoteMeta + "   **************************************");
    }
    else {
        player.PlaylistReset = false;
    }
    player.PlaylistTimestamp = info["playlist_timestamp"];

    if (info["playlist_loop"] != undefined && player.IsSyncSlave == false) {
        const lastPlayistItemIndex = parseInt(info["playlist_loop"][info["playlist_loop"].length - 1]["playlist index"], 10) + 1;
        const playListCount = parseInt(info["playlist_loop"].length, 10);
        //System.Print("PlayListCount=" + PlayListCount);
        if (player.Playlist.length <= player.PlaylistCount) {
            for (let i = 0; i < info["playlist_loop"].length; i++) {
                const playListItem = getEmptyPlaylistItem();
                try {
                    const playerInfo = info["playlist_loop"][i];

                    if (playerInfo["lyrics"] != undefined) {
                        // System.Print(PlayerInfo["lyrics"]);
                    }
                    playListItem.Id = playerInfo["id"];
                    playListItem.Url = info["playlist_loop"][i].url;

                    playListItem.Duration = info["playlist_loop"][i].duration;

                    playListItem.Title = System.ConvertFromUTF8(info["playlist_loop"][i]["title"]);
                    var crapTitle = playListItem.Title.indexOf('text=');
                    if (crapTitle > -1) {
                        playListItem.Title = playListItem.Title.substring(crapTitle + 6);
                        playListItem.Title = playListItem.Title.substring(0, playerInfo["title"].indexOf('"'));
                    }

                    if (playerInfo["album"] != undefined) {
                        if (playerInfo["album"] != playerInfo["title"]) {
                            playListItem.Album = System.ConvertFromUTF8(playerInfo["album"]);
                        }
                    }
                    else if (playerInfo["remote_title"] != undefined) {
                        if (playerInfo["remote_title"] != playerInfo["title"]) {
                            playListItem.Album = System.ConvertFromUTF8(info["playlist_loop"][i]["remote_title"]);
                        }
                    }

                    if (playerInfo["artist"] != undefined) {
                        playListItem.Artist = System.ConvertFromUTF8(playerInfo["artist"]);
                    }
                    else if (playerInfo["albumartist"] != undefined) {
                        playListItem.Artist = System.ConvertFromUTF8(playerInfo["albumartist"]);
                    }

                    var artUrl = "";
                    if (playerInfo["artwork_url"] != undefined) {
                        artUrl = playerInfo["artwork_url"].toString();
                        if (artUrl.substring(0, 4) != "http") {
                            artUrl = "http://" + server.Ip + ":" + server.Port + "/" + artUrl.replace(/^\//, '');
                        }

                    }
                    else if (playerInfo["artwork_track_id"] != undefined) {
                        artUrl = "http://" + server.Ip + ":" + server.Port + "/music/" + playerInfo["artwork_track_id"] + "/cover.jpg";
                    }
                    playListItem.ArtUrl = artUrl;

                    //System.Print("************************Now Playing Loop**************************************");
                    //System.Print("PlayerInfo.artist=" + PlayerInfo.artist);
                    //System.Print("Play_List_Item.Title=" + Play_List_Item.Title);
                    //System.Print("Play_List_Item.Album=" + Play_List_Item.Album);

                    playListItem.Remote = info["playlist_loop"][i]["remote"];

                    if (playerInfo["type"] != undefined) {
                        playListItem.Type = playerInfo["type"];
                    }
                    else {
                        playListItem.Type = "";
                    }

                    if (playerInfo["bitrate"] != undefined) {
                        playListItem.BitRate = playerInfo["bitrate"];
                    }
                    else {
                        playListItem.BitRate = "";
                    }

                    if (playerInfo["genre"] != undefined) {
                        playListItem.Genre = playerInfo["genre"];
                    }
                    else {
                        playListItem.Genre = "";
                    }

                    player.Playlist.push(playListItem);
                }
                catch (err) {
                    System.Print("%%%%%%%%%%%%%%%%%% Playlist Error %%%%%%%%%%%%%%%%%%%%%%%%%%%");
                    System.Print("err with play list count error was " + err);
                    //quick hack fix that will be readdressed later
                    player.PlaylistCount--;
                }
            }

            if (player.Playlist.length < player.PlaylistCount && player.IsSyncSlave == false) {
                var json = '[{"id": "' + json["id"] + '","data":{"response":"\/' + server.ClientId + '\/slim\/request","request":["' + player.MacAddress + '",["status",' + lastPlayistItemIndex + ',25,"tags:uBjJKlaxdecNoptyw"]]}' + ',"channel":"\/slim\/request"}]';
                sendJsonCommand(json, server);
            }
        }
    }

    let nowPlayingInfo = player.Playlist[player.PlaylistCurrentIndex];
    
    // const nowPlayerProperties: string[] = [];
    // for (let prop in nowPlayingInfo) {
    //     nowPlayerProperties.push(prop + ':' + nowPlayingInfo[prop]);
    // }
    // dbg('nowPlayingInfo: ' + nowPlayerProperties.join(', '));

    // if (!nowPlayingInfo) {
    //     dbg('Null PlaylistItem, creating empty one');
    //     nowPlayingInfo = getEmptyPlaylistItem();
    //     player.PlaylistCurrentIndex = 0;
    // }

    //Remote Meta Data will take priority,if it exists we will use it instead.
    if (info["remoteMeta"] != undefined) {
        nowPlayingInfo.Title = info["remoteMeta"]["title"] || "";
        const hasBadTitle = nowPlayingInfo.Title?.indexOf('text=') ?? -1;
        if (hasBadTitle > -1) {
            nowPlayingInfo.Title = nowPlayingInfo.Title.substring(hasBadTitle + 6);
            nowPlayingInfo.Title = nowPlayingInfo.Title.substring(0, nowPlayingInfo.Title.indexOf('"'));
        }
        nowPlayingInfo.Artist = info["remoteMeta"]["artist"];
        if (info["remoteMeta"]["album"] != undefined) {
            nowPlayingInfo.Album = info["remoteMeta"]["album"];
        }
        else if (info["remoteMeta"]["remote_title"] != undefined) {
            nowPlayingInfo.Album = info["remoteMeta"]["remote_title"];
        }
        if (info["remoteMeta"]["type"] != undefined) {
            nowPlayingInfo.Type = info["remoteMeta"]["type"];
        }
        let artURL = "";
        if (info["remoteMeta"]["artwork_url"] != undefined) {
            artURL = info["remoteMeta"]["artwork_url"].toString();
            if (artURL.substring(0, 4) != "http") {
                artURL = "http://" + player.Server.Ip + ":" + player.Server.Port + "/" + artURL.replace(/^\//, '');
            }

        }
        else if (info["remoteMeta"]["artwork_track_id"] != undefined) {
            artURL = "http://" + player.Server.Ip + ":" + player.Server.Port + "/music/" + info["remoteMeta"]["artwork_track_id"] + "/cover.jpg";
        }
        nowPlayingInfo.ArtUrl = artURL;

        if (player.BitRate == undefined) {
            player.BitRate = "";
        }
        if (nowPlayingInfo.Artist == undefined) {
            nowPlayingInfo.Artist = "";
        }
        if (nowPlayingInfo.Album == undefined) {
            nowPlayingInfo.Album = "";
        }
        if (info["remoteMeta"]["url"] != undefined) {
            player.NowPlayingUrl = info["remoteMeta"]["url"];
        }
        else {
            player.NowPlayingUrl = "";
        }
    }

    if (updateVars == false) {
        try {
            updateVars = (player.Title != nowPlayingInfo.Title);
        }
        catch (Error) {
            System.Print("player.Playlist_Cur_Index=" + player.PlaylistCurrentIndex);
            System.Print("Error=" + Error);
        }
    }

    if (updateVars == true) {
        var Title = System.ConvertFromUTF8(nowPlayingInfo.Title);

        if (player.Title != Title) {
            System.SignalEvent("SongChangeP" + paddedPlayerId);
            player.HasPandoraThumbsUp = false;
        }

        player.Title = Title;
        player.Artist = System.ConvertFromUTF8(nowPlayingInfo.Artist);
        player.Album = System.ConvertFromUTF8(nowPlayingInfo.Album);
        player.NowPlayingCoverArt = nowPlayingInfo.ArtUrl;
        player.Genre = nowPlayingInfo.Genre;
        player.BitRate = nowPlayingInfo.BitRate;
        if (nowPlayingInfo.Type != undefined) {
            player.IsPlayingPandora = (nowPlayingInfo.Type.indexOf("(Pandora)") > -1);
            player.Type = nowPlayingInfo.Type
        }
        else {
            player.IsPlayingPandora = false;
            player.Type = "";
        }

        if (info["remoteMeta"] != undefined) {
            dbg('Setting Player: ' +player.Id + ' BitRate from info["remoteMeta"]["bitrate"]: ' + info["remoteMeta"]["bitrate"]);
            if (info["remoteMeta"]["bitrate"] != undefined) {
                player.BitRate = info["remoteMeta"]["bitrate"];
            }

            if (info["remoteMeta"]["album"] != undefined) {
                player.Album = System.ConvertFromUTF8(info["remoteMeta"]["album"]);
            }
        }

        //Now update the masters info
        updatePlayerVariables(player);
        //Send additional info to Music informatoin driver if it is being used
        writeDataToMusicInfoDriver(player);

        if (player.SyncedPlayers.length > 0) {
            //Update their vars to mirror the masters, then update all data for all remotes
            for (let i = 0; i < player.SyncedPlayers.length; i++) {
                const syncedPlayer = player.SyncedPlayers[i];
            
                syncedPlayer.Title = player.Title;
                syncedPlayer.Artist = player.Artist;
                syncedPlayer.Album = player.Album;
                syncedPlayer.NowPlayingCoverArt = player.NowPlayingCoverArt;
                syncedPlayer.Genre = player.Genre;
                syncedPlayer.BitRate = player.BitRate;
                syncedPlayer.CanSeek = player.CanSeek;
                syncedPlayer.Repeat = player.Repeat;
                syncedPlayer.RepeatType = player.RepeatType;
                syncedPlayer.Shuffle = player.Shuffle;
                syncedPlayer.ShuffleType = player.ShuffleType;
                syncedPlayer.IsPlayingPandora = player.IsPlayingPandora;
                syncedPlayer.HasPandoraThumbsUp = player.HasPandoraThumbsUp;
                syncedPlayer.Type = player.Type;
                syncedPlayer.Progress = player.Progress;
                syncedPlayer.Duration = player.Duration;
                syncedPlayer.ProgressBar = player.ProgressBar;
                syncedPlayer.SongID = player.SongID;
                syncedPlayer.Mode = player.Mode;
                syncedPlayer.StationName = player.StationName;

                syncedPlayer.PlaylistCurrentIndex = player.PlaylistCurrentIndex;
                syncedPlayer.PlaylistCount = player.PlaylistCount;
                syncedPlayer.Playlist = player.Playlist;

                updatePlayerVariables(syncedPlayer);
                //Send additional info to Music informatoin driver if it is being used
                writeDataToMusicInfoDriver(syncedPlayer);
            }
        }
    }
}

function updatePlayerVariables(player: Player): void {
    var paddedPlayerId = padDigit(player.Id);

    SystemVars.Write("MACP" + paddedPlayerId, player.MacAddress);

    SystemVars.Write("ConnectedP" + paddedPlayerId, player.Connected == true);
    SystemVars.Write("NotConnectedP" + paddedPlayerId, player.Connected == false);

    SystemVars.Write("PoweredOnP" + paddedPlayerId, player.PoweredOn == true);
    SystemVars.Write("PoweredOffP" + paddedPlayerId, player.PoweredOn == false);

    SystemVars.Write("SyncMasterP" + paddedPlayerId, player.IsSyncMaster);
    SystemVars.Write("SyncSlaveP" + paddedPlayerId, player.IsSyncSlave);

    SystemVars.Write("CurrentCoverURLP" + paddedPlayerId, "", "IMGURL");
    SystemVars.Write("TitleP" + paddedPlayerId, player.Title);
    SystemVars.Write("ArtistP" + paddedPlayerId, player.Artist);
    SystemVars.Write("AlbumP" + paddedPlayerId, player.Album);
    SystemVars.Write("PlayingP" + paddedPlayerId, player.Mode == "play");
    SystemVars.Write("PausedP" + paddedPlayerId, player.Mode == "pause");
    SystemVars.Write("StoppedP" + paddedPlayerId, player.Mode == "stop");
    SystemVars.Write("VolumeMutedP" + paddedPlayerId, player.Muted);
    
    SystemVars.Write("VolumeLevelP" + paddedPlayerId, player.Volume);
    SystemVars.Write("CanSeekP" + paddedPlayerId, player.CanSeek);
    SystemVars.Write("CantSeekP" + paddedPlayerId, player.CanSeek == false);

    SystemVars.Write("RepeatP" + paddedPlayerId, player.Repeat);
    SystemVars.Write("RepeatTypeP" + paddedPlayerId, player.RepeatType);
    SystemVars.Write("ShuffleP" + paddedPlayerId, player.Shuffle);
    SystemVars.Write("ShuffleTypeP" + paddedPlayerId, player.ShuffleType);
    SystemVars.Write("StationNameP" + paddedPlayerId, player.StationName);

    updatePlayerProgressVariables(player);

    SystemVars.Write("PlayingPandoraP" + paddedPlayerId, player.IsPlayingPandora);
    SystemVars.Write("NotPlayingPandoraP" + paddedPlayerId, player.IsPlayingPandora == false);

    SystemVars.Write("PandoraThumbsUpP" + paddedPlayerId, player.HasPandoraThumbsUp);
    SystemVars.Write("TypeP" + paddedPlayerId, player.Type);
    SystemVars.Write("BitRateP" + paddedPlayerId, player.BitRate);

    if (player.Title.length == 0) {
        SystemVars.Write("SongTitleAvailableP" + paddedPlayerId, false);
    }
    else {
        SystemVars.Write("SongTitleAvailableP" + paddedPlayerId, true);
    }
    if (player.Album.length == 0) {
        SystemVars.Write("AlbumTitleAvailableP" + paddedPlayerId, false);
    }
    else {
        SystemVars.Write("AlbumTitleAvailableP" + paddedPlayerId, true);
    }

    if (player.Artist.length == 0) {
        SystemVars.Write("ArtistTitleAvailableP" + paddedPlayerId, false);
    }
    else {
        SystemVars.Write("ArtistTitleAvailableP" + paddedPlayerId, true);
    }

    if (player.IsSynced == true) {
        var SyncedWith = "";
        for (let i = 0; i < player.SyncedPlayers.length; i++) {
            if (player.SyncedPlayers[i].Name != player.Name) {
                SyncedWith += player.SyncedPlayers[i] + ",";
            }
        }
        SystemVars.Write("SyncedPlayerStringP" + paddedPlayerId, SyncedWith.substring(0, SyncedWith.length - 1));
    }
    else {
        SystemVars.Write("SyncedPlayerStringP" + paddedPlayerId, "");
    }

    if (player.NowPlayingCoverArt.length == 0) {
        player.NowPlayingCoverArt = "http://" + player.Server.Ip + ":" + player.Server.Port + "/music/" + player.SongID + "/cover_128x128_p.png";
    }
    else if (player.NowPlayingCoverArt.indexOf("http") == -1) {
        player.NowPlayingCoverArt = "http://" + player.Server.Ip + ":" + player.Server.Port  + "/" + player.NowPlayingCoverArt.replace(/^\//, '');
    }
    SystemVars.Write("CurrentCoverURLP" + paddedPlayerId, player.NowPlayingCoverArt, "IMGURL", "ForcePropagate");
}

function updatePlayerProgressVariables(player: Player): void {
    var paddedPlayerId = padDigit(player.Id);
    SystemVars.Write("ProgressP" + paddedPlayerId, toTimeString(player.Progress));
    if (player.Duration > 0) {
        //Check to see if seek is available
        SystemVars.Write("DurationAvailableP" + paddedPlayerId, true);
        SystemVars.Write("DurationP" + paddedPlayerId, toTimeString(player.Duration));
        if (player.Remaining > -1) {
            SystemVars.Write("RemainingP" + paddedPlayerId, toTimeString(player.Remaining));
            SystemVars.Write("ProgressBarP" + paddedPlayerId, player.ProgressBar);
        }
    }
    else {
        SystemVars.Write("DurationAvailableP" + paddedPlayerId, false);
        SystemVars.Write("CantSeekP" + paddedPlayerId, false);

    }
}

function clearAllBrowseModes(remotePlayer: RemotePlayer): void {
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);
    SystemVars.Write("SelectModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    SystemVars.Write("PlayModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    SystemVars.Write("AddNextModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    SystemVars.Write("AddEndModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    SystemVars.Write("FavoritesModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
}

function setBrowseModeImpl(remotePlayer: RemotePlayer, mode: number): void {
    clearAllBrowseModes(remotePlayer);

    const paddedPlayerId = padDigit(remotePlayer.Player.Id);
    let existingMode = parseInt(SystemVars.Read("SelectModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id), 10);
    if (mode == 99) {
        existingMode++;
        if (existingMode > 4) existingMode = 0;
        mode = existingMode;
    }
    switch (mode) {
        case 0: //"select":
            SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, mode);
            SystemVars.Write("SelectModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
        case 1: //"play":
            SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, mode);
            SystemVars.Write("PlayModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
        case 2: //"addnext":
            SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, mode);
            SystemVars.Write("AddNextModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
        case 3: //"addend":
            SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, mode);
            SystemVars.Write("AddEndModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
        case 4: //"favorites":
            SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, mode);
            SystemVars.Write("FavoritesModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
    }
}

function setPlaylistModeImpl(remotePlayer: RemotePlayer, mode: number): void {
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
            unselectNowPlayingItem(remotePlayer);
            break;
        case 1:
            SystemVars.Write("PlayListPlayModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
            SystemVars.Write("PlayListSelectModeP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
            break;
    }
}

function unselectNowPlayingItem(remotePlayer: RemotePlayer): void {
    remotePlayer.PlayListChangeCommands = []; //Clear out any commands because we have canceled
    remotePlayer.NowPlayingList.Open();
    const lastItem = remotePlayer.LastPlayListSelectedItem;
    remotePlayer.NowPlayingList.ModifyAt(lastItem, "(" + (lastItem + 1) + ") " + remotePlayer.Player.Playlist[lastItem].Title);
    remotePlayer.NowPlayingList.Close();
}

function setShowMoreOptionsPopupImpl(remotePlayer: RemotePlayer, mode: string) {
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

function getPlayerStatusImpl(remotePlayer: RemotePlayer): void {
    // TODO: figure out json variable re-assignment

    //From my list works
    var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary","items",0,25,"menu:browselibrary","mode:bmf","item_id:0"]]}' + ',"channel":"/slim/request"}]';

    //Play everything under item 0 (Flac)
    var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary","playlist","play","menu:browselibrary","mode:bmf","item_id:0"]]}' + ',"channel":"/slim/request"}]';

    //IPENG
    var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary","items",0,25,"mode":"artists","menu":1]]}' + ',"channel":"/slim/request"}]';

    sendJsonCommand(json, remotePlayer.Player.Server);
}

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
    if (g_Trial_Expired == true) { return; }

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

function browseSelectionActionImpl(remotePlayer: RemotePlayer, mode: string, index: number) {
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);
    const command = remotePlayer.CurrentList.ListItems[index].Actions[0].GoCmd;
    const params = remotePlayer.CurrentList.ListItems[index].Actions[0].GoParams;
    remotePlayer.CurrentList.Top = index;

    //This shouldn't be possible but incase it does show up, just bump up to the previous browselist
    if (command.indexOf("jiveblankcommand") > -1) {
        browseBackImpl(remotePlayer);
        return;
    }

    if (params.indexOf("__TAGGEDINPUT__") > -1) {
        remotePlayer.CurrentList.Selected = index;
        SystemVars.Write("ShowingKeyboardP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
        //Now check remote to see if it has a page macro for a keyboard
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
            //Save this URL to the players URL setting that can be used to save a default station at start up
            remotePlayer.Player.NowPlayingUrl = remotePlayer.CurrentList.ListItems[index].FavoritesUrl;
        }

        let json = "";
        let commands = "";
        let params = "";
        if (mode == "Favorite") {
            if (SystemVars.Read("BrowseListTitleP" + paddedPlayerId + "%" + remotePlayer.Remote.Id).toLowerCase() == "favorites") {
                const itemId = getItemIdValue(remotePlayer.CurrentList.ListItems[index].Actions[0].Params);
                //System.Print("Delete Favorite Item_ID=" + Item_ID);
                json = '[{"id": "' + paddedPlayerId + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["favorites","delete","title:' + remotePlayer.CurrentList.ListItems[index].FavoritesTitle + '","url:' + remotePlayer.CurrentList.ListItems[index].FavoritesUrl + '",' + itemId + ',"useContextMenu:1","type:audio"' + ']]}' + ',"channel":"/slim/request"}]';
                remotePlayer.BrowseList.Open();
                remotePlayer.BrowseList.RemoveAt(index);
                remotePlayer.BrowseList.Close();
                setBrowseModeImpl(remotePlayer, 0);
            }
            else {
                json = '[{"id": "' + paddedPlayerId + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["favorites","add","title:' + remotePlayer.CurrentList.ListItems[index].FavoritesTitle + '","url:' + remotePlayer.CurrentList.ListItems[index].FavoritesUrl + '"]]}' + ',"channel":"/slim/request"}]';

            }

            json = json.replace(/\//g, "\\/");
            sendJsonCommand(json, remotePlayer.Player.Server);
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
        sendJsonCommand(json, remotePlayer.Player.Server);
    }
    else {
        remotePlayer.Offset = 0;
        remotePlayer.BrowseListSelect(index);
        setBrowseModeImpl(remotePlayer, 0);
    }
}

function browseBackImpl(remotePlayer: RemotePlayer): void {
    setBrowseModeImpl(remotePlayer, 0);
    remotePlayer.ListBack();
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

            System.Print("NewLocation=" + newLocation);
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

function jumpToBrowseLocationImpl(remotePlayer: RemotePlayer, service: string): void {
    const paddedPlayerId = padDigit(remotePlayer.Player.Id);

    SystemVars.Write("MoreOptionsAvailableP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);
    SystemVars.Write("MoreOptionsNotAvailableP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, true);
    SystemVars.Write("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + remotePlayer.Remote.Id, false);

    setBrowseModeImpl(remotePlayer, 0);

    //Clear the history and reload the parent menu for the player
    remotePlayer.ListLevel = 0;
    remotePlayer.History = [];
    
    //Now Push the parent for this player
    remotePlayer.CurrentList.ListItems = remotePlayer.Player.ParentMenu.ListItems;
    remotePlayer.ListLevel = 1;

    let isRpc = false;
    switch (service) {
        case "artists":
        case "albums":
        case "years":
        case "genres":
        case "playlists":
        case "mediafolder":
        case "musicfolder":
        case "bmf":
            var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary", "items", 0,' + g_Max_Poll_Count + ', "sort:new","mode:' + service + '"]]}' + ',"channel":"/slim/request"}]';
            break;
        case "myMusic":
        case "home":
            var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["menu","items",0,' + g_Max_Poll_Count + ',"direct:1"]]}' + ',"channel":"/slim/request"}]';
            break;
        case "new":
            var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["browselibrary", "items", 0,' + g_Max_Poll_Count + ', "sort:new","mode:albums"]]}' + ',"channel":"/slim/request"}]';
            isRpc = true;
            break;
        case "radios":
            var json = '[{""id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["radios", 0,' + g_Max_Poll_Count + ', "menu:radio"]]}' + ',"channel":"/slim/request"}]';
            break;
        default:
            var json = '[{"id": "' + remotePlayer.Player.Id + "_" + remotePlayer.Remote.Id + '","data":{"response":"/' + remotePlayer.Player.Server.ClientId + '/slim/request","request":["' + remotePlayer.Player.MacAddress + '",["' + service + '","items",0,' + g_Max_Poll_Count + ',"menu:' + service + '"]]}' + ',"channel":"/slim/request"}]';
            break;
    }

    remotePlayer.Player.Server.ConnectionIncomingData = "";

    sendJsonCommand(json, remotePlayer.Player.Server, isRpc);
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

function startExtraMusicConnection() {
    g_Music_Info_Connection = new TCP(onCommRxExtraMusicInfo, System.IPAddress, g_Extra_Music_Tcp_Port);
    g_Music_Info_Connection.OnConnectFunc = onConnectionExtraMusicInfo;
    g_Music_Info_Connection.OnDisconnectFunc = onDisconnectExtraMusicInfo;
    g_Music_Info_Connection.UseHandleInCallbacks = false;
    g_Music_Info_Connection.AddRxFraming("StopChar", '\r\n');
}

function writeDataToMusicInfoDriver(player: Player): void {
    if (g_Use_Extra_Music_Server_Info) {
        let title = player.Title;
        if (title.length == 0) { title = " "; }

        let album = player.Album;
        if (album.length == 0) { album = " "; }

        let artist = player.Artist;
        if (artist.length == 0) { artist = " "; }

        let nowPlayingCoverArt = player.NowPlayingCoverArt;
        if (nowPlayingCoverArt.length == 0) nowPlayingCoverArt = " ";

        const remoteIds = g_Remote_Ids.join(",");

        g_Music_Info_Connection.Write("GETDATA Title^" + title +
                                        "^^Artist^" + artist +
                                        "^^Album^" + album +
                                        "^^AlbumCoverURL^" + nowPlayingCoverArt +
                                        "^^RemoteIDs^" + remoteIds +
                                        "^^PlayerID^" + player.MacAddress +
                                        "\r\n");
    }
}

function sendJsonCommand(json: string, server: Server, isRpc: boolean = false): void {
    dbg('sendJsonCommand sending Command: ' + json + ' to Server: ' + server.Ip);
    if (g_Trial_Expired == true) return;

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
                    updatePlayerState(nowPlayingJson[i], server);
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

function updateConnectionState(server: Server): void {
    for (let i = 0; i < server.Players.length; i++) {
        server.Players[i].Connected = false;
        updatePlayerVariables(server.Players[i]);
    }
}

System.Print("Initializing " + g_DriverName + " version " + g_DriverVersion);

printDebugModes();
checkSerial();
Init();
