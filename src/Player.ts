class Player {
    private readonly _logger: Logger;
    private readonly onProgressTick: (handle: number) => void;
    private readonly onPlaylistReady: (playerId: number, titles: string[]) => void;

    private Album: string = "";
    private Artist: string = "";
    private AvailablePlayers: object[] = []; //This will hold the player names of all available players
    private BitRate: string = "";
    private Genre: string = "";
    private HasPandoraThumbsUp: boolean = false;
    private IsPlayingPandora: boolean = false;
    private IsSyncMaster: boolean = false;
    private IsSyncSlave: boolean = false;
    private Mode: string = "";
    private Muted: boolean = false;
    private NowPlayingCoverArt: string = "";
    private PlaylistCount: number = 0;
    private PlaylistCurrentIndex: number = 0;
    private PlaylistRebuildPending: boolean = false;
    private PlaylistTimestamp: number = 0;
    private Repeat: boolean = false;
    private RepeatType: number = 0; //0 = Off,  1= Repeat Song, 2= Repeat after end
    private Shuffle: boolean = false;
    private ShuffleType: number = 0;
    private SongID: number = 0;
    private StationName: string = "";
    private SyncedPlayers: Player[] = [];
    private SyncMaster: boolean = false;
    private Title: string = "";
    private Type: string = "";
    private Year: number = 0;
    
    public readonly CustomMenuNames: string[] = [];
    public readonly CustomMenuNewNames: string[] = [];
    public readonly Id: number;
    public readonly Name: string;
    public readonly NowPlayingTimer: Timer = new Timer();
    public readonly ShouldHideMySqueezebox: boolean;
    public readonly ShouldSkipFirstPandoraMenu: boolean;
    public readonly UseCustomParentMenu: boolean;
    
    public CanSeek: boolean = false;
    public Connected: boolean = false;
    public Duration: number = 0;
    public IsSynced: boolean = false;
    public MacAddress: string;
    public NowPlayingUrl: string = "";
    public ParentMenu: BrowseListItem;
    public Playlist: PlaylistItem[] = [];
    public Progress: number = 0;
    public ProgressBar: number = 0;
    public PoweredOn: boolean = false;
    public Remaining: number = 0;
    public Server: Server;
    public SyncSlave: boolean = false;
    public Volume: number = 0;

    constructor(
        id: number,
        logger: Logger,
        onProgressTick: (handle: number) => void,
        onPlaylistReady: (playerId: number, titles: string[]) => void
    ) {
        let paddedId = padDigit(id);

        this._logger = logger;
        this.onProgressTick = onProgressTick;
        this.onPlaylistReady = onPlaylistReady;

        this.Id = id;
        this.Name = Config.Get("NameP" + paddedId);
        this.ShouldHideMySqueezebox = (Config.Get("Favorites_Hide_MySqueeze_P" + paddedId) == "true");
        this.ShouldSkipFirstPandoraMenu = (Config.Get("SkipFirstPandoraMenuP" + paddedId) == "true");
        this.UseCustomParentMenu = (Config.Get("Use_Custom_Parent_Menu_P" + paddedId) == "true");

        if (this.UseCustomParentMenu) {
            this.CustomMenuNames = Config.Get("Custom_Menu_Order_P" + paddedId).split(":");
            this.CustomMenuNewNames = Config.Get("Custom_Menu_Names_P" + paddedId).split(":");
        }

        this.NowPlayingTimer.UseHandleInCallbacks = true;

        this.UpdateAssociatedVariables();
    }

    public UpdateAssociatedVariables(): void {
        const paddedId = padDigit(this.Id);
        SystemVars.Write("NameP" + paddedId, this.Name);
        SystemVars.Write("ConnectedP" + paddedId, this.Connected);
        SystemVars.Write("NotConnectedP" + paddedId, !this.Connected);
        SystemVars.Write("PoweredOnP" + paddedId, this.PoweredOn);
        SystemVars.Write("PoweredOffP" + paddedId, !this.PoweredOn);
        SystemVars.Write("SyncMasterP" + paddedId, this.SyncMaster);
        SystemVars.Write("SyncSlaveP" + paddedId, this.SyncSlave);
    }

    public applyStatusUpdate(info: LyrionStatusData): void {
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
                this.NowPlayingTimer.Start(this.onProgressTick, 1000);
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
        
        this.applyPlaylistUpdate(info);

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
                this.Year = parseInt(nowPlayingInfo.Year, 10) || 0;
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
                    this._logger.logInfo('Setting BitRate from remoteMeta.bitrate: ' + meta.bitrate, LogInfoLevel.High);
                    if (meta.bitrate != undefined) { this.BitRate = meta.bitrate; }
                    if (meta.album != undefined) { this.Album = System.ConvertFromUTF8(meta.album); }
                }
            }

            this.updateVariables();
            this.propagateToSyncedPlayers();
        }
    }

    private applyPlaylistUpdate(info: LyrionStatusData): void {
        this.PlaylistCount = info.playlist_tracks;

        // A changed timestamp means LMS replaced or modified the queue;
        // discard our cached copy so it is rebuilt from scratch.
        if (info.playlist_timestamp != this.PlaylistTimestamp) {
            this.Playlist = [];
            this.PlaylistRebuildPending = true;
        }
        this.PlaylistTimestamp = info.playlist_timestamp;

        // LMS paginates the queue across multiple status responses.
        // Accumulate pages until Playlist is fully populated.
        if (info.playlist_loop != undefined) {
            const nextPageOffset = parseInt(info.playlist_loop[info.playlist_loop.length - 1]["playlist index"], 10) + 1;
            if (this.Playlist.length < this.PlaylistCount) {
                info.playlist_loop.forEach(entry => {
                    try {
                        this.Playlist.push(this.buildPlaylistItem(entry));
                    } catch (err) {
                        this._logger.logError('Playlist error: ' + err);
                        this.PlaylistCount--;
                    }
                });
                // More pages remain — request the next batch.
                if (this.Playlist.length < this.PlaylistCount) {
                    const paginationJson = buildSlimRequestJson(
                        this.Id,
                        undefined,
                        this.Server.ClientId,
                        g_Slim_Request,
                        this.MacAddress,
                        [LyrionCmd.Status, nextPageOffset, 25, g_Status_Tags]);
                    this.Server.sendJsonCommand(paginationJson);
                }
            }
        }

        // All pages loaded after a queue composition change — notify remotes.
        if (this.PlaylistRebuildPending && this.Playlist.length >= this.PlaylistCount) {
            this.PlaylistRebuildPending = false;
            this.onPlaylistReady(this.Id, this.Playlist.map(function(p) { return p.Title; }));
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
        item.Year = entry.year?.toString() ?? "";
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
            syncedPlayer.Year = this.Year;
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

    public updateVariables(): void {
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
        SystemVars.Write("YearP" + paddedPlayerId, this.Year);
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

    public updateProgressVariables(): void {
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

    public tickProgress(): void {
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
            this.NowPlayingTimer.Start(this.onProgressTick, 1000);
        }
    }

    public subscribeToStatus(): void {
        const json = buildSlimSubscribeJson(this.Id, undefined, this.Server.ClientId, "slim/playerstatus/" + this.MacAddress, this.MacAddress, [LyrionCmd.Status, "0", g_Max_Now_Playing_List_Size, g_Status_Tags, "subscribe:60"]);
        this.Server.sendJsonCommand(json);
    }
}
