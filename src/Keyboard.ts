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
        const params = remotePlayer.CurrentList.ListItems[remotePlayer.CurrentList.Selected].Actions[0].GoParams.slice();
        for (let pi = 0; pi < params.length; pi++) {
            if (params[pi].indexOf("__TAGGEDINPUT__") > -1) {
                params[pi] = params[pi].replace("__TAGGEDINPUT__", remotePlayer.KeyboardData);
                break;
            }
        }
        params.push("useContextMenu:1");
        remotePlayer.SetNewBrowseListRequestCorrelation();
        const json = buildSlimRequestJson(
            remotePlayer.Player.Id,
            remotePlayer.Remote.Id,
            remotePlayer.Player.Server.ClientId,
            g_Slim_Request,
            remotePlayer.Player.MacAddress,
            (commands as LyrionCommandArray)
                .concat([0, g_Max_Browse_Items])
                .concat(params as LyrionCommandArray),
            remotePlayer.BrowseListRequestCorrelation
        );

        remotePlayer.BrowseList.Open();
        remotePlayer.BrowseList.RemoveAll();
        remotePlayer.BrowseList.Insert("Searching..");
        remotePlayer.BrowseList.Close();

        remotePlayer.CurrentList.MenuTitle = SystemVars.Read("BrowseListTitleP" + padDigit(remotePlayer.Player.Id) + "%" + remotePlayer.Remote.Id);
        remotePlayer.ListLevel++;
        remotePlayer.Player.Server.sendJsonCommand(json);

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
