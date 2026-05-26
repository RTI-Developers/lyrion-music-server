class RemotePlayer {
	Remote: Remote;
    Player: Player;

	PlayListSelectedItem: number = 0;
	LastPlayListSelectedItem: number = 0;
	PlaylistItemSelected: boolean = false;
	PlayListItemOrigLocation: number = -1;
	PlayListItemNewLocation: number = -1;

	PlayListChangeCommands: object[] = [];

    BrowseList: SystemVarsList<BrowseListItem | string>;

	NowPlayingList: SystemVarsList<string>;

	CurrentList: BrowseListItem = getEmptyBrowseListItem();
	CurrentActionsList: ActionItems = getEmptyActionItems();

    BrowseListParentActionItems: ActionItems = getEmptyActionItems();
    BrowseListRequestCorrelation: number = 0;

	ListLevel: number = 0;

    KeyboardData: string = "";
    KeyboardLayout: number = 0;
    BrowselistPageMacro: number = 0;
    KeyboardPageMacro: number = 0;

    Offset: number = 0;

    History: BrowseListItem[] = [];

    constructor(remote: Remote, player: Player) {
        this.Remote = remote;
        this.Player = player;

        this.NowPlayingList = new SystemVarsList("NowPlayingListP" + padDigit(player.Id) + "%" + remote.Id);
        this.BrowseList = new SystemVarsList("BrowseListP" + padDigit(player.Id) + "%" + remote.Id);
    }

    ClearCurrentList() {
        this.CurrentList = getEmptyBrowseListItem();
    }
    
    BrowseListSelect(index: number): void {
        dbg('List Select: index ' + index);
        const paddedPlayerId = padDigit(this.Player.Id);

        const command = this.CurrentList.ListItems[index].Actions[0].GoCmd;
        const params = this.CurrentList.ListItems[index].Actions[0].GoParams;

        if (command == '"jiveblankcommand"') {
            this.ListBack();
            return;
        }

        this.CurrentList.MenuTitle = SystemVars.Read("BrowseListTitleP" + paddedPlayerId + "%" + this.Remote.Id);
        this.BrowseListParentActionItems = this.CurrentList.ListItems[index].Actions[0];

        // Reset BrowseListRequestCorrelation to ignore any late-arriving menu results from previous navigation
        this.SetNewBrowseListRequestCorrelation();

        let json: string;
        if (command.indexOf("play") > -1) {
            json = ('[{"id": "' + paddedPlayerId + "_" + this.Remote.Id + "_" + this.BrowseListRequestCorrelation + '","data":{"response":"/' + this.Player.Server.ClientId + '/slim/request","request":["' + this.Player.MacAddress.toLowerCase() + '",[' + command + ',' + params + ']]}' + ',"channel":"/slim/request"}]');
        } else {
            json = ('[{"id": "' + paddedPlayerId + "_" + this.Remote.Id + "_" + this.BrowseListRequestCorrelation + '","data":{"response":"/' + this.Player.Server.ClientId + '/slim/request","request":["' + this.Player.MacAddress.toLowerCase() + '",[' + command + ',' + this.Offset + ',' + g_Max_Poll_Count + ',' + params + ']]}' + ',"channel":"/slim/request"}]');
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

        sendJsonCommand(json, this.Player.Server);
    }

    ListBack(): void {
        if (this.History.length > 0) {
            const paddedPlayerId = padDigit(this.Player.Id);

            // Reset BrowseListRequestCorrelation to ignore any late-arriving menu results from previous navigation
            this.SetNewBrowseListRequestCorrelation();

            this.ListLevel--;
            this.CurrentList = this.History.pop()!;
            if (g_Print_Incoming_Menu) System.Print("ListLevel=" + this.ListLevel);
            if (this.ListLevel == 0) {
                this.CurrentList.MenuTitle = " Home";
            }
            SystemVars.Write("BrowseListTitleP" + paddedPlayerId + "%" + this.Remote.Id, this.CurrentList.MenuTitle);
            this.BrowseList.Open();
            this.BrowseList.RemoveAll();

            var lastListIem;
            for (let listItem in this.CurrentList.ListItems) {
                this.BrowseList.Insert(this.CurrentList.ListItems[listItem].MenuTitle);
                lastListIem = listItem;
            }

            //Now set top of list
            this.BrowseList.SetIndexes(this.CurrentList.Top, this.CurrentList.Top);
            SystemVars.Write("MoreOptionsAvailableP" + paddedPlayerId + "%" + this.Remote.Id, this.CurrentList.ListItems[lastListIem].MoreOptionsAvailable);
            SystemVars.Write("MoreOptionsNotAvailableP" + paddedPlayerId + "%" + this.Remote.Id, (this.CurrentList.ListItems[lastListIem].MoreOptionsAvailable == false));
            SystemVars.Write("ShowingMoreOptionsBrowseP" + paddedPlayerId + "%" + this.Remote.Id, false);
            if (g_Print_Incoming_Menu) System.Print("this.CurrentList.MoreOptionsAvailable=" + this.CurrentList.ListItems[lastListIem].MoreOptionsAvailable);
            this.BrowseList.Close();
        }
    }

    ListAppend(listItem: BrowseListItem): void {
        this.BrowseList.Insert(listItem.MenuTitle);
        this.CurrentList.ListItems.push(listItem);    
    }

    ListRemoveAll(): void {
        this.BrowseList.RemoveAll();
        this.CurrentList.ListItems = [];    
    }

    PushHistory(): void {
        this.History.push(this.CurrentList);
        this.ClearCurrentList()
    }

    SetNewBrowseListRequestCorrelation(): void {
        this.BrowseListRequestCorrelation = Math.floor(Math.random() * 10000);
    }
}
