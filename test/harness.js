'use strict';

/**
 * Integration test harness for the Lyrion Music Server RTI driver.
 *
 * Stubs all RTI SDK globals (TCP, Timer, System, Config, SystemVars, etc.)
 * with Node.js implementations, then loads and executes the compiled driver
 * (dist/index.js) via vm.runInThisContext so its top-level var/function
 * declarations become true globals — exactly as they would on the RTI XP-8.
 *
 * Also spawns Squeezelite so there is a real player for LMS to report on.
 *
 * Usage:
 *   node test/harness.js
 *   node test/harness.js --no-squeezelite   (if player is already connected)
 *   node test/harness.js --duration 60       (run for 60 seconds, default 30)
 */

const net    = require('net');
const fs     = require('fs');
const vm     = require('vm');
const path   = require('path');
const { spawn } = require('child_process');

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const startSqueezelite = !args.includes('--no-squeezelite');
const durationArg      = args.indexOf('--duration');
const DURATION_MS      = durationArg !== -1 ? parseInt(args[durationArg + 1], 10) * 1000 : 90_000;
const playerArg        = args.indexOf('--player');
const CLI_PLAYER_NAME  = playerArg !== -1 ? args[playerArg + 1] : null;
const logFileArg       = args.indexOf('--log-file');
const LOG_FILE         = logFileArg !== -1 ? args[logFileArg + 1] : null;

// If --log-file is given, tee all stdout/stderr to a UTF-8 file.
if (LOG_FILE) {
    const logStream = fs.createWriteStream(LOG_FILE, { encoding: 'utf8' });
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, enc, cb) => {
        logStream.write(chunk);
        return origWrite(chunk, enc, cb);
    };
    const origErrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, enc, cb) => {
        logStream.write(chunk);
        return origErrWrite(chunk, enc, cb);
    };
    console.log('[HARNESS] Logging to ' + LOG_FILE);
}

// ─── Test configuration ───────────────────────────────────────────────────────

// Override with --player <name> to target an existing LMS player instead of
// spawning a new Squeezelite instance (e.g. --player Home --no-squeezelite).
const PLAYER_NAME      = CLI_PLAYER_NAME ?? 'LMS-Test';
const SERVER_IP        = 'audio.internal.melena.casa';
const SERVER_PORT      = 9000;    // HTTP/CometD port used by the driver
const SQ_SLIMPROTO_PORT = 3483;   // SlimProto port used by Squeezelite (≠ HTTP port)
const SQ_EXE           = 'C:\\temp\\squeezelite-2.0.0.1563\\squeezelite-x64.exe';

// ─── RTI shim state ───────────────────────────────────────────────────────────

let _handleCounter = 0;
const _nextHandle  = () => ++_handleCounter;
const _sysVarStore = {};
const _rawRxLog    = [];   // {ts, handle, bytes, str}

// ─── System ───────────────────────────────────────────────────────────────────

global.System = {
    Version:    '25.0',
    IPAddress:  '127.0.0.1',
    MACAddress: '00:00:00:00:00:00',
    LogLevel:   0,
    IPNetMask:  '255.255.255.0',

    Print:             (msg)        => { process.stdout.write('[DRV] ' + msg + '\n'); return true; },
    PrintMultiline:    (msg)        => { process.stdout.write('[DRV] ' + msg + '\n'); return true; },
    Sleep:             (_ms)        => true,
    GetURL:            (_url)       => '',
    ConvertFromUTF8:   (s)          => s,
    ConvertToUTF8:     (s)          => s,
    RunSystemMacro:    (_n)         => true,
    SignalEvent:       (name)       => { console.log('[EVENT] ' + name); return true; },
    SetPriority:       (_n)         => true,
    StartUPnPScan:     ()           => true,
    GetLocalTime:      ()           => new Date().toLocaleString(),
    GetUTCTime:        ()           => new Date().toUTCString(),
    GetLocalTimeInSeconds: ()       => Math.floor(Date.now() / 1000),
    GetUTCTimeInSeconds:   ()       => Math.floor(Date.now() / 1000),
    Compress:          (s)          => s,
    Uncompress:        (s, _n)      => s,
    GetRandomInteger:  (lo, hi)     => Math.floor(Math.random() * (hi - lo + 1)) + lo,
    LogError:          (msg)        => { console.error('[ERR] ' + msg); return true; },
    LogInfo:           (_lv, msg)   => { console.log('[INFO] ' + msg); return true; },
    GetViewName:       (i)          => 'View' + i,
    LoadResource:      (_r)         => '',
    Ping:              (_addr)      => true,
    GetTickCount:      ()           => Date.now(),
};

// ─── Config ───────────────────────────────────────────────────────────────────

const _configMap = {
    // RTI system
    'SYSTEM::TwoWayDeviceList': '',
    'TotalRemotes':             '0',

    // Driver settings
    'Total_Players':            '1',
    'NameP01':                  PLAYER_NAME,
    'Defaul_Server_IP':         SERVER_IP,
    'Default_Server_TCP_Port':  String(SERVER_PORT),

    // Debug flags — all on so we see every byte and every JSON parse
    'DebugTrace':           'true',
    'DebugPrintPosts':      'true',
    'DebugPrintIncoming':   'true',
    'DebugRAWIncoming':     'true',
    'DebugMenuIncoming':    'false',

    // Per-player settings (Player 1)
    'Favorites_Hide_MySqueeze_P01': 'false',
    'SkipFirstPandoraMenuP01':      'false',
    'Use_Custom_Parent_Menu_P01':   'false',
    'Custom_Menu_Order_P01':        '',
    'Custom_Menu_Names_P01':        '',
};

global.Config = {
    Get(key) {
        if (Object.prototype.hasOwnProperty.call(_configMap, key)) {
            return _configMap[key];
        }
        console.warn('[CONFIG] Unknown key: ' + key + ' — returning empty string');
        return '';
    }
};

// ─── SystemVars ───────────────────────────────────────────────────────────────

global.SystemVars = {
    OnSysVarChangeFunc: null,
    Write(varname, data) {
        const prev = _sysVarStore[varname];
        _sysVarStore[varname] = data;
        if (prev !== data) {
            // Uncomment to log every sysvar change:
            // console.log('[SYSVAR] ' + varname + ' = ' + JSON.stringify(data));
        }
        return true;
    },
    Read(varname) {
        return Object.prototype.hasOwnProperty.call(_sysVarStore, varname)
            ? _sysVarStore[varname]
            : '';
    },
    AddSubscription:    (_id) => true,
    RemoveSubscription: (_id) => true,
};

// ─── SystemVarsList ───────────────────────────────────────────────────────────

global.SystemVarsList = class SystemVarsListShim {
    constructor(varname) {
        this._name     = varname;
        this._items    = [];
        this.Size      = 0;
        this.MarkedCount = 0;
        this.OnScrollInfoFunc = null;
    }
    Open()                { return true; }
    Close()               { return true; }
    Insert(data)          { this._items.push(data); this.Size = this._items.length; return true; }
    InsertWithImage(d, _) { this._items.push(d);    this.Size = this._items.length; return true; }
    InsertAt(i, data)     { this._items.splice(i, 0, data); this.Size = this._items.length; return true; }
    RemoveAll()           { this._items = []; this.Size = 0; return true; }
    RemoveAt(i)           { this._items.splice(i, 1); this.Size = this._items.length; return true; }
    ReadAt(i)             { return this._items[i]; }
    ModifyAt(i, data)     { this._items[i] = data; return true; }
    SetMarked(_i)         { return true; }
    AddMarked(_i)         { return true; }
    RemoveMarked(_i)      { return true; }
    IsMarked(_i)          { return false; }
    GetMarked(_i)         { return -1; }
    SetIndexes(_s, _t)    { return true; }
};

// ─── Timer ───────────────────────────────────────────────────────────────────

global.Timer = class TimerShim {
    constructor() {
        this.Handle               = _nextHandle();
        this.State                = 0;
        this.Interval             = 0;
        this.UseHandleInCallbacks = false;
        this._ref                 = null;
    }

    Start(callback, timeout) {
        this.Stop();
        this.State    = 1;
        this.Interval = timeout;
        const h       = this.Handle;
        const getUse  = () => this.UseHandleInCallbacks;
        this._ref = setTimeout(() => {
            this.State = 0;
            this._ref  = null;
            try {
                callback(getUse() ? h : undefined);
            } catch (e) {
                console.error('[TIMER #' + h + '] callback threw:', e);
            }
        }, timeout);
        return true;
    }

    Stop() {
        if (this._ref !== null) {
            clearTimeout(this._ref);
            this._ref = null;
        }
        this.State = 0;
        return true;
    }
};

// ─── TCP ─────────────────────────────────────────────────────────────────────

global.TCP = class TCPShim {
    /**
     * @param {(data: string, handle: number) => void} onCommRx
     * @param {string} [host]
     * @param {number|string} [port]
     */
    constructor(onCommRx, host, port) {
        this.Handle               = _nextHandle();
        this.UseHandleInCallbacks = false;
        this.OnConnectFunc        = null;
        this.OnDisconnectFunc     = null;
        this.OpenState            = 0;
        this.ConnectState         = 0;
        this.TxQueueDepth         = 0;
        this.HeartbeatConnectState = false;

        this._onCommRx = onCommRx;
        this._socket   = null;

        if (host && port) {
            // Defer by one tick so callers can set OnConnectFunc/OnDisconnectFunc
            // after construction (as the RTI driver does).
            setImmediate(() => this._connect(host, parseInt(port, 10)));
        }
    }

    _connect(host, port) {
        console.log('[TCP #' + this.Handle + '] Connecting to ' + host + ':' + port);
        const sock = new net.Socket();
        this._socket = sock;

        sock.connect(port, host, () => {
            this.ConnectState = 1;
            console.log('[TCP #' + this.Handle + '] Connected');
            if (this.OnConnectFunc) {
                this.OnConnectFunc(this.UseHandleInCallbacks ? this.Handle : undefined);
            }
        });

        sock.on('data', (buf) => {
            // Use latin1 (binary) to preserve every byte value as a char code,
            // matching the RTI TCP string model.
            const str   = buf.toString('latin1');
            const entry = { ts: Date.now(), handle: this.Handle, bytes: buf.length, str };
            _rawRxLog.push(entry);

            // Show chunk boundary so we can correlate it with parsing decisions.
            const preview = str.substring(0, 120).replace(/[\r\n]+/g, ' ↵ ');
            console.log('[TCP #' + this.Handle + ' RX] ' + buf.length + 'B │ ' + preview);

            this._onCommRx(str, this.UseHandleInCallbacks ? this.Handle : undefined);
        });

        sock.on('close', () => {
            this.ConnectState = 0;
            console.log('[TCP #' + this.Handle + '] Disconnected');
            if (this.OnDisconnectFunc) {
                this.OnDisconnectFunc(this.UseHandleInCallbacks ? this.Handle : undefined);
            }
        });

        sock.on('error', (err) => {
            console.error('[TCP #' + this.Handle + '] Socket error: ' + err.message);
        });
    }

    Write(data) {
        if (this._socket && this.ConnectState) {
            this._socket.write(Buffer.from(data, 'latin1'));
            return true;
        }
        console.warn('[TCP #' + this.Handle + '] Write called but not connected');
        return false;
    }

    Open(host, port) {
        this._connect(host, parseInt(port, 10));
        return true;
    }

    Close() {
        if (this._socket) {
            this._socket.destroy();
            this._socket = null;
        }
        this.ConnectState = 0;
        return true;
    }

    // Unused stubs required by the Comm interface
    Read(_t)            { return ''; }
    WaitForRx(_t)       { return false; }
    AddRxFraming()      { return false; }
    AddRxHTTPFraming()  { return false; }
    SetTxInterMsgDelay() { return true; }
    EnableHeartbeat()   { return true; }
    HeartbeatReceived() { return true; }
};

// ─── Persistence (unused by driver but referenced in typings) ─────────────────

global.Persistence = {
    Write: (_k, _v) => true,
    Read:  (_k)     => '',
    Delete: (_k)    => true,
    Save:   ()      => true,
};

// ─── Playback test sequence ───────────────────────────────────────────────────

// Send a randomplay tracks command directly via driver globals, bypassing the
// browse-action path (which requires PlayCmd to be populated, which library
// browse items don't have because their cmd lives in base.actions, not per-item).
function _directPlay() {
    // g_Players, buildSlimRequestJson, and g_Slim_Request are all globals exported
    // by the driver via vm.runInThisContext.
    const player = (typeof g_Players !== 'undefined') ? g_Players[0] : null;
    if (!player || !player.MacAddress) {
        console.log('[TEST] directPlay: player not ready yet');
        return;
    }
    const json = buildSlimRequestJson(
        player.Id, 0, player.Server.ClientId,
        g_Slim_Request, player.MacAddress,
        ['randomplay', 'tracks']
    );
    console.log('[TEST] directPlay → randomplay tracks on ' + player.MacAddress);
    player.Server.sendJsonCommand(json);
}

// Called once when the driver reports ConnectedP01 = true.
// Fires a timed sequence of driver function calls that exercises menu navigation,
// playback start, track skip, pause/resume, and stop.
let _testStarted = false;

function _runTestSequence() {
    if (_testStarted) return;
    _testStarted = true;

    const P = 1;   // playerId  (player "LMS-Test" is player 1)
    const R = 0;   // remoteId

    function step(label, fn, delayMs) {
        setTimeout(() => {
            console.log('\n[TEST] ─── ' + label + ' ───');
            try { fn(); } catch (e) { console.error('[TEST] Error:', e.message); }
        }, delayMs);
    }

    let t = 0;

    // Give the menu and NowPlayingTimer a moment to settle after connection.
    t += 4000; step('Navigate to Albums',    () => jumpToBrowseLocation(P, 'albums', R), t);
    t += 2000; step('Start randomplay',      () => _directPlay(), t);
    t += 8000; step('Skip to next track',    () => transport(P, 'next', R), t);
    t += 8000; step('Pause',                 () => transport(P, 'pause', R), t);
    t += 4000; step('Resume',                () => transport(P, 'play', R), t);
    t += 8000; step('Navigate to Favorites', () => jumpToBrowseLocation(P, 'favorites', R), t);
    t += 2000; step('Drill into first Fav',  () => browseSelection(P, 0, R), t);
    t += 4000; step('Stop',                  () => transport(P, 'stop', R), t);
}

// Intercept SystemVars.Write to detect when the player comes online.
const _origSysVarsWrite = global.SystemVars.Write.bind(global.SystemVars);
global.SystemVars.Write = (varname, data) => {
    const result = _origSysVarsWrite(varname, data);
    if (varname === 'ConnectedP01' && data === true) {
        console.log('\n[TEST] Player ConnectedP01 — scheduling test sequence');
        _runTestSequence();
    }
    return result;
};

// ─── Load and run the compiled driver ────────────────────────────────────────

const driverPath = path.resolve(__dirname, '../dist/index.js');
if (!fs.existsSync(driverPath)) {
    console.error('ERROR: ' + driverPath + ' not found. Run `npx tsc` first.');
    process.exit(1);
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' Lyrion driver integration test');
console.log(' Player : ' + PLAYER_NAME);
console.log(' Server : ' + SERVER_IP + ':' + SERVER_PORT);
console.log(' Duration: ' + (DURATION_MS / 1000) + 's');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const driverCode = fs.readFileSync(driverPath, 'utf8');

function loadDriver() {
    console.log('[HARNESS] Loading dist/index.js …');
    try {
        vm.runInThisContext(driverCode, { filename: 'dist/index.js' });
    } catch (e) {
        console.error('[HARNESS] Driver threw during init:', e);
        process.exit(1);
    }
    console.log('[HARNESS] Driver initialized successfully');
}

// ─── Start Squeezelite ───────────────────────────────────────────────────────

let sq = null;

// How long to wait (ms) for Squeezelite to register with LMS before loading
// the driver and requesting the player list.
const SQ_WARMUP_MS = 8000;

if (startSqueezelite) {
    if (!fs.existsSync(SQ_EXE)) {
        console.warn('[HARNESS] Squeezelite not found at ' + SQ_EXE + ' — loading driver immediately');
        loadDriver();
    } else {
        const sqLogPath = path.resolve(__dirname, 'squeezelite.log');
        const sqLogFd   = fs.openSync(sqLogPath, 'w');
        console.log('[HARNESS] Starting Squeezelite "' + PLAYER_NAME + '" → ' + SERVER_IP);
        console.log('[HARNESS] Squeezelite output → ' + sqLogPath);

        // Squeezelite uses the SlimProto protocol on port 3483, NOT the HTTP port 9000.
        // Omitting -o lets squeezelite pick the default audio device; since we don't
        // issue any play commands, no audio is actually produced.
        sq = spawn(SQ_EXE, ['-n', PLAYER_NAME, '-s', SERVER_IP + ':' + SQ_SLIMPROTO_PORT], {
            stdio: ['ignore', sqLogFd, sqLogFd]
        });
        sq.on('exit', (code) => {
            fs.closeSync(sqLogFd);
            console.log('[SQ] Exited with code ' + code);
            const log = fs.readFileSync(sqLogPath, 'utf8').trim();
            if (log) console.log('[SQ LOG]\n' + log);
        });

        console.log('[HARNESS] Waiting ' + (SQ_WARMUP_MS / 1000) + 's for Squeezelite to register with LMS …');
        setTimeout(loadDriver, SQ_WARMUP_MS);
    }
} else {
    console.log('[HARNESS] --no-squeezelite: assuming player already connected');
    loadDriver();
}

// ─── Shutdown ─────────────────────────────────────────────────────────────────

function shutdown() {
    console.log('\n[HARNESS] Shutting down …');

    if (sq) {
        try { sq.kill(); } catch (_) {}
    }

    console.log('\n[HARNESS] Raw RX summary: ' + _rawRxLog.length + ' chunks received');
    const totalBytes = _rawRxLog.reduce((s, e) => s + e.bytes, 0);
    console.log('[HARNESS] Total bytes received: ' + totalBytes);

    process.exit(0);
}

setTimeout(shutdown, DURATION_MS);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
