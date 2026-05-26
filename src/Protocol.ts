function sendJsonCommand(json: string, server: Server, isRpc: boolean = false): void {
    dbg('sendJsonCommand sending Command: ' + json + ' to Server: ' + server.Ip);
    let command = "POST /cometd HTTP/1.1\r\n" +
                  "Content-Length: " + json.length + "\r\n" +
                  "Content-Type: application/json\r\n\r\n";

    if (isRpc) {
        command = "POST /jsonrpc.js HTTP/1.1\r\n" +
                  "Content-Length: " + json.length + "\r\n\r\n"
    }

    command += json + "\r\n\r\n";

    server.Connection.Write(command);

    if (g_Print_Posts) {
        System.Print("");
        System.Print(g_DriverName + "  **Sending the following Command with http header to " + server.Ip + "****");
        var test = command.split('\r\n');
        for (let i = 0; i < test.length; i++) {
            printMaxLineSize(test[i]);
        }
        System.Print(g_DriverName + "****End Post****");
        System.Print("");
    }
}
