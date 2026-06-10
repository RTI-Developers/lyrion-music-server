const g_Status_Tags = "tags:uBJjdKlaAxcNory";
const g_Slim_Request = "slim/request";

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

function parseLyrionCometd(data: string): LyrionCometdMessage[] | false {
    const result = getJson(data);
    return (result !== false) ? result as LyrionCometdMessage[] : false;
}

function parseLyrionRpc(data: string): LyrionRpcResponse | false {
    const result = getJson(data);
    return (result !== false) ? result as LyrionRpcResponse : false;
}

function isLyrionServerStatus(data: object): data is LyrionServerStatusData {
    return "players_loop" in data;
}

function isLyrionPlayerStatus(data: object): data is LyrionStatusData {
    return "player_name" in data;
}

function isLyrionMenuData(data: object): data is LyrionMenuData {
    return "item_loop" in data;
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

function getItemIdValue(params: string[]): string {
    for (var p = 0; p < params.length; p++) {
        if (params[p].indexOf("item_id") > -1) {
            return params[p];
        }
    }
    return "";
}

function myTrim(value: string): string {
    return value.replace(/^\s+|\s+$/gm, '');
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
        GoCmd: [],
        GoParams: [],
        PlayCmd: [],
        PlayParams: [],
        AddHoldCmd: [],
        AddHoldParams: [],
        AddCmd: [],
        AddParams: [],
        MoreCmd: [],
        MoreParams: [],
        Params: [],
        CommonParams: []
    };
}

function buildRequestId(playerId: number | undefined, remoteId: number | undefined, correlationId?: number): string {
    let id = (playerId ?? "") + "_" + (remoteId ?? "");
    if (correlationId !== undefined) { id += "_" + correlationId; }
    return id;
}

function parseRequestId(id: string): { playerId: number | undefined; remoteId: number | undefined; correlationId: number | undefined } {
    const parts = id.split("_");
    const parseOptId = (s: string): number | undefined => { const n = parseInt(s, 10); return isNaN(n) ? undefined : n; };
    return {
        playerId: parts.length > 0 ? parseOptId(parts[0]) : undefined,
        remoteId: parts.length > 1 ? parseOptId(parts[1]) : undefined,
        correlationId: parts.length > 2 ? parseOptId(parts[2]) : undefined
    };
}

function buildSlimRequestJson(playerId: number | undefined, remoteId: number | undefined, clientId: string, responsePath: string, target: string, cmd: LyrionCommandArray, correlationId?: number): string {
    const request: LyrionSlimRequest = {
        id: buildRequestId(playerId, remoteId, correlationId),
        data: {
            response: "/" + clientId + "/" + responsePath,
            request: [target, cmd]
        },
        channel: "/slim/request"
    };
    return JSON.stringify([request]);
}

function buildSlimSubscribeJson(playerId: number | undefined, remoteId: number | undefined, clientId: string, responsePath: string, target: string, cmd: LyrionCommandArray): string {
    const request: LyrionSlimSubscribeRequest = {
        id: buildRequestId(playerId, remoteId),
        data: {
            response: "/" + clientId + "/" + responsePath,
            request: [target, cmd]
        },
        channel: "/slim/subscribe"
    };
    return JSON.stringify([request]);
}

function buildRpcRequestJson(id: string, target: string, cmd: LyrionCommandArray): string {
    const request: LyrionRpcRequest = {
        id: id,
        method: "slim.request",
        params: [target, cmd]
    };
    return JSON.stringify(request);
}

function findMenuItem(menuTitle: string, listItems: BrowseListItem[]): BrowseListItem | null {
    for (var i = 0; i < listItems.length; i++) {
        var existingMenuTitle = listItems[i].MenuTitle.toLowerCase();

        if (menuTitle.toLowerCase() == existingMenuTitle) {
            return listItems[i];
        }
    }
    
    g_logger.logInfo('findMenuItem failed to find BrowseListItem for menuTitle:' + menuTitle, LogInfoLevel.High, 'findMenuItem');
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


function getPlayer(playerId: number): Player | null {
    for (let i = 0; i < g_Players.length; i++) {
        if (g_Players[i].Id === playerId) { return g_Players[i]; }
    }
    g_logger.logInfo('Could not find Player for PlayerId: ' + playerId, LogInfoLevel.High, 'getPlayer');
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
    g_logger.logInfo('Could not find RemotePlayer for RemoteId: ' + remoteId + ' and PlayerId: ' + playerId + ' in list: ' + remotePlayerIds, LogInfoLevel.High, 'getRemotePlayer');

    if (playerId != 0) {
        g_logger.logInfo('Retrying with PlayerId 0', LogInfoLevel.High, 'getRemotePlayer');
        return getRemotePlayer(remoteId, 0);
    }

    return null;
}
