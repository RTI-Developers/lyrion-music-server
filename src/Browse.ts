function loadRemotesParentList(player: Player): void {
    for (let i = 0; i < g_RemotePlayers.length; i++) {
        const remotePlayer = g_RemotePlayers[i];

        if (remotePlayer.Player == player) {
            remotePlayer.CurrentList.ListItems = player.ParentMenu.ListItems;
            remotePlayer.loadNewParentBrowseList();
        }
    }
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
        remotePlayer.loadNewParentBrowseList();
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

                            // strip sort/track_id params that break artist/album root playallParams selections
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
        server.sendJsonCommand(toSend);
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
