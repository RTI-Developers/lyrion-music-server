// Lyrion Music Server (LMS) API response type definitions.
// Covers the CometD long-poll protocol (/cometd) and JSON-RPC (/jsonrpc.js).

// ── CometD Envelope ──────────────────────────────────────────────────────────

type LyrionCometdResponse = LyrionCometdMessage[];

interface LyrionCometdMessage {
    channel: string;
    id?: string;
    /** Present in handshake responses. */
    clientId?: string;
    /** Present in handshake responses. */
    version?: string;
    /** Present in handshake responses. */
    successful?: boolean;
    /** Present in handshake responses. */
    supportedConnectionTypes?: string[];
    data?: LyrionStatusData | LyrionServerStatusData | LyrionMenuData;
}

// ── Server Status (serverstatus command) ─────────────────────────────────────

interface LyrionServerStatusData {
    version: string;
    mac?: string;
    ip?: string;
    httpport?: number;
    uuid?: string;
    rescan?: number;
    lastscan?: number;
    lastscanfailed?: string;
    "info total albums"?: number;
    "info total artists"?: number;
    "info total genres"?: number;
    "info total songs"?: number;
    players_loop: LyrionServerPlayerInfo[];
}

/** Player entry within a serverstatus players_loop response. */
interface LyrionServerPlayerInfo {
    playerid: string;       // MAC address, e.g. "00:04:20:ab:cd:ef"
    name: string;
    uuid?: string;
    ip?: string;
    model?: string;
    modelname?: string;
    power?: 0 | 1;
    isplaying?: 0 | 1;
    displaytype?: string;
    isplayer?: 0 | 1;
    canpoweroff?: 0 | 1;
    connected: 0 | 1;
    player_needs_upgrade?: 0 | 1;
    player_is_upgrading?: 0 | 1;
    firmware?: string;
}

// ── Player Status (status command, push subscription) ────────────────────────

interface LyrionStatusData {
    player_name: string;
    player_connected: "0" | "1";
    player_needs_upgrade?: 0 | 1;
    player_is_upgrading?: 0 | 1;
    power?: "0" | "1";
    signalstrength?: number;
    waitingToPlay?: 0 | 1;
    mode: "play" | "stop" | "pause";
    remote?: 0 | 1;
    current_title?: string;
    time?: number;                      // elapsed seconds (decimal)
    rate?: number;
    duration?: number;                  // total duration in seconds (decimal)
    sleep?: number;
    will_sleep_in?: number;
    sync_master?: string;               // MAC of sync group master
    sync_slaves?: string;               // comma-separated slave MACs
    "mixer volume": string;             // may be negative string when muted
    "mixer treble"?: number;
    "mixer bass"?: number;
    "mixer pitch"?: number;
    "playlist duration"?: number;
    "playlist repeat": 0 | 1 | 2;      // 0=off, 1=song, 2=playlist
    "playlist shuffle": 0 | 1 | 2;     // 0=off, 1=songs, 2=albums
    playlist_id?: string;
    playlist_name?: string;
    playlist_modified?: 0 | 1;
    playlist_timestamp: number;
    playlist_tracks: number;
    playlist_cur_index: string;         // 0-based current index as string
    can_seek?: "0" | "1";
    playlist_loop?: LyrionPlaylistEntry[];
    remoteMeta?: LyrionRemoteMeta;
}

/** A single entry in the status response playlist_loop array. */
interface LyrionPlaylistEntry {
    "playlist index": string;           // 0-based playlist position as string
    id: string;
    title: string;
    artist?: string;
    albumartist?: string;
    album?: string;
    remote_title?: string;              // stream or station title
    url: string;
    duration: string;                   // decimal seconds as string
    coverid?: string;
    artwork_url?: string;
    artwork_track_id?: string;
    remote?: 0 | 1;
    type?: string;                      // content type, e.g. "mp3", "(Pandora)"
    bitrate?: string;
    genre?: string;
    year?: number;
}

/** Metadata for the currently-playing remote stream, when present. */
interface LyrionRemoteMeta {
    title?: string;
    artist?: string;
    album?: string;
    remote_title?: string;
    type?: string;
    artwork_url?: string;
    artwork_track_id?: string;
    url?: string;
    bitrate?: string;
}

// ── Menu / OPML (menu items command) ─────────────────────────────────────────

interface LyrionMenuData {
    item_loop: LyrionMenuItem[];
    count?: number;
    offset?: number;
    base?: LyrionMenuBase;
    window?: { textarea?: string };
    /** Present when response is a now-playing context (not a browse menu). */
    player_name?: string;
}

interface LyrionMenuBase {
    actions: {
        go?: LyrionMenuAction;
        play?: LyrionMenuAction;
        add?: LyrionMenuAction;
        "add-hold"?: LyrionMenuAction;
        "set-preset-0"?: LyrionMenuAction;
    };
}

/** A single item within a menu item_loop. */
interface LyrionMenuItem {
    text: string;
    id: string;
    node?: string;
    type?: string;
    isaudio?: boolean;
    hasitems?: boolean;
    goAction?: string;
    actions?: {
        go?: LyrionMenuAction;
        play?: LyrionMenuAction;
        add?: LyrionMenuAction;
        "add-hold"?: LyrionMenuAction;
        more?: LyrionMenuAction;
    };
    params?: { [key: string]: string | number };
    commonParams?: { [key: string]: string | number };
    playallParams?: { [key: string]: string | number };
    presetParams?: { favorites_url?: string; favorites_title?: string };
    track?: string;
}

/** Command and params pair for a menu action. cmd is an array of command tokens. */
interface LyrionMenuAction {
    cmd?: string[];
    params?: { [key: string]: string | number };
}

// ── JSON-RPC Favorites (/jsonrpc.js) ─────────────────────────────────────────

/** JSON-RPC response envelope returned by POST /jsonrpc.js. */
interface LyrionRpcResponse {
    id: string;
    method?: string;
    result: {
        title?: string;
        count?: number;
        offset?: number;
        loop_loop?: LyrionFavoriteItem[];
    };
}

/** A single item returned in a favorites RPC loop_loop array. */
interface LyrionFavoriteItem {
    id: string;
    name: string;
    hasitems: boolean;
    type?: string;
    isaudio?: boolean;
    url?: string;
}

// ── LMS Command Identifiers ───────────────────────────────────────────────────

/** Top-level LMS command verbs — position 0 of a LyrionCommandArray. */
declare const enum LyrionCmd {
    BrowseLibrary = "browselibrary",
    Button        = "button",
    Favorites     = "favorites",
    Menu          = "menu",
    Mixer         = "mixer",
    OpmlGeneric   = "opml_generic",
    Pandora       = "pandora",
    Pause         = "pause",
    Play          = "play",
    Playlist      = "playlist",
    Power         = "power",
    Radios        = "radios",
    ServerStatus  = "serverstatus",
    Status        = "status",
    Stop          = "stop",
    Sync          = "sync",
    Time          = "time",
}

/** Sub-commands for LyrionCmd.Button. */
declare const enum LyrionButtonCmd {
    JumpForward = "jump_fwd",
    JumpRewind  = "jump_rew",
    Repeat      = "repeat",
    Shuffle     = "shuffle",
}

/** Sub-commands for LyrionCmd.Favorites. */
declare const enum LyrionFavoritesCmd {
    Add      = "add",
    Delete   = "delete",
    Items    = "items",
    Playlist = "playlist",
}

/** Sub-commands for LyrionCmd.Mixer. */
declare const enum LyrionMixerCmd {
    Muting = "muting",
    Volume = "volume",
}

/** Sub-commands for LyrionCmd.Playlist. */
declare const enum LyrionPlaylistCmd {
    Index = "index",
    Play  = "play",
}

// ── Command Array ─────────────────────────────────────────────────────────────

/** LMS command array element type. */
type LyrionCommandArray = Array<string | number>;

// ── Outgoing CometD Request Types ─────────────────────────────────────────────

interface LyrionHandshakeRequest {
    channel: "/meta/handshake";
    version: "1.0";
    supportedConnectionTypes: string[];
}

interface LyrionMetaConnectRequest {
    connectionType: "streaming";
    channel: "/meta/connect";
    clientId: string;
}

interface LyrionMetaSubscribeRequest {
    subscription: string;
    channel: "/meta/subscribe";
    clientId: string;
}

interface LyrionSlimRequest {
    id: string | number;
    data: {
        response: string;
        request: [string, LyrionCommandArray];
    };
    channel: "/slim/request";
}

interface LyrionSlimSubscribeRequest {
    id: string | number;
    data: {
        response: string;
        request: [string, LyrionCommandArray];
    };
    channel: "/slim/subscribe";
}

// ── Outgoing JSON-RPC Request Type ────────────────────────────────────────────

interface LyrionRpcRequest {
    id: string;
    method: "slim.request";
    params: [string, LyrionCommandArray];
}

// ── Driver-Internal Browse Types ──────────────────────────────────────────────

interface BrowseListItem {
    MainTitle: string;
    MenuTitle: string;
    ListItems: BrowseListItem[];
    Count: number;
    Top: number;
    Offset: number;
    Selected: number;
    MoreOptionsAvailable: boolean;
    FavoritesUrl: string;
    FavoritesTitle: string;
    Actions: ActionItems[];
    PlayOnly: boolean;
}

interface ActionItems {
    Items: ActionItems[];
    GoCmd: string[];
    GoParams: string[];
    PlayCmd: string[];
    PlayParams: string[];
    AddHoldCmd: string[];
    AddHoldParams: string[];
    AddCmd: string[];
    AddParams: string[];
    MoreCmd: string[];
    MoreParams: string[];
    Params: string[];
    CommonParams: string[];
}

interface PlaylistItem {
    Id: string;
    ArtUrl: string;
    Url: string;
    Duration: string;
    Title: string;
    Artist: string;
    Album: string;
    Genre: string;
    Remote: string;
    Type: string;
    BitRate: string;
    Year: string;
}
