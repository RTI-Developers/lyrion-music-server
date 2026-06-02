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
function parseParentMenu(msg: LyrionCometdMessage, server: Server): void {
    const data = msg.data as LyrionMenuData;
    const parentHomeTitle = "Home";
    const serverParent: BrowseListItem = getEmptyBrowseListItem();
    serverParent.MenuTitle = parentHomeTitle;

    const { playerId, remoteId } = parseRequestId(msg.id ?? "");
    g_logger.logInfo('parseParentMenu playerId: ' + playerId + ' remoteId: ' + remoteId, LogInfoLevel.High, 'parseParentMenu');

    let remotePlayer: RemotePlayer | null = null;
    if (playerId !== undefined && remoteId !== undefined) {
        remotePlayer = getRemotePlayer(remoteId, playerId);
    }

    //Store the Connection Location so we dont have to look it up later
    for (let i = 0; i < data.item_loop.length; i++) {
        const item = data.item_loop[i];
        const node = item.node;
        const title = item.text;
        const id = item.id;
        if (node == "home" || node == "" || node == "myMusic") {
            if (title.indexOf("Search") == -1 && title != "App Gallery" && title != "Library Views" && title.indexOf("Turn Off") == -1 && title != "TuneIn Radio" || id == "myMusicSearch") { //&& Title != "Random Mix"
                if (item.actions != undefined) {
                    const menuItem = getEmptyBrowseListItem();
                    const actionItems = getEmptyActionItems();
                    menuItem.MenuTitle = title;
                    if (id == "myMusicSearch") {
                        menuItem.MenuTitle = "Local Music Search";
                    }
                    if (item.actions.go != undefined) {
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, item.actions.go.cmd);
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, item.actions.go.params);
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
            }

            player.ParentMenu = customParent;
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

function parseMenu(msg: LyrionCometdMessage, server: Server): void {
    const data = msg.data as LyrionMenuData;
    if (data != undefined) {
        //First look to see if this is the parent
        if (data.item_loop[0]?.node != undefined) {
            g_logger.logInfo('Parent Menu', LogInfoLevel.High, 'parseMenu');
            parseParentMenu(msg, server);
        }
        else {
            g_logger.logInfo('Submenu', LogInfoLevel.High, 'parseMenu');
            parseSubMenu(msg, server);
        }
    }
    else {
        g_logger.logError('Dont know what to do ParseMenu: ' + JSON.stringify(msg), 'parseMenu');
    }
}

//Expects the RemotePlayer key in the json as ID
function parseSubMenu(msg: LyrionCometdMessage, server: Server): void {
    const data = msg.data as LyrionMenuData;
    const { playerId, remoteId, correlationId } = parseRequestId(msg.id ?? "");

    let remotePlayer: RemotePlayer | null = null;
    const browseListRequestCorrelation: number | null = correlationId !== undefined ? correlationId : null;
    if (browseListRequestCorrelation !== null && playerId !== undefined && remoteId !== undefined) {
        remotePlayer = getRemotePlayer(remoteId, playerId);
    }

    const totalItems = data.count ?? 0;
    const offset = data.offset ?? 0;
    const itemCount = data.item_loop.length;
    const itemsCollected = offset + itemCount;

    g_logger.logInfo('remotePlayer.ListLevel=' + remotePlayer?.ListLevel + ' totalItems=' + totalItems + ' itemsCollected=' + itemsCollected + ' itemCount=' + itemCount + ' offset=' + offset, LogInfoLevel.High, 'parseSubMenu');

    if (!remotePlayer) {
        g_logger.logInfo('parseSubMenu: failed to find matching remotePlayer', LogInfoLevel.High, 'parseSubMenu');
        return;
    }

    if (!browseListRequestCorrelation || remotePlayer.BrowseListRequestCorrelation != browseListRequestCorrelation) {
        g_logger.logInfo('parseSubMenu: json browseListRequestCorrelation value did not match current remotePlayer.BrowseListRequestCorrelation value', LogInfoLevel.High, 'parseSubMenu');
        return;
    }

    if (data.player_name != undefined) {
        return;
    }

    const moreOptions = getEmptyActionItems();

    remotePlayer.BrowseList.Open();
    let moreOptionsAvailable = false;
    if (data.base != undefined) {
        if (data.base.actions["set-preset-0"] != undefined) {
            //if(g_Print_Incoming_Menu) System.Print("Should Be showing more options");
            SystemVars.Write("MoreOptionsAvailableP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id, true);
            moreOptionsAvailable = true;

            moreOptions.AddParams = getMenuDetails(moreOptions.AddParams, data.base.actions.add?.params);
            moreOptions.AddCmd = getMenuDetails(moreOptions.AddCmd, data.base.actions.add?.cmd);

            moreOptions.PlayParams = getMenuDetails(moreOptions.PlayParams, data.base.actions.play?.params);
            moreOptions.PlayCmd = getMenuDetails(moreOptions.PlayCmd, data.base.actions.play?.cmd);

            moreOptions.AddHoldParams = getMenuDetails(moreOptions.AddHoldParams, data.base.actions["add-hold"]?.params);
            moreOptions.AddHoldCmd = getMenuDetails(moreOptions.AddHoldCmd, data.base.actions["add-hold"]?.cmd);

            if (data.base.actions.go != undefined) {
                moreOptions.GoParams = getMenuDetails(moreOptions.GoParams, data.base.actions.go.params);
                moreOptions.GoCmd = getMenuDetails(moreOptions.GoCmd, data.base.actions.go.cmd);
            }
            remotePlayer.CurrentActionsList.Items[remotePlayer.ListLevel] = moreOptions;
        }
    }

    //If the Offset is 0 and there are more items to get then we are at the start of the list
    if (offset == 0 && totalItems >= itemCount || totalItems == 0) {
        remotePlayer.BrowseList.RemoveAll();
    }

    if (data.item_loop != null) {
        const count = data.count ?? 0;
        if (count == 0) {
            if (data.window?.textarea != undefined) {
                remotePlayer.BrowseList.RemoveAll();
                const menuItem = getEmptyBrowseListItem();
                menuItem.MenuTitle = data.window.textarea;
                remotePlayer.ListAppend(menuItem);
                remotePlayer.BrowseList.Close();
                return;
            }
        }

        for (let i = 0; i < data.item_loop.length; i++) {
            var item = data.item_loop[i];
            var shouldProcess = true;
            if (item.text.toLowerCase() == "on mysqueezebox.com" && remotePlayer.Player.ShouldHideMySqueezebox) {
                shouldProcess = false;
            }

            if (shouldProcess) {
                var menuItem = getEmptyBrowseListItem();
                var actionItems = getEmptyActionItems();
                menuItem.MenuTitle = System.ConvertFromUTF8(item.text);

                if (item.presetParams != undefined) {
                    //System.Print("presetParams exist");
                    if (item.presetParams.favorites_url != undefined) {
                        menuItem.FavoritesUrl = replaceAll(item.presetParams.favorites_url, '"', "");
                        menuItem.FavoritesTitle = item.presetParams.favorites_title ?? "";
                        g_logger.logInfo(menuItem.FavoritesTitle + ' url:' + menuItem.FavoritesUrl, LogInfoLevel.Low, 'parseSubMenu');
                    }
                }

                actionItems.CommonParams = getMenuDetails(actionItems.CommonParams, item.commonParams);
                actionItems.Params = getMenuDetails(actionItems.Params, item.params);

                if (item.actions != undefined) {
                    if (item.actions.play != undefined || item.actions["add-hold"] != undefined || item.actions.add != undefined || item.actions.more != undefined) {
                        moreOptionsAvailable = true;
                    }
                    if (item.actions.play != undefined) {
                        actionItems.PlayCmd = getMenuDetails(actionItems.PlayCmd, item.actions.play.cmd);
                        actionItems.PlayParams = getMenuDetails(actionItems.PlayCmd, item.actions.play.params);
                    }
                    if (item.actions["add-hold"] != undefined) {
                        actionItems.AddHoldCmd = getMenuDetails(actionItems.AddHoldCmd, item.actions["add-hold"].cmd);
                        actionItems.AddHoldParams = getMenuDetails(actionItems.AddHoldParams, item.actions["add-hold"].params);
                    }
                    if (item.actions.add != undefined) {
                        actionItems.AddCmd = getMenuDetails(actionItems.AddCmd, item.actions.add.cmd);
                        actionItems.AddParams = getMenuDetails(actionItems.AddParams, item.actions.add.params);
                    }
                    if (item.actions.go != undefined) {
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, item.actions.go.cmd);
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, item.actions.go.params);
                    }
                    if (item.actions.more != undefined) {
                        actionItems.MoreCmd = getMenuDetails(actionItems.MoreCmd, item.actions.more.cmd);
                        actionItems.MoreParams = getMenuDetails(actionItems.MoreParams, item.actions.more.params);
                    }
                }

                if (item.goAction == "play" || item.goAction == "playControl") {
                    menuItem.PlayOnly = true;
                    if (item.actions != undefined) {
                        if (item.actions.play != undefined) {
                            actionItems.GoCmd = actionItems.PlayCmd;
                            actionItems.GoParams = actionItems.PlayParams;
                        }
                        else if (item.goAction == "playControl") {
                            if (actionItems.GoCmd.length > 0) {
                                actionItems.GoCmd = actionItems.PlayCmd;
                                actionItems.GoParams = actionItems.PlayParams;
                            }
                            else {
                                actionItems.GoCmd = moreOptions.PlayCmd.slice();
                                actionItems.GoParams = [
                                    ...moreOptions.PlayParams,
                                    "touchToPlay:" + item.params!["item_id"],
                                    "isContextMenu:1",
                                    "item_id:" + item.params!["item_id"]
                                ];
                            }
                        }
                    }
                    else {
                        actionItems.GoCmd = getMenuDetails([], data.base?.actions.play?.cmd);
                        actionItems.GoParams = getMenuDetails([], data.base?.actions.play?.params);
                        if (item.params != undefined) {
                            actionItems.GoParams = getMenuDetails(actionItems.GoParams, item.params);
                        }
                        if (item.commonParams != undefined) {
                            actionItems.GoParams = getMenuDetails(actionItems.GoParams, item.commonParams);
                        }
                        if (item.playallParams != undefined) {
                            actionItems.GoParams = getMenuDetails(actionItems.GoParams, item.playallParams);

                            // strip sort/track_id params that break artist/album root playallParams selections
                            actionItems.GoParams = actionItems.GoParams.filter(function(p) {
                                return p.indexOf("sort") == -1 && p.indexOf("track_id") == -1;
                            });
                        }
                    }
                }

                //If there is a go command then add it if it hasn't already been added
                if (data.base != null) {
                    if (data.base.actions.go != undefined && actionItems.GoCmd.length == 0) {
                        actionItems.GoCmd = getMenuDetails(actionItems.GoCmd, data.base.actions.go.cmd);
                        actionItems.GoParams = getMenuDetails(actionItems.GoParams, data.base.actions.go.params);

                        if (actionItems.Params.length > 0) {
                            actionItems.GoParams = actionItems.GoParams.concat(actionItems.Params);
                        }
                        if (actionItems.CommonParams.length > 0) {
                            actionItems.GoParams = actionItems.GoParams.concat(actionItems.CommonParams);
                        }
                    }
                }
                if (actionItems.CommonParams.length == 0) {
                    const itemId = getItemIdValue(actionItems.GoParams);
                    if (itemId.length > 0) {
                        actionItems.CommonParams = [itemId];
                    }
                }

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

    g_logger.logInfo('Finished parsing submenu page.  itemsCollected: ' + itemsCollected + ' of totalItems: ' + totalItems, LogInfoLevel.High, 'parseSubMenu');
    if (itemsCollected < totalItems) {  //We have to get more pages..
        //get the last selected item, so we know what command to send if we have a offset

        remotePlayer.Offset = itemsCollected;
        const toSend = buildSlimRequestJson(
            playerId,
            remoteId,
            server.ClientId,
            g_Slim_Request,
            remotePlayer.Player.MacAddress.toLowerCase(),
            (remotePlayer.BrowseListParentActionItems.GoCmd as LyrionCommandArray)
                .concat([remotePlayer.Offset, g_Max_Poll_Count])
                .concat(remotePlayer.BrowseListParentActionItems.GoParams as LyrionCommandArray),
            correlationId
        );
        server.sendJsonCommand(toSend);
    }
    else {
        //We have the entire list loaded
        remotePlayer.CurrentList.Offset = 0;
    }
}

function getMenuDetails(existing: string[], item: string[] | { [key: string]: string | number } | undefined): string[] {
    if (item == undefined) return existing;
    const result = existing.slice();
    for (var key in item) {
        if (isInteger(key)) {
            result.push(String((item as any)[key]));
        } else {
            result.push(key + ":" + (item as any)[key]);
        }
    }
    return result;
}
