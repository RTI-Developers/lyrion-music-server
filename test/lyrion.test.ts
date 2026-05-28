import { describe, it, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { createHarness } from 'rti-driver-test-harness';
import { DEBUG, LMS_HOST, LMS_PORT, SQ_AUDIO_OUT, SQ_EXE_NAME } from './test-env';

// ─── Shared constants ─────────────────────────────────────────────────────────

const PLAYER_ID     = 1;
const REMOTE_A_NAME = 'test-remote-a';
const REMOTE_B_NAME = 'test-remote-b';

const SQ_EXE = path.resolve(__dirname, '../tools', SQ_EXE_NAME);

// ─── Harness ──────────────────────────────────────────────────────────────────

const harness = createHarness({
    driver: path.resolve(__dirname, '../dist/index.js'),

    system: {
        Version:   '25.0',
        IPAddress: '127.0.0.1',
    },

    remotes: [
        { id: 1, name: REMOTE_A_NAME },
        { id: 2, name: REMOTE_B_NAME },
    ],

    config: {
        'TotalRemotes':                 '2',
        'NameR1':                       REMOTE_A_NAME,
        'NameR2':                       REMOTE_B_NAME,
        'Total_Players':                '1',
        'NameP01':                      'LMS-Test',
        'Defaul_Server_IP':             LMS_HOST,
        'Default_Server_TCP_Port':      LMS_PORT,
        'DebugTrace':                   DEBUG,
        'DebugPrintPosts':              DEBUG,
        'DebugPrintIncoming':           DEBUG,
        'DebugRAWIncoming':             DEBUG,
        'DebugMenuIncoming':            DEBUG,
        'Favorites_Hide_MySqueeze_P01': 'false',
        'SkipFirstPandoraMenuP01':      'false',
        'Use_Custom_Parent_Menu_P01':   'false',
        'Custom_Menu_Order_P01':        '',
        'Custom_Menu_Names_P01':        '',
    },

    pre: [
        // Kill any leftover squeezelite from a previous run so LMS doesn't kick
        // the new instance off its SlimProto channel.
        {
            name:  'kill-squeezelite',
            shell: 'taskkill /F /IM squeezelite-x64.exe 2>nul & exit 0',
        },
        {
            name:     'squeezelite',
            spawn:    SQ_EXE,
            // -m: fixed MAC gives LMS a stable player identity across runs.
            args:     ['-n', 'LMS-Test', '-m', '00:00:00:00:00:0F',
                       '-s', `${LMS_HOST}:3483`,
                       '-o', SQ_AUDIO_OUT,
                       '-d', 'all=info'],
            logFile:  path.resolve(__dirname, 'squeezelite.log'),
            warmupMs: 8_000,
        },
    ],

    post: [
        {
            name:  'kill-squeezelite',
            shell: 'taskkill /F /IM squeezelite-x64.exe 2>nul & exit 0',
        },
    ],
});

const remoteA = harness.remote(1);
const remoteB = harness.remote(2);

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Lyrion Music Server', () => {
    beforeAll(harness.setup);
    afterAll(harness.teardown);

    // ── Connection ────────────────────────────────────────────────────────────

    it('connects and loads the home menu for both remotes', async () => {
        await harness.expectSysvar('ConnectedP01', true, { timeout: 30_000 });
        await Promise.all([
            remoteA.expectViewSysvar('BrowseListAtParentP01', true, { timeout: 15_000 }),
            remoteB.expectViewSysvar('BrowseListAtParentP01', true, { timeout: 15_000 }),
        ]);
    });
    
    // ── Player power ──────────────────────────────────────────────────────────

    it('power: off then back on', async () => {
        // Power the player off, stopping any current playback
        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('playerPower', PLAYER_ID, 0),
            harness.expectEvent('POFFP01', { timeout: 10_000 }),
            harness.expectSysvar('PoweredOnP01',  false, { timeout: 10_000 }),
            harness.expectSysvar('PoweredOffP01', true,  { timeout: 10_000 }),
        );

        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('playerPower', PLAYER_ID, 1),
            harness.expectEvent('PONP01', { timeout: 10_000 }),
            harness.expectSysvar('PoweredOnP01',  true,  { timeout: 10_000 }),
            harness.expectSysvar('PoweredOffP01', false, { timeout: 10_000 }),
        );
    });

    // ── Playback ──────────────────────────────────────────────────────────────

    it('plays a direct URL and populates now-playing metadata', async () => {
        // Verify the player starts, the driver writes all three metadata fields, and
        // fires SongChangeP01.  SongChangeP01 is not asserted here because playDirectUrl
        // may re-queue a track already loaded — the event only fires when the title changes.
        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('playDirectUrl', PLAYER_ID, 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'),
            harness.expectSysvar('PlayingP01', true, { timeout: 15_000 }),
            harness.expectSysvar('TitleP01',  (v: unknown) => typeof v === 'string' && v !== '', { timeout: 15_000 }),
            harness.expectSysvar('ArtistP01', (v: unknown) => typeof v === 'string' && v !== '', { timeout: 15_000 }),
            harness.expectSysvar('AlbumP01',  (v: unknown) => typeof v === 'string' && v !== '', { timeout: 15_000 })
        );
    });

    it('transport: waits for playback then skips to next track', async () => {
        // A brief stopped/paused window during the track transition is normal.
        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('transport', PLAYER_ID, 'next'),
            harness.expectEvent('SongChangeP01', { timeout: 15_000 }),
            harness.expectSysvar('PlayingP01', true, { timeout: 15_000 }),
        );
        await harness.expectSysvar('TitleP01', (v: unknown) => typeof v === 'string' && v !== '', { timeout: 5_000 });
    });

    it('transport: pause then resume', async () => {
        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('transport', PLAYER_ID, 'pause'),
            harness.expectEvent('PausedP01', { timeout: 10_000 }),
            harness.expectSysvar('PlayingP01', false, { timeout: 10_000 }),
            harness.expectSysvar('PausedP01',  true,  { timeout: 10_000 }),
        );

        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('transport', PLAYER_ID, 'play'),
            harness.expectEvent('PlayingP01', { timeout: 10_000 }),
            harness.expectSysvar('PlayingP01', true,  { timeout: 10_000 }),
            harness.expectSysvar('PausedP01',  false, { timeout: 10_000 }),
        );
    });

    it('transport: stop', async () => {
        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('transport', PLAYER_ID, 'stop'),
            harness.expectEvent('StoppedP01', { timeout: 10_000 }),
            harness.expectSysvar('StoppedP01', true,  { timeout: 10_000 }),
            harness.expectSysvar('PlayingP01', false, { timeout: 10_000 }),
            harness.expectSysvar('PausedP01',  false, { timeout: 10_000 }),
        );
    });

    // ── Volume ────────────────────────────────────────────────────────────────

    it('volume: responds to set commands', async () => {
        // Set to a known low value, then a high value — each change must be confirmed
        // by a status update from LMS so we know the command was processed end-to-end.
        await harness.delay(5_000);
        remoteA.call('playerVolume', PLAYER_ID, 'set', 30);
        await harness.expectSysvar('VolumeLevelP01', 30, { timeout: 8_000 });

        await harness.delay(5_000);
        remoteA.call('playerVolume', PLAYER_ID, 'set', 70);
        await harness.expectSysvar('VolumeLevelP01', 70, { timeout: 8_000 });
    });

    // ── Browse navigation ─────────────────────────────────────────────────────

    it('each remote maintains independent browse state', async () => {
        // Wait for home menu to be (re)loaded on both remotes.
        await harness.delay(5_000);
        await Promise.all([
            remoteA.expectViewSysvar('BrowseListAtParentP01', true, { timeout: 15_000 }),
            remoteB.expectViewSysvar('BrowseListAtParentP01', true, { timeout: 15_000 }),
        ]);
        await harness.delay(1_000);

        // setBrowseMode(0) = Select — must be called before browseSelection on
        // each remote, matching what the RTI panel does on hardware.
        await harness.delay(5_000);
        await harness.act(
            () => {
                remoteA.call('setBrowseMode', PLAYER_ID, 0);
                remoteB.call('setBrowseMode', PLAYER_ID, 0);
                remoteA.call('browseSelection', PLAYER_ID, 0);  // home item 0
                remoteB.call('browseSelection', PLAYER_ID, 1);  // home item 1
            },
            remoteA.waitForViewSysvar('BrowseListTitleP01', (v: unknown) => typeof v === 'string' && v !== '' && v.trim() !== 'Home', { timeout: 8_000 }),
            remoteB.waitForViewSysvar('BrowseListTitleP01', (v: unknown) => typeof v === 'string' && v !== '' && v.trim() !== 'Home', { timeout: 8_000 }),
        );
    });

    it('browseBack returns to the parent list', async () => {
        // remoteA is in a submenu from the previous test.
        await harness.delay(5_000);
        await harness.act(
            () => remoteA.call('browseBack', PLAYER_ID),
            remoteA.waitForViewSysvar(
                'BrowseListTitleP01',
                (v: unknown) => typeof v === 'string' && v.trim().toLowerCase() === 'home',
                { timeout: 8_000 },
            ),
        );
    });
});
