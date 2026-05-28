class RemotePlayer {
    private readonly _logger: Logger;

	public readonly Remote: Remote;
    public readonly Player: Player;

    public readonly BrowseList: SystemVarsList<BrowseListItem | string>;

	public readonly NowPlayingList: SystemVarsList<string>;

	public CurrentList: BrowseListItem = getEmptyBrowseListItem();
	public readonly CurrentActionsList: ActionItems = getEmptyActionItems();

    public BrowseListParentActionItems: ActionItems = getEmptyActionItems();
    public BrowseListRequestCorrelation: number = 0;

	public ListLevel: number = 0;

    public KeyboardData: string = "";
    public KeyboardLayout: number = 0;

    public Offset: number = 0;

    public History: BrowseListItem[] = [];

    constructor(remote: Remote, player: Player, logger: Logger) {
        this._logger = logger;
        this.Remote = remote;
        this.Player = player;

        this.NowPlayingList = new SystemVarsList("NowPlayingListP" + padDigit(player.Id) + "%" + remote.Id);
        this.BrowseList = new SystemVarsList("BrowseListP" + padDigit(player.Id) + "%" + remote.Id);
    }

    private ClearCurrentList() {
        this.CurrentList = getEmptyBrowseListItem();
    }
    
    public BrowseListSelect(index: number): void {
        this._logger.logInfo('List Select: index ' + index, LogInfoLevel.High);
        const paddedPlayerId = padDigit(this.Player.Id);

        const command = this.CurrentList.ListItems[index].Actions[0].GoCmd;
        const params = this.CurrentList.ListItems[index].Actions[0].GoParams;

        if (command.some(function(c) { return c === "jiveblankcommand"; })) {
            this.ListBack();
            return;
        }

        this.CurrentList.MenuTitle = SystemVars.Read("BrowseListTitleP" + paddedPlayerId + "%" + this.Remote.Id);
        this.BrowseListParentActionItems = this.CurrentList.ListItems[index].Actions[0];

        // Reset BrowseListRequestCorrelation to ignore any late-arriving menu results from previous navigation
        this.SetNewBrowseListRequestCorrelation();

        let json: string;
        if (command.some(function(c) { return c.indexOf("play") > -1; })) {
            json = buildSlimRequestJson(
                this.Player.Id,
                this.Remote.Id,
                this.Player.Server.ClientId,
                g_Slim_Request,
                this.Player.MacAddress.toLowerCase(),
                (command as LyrionCommandArray)
                    .concat(params as LyrionCommandArray),
                this.BrowseListRequestCorrelation);
        } else {
            json = buildSlimRequestJson(
                this.Player.Id,
                this.Remote.Id,
                this.Player.Server.ClientId,
                g_Slim_Request,
                this.Player.MacAddress.toLowerCase(),
                (command as LyrionCommandArray)
                    .concat([this.Offset, g_Max_Poll_Count])
                    .concat(params as LyrionCommandArray),
                this.BrowseListRequestCorrelation);
        }

        if (this.CurrentList.ListItems[index].PlayOnly != true) {
            SystemVars.Write("BrowseListTitleP" + paddedPlayerId + "%" + this.Remote.Id, this.CurrentList.ListItems[index].MenuTitle);
            SystemVars.Write("BrowseListAtParentP" + paddedPlayerId + "%" + this.Remote.Id, false); //Will come back to this
            this.CurrentList.Selected = index;
            this.ListLevel++;
            this.BrowseList.Open();
            this.BrowseList.RemoveAll();
            this.BrowseList.Insert("Loading..");
            this.BrowseList.Close();
        }

        this.PushHistory();

        this.Player.Server.sendJsonCommand(json);
    }

    public ListBack(): void {
        if (this.History.length > 0) {
            const paddedPlayerId = padDigit(this.Player.Id);

            // Reset BrowseListRequestCorrelation to ignore any late-arriving menu results from previous navigation
            this.SetNewBrowseListRequestCorrelation();

            this.ListLevel--;
            this.CurrentList = this.History.pop()!;
            this._logger.logInfo('ListLevel=' + this.ListLevel, LogInfoLevel.High);
            if (this.ListLevel == 0) {
                this.CurrentList.MenuTitle = " Home";
            }
            SystemVars.Write("BrowseListTitleP" + paddedPlayerId + "%" + this.Remote.Id, this.CurrentList.MenuTitle);
            this.BrowseList.Open();
            this.BrowseList.RemoveAll();

            for (let i = 0; i < this.CurrentList.ListItems.length; i++) {
                this.BrowseList.Insert(this.CurrentList.ListItems[i].MenuTitle);
            }

            const lastIdx = this.CurrentList.ListItems.length - 1;
            //Now set top of list
            this.BrowseList.SetIndexes(this.CurrentList.Top, this.CurrentList.Top);
            SystemVars.Write("MoreOptionsAvailableP" + paddedPlayerId + "%" + this.Remote.Id, this.CurrentList.ListItems[lastIdx].MoreOptionsAvailable);
            SystemVars.Write("MoreOptionsNotAvailableP" + paddedPlayerId + "%" + this.Remote.Id, (this.CurrentList.ListItems[lastIdx].MoreOptionsAvailable == false));
            SystemVars.Write("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + this.Remote.Id, false);
            this._logger.logInfo('this.CurrentList.MoreOptionsAvailable=' + this.CurrentList.ListItems[lastIdx].MoreOptionsAvailable, LogInfoLevel.High);
            this.BrowseList.Close();
        }
    }

    public ListAppend(listItem: BrowseListItem): void {
        this.BrowseList.Insert(listItem.MenuTitle);
        this.CurrentList.ListItems.push(listItem);    
    }

    private ListRemoveAll(): void {
        this.BrowseList.RemoveAll();
        this.CurrentList.ListItems = [];    
    }

    private PushHistory(): void {
        this.History.push(this.CurrentList);
        this.ClearCurrentList()
    }

    public SetNewBrowseListRequestCorrelation(): void {
        this.BrowseListRequestCorrelation = Math.floor(Math.random() * 10000);
    }

    private clearAllBrowseModes(): void {
        const paddedPlayerId = padDigit(this.Player.Id);
        SystemVars.Write("SelectModeP" + paddedPlayerId + "%" + this.Remote.Id, false);
        SystemVars.Write("PlayModeP" + paddedPlayerId + "%" + this.Remote.Id, false);
        SystemVars.Write("AddNextModeP" + paddedPlayerId + "%" + this.Remote.Id, false);
        SystemVars.Write("AddEndModeP" + paddedPlayerId + "%" + this.Remote.Id, false);
        SystemVars.Write("FavoritesModeP" + paddedPlayerId + "%" + this.Remote.Id, false);
    }

    public applyBrowseMode(mode: number): void {
        this.clearAllBrowseModes();

        const paddedPlayerId = padDigit(this.Player.Id);
        let existingMode = parseInt(SystemVars.Read("SelectModeIntegerP" + paddedPlayerId + "%" + this.Remote.Id), 10);
        if (mode == 99) {
            existingMode++;
            if (existingMode > 4) existingMode = 0;
            mode = existingMode;
        }
        switch (mode) {
            case 0: //"select":
                SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + this.Remote.Id, mode);
                SystemVars.Write("SelectModeP" + paddedPlayerId + "%" + this.Remote.Id, true);
                break;
            case 1: //"play":
                SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + this.Remote.Id, mode);
                SystemVars.Write("PlayModeP" + paddedPlayerId + "%" + this.Remote.Id, true);
                break;
            case 2: //"addnext":
                SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + this.Remote.Id, mode);
                SystemVars.Write("AddNextModeP" + paddedPlayerId + "%" + this.Remote.Id, true);
                break;
            case 3: //"addend":
                SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + this.Remote.Id, mode);
                SystemVars.Write("AddEndModeP" + paddedPlayerId + "%" + this.Remote.Id, true);
                break;
            case 4: //"favorites":
                SystemVars.Write("SelectModeIntegerP" + paddedPlayerId + "%" + this.Remote.Id, mode);
                SystemVars.Write("FavoritesModeP" + paddedPlayerId + "%" + this.Remote.Id, true);
                break;
        }
    }

    public loadNewParentBrowseList(): void {
        const paddedPlayerId = padDigit(this.Player.Id);
        SystemVars.Write("BrowseListTitleP" + paddedPlayerId + "%" + this.Remote.Id, this.Player.ParentMenu.MenuTitle);
        SystemVars.Write("BrowseListAtParentP" + paddedPlayerId + "%" + this.Remote.Id, true);
        this.BrowseList.Open();
        this.BrowseList.RemoveAll();

        const newNames = this.Player.CustomMenuNewNames;

        this._logger.logInfo('Adding ' + this.CurrentList.ListItems.length + ' items to browse list', LogInfoLevel.High);
        for (var i = 0; i < this.CurrentList.ListItems.length; i++) {
            if (newNames.length > 0) {
                this.CurrentList.ListItems[i].MenuTitle = newNames[i];
            }
            const title = this.CurrentList.ListItems[i].MenuTitle;
            this.BrowseList.Insert(title);
        }
        this.BrowseList.SetIndexes(0, 0);
        this.BrowseList.SetMarked(0);
        this.BrowseList.Close();
        this._logger.logInfo('Browse list now contains ' + this.BrowseList.Size + ' items', LogInfoLevel.High);
    }
}
