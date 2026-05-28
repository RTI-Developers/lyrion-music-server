// Copy this file to test-env.ts and fill in your values.

// Hostname or IP address of your Lyrion Music Server.
export const LMS_HOST = 'lms.your-server.local';

// TCP port for the Lyrion web/CLI interface (default: 9000).
export const LMS_PORT = '9000';

// Squeezelite binary filename inside the tools/ folder (gitignored — download separately).
// https://lyrion.org/players-and-controllers/squeezelite/
export const SQ_EXE_NAME = 'squeezelite-x64.exe';

// The audio output device name passed to squeezelite via -o.
// Run `squeezelite -l` to list available devices on your machine.
export const SQ_AUDIO_OUT = 'Primary Sound Driver [Windows DirectSound]';

// Set to 'true' to enable all driver debug flags when troubleshooting test failures.
export const DEBUG = 'false';
