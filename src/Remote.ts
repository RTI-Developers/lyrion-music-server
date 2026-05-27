class Remote {
	public readonly Id: number;

	private MacAddress: string;
    
    public BroweslistPageMacro: number;
    public KeyboardPageMacro: number;

    constructor(id: number)
    {
        this.Id = id;
    }
}