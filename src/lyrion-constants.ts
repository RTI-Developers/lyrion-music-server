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

