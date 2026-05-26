class Player {
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

    //Used at driver start up or when the driver reconnects to the server that hosts this player
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

    constructor(id: number) {
        let paddedId = padDigit(id);
        
        this.Id = id;
        this.Name = Config.Get("NameP" + paddedId);
        this.ShouldHideMySqueezebox = (Config.Get("Favorites_Hide_MySqueeze_P" + paddedId) == "true");
        this.ShouldHideMySqueezebox = (Config.Get("SkipFirstPandoraMenuP" + paddedId) == "true");
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
}