class Remote {
    public readonly BroweslistPageMacro: number | undefined;
	public readonly Id: number;
    public readonly KeyboardPageMacro: number | undefined;

    constructor(id: number, browselistPageMacro?: number, keyboardPageMacro?: number) {
        this.Id = id;
        this.BroweslistPageMacro = browselistPageMacro;
        this.KeyboardPageMacro = keyboardPageMacro;
    }
}