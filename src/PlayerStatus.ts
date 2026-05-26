function updatePlayerState(json: string, server: Server): void {
    //if there is more then one data object, then we have synced players, so enumerate the data objects.
    if (json["data"] == undefined) { return; }

    let player: Player | undefined = undefined;
    for (let i = 0; i < server.Players.length; i++) {
        if (server.Players[i].Name == json["data"]["player_name"]) {
            player = server.Players[i];
            break;
        }
    }

    if (!player) { return; }

    //current_title
    let updateVars = false;
    const paddedPlayerId = padDigit(player.Id);
    const info = json["data"];
    const playerConnected = info["player_connected"] == "1";

    if (player.Mode != info["mode"] || player.Connected != playerConnected) {
        updateVars = true;
    }

    var syncedPlayers = player.SyncedPlayers.length;
    if (json["data"]["sync_master"] != undefined) {
        player.SyncedPlayers = [];

        //First Push the Master to the SyncedPlayersList
        let masterPlayer: Player | undefined = undefined;
        for (let i = 0; i < server.Players.length; i++) {
            if (server.Players[i].MacAddress == json["data"]["sync_master"]) {
                masterPlayer = server.Players[i];
                break;
            }
        }

        if (masterPlayer) {
            player.SyncedPlayers.push(masterPlayer);
        }

        if (json["data"]["sync_master"] == player.MacAddress) {
            player.IsSynced = true;
            player.IsSyncMaster = true;
            player.IsSyncSlave = false;
        }
        else {
            player.IsSyncMaster = false;
        }

        //Now look for the synced slave players
        if (json["data"]["sync_slaves"] != undefined) {
            const syncList = json["data"]["sync_slaves"].split(",");
            for (let i = 0; i < syncList.length; i++) {
                let slavePlayer: Player | undefined = undefined;
                for (let j = 0; j < server.Players.length; j++) {
                    if (server.Players[j].MacAddress == syncList[i]) {
                        slavePlayer = server.Players[j];
                        break;
                    }
                }

                if (slavePlayer) {
                    player.SyncedPlayers.push(slavePlayer);
                    slavePlayer.IsSynced = true;
                    slavePlayer.IsSyncMaster = false;
                    slavePlayer.IsSyncSlave = true;
                }
            }
        }
    }
    else {
        player.IsSynced = false;
        player.IsSyncMaster = false;
        player.IsSyncSlave = false;
        player.SyncedPlayers = [];
    }

    if (syncedPlayers != player.SyncedPlayers.length) {
        updateVars = true;
    }

    var volume = parseInt(info["mixer volume"], 10);
    if (volume != player.Volume) {
        updateVars = true;
    }
    player.Volume = volume;
    if (volume < 1) {
        player.Muted = true;
    }
    else {
        player.Muted = false;
    }

    if (info["current_title"] != undefined) {
        player.StationName = info["current_title"];
    }
    else {
        player.StationName = "";
    }

    if (info["mode"] != player.Mode) {
        switch (info["mode"]) {
            case "play":
                System.SignalEvent("PlayingP" + paddedPlayerId);
                break;
            case "pause":
                System.SignalEvent("PausedP" + paddedPlayerId);
                break;
            case "stop":
                System.SignalEvent("StoppedP" + paddedPlayerId);
                break;
        }
    }

    player.Connected = playerConnected;

    if (player.IsSyncSlave) {
        //We are done so pass this on and up date all their data with the synced master
        //Maybe just return here, all synced players wil have been previously updated when the master was loaded.
        //System.Print("Synced Player " + player.Name);
        if (updateVars) {
            SystemVars.Write("VolumeLevelP" + paddedPlayerId, player.Volume);
        }
        //We should have already updated everything else for this player, so just update the volume level
        return;
    }

    player.Mode = info["mode"];

    if (info["mode"] != "play") {
        player.NowPlayingTimer.Stop();
    }
    else {
        player.NowPlayingTimer.Stop();
        player.NowPlayingTimer.Start(onTimerUpdatePlayerProgress, 1000);
    }

    player.Progress = parseInt(info["time"], 10);

    if (info["duration"] != undefined) {
        player.Duration = parseInt(info["duration"], 10);
        player.Remaining = player.Duration - player.Progress;
    }
    else {
        player.Duration = 0;
        player.Remaining = 0;
    }

    if (info["can_seek"] != undefined && player.Duration > 0) {
        player.CanSeek = (info["can_seek"] == "1");
    }
    else {
        player.CanSeek = false;
    }

    player.PlaylistLastCurrentIndex = player.PlaylistCurrentIndex;  //Used to unmark last selected item
    player.PlaylistCurrentIndex = parseInt(info["playlist_cur_index"], 10);

    const shuffleType = parseInt(info["playlist shuffle"], 10);
    const repeatType = parseInt(info["playlist repeat"], 10);
    const poweredOn = (info["power"] == "1");

    if (poweredOn != player.PoweredOn) {
        if (poweredOn == true) {
            System.SignalEvent("PONP" + paddedPlayerId);
        }
        else {
            System.SignalEvent("POFFP" + paddedPlayerId);
        }
    }

    //Need to check this....
    if (player.ShuffleType != shuffleType || player.RepeatType != repeatType || player.PoweredOn != poweredOn) {
        updateVars = true;
    }

    player.RepeatType = repeatType;
    player.Repeat = (player.RepeatType > 0);
    player.ShuffleType = shuffleType;
    player.Shuffle = (player.ShuffleType > 0);
    player.PoweredOn = poweredOn;

    player.PlaylistCount = parseInt(info["playlist_tracks"], 10);

    if (info["playlist_timestamp"] != player.PlaylistTimestamp) {
        //System.Print("Resetting Playlist");
        player.Playlist = [];
        player.PlaylistReset = true;
        player.PlaylistLastCurrentIndex = 0; //Set to 0 because we are reloading the list, it will be corrected on the next now playing pull

        //System.Print("**************************  " + Info.playlist_timestamp + "   **************************************");
        //System.Print("**************************  " + player.Playlist_Timestamp + "   **************************************");
        //System.Print("**************************  " + Info.remoteMeta + "   **************************************");
    }
    else {
        player.PlaylistReset = false;
    }
    player.PlaylistTimestamp = info["playlist_timestamp"];

    if (info["playlist_loop"] != undefined && player.IsSyncSlave == false) {
        const lastPlayistItemIndex = parseInt(info["playlist_loop"][info["playlist_loop"].length - 1]["playlist index"], 10) + 1;
        const playListCount = parseInt(info["playlist_loop"].length, 10);
        //System.Print("PlayListCount=" + PlayListCount);
        if (player.Playlist.length <= player.PlaylistCount) {
            for (let i = 0; i < info["playlist_loop"].length; i++) {
                const playListItem = getEmptyPlaylistItem();
                try {
                    const playerInfo = info["playlist_loop"][i];

                    if (playerInfo["lyrics"] != undefined) {
                        // System.Print(PlayerInfo["lyrics"]);
                    }
                    playListItem.Id = playerInfo["id"];
                    playListItem.Url = info["playlist_loop"][i].url;

                    playListItem.Duration = info["playlist_loop"][i].duration;

                    playListItem.Title = System.ConvertFromUTF8(info["playlist_loop"][i]["title"]);
                    var crapTitle = playListItem.Title.indexOf('text=');
                    if (crapTitle > -1) {
                        playListItem.Title = playListItem.Title.substring(crapTitle + 6);
                        playListItem.Title = playListItem.Title.substring(0, playerInfo["title"].indexOf('"'));
                    }

                    if (playerInfo["album"] != undefined) {
                        if (playerInfo["album"] != playerInfo["title"]) {
                            playListItem.Album = System.ConvertFromUTF8(playerInfo["album"]);
                        }
                    }
                    else if (playerInfo["remote_title"] != undefined) {
                        if (playerInfo["remote_title"] != playerInfo["title"]) {
                            playListItem.Album = System.ConvertFromUTF8(info["playlist_loop"][i]["remote_title"]);
                        }
                    }

                    if (playerInfo["artist"] != undefined) {
                        playListItem.Artist = System.ConvertFromUTF8(playerInfo["artist"]);
                    }
                    else if (playerInfo["albumartist"] != undefined) {
                        playListItem.Artist = System.ConvertFromUTF8(playerInfo["albumartist"]);
                    }

                    var artUrl = "";
                    if (playerInfo["artwork_url"] != undefined) {
                        artUrl = playerInfo["artwork_url"].toString();
                        if (artUrl.substring(0, 4) != "http") {
                            artUrl = "http://" + server.Ip + ":" + server.Port + "/" + artUrl.replace(/^\//, '');
                        }

                    }
                    else if (playerInfo["artwork_track_id"] != undefined) {
                        artUrl = "http://" + server.Ip + ":" + server.Port + "/music/" + playerInfo["artwork_track_id"] + "/cover.jpg";
                    }
                    playListItem.ArtUrl = artUrl;

                    //System.Print("************************Now Playing Loop**************************************");
                    //System.Print("PlayerInfo.artist=" + PlayerInfo.artist);
                    //System.Print("Play_List_Item.Title=" + Play_List_Item.Title);
                    //System.Print("Play_List_Item.Album=" + Play_List_Item.Album);

                    playListItem.Remote = info["playlist_loop"][i]["remote"];

                    if (playerInfo["type"] != undefined) {
                        playListItem.Type = playerInfo["type"];
                    }
                    else {
                        playListItem.Type = "";
                    }

                    if (playerInfo["bitrate"] != undefined) {
                        playListItem.BitRate = playerInfo["bitrate"];
                    }
                    else {
                        playListItem.BitRate = "";
                    }

                    if (playerInfo["genre"] != undefined) {
                        playListItem.Genre = playerInfo["genre"];
                    }
                    else {
                        playListItem.Genre = "";
                    }

                    player.Playlist.push(playListItem);
                }
                catch (err) {
                    System.Print("%%%%%%%%%%%%%%%%%% Playlist Error %%%%%%%%%%%%%%%%%%%%%%%%%%%");
                    System.Print("err with play list count error was " + err);
                    //quick hack fix that will be readdressed later
                    player.PlaylistCount--;
                }
            }

            if (player.Playlist.length < player.PlaylistCount && player.IsSyncSlave == false) {
                var json = '[{"id": "' + json["id"] + '","data":{"response":"\/' + server.ClientId + '\/slim\/request","request":["' + player.MacAddress + '",["status",' + lastPlayistItemIndex + ',25,"tags:uBjJKlaxdecNoptyw"]]}' + ',"channel":"\/slim\/request"}]';
                sendJsonCommand(json, server);
            }
        }
    }

    let nowPlayingInfo = player.Playlist[player.PlaylistCurrentIndex];

    //Remote Meta Data will take priority,if it exists we will use it instead.
    if (info["remoteMeta"] != undefined) {
        nowPlayingInfo.Title = info["remoteMeta"]["title"] || "";
        const hasBadTitle = nowPlayingInfo.Title?.indexOf('text=') ?? -1;
        if (hasBadTitle > -1) {
            nowPlayingInfo.Title = nowPlayingInfo.Title.substring(hasBadTitle + 6);
            nowPlayingInfo.Title = nowPlayingInfo.Title.substring(0, nowPlayingInfo.Title.indexOf('"'));
        }
        nowPlayingInfo.Artist = info["remoteMeta"]["artist"];
        if (info["remoteMeta"]["album"] != undefined) {
            nowPlayingInfo.Album = info["remoteMeta"]["album"];
        }
        else if (info["remoteMeta"]["remote_title"] != undefined) {
            nowPlayingInfo.Album = info["remoteMeta"]["remote_title"];
        }
        if (info["remoteMeta"]["type"] != undefined) {
            nowPlayingInfo.Type = info["remoteMeta"]["type"];
        }
        let artURL = "";
        if (info["remoteMeta"]["artwork_url"] != undefined) {
            artURL = info["remoteMeta"]["artwork_url"].toString();
            if (artURL.substring(0, 4) != "http") {
                artURL = "http://" + player.Server.Ip + ":" + player.Server.Port + "/" + artURL.replace(/^\//, '');
            }

        }
        else if (info["remoteMeta"]["artwork_track_id"] != undefined) {
            artURL = "http://" + player.Server.Ip + ":" + player.Server.Port + "/music/" + info["remoteMeta"]["artwork_track_id"] + "/cover.jpg";
        }
        nowPlayingInfo.ArtUrl = artURL;

        if (player.BitRate == undefined) {
            player.BitRate = "";
        }
        if (nowPlayingInfo.Artist == undefined) {
            nowPlayingInfo.Artist = "";
        }
        if (nowPlayingInfo.Album == undefined) {
            nowPlayingInfo.Album = "";
        }
        if (info["remoteMeta"]["url"] != undefined) {
            player.NowPlayingUrl = info["remoteMeta"]["url"];
        }
        else {
            player.NowPlayingUrl = "";
        }
    }

    if (updateVars == false) {
        try {
            updateVars = (player.Title != nowPlayingInfo.Title);
        }
        catch (Error) {
            System.Print("player.Playlist_Cur_Index=" + player.PlaylistCurrentIndex);
            System.Print("Error=" + Error);
        }
    }

    if (updateVars == true) {
        var Title = System.ConvertFromUTF8(nowPlayingInfo.Title);

        if (player.Title != Title) {
            System.SignalEvent("SongChangeP" + paddedPlayerId);
            player.HasPandoraThumbsUp = false;
        }

        player.Title = Title;
        player.Artist = System.ConvertFromUTF8(nowPlayingInfo.Artist);
        player.Album = System.ConvertFromUTF8(nowPlayingInfo.Album);
        player.NowPlayingCoverArt = nowPlayingInfo.ArtUrl;
        player.Genre = nowPlayingInfo.Genre;
        player.BitRate = nowPlayingInfo.BitRate;
        if (nowPlayingInfo.Type != undefined) {
            player.IsPlayingPandora = (nowPlayingInfo.Type.indexOf("(Pandora)") > -1);
            player.Type = nowPlayingInfo.Type
        }
        else {
            player.IsPlayingPandora = false;
            player.Type = "";
        }

        if (info["remoteMeta"] != undefined) {
            dbg('Setting Player: ' +player.Id + ' BitRate from info["remoteMeta"]["bitrate"]: ' + info["remoteMeta"]["bitrate"]);
            if (info["remoteMeta"]["bitrate"] != undefined) {
                player.BitRate = info["remoteMeta"]["bitrate"];
            }

            if (info["remoteMeta"]["album"] != undefined) {
                player.Album = System.ConvertFromUTF8(info["remoteMeta"]["album"]);
            }
        }

        //Now update the masters info
        updatePlayerVariables(player);

        if (player.SyncedPlayers.length > 0) {
            //Update their vars to mirror the masters, then update all data for all remotes
            for (let i = 0; i < player.SyncedPlayers.length; i++) {
                const syncedPlayer = player.SyncedPlayers[i];

                syncedPlayer.Title = player.Title;
                syncedPlayer.Artist = player.Artist;
                syncedPlayer.Album = player.Album;
                syncedPlayer.NowPlayingCoverArt = player.NowPlayingCoverArt;
                syncedPlayer.Genre = player.Genre;
                syncedPlayer.BitRate = player.BitRate;
                syncedPlayer.CanSeek = player.CanSeek;
                syncedPlayer.Repeat = player.Repeat;
                syncedPlayer.RepeatType = player.RepeatType;
                syncedPlayer.Shuffle = player.Shuffle;
                syncedPlayer.ShuffleType = player.ShuffleType;
                syncedPlayer.IsPlayingPandora = player.IsPlayingPandora;
                syncedPlayer.HasPandoraThumbsUp = player.HasPandoraThumbsUp;
                syncedPlayer.Type = player.Type;
                syncedPlayer.Progress = player.Progress;
                syncedPlayer.Duration = player.Duration;
                syncedPlayer.ProgressBar = player.ProgressBar;
                syncedPlayer.SongID = player.SongID;
                syncedPlayer.Mode = player.Mode;
                syncedPlayer.StationName = player.StationName;

                syncedPlayer.PlaylistCurrentIndex = player.PlaylistCurrentIndex;
                syncedPlayer.PlaylistCount = player.PlaylistCount;
                syncedPlayer.Playlist = player.Playlist;

                updatePlayerVariables(syncedPlayer);
            }
        }
    }
}

function updatePlayerVariables(player: Player): void {
    var paddedPlayerId = padDigit(player.Id);

    SystemVars.Write("MACP" + paddedPlayerId, player.MacAddress);

    SystemVars.Write("ConnectedP" + paddedPlayerId, player.Connected == true);
    SystemVars.Write("NotConnectedP" + paddedPlayerId, player.Connected == false);

    SystemVars.Write("PoweredOnP" + paddedPlayerId, player.PoweredOn == true);
    SystemVars.Write("PoweredOffP" + paddedPlayerId, player.PoweredOn == false);

    SystemVars.Write("SyncMasterP" + paddedPlayerId, player.IsSyncMaster);
    SystemVars.Write("SyncSlaveP" + paddedPlayerId, player.IsSyncSlave);

    SystemVars.Write("CurrentCoverURLP" + paddedPlayerId, "", "IMGURL");
    SystemVars.Write("TitleP" + paddedPlayerId, player.Title);
    SystemVars.Write("ArtistP" + paddedPlayerId, player.Artist);
    SystemVars.Write("AlbumP" + paddedPlayerId, player.Album);
    SystemVars.Write("PlayingP" + paddedPlayerId, player.Mode == "play");
    SystemVars.Write("PausedP" + paddedPlayerId, player.Mode == "pause");
    SystemVars.Write("StoppedP" + paddedPlayerId, player.Mode == "stop");
    SystemVars.Write("VolumeMutedP" + paddedPlayerId, player.Muted);

    SystemVars.Write("VolumeLevelP" + paddedPlayerId, player.Volume);
    SystemVars.Write("CanSeekP" + paddedPlayerId, player.CanSeek);
    SystemVars.Write("CantSeekP" + paddedPlayerId, player.CanSeek == false);

    SystemVars.Write("RepeatP" + paddedPlayerId, player.Repeat);
    SystemVars.Write("RepeatTypeP" + paddedPlayerId, player.RepeatType);
    SystemVars.Write("ShuffleP" + paddedPlayerId, player.Shuffle);
    SystemVars.Write("ShuffleTypeP" + paddedPlayerId, player.ShuffleType);
    SystemVars.Write("StationNameP" + paddedPlayerId, player.StationName);

    updatePlayerProgressVariables(player);

    SystemVars.Write("PlayingPandoraP" + paddedPlayerId, player.IsPlayingPandora);
    SystemVars.Write("NotPlayingPandoraP" + paddedPlayerId, player.IsPlayingPandora == false);

    SystemVars.Write("PandoraThumbsUpP" + paddedPlayerId, player.HasPandoraThumbsUp);
    SystemVars.Write("TypeP" + paddedPlayerId, player.Type);
    SystemVars.Write("BitRateP" + paddedPlayerId, player.BitRate);

    if (player.Title.length == 0) {
        SystemVars.Write("SongTitleAvailableP" + paddedPlayerId, false);
    }
    else {
        SystemVars.Write("SongTitleAvailableP" + paddedPlayerId, true);
    }
    if (player.Album.length == 0) {
        SystemVars.Write("AlbumTitleAvailableP" + paddedPlayerId, false);
    }
    else {
        SystemVars.Write("AlbumTitleAvailableP" + paddedPlayerId, true);
    }

    if (player.Artist.length == 0) {
        SystemVars.Write("ArtistTitleAvailableP" + paddedPlayerId, false);
    }
    else {
        SystemVars.Write("ArtistTitleAvailableP" + paddedPlayerId, true);
    }

    if (player.IsSynced == true) {
        var SyncedWith = "";
        for (let i = 0; i < player.SyncedPlayers.length; i++) {
            if (player.SyncedPlayers[i].Name != player.Name) {
                SyncedWith += player.SyncedPlayers[i] + ",";
            }
        }
        SystemVars.Write("SyncedPlayerStringP" + paddedPlayerId, SyncedWith.substring(0, SyncedWith.length - 1));
    }
    else {
        SystemVars.Write("SyncedPlayerStringP" + paddedPlayerId, "");
    }

    if (player.NowPlayingCoverArt.length == 0) {
        player.NowPlayingCoverArt = "http://" + player.Server.Ip + ":" + player.Server.Port + "/music/" + player.SongID + "/cover_128x128_p.png";
    }
    else if (player.NowPlayingCoverArt.indexOf("http") == -1) {
        player.NowPlayingCoverArt = "http://" + player.Server.Ip + ":" + player.Server.Port  + "/" + player.NowPlayingCoverArt.replace(/^\//, '');
    }
    SystemVars.Write("CurrentCoverURLP" + paddedPlayerId, player.NowPlayingCoverArt, "IMGURL", "ForcePropagate");
}

function updatePlayerProgressVariables(player: Player): void {
    var paddedPlayerId = padDigit(player.Id);
    SystemVars.Write("ProgressP" + paddedPlayerId, toTimeString(player.Progress));
    if (player.Duration > 0) {
        //Check to see if seek is available
        SystemVars.Write("DurationAvailableP" + paddedPlayerId, true);
        SystemVars.Write("DurationP" + paddedPlayerId, toTimeString(player.Duration));
        if (player.Remaining > -1) {
            SystemVars.Write("RemainingP" + paddedPlayerId, toTimeString(player.Remaining));
            SystemVars.Write("ProgressBarP" + paddedPlayerId, player.ProgressBar);
        }
    }
    else {
        SystemVars.Write("DurationAvailableP" + paddedPlayerId, false);
        SystemVars.Write("CantSeekP" + paddedPlayerId, false);

    }
}
