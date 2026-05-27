class Player {
    private readonly _onProgressTick: (handle: number) => void;

    Id: number;
	Name: string;
    MacAddress: string;
    ParentMenu: BrowseListItem;
    Connected: boolean = false;
    PoweredOn: boolean = false;
    SyncMaster: boolean = false;
    SyncSlave: boolean = false;
    UseCustomParentMenu: boolean;
    CustomMenuNames: string[] = [];
    CustomMenuNewNames: string[] = [];
    ShouldHideMySqueezebox: boolean;
    ShouldSkipFirstPandoraMenu: boolean;
    Server: Server;
    CustomParentMenu: BrowseListItem;

    Mode: string = "";
    Progress: number = 0;
    ProgressBar: number = 0;
    Remaining: number = 0;
    Duration: number = 0;
    Volume: number = 0;
    Muted: boolean = false;
    NowPlayingUrl: string = "";

    CanSeek: boolean = false;

    Repeat: boolean = false;
    RepeatType: number = 0; //0 = Off,  1= Repeat Song, 2= Repeat after end
    Shuffle: boolean = false;
    ShuffleType: number = 0;

    Genre: string = "";
    Title: string = "";
    Album: string = "";
    Artist: string = "";
    StationName: string = "";

    SongID: number = 0;
    NowPlayingCoverArt: string = "";

    Year: number = 0;
    BitRate: string = "";
    Type: string = "";

    IsPlayingPandora: boolean = false;
    HasPandoraThumbsUp: boolean = false;

    NowPlayingTimer: Timer;
    Playlist: PlaylistItem[] = [];
    PlaylistCurrentIndex: number = 0;
    PlaylistLastCurrentIndex: number = 0;
    PlaylistTimestamp: number = 0;
    PlaylistReset: boolean = false;
    PlaylistCount: number = 0;

    IsSynced: boolean = false;
    IsSyncMaster: boolean = false;
    IsSyncSlave: boolean = false;
    AvailablePlayers: object[] = []; //This will hold the player names of all available players
    SyncedPlayers: Player[] = [];

    constructor(
        id: number,
        onProgressTick: (handle: number) => void
    ) {
        let paddedId = padDigit(id);

        this._onProgressTick = onProgressTick;

        this.Id = id;
        this.Name = Config.Get("NameP" + paddedId);
        this.ShouldHideMySqueezebox = (Config.Get("Favorites_Hide_MySqueeze_P" + paddedId) == "true");
        this.ShouldSkipFirstPandoraMenu = (Config.Get("SkipFirstPandoraMenuP" + paddedId) == "true");
        this.UseCustomParentMenu = (Config.Get("Use_Custom_Parent_Menu_P" + paddedId) == "true");

        if (this.UseCustomParentMenu) {
            this.CustomMenuNames = Config.Get("Custom_Menu_Order_P" + paddedId).split(":");
            this.CustomMenuNewNames = Config.Get("Custom_Menu_Names_P" + paddedId).split(":");
        }

        this.NowPlayingTimer = new Timer();
        this.NowPlayingTimer.UseHandleInCallbacks = true;

        this.UpdateAssociatedVariables();
    }

    UpdateAssociatedVariables(): void {
        const paddedId = padDigit(this.Id);
        SystemVars.Write("NameP" + paddedId, this.Name);
        SystemVars.Write("ConnectedP" + paddedId, this.Connected);
        SystemVars.Write("NotConnectedP" + paddedId, !this.Connected);
        SystemVars.Write("PoweredOnP" + paddedId, this.PoweredOn);
        SystemVars.Write("PoweredOffP" + paddedId, !this.PoweredOn);
        SystemVars.Write("SyncMasterP" + paddedId, this.SyncMaster);
        SystemVars.Write("SyncSlaveP" + paddedId, this.SyncSlave);
    }

    applyStatusUpdate(info: LyrionStatusData): void {
        const paddedPlayerId = padDigit(this.Id);
        let updateVars = false;

        const playerConnected = info.player_connected == "1";
        if (this.Connected != playerConnected) { updateVars = true; }
        this.Connected = playerConnected;

        if (this.updateSyncState(info)) { updateVars = true; }

        const volume = parseInt(info["mixer volume"], 10);
        if (volume != this.Volume) { updateVars = true; }
        this.Volume = volume;
        this.Muted = (volume < 1);

        this.StationName = info.current_title ?? "";

        if (info.mode != this.Mode) {
            updateVars = true;
            switch (info.mode) {
                case "play":  System.SignalEvent("PlayingP" + paddedPlayerId); break;
                case "pause": System.SignalEvent("PausedP" + paddedPlayerId);  break;
                case "stop":  System.SignalEvent("StoppedP" + paddedPlayerId); break;
            }
        }

        if (info.mode == "play") {
            if (this.NowPlayingTimer.State == 0) {
                this.NowPlayingTimer.Start(this._onProgressTick, 1000);
            }
        } else {
            this.NowPlayingTimer.Stop();
        }
        this.Mode = info.mode;

        if (this.IsSyncSlave) {
            if (updateVars) {
                SystemVars.Write("VolumeLevelP" + paddedPlayerId, this.Volume);
            }
            return;
        }

        this.Progress = Math.floor(info.time ?? 0);
        if (info.duration != undefined) {
            this.Duration = Math.floor(info.duration);
            this.Remaining = this.Duration - this.Progress;
        } else {
            this.Duration = 0;
            this.Remaining = 0;
        }
        this.CanSeek = (info.can_seek != undefined && this.Duration > 0)
            ? (info.can_seek == "1")
            : false;

        this.PlaylistLastCurrentIndex = this.PlaylistCurrentIndex;
        this.PlaylistCurrentIndex = parseInt(info.playlist_cur_index, 10);

        const shuffleType = info["playlist shuffle"];
        const repeatType = info["playlist repeat"];
        const poweredOn = (info.power == "1");

        if (poweredOn != this.PoweredOn) {
            System.SignalEvent(poweredOn ? "PONP" + paddedPlayerId : "POFFP" + paddedPlayerId);
        }
        if (this.ShuffleType != shuffleType || this.RepeatType != repeatType || this.PoweredOn != poweredOn) {
            updateVars = true;
        }

        this.RepeatType = repeatType;
        this.Repeat = (this.RepeatType > 0);
        this.ShuffleType = shuffleType;
        this.Shuffle = (this.ShuffleType > 0);
        this.PoweredOn = poweredOn;
        this.PlaylistCount = info.playlist_tracks;

        if (info.playlist_timestamp != this.PlaylistTimestamp) {
            this.Playlist = [];
            this.PlaylistReset = true;
            this.PlaylistLastCurrentIndex = 0;
        } else {
            this.PlaylistReset = false;
        }
        this.PlaylistTimestamp = info.playlist_timestamp;

        if (info.playlist_loop != undefined) {
            const lastIndex = parseInt(info.playlist_loop[info.playlist_loop.length - 1]["playlist index"], 10) + 1;
            if (this.Playlist.length <= this.PlaylistCount) {
                for (let i = 0; i < info.playlist_loop.length; i++) {
                    try {
                        this.Playlist.push(this.buildPlaylistItem(info.playlist_loop[i]));
                    } catch (err) {
                        System.Print("%%%%%%%%%%%%%%%%%% Playlist Error %%%%%%%%%%%%%%%%%%%%%%%%%%%");
                        System.Print("err with play list count error was " + err);
                        this.PlaylistCount--;
                    }
                }
                if (this.Playlist.length < this.PlaylistCount) {
                    const paginationJson = buildSlimRequestJson(
                        this.Id,
                        undefined,
                        this.Server.ClientId,
                        g_Slim_Request,
                        this.MacAddress,
                        [LyrionCmd.Status, lastIndex, 25, g_Status_Tags]);
                    this.Server.sendJsonCommand(paginationJson);
                }
            }
        }

        const nowPlayingInfo = this.Playlist[this.PlaylistCurrentIndex];

        if (info.remoteMeta != undefined && nowPlayingInfo != undefined) {
            this.applyRemoteMeta(info.remoteMeta, nowPlayingInfo);
        }

        if (!updateVars && nowPlayingInfo != undefined) {
            updateVars = (this.Title != nowPlayingInfo.Title);
        }

        if (updateVars) {
            if (nowPlayingInfo != undefined) {
                const title = System.ConvertFromUTF8(nowPlayingInfo.Title);
                if (this.Title != title) {
                    System.SignalEvent("SongChangeP" + paddedPlayerId);
                    this.HasPandoraThumbsUp = false;
                }

                this.Title = title;
                this.Artist = System.ConvertFromUTF8(nowPlayingInfo.Artist);
                this.Album = System.ConvertFromUTF8(nowPlayingInfo.Album);
                this.NowPlayingCoverArt = nowPlayingInfo.ArtUrl;
                this.Genre = nowPlayingInfo.Genre;
                this.BitRate = nowPlayingInfo.BitRate;
                if (nowPlayingInfo.Type != undefined) {
                    this.IsPlayingPandora = (nowPlayingInfo.Type.indexOf("(Pandora)") > -1);
                    this.Type = nowPlayingInfo.Type;
                } else {
                    this.IsPlayingPandora = false;
                    this.Type = "";
                }

                if (info.remoteMeta != undefined) {
                    const meta = info.remoteMeta;
                    dbg('Setting Player: ' + this.Id + ' BitRate from remoteMeta.bitrate: ' + meta.bitrate);
                    if (meta.bitrate != undefined) { this.BitRate = meta.bitrate; }
                    if (meta.album != undefined) { this.Album = System.ConvertFromUTF8(meta.album); }
                }
            }

            this.updateVariables();
            this.propagateToSyncedPlayers();
        }
    }

    private updateSyncState(info: LyrionStatusData): boolean {
        const prevCount = this.SyncedPlayers.length;

        if (info.sync_master == undefined) {
            this.IsSynced = false;
            this.IsSyncMaster = false;
            this.IsSyncSlave = false;
            this.SyncedPlayers = [];
            return prevCount != 0;
        }

        this.SyncedPlayers = [];

        let masterPlayer: Player | undefined = undefined;
        for (let i = 0; i < this.Server.Players.length; i++) {
            if (this.Server.Players[i].MacAddress == info.sync_master) {
                masterPlayer = this.Server.Players[i];
                break;
            }
        }
        if (masterPlayer) {
            this.SyncedPlayers.push(masterPlayer);
        }

        if (info.sync_master == this.MacAddress) {
            this.IsSynced = true;
            this.IsSyncMaster = true;
            this.IsSyncSlave = false;
        } else {
            this.IsSyncMaster = false;
        }

        if (info.sync_slaves != undefined) {
            const syncList = info.sync_slaves.split(",");
            for (let i = 0; i < syncList.length; i++) {
                let slavePlayer: Player | undefined = undefined;
                for (let j = 0; j < this.Server.Players.length; j++) {
                    if (this.Server.Players[j].MacAddress == syncList[i]) {
                        slavePlayer = this.Server.Players[j];
                        break;
                    }
                }
                if (slavePlayer) {
                    this.SyncedPlayers.push(slavePlayer);
                    slavePlayer.IsSynced = true;
                    slavePlayer.IsSyncMaster = false;
                    slavePlayer.IsSyncSlave = true;
                }
            }
        }

        return prevCount != this.SyncedPlayers.length;
    }

    private buildPlaylistItem(entry: LyrionPlaylistEntry): PlaylistItem {
        const item = getEmptyPlaylistItem();
        item.Id = entry.id;
        item.Url = entry.url;
        item.Duration = entry.duration;
        item.Title = this.fixTitle(System.ConvertFromUTF8(entry.title));

        if (entry.album != undefined && entry.album != entry.title) {
            item.Album = System.ConvertFromUTF8(entry.album);
        } else if (entry.remote_title != undefined && entry.remote_title != entry.title) {
            item.Album = System.ConvertFromUTF8(entry.remote_title);
        }

        if (entry.artist != undefined) {
            item.Artist = System.ConvertFromUTF8(entry.artist);
        } else if (entry.albumartist != undefined) {
            item.Artist = System.ConvertFromUTF8(entry.albumartist);
        }

        item.ArtUrl = this.resolveArtUrl(entry.artwork_url, entry.artwork_track_id);
        item.Remote = entry.remote?.toString() ?? "";
        item.Type = entry.type ?? "";
        item.BitRate = entry.bitrate ?? "";
        item.Genre = entry.genre ?? "";
        return item;
    }

    private applyRemoteMeta(meta: LyrionRemoteMeta, nowPlayingInfo: PlaylistItem): void {
        nowPlayingInfo.Title = this.fixTitle(meta.title ?? "");
        nowPlayingInfo.Artist = meta.artist ?? "";
        if (meta.album != undefined) {
            nowPlayingInfo.Album = meta.album;
        } else if (meta.remote_title != undefined) {
            nowPlayingInfo.Album = meta.remote_title;
        }
        if (meta.type != undefined) {
            nowPlayingInfo.Type = meta.type;
        }
        nowPlayingInfo.ArtUrl = this.resolveArtUrl(meta.artwork_url, meta.artwork_track_id);
        this.NowPlayingUrl = meta.url ?? "";
    }

    private resolveArtUrl(artworkUrl?: string, artworkTrackId?: string): string {
        if (artworkUrl != undefined) {
            const url = artworkUrl.toString();
            return url.substring(0, 4) != "http"
                ? "http://" + this.Server.Ip + ":" + this.Server.Port + "/" + url.replace(/^\//, '')
                : url;
        }
        if (artworkTrackId != undefined) {
            return "http://" + this.Server.Ip + ":" + this.Server.Port + "/music/" + artworkTrackId + "/cover.jpg";
        }
        return "";
    }

    private fixTitle(title: string): string {
        const idx = title.indexOf('text=');
        if (idx > -1) {
            title = title.substring(idx + 6);
            title = title.substring(0, title.indexOf('"'));
        }
        return title;
    }

    private propagateToSyncedPlayers(): void {
        for (let i = 0; i < this.SyncedPlayers.length; i++) {
            const syncedPlayer = this.SyncedPlayers[i];
            syncedPlayer.Title = this.Title;
            syncedPlayer.Artist = this.Artist;
            syncedPlayer.Album = this.Album;
            syncedPlayer.NowPlayingCoverArt = this.NowPlayingCoverArt;
            syncedPlayer.Genre = this.Genre;
            syncedPlayer.BitRate = this.BitRate;
            syncedPlayer.CanSeek = this.CanSeek;
            syncedPlayer.Repeat = this.Repeat;
            syncedPlayer.RepeatType = this.RepeatType;
            syncedPlayer.Shuffle = this.Shuffle;
            syncedPlayer.ShuffleType = this.ShuffleType;
            syncedPlayer.IsPlayingPandora = this.IsPlayingPandora;
            syncedPlayer.HasPandoraThumbsUp = this.HasPandoraThumbsUp;
            syncedPlayer.Type = this.Type;
            syncedPlayer.Progress = this.Progress;
            syncedPlayer.Duration = this.Duration;
            syncedPlayer.ProgressBar = this.ProgressBar;
            syncedPlayer.SongID = this.SongID;
            syncedPlayer.Mode = this.Mode;
            syncedPlayer.StationName = this.StationName;
            syncedPlayer.PlaylistCurrentIndex = this.PlaylistCurrentIndex;
            syncedPlayer.PlaylistCount = this.PlaylistCount;
            syncedPlayer.Playlist = this.Playlist;
            syncedPlayer.updateVariables();
        }
    }

    updateVariables(): void {
        var paddedPlayerId = padDigit(this.Id);

        SystemVars.Write("MACP" + paddedPlayerId, this.MacAddress);
        SystemVars.Write("ConnectedP" + paddedPlayerId, this.Connected == true);
        SystemVars.Write("NotConnectedP" + paddedPlayerId, this.Connected == false);
        SystemVars.Write("PoweredOnP" + paddedPlayerId, this.PoweredOn == true);
        SystemVars.Write("PoweredOffP" + paddedPlayerId, this.PoweredOn == false);
        SystemVars.Write("SyncMasterP" + paddedPlayerId, this.IsSyncMaster);
        SystemVars.Write("SyncSlaveP" + paddedPlayerId, this.IsSyncSlave);

        SystemVars.Write("CurrentCoverURLP" + paddedPlayerId, "", "IMGURL");
        SystemVars.Write("TitleP" + paddedPlayerId, this.Title);
        SystemVars.Write("ArtistP" + paddedPlayerId, this.Artist);
        SystemVars.Write("AlbumP" + paddedPlayerId, this.Album);
        SystemVars.Write("PlayingP" + paddedPlayerId, this.Mode == "play");
        SystemVars.Write("PausedP" + paddedPlayerId, this.Mode == "pause");
        SystemVars.Write("StoppedP" + paddedPlayerId, this.Mode == "stop");
        SystemVars.Write("VolumeMutedP" + paddedPlayerId, this.Muted);
        SystemVars.Write("VolumeLevelP" + paddedPlayerId, this.Volume);
        SystemVars.Write("CanSeekP" + paddedPlayerId, this.CanSeek);
        SystemVars.Write("CantSeekP" + paddedPlayerId, this.CanSeek == false);
        SystemVars.Write("RepeatP" + paddedPlayerId, this.Repeat);
        SystemVars.Write("RepeatTypeP" + paddedPlayerId, this.RepeatType);
        SystemVars.Write("ShuffleP" + paddedPlayerId, this.Shuffle);
        SystemVars.Write("ShuffleTypeP" + paddedPlayerId, this.ShuffleType);
        SystemVars.Write("StationNameP" + paddedPlayerId, this.StationName);

        this.updateProgressVariables();

        SystemVars.Write("PlayingPandoraP" + paddedPlayerId, this.IsPlayingPandora);
        SystemVars.Write("NotPlayingPandoraP" + paddedPlayerId, this.IsPlayingPandora == false);
        SystemVars.Write("PandoraThumbsUpP" + paddedPlayerId, this.HasPandoraThumbsUp);
        SystemVars.Write("TypeP" + paddedPlayerId, this.Type);
        SystemVars.Write("BitRateP" + paddedPlayerId, this.BitRate);
        SystemVars.Write("SongTitleAvailableP" + paddedPlayerId, this.Title.length > 0);
        SystemVars.Write("AlbumTitleAvailableP" + paddedPlayerId, this.Album.length > 0);
        SystemVars.Write("ArtistTitleAvailableP" + paddedPlayerId, this.Artist.length > 0);

        if (this.IsSynced == true) {
            var SyncedWith = "";
            for (let i = 0; i < this.SyncedPlayers.length; i++) {
                if (this.SyncedPlayers[i].Name != this.Name) {
                    SyncedWith += this.SyncedPlayers[i] + ",";
                }
            }
            SystemVars.Write("SyncedPlayerStringP" + paddedPlayerId, SyncedWith.substring(0, SyncedWith.length - 1));
        }
        else {
            SystemVars.Write("SyncedPlayerStringP" + paddedPlayerId, "");
        }

        if (this.NowPlayingCoverArt.length == 0) {
            this.NowPlayingCoverArt = "http://" + this.Server.Ip + ":" + this.Server.Port + "/music/" + this.SongID + "/cover_128x128_p.png";
        }
        else if (this.NowPlayingCoverArt.indexOf("http") == -1) {
            this.NowPlayingCoverArt = "http://" + this.Server.Ip + ":" + this.Server.Port + "/" + this.NowPlayingCoverArt.replace(/^\//, '');
        }
        SystemVars.Write("CurrentCoverURLP" + paddedPlayerId, this.NowPlayingCoverArt, "IMGURL", "ForcePropagate");
    }

    updateProgressVariables(): void {
        var paddedPlayerId = padDigit(this.Id);
        SystemVars.Write("ProgressP" + paddedPlayerId, toTimeString(this.Progress));
        if (this.Duration > 0) {
            SystemVars.Write("DurationAvailableP" + paddedPlayerId, true);
            SystemVars.Write("DurationP" + paddedPlayerId, toTimeString(this.Duration));
            if (this.Remaining > -1) {
                SystemVars.Write("RemainingP" + paddedPlayerId, toTimeString(this.Remaining));
                SystemVars.Write("ProgressBarP" + paddedPlayerId, this.ProgressBar);
            }
        }
        else {
            SystemVars.Write("DurationAvailableP" + paddedPlayerId, false);
            SystemVars.Write("CantSeekP" + paddedPlayerId, false);
        }
    }

    tickProgress(): void {
        if (this.Mode == "play") {
            this.Progress++;
            if (this.Duration > 0) {
                this.Remaining = this.Duration - this.Progress;
                this.ProgressBar = (Math.floor((this.Progress / this.Duration) * 100));
            }
            else {
                this.ProgressBar = 0;
                this.Remaining = 0;
            }
            this.updateProgressVariables();
            this.NowPlayingTimer.Start(this._onProgressTick, 1000);
        }
    }

    subscribeToStatus(): void {
        const json = buildSlimSubscribeJson(this.Id, undefined, this.Server.ClientId, "slim/playerstatus/" + this.MacAddress, this.MacAddress, [LyrionCmd.Status, "0", g_Max_Now_Playing_List_Size, g_Status_Tags, "subscribe:60"]);
        this.Server.sendJsonCommand(json);
    }
}
