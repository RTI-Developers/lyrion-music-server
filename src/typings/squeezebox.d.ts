interface BrowseListItem {
    MainTitle: string;
    MenuTitle: string;
    ListItems: BrowseListItem[];
    Count: number; //Total Items in List
    Top: number; //Top item in the list
    Offset: number;
    Selected: number;
    MoreOptionsAvailable: boolean;
    FavoritesUrl: string;
    FavoritesTitle: string;
    Actions: ActionItems[];  //If a menu item has base actions, then add them to this, other wise the parent base actions will be used
    PlayOnly: boolean;
}

interface ActionItems {
    //Go params will be stored in the browselist item
    Items: ActionItems[];

    GoCmd: string;   //Select
    GoParams: string;

    PlayCmd: string; // Play immediately
    PlayParams: string;

    AddHoldCmd: string; //Add next
    AddHoldParams: string;

    AddCmd: string;   //Add to End
    AddParams: string;

    MoreCmd: string;   //Add to End
    MoreParams: string;

    Params: string;  //A item may have seperate params
    CommonParams: string;  //Holds item id
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

interface FavoriteResponse {
    id: string;
    name: string;
    type: string;
    isaudio: boolean;
    hasitems: boolean;
}
