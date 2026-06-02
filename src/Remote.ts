class Remote {
    public readonly BrowselistPageMacro: number | undefined;
	public readonly Id: number;
    public readonly KeyboardPageMacro: number | undefined;

    constructor(id: number, browselistPageMacro?: number, keyboardPageMacro?: number) {
        this.Id = id;
        this.BrowselistPageMacro = browselistPageMacro;
        this.KeyboardPageMacro = keyboardPageMacro;
    }
}