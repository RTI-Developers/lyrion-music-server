class Server {
	Connection: TCP;
    ClientId: string;
	Players: Player[] = [];
    Ip: string;
    Port: number;
    ServerVersion: number = 0;
    ConnectionIncomingData: string = "";
    ConnectionContentSize: number = 0;
    BufferCount: number = 0;
    Connected: boolean = false;
    StartUpTimer: Timer = new Timer();

    constructor(ip: string, port: number) {
        this.Ip = ip;
        this.Port = port;

        this.Connection = new TCP(onCommRx, ip, port);
        this.Connection.UseHandleInCallbacks = true;
        this.Connection.OnConnectFunc = onConnection;
        this.Connection.OnDisconnectFunc = onDisconnect;
        // this.Connection.OnConnectFailedFunc = OnConnectionFailed; // TODO: Handle fact that TCP object does not have OnConnectFailedFunc

        //Used when a new client id has been made[reconnected] will go out and get a list of all the players from the server 
        this.StartUpTimer.UseHandleInCallbacks = true;
    }
}
