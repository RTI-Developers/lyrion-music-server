function padDigit(num: number): string {
    if (num.toString().length == 1) {
        return "0" + num;
    }
    else {
        return num.toString();
    }
}

function isInteger(value: string): boolean {
    var er = /^-?[0-9]+$/;
    return er.test(value);
}

function replaceAll(target: string, search: string, replacement: string): string {
    return target.replace(new RegExp(search, 'g'), replacement);
};

function moveArrayItem(array: any[], from: number, to: number): any[] {
    return array.splice(to, 0, array.splice(from, 1)[0]);
}

function getJson(data: string): any {
    try {
        return JSON.parse(data);
    }
    catch (e) {
        return false;
    }
}

function toTimeString(seconds: number): string {
    let h, m, s, result = '';
    // HOURs
    h = Math.floor(seconds / 3600);
    seconds -= h * 3600;
    if (h) {
        result = h < 10 ? '0' + h + ':' : h + ':';
    }
    // MINUTEs
    m = Math.floor(seconds / 60);
    seconds -= m * 60;
    result += m < 10 ? '0' + m + ':' : m + ':';
    // SECONDs
    s = seconds % 60;
    result += s < 10 ? '0' + s : s;
    return result;
}

function getItemIdValue(params: string): string {
    const paramsArray = params.split(",");
    for (var p = 0; p < paramsArray.length; p++) {
        var values = paramsArray[p].split(":");
        if (values[0] == '"item_id') {
            return paramsArray[p];
        }
    }
    return "";
}

function getItemIdValuePair(params: string): string {
    var itemId;
    const paramsArray = params.split(',');
    for (var Param in paramsArray) {
        var Info = paramsArray[Param].split(':');
        if (Info[0].indexOf("item_id") > -1) {
            itemId = Info[0] + ":" + Info[1];//Params[Param];
            break;
        }
    }
    return itemId || "";
}

function printOutResults(data: string): void {
    System.Print("---------------Start data--------------");
    const dataArray = data.split('\r\n');
    for (var l = 0; l < dataArray.length; l++) {
        printMaxLineSize(dataArray[l]);
    }
    System.Print("---------------End data--------------");
}

function printMaxLineSize(line: string): void {
    let lineCount = 0;
    let maxLineCount = 175;
    let printData = "";
    for (var x = 0; x < line.length; x++) {
        printData += line.charAt(x);
        lineCount++;
        if (lineCount == maxLineCount) {
            System.Print(printData);
            lineCount = 0;
            printData = "";
        }
    }
    System.Print(printData);
}

function test(str: string): void {
    for (let i = 0; i < str.length; i++) {
        System.Print(str.substring(i, 1) + " " + str.charCodeAt(i));
    }
}

function myTrim(value: string): string {
    return value.replace(/^\s+|\s+$/gm, '');
}

function printDebugModes(): void {
    SystemVars.Write("PrintRAW", g_Print_Incoming_Raw);
    SystemVars.Write("PrintPost", g_Print_Posts);
    SystemVars.Write("PrintJSON", g_Print_Incoming_Json);
    SystemVars.Write("PrintMenu", g_Print_Incoming_Menu);
}

function dbg(message: string): void {
    if (g_Debug) {
        System.Print(g_DriverName + ":" + message);
        if (System.LogLevel > 0) {
            System.LogInfo(0, message);
        }
    }
}

function formatDate(date: string): string {
    let d = new Date(date);
    let hh = d.getHours();
    let m = d.getMinutes();
    let s = d.getSeconds();
    let dd = "AM";
    let h = hh;
    if (h >= 12) {
        h = hh - 12;
        dd = "PM";
    }
    if (h == 0) {
        h = 12;
    }
    let m2 = m < 10 ? "0" + m : m;

    let s2 = s < 10 ? "0" + s : s;

    var pattern = new RegExp("0?" + hh + ":" + m2 + ":" + s2);

    let replacement = h + ":" + m2;
    replacement += " " + dd;

    var newDate = date.replace(pattern, replacement);
    return newDate.substring(0, newDate.indexOf("GMT"));
}


function getServerByConnectionHandle(handle: number): Server | null {
    if (g_Servers.length == 1) { return g_Servers[0]; }
    
    //We are using more then one server, so find the Server
    for (let i = 0; i < g_Servers.length; i++) {
        const server = g_Servers[i];

        if (server.Connection.Handle == handle || server.StartUpTimer.Handle == handle) {
            return server;
        }
    }

    dbg('getServerByConnectionHandle failed to find Server for handle:' + handle);
    return null;
}

function getEmptyBrowseListItem(): BrowseListItem {
    return {
        MainTitle: "",
        MenuTitle: "",
        ListItems: [],
        Count: 0, //Total Items in List
        Top: 0, //Top item in the list
        Offset: 0,
        Selected: 0,
        MoreOptionsAvailable: false,
        FavoritesUrl: "",
        FavoritesTitle: "",
        Actions: [],  //If a menu item has base actions, then add them to this, other wise the parent base actions will be used
        PlayOnly: false
    };
}

function getEmptyActionItems(): ActionItems {
    return {
        Items: [],
        GoCmd: "",
        GoParams: "",
        PlayCmd: "",
        PlayParams: "",
        AddHoldCmd: "",
        AddHoldParams: "",
        AddCmd: "",
        AddParams: "",
        MoreCmd: "",
        MoreParams: "",
        Params: "",
        CommonParams: ""
    };
}

function findMenuItem(menuTitle: string, listItems: BrowseListItem[]): BrowseListItem | null {
    for (var i = 0; i < listItems.length; i++) {
        var existingMenuTitle = listItems[i].MenuTitle.toLowerCase();

        if (menuTitle.toLowerCase() == existingMenuTitle) {
            return listItems[i];
        }
    }
    
    dbg('findMenuItem failed to find BrowseListItem for menuTitle:' + menuTitle);
    return null;
}

function getEmptyPlaylistItem(): PlaylistItem {
    return {
        Id: "",
        ArtUrl: "",
        Url: "",
        Duration: "",
        Title: "",
        Artist: "",
        Album: "",
        Genre: "",
        Remote: "",
        Type: "",
        BitRate: "",
        Year: ""
    }
}

function getPlayerByTimerHandle(handle: number): Player | null {
    for (var i = 0; i < g_Players.length; i++) {
        const player = g_Players[i];
        if (player.NowPlayingTimer.Handle == handle) {
            return player;
        }
    }

    return null;
}

function getRemotePlayer(remoteId: number, playerId: number): RemotePlayer | null {
    for (let i = 0; i < g_RemotePlayers.length; i++) {
        const remotePlayer = g_RemotePlayers[i];

        if (remotePlayer.Remote.Id == remoteId && remotePlayer.Player.Id == playerId)
        {
            return remotePlayer;
        }
    }

    const remotePlayerIds = g_RemotePlayers.map(rp => [rp.Remote.Id, rp.Player.Id]);
    dbg('Could not find RemotePlayer for RemoteId: ' + remoteId + ' and PlayerId: ' + playerId + ' in list: ' + remotePlayerIds);

    if (playerId != 0) {
        dbg('Retrying with PlayerId 0');
        return getRemotePlayer(remoteId, 0);
    }

    return null;
}
