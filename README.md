## Build Instructions

- Create `./tools` folder
- Place PackageDriver.exe in `./tools` folder
- Open project in VS Code
- Run Task `Install Dependencies - All`
- Run Task `Package Driver`
- Locate resultant driver file in `./dist` folder

## Recommended Development/Debugging Steps

- Install VS Code recommended extensions
- Run Task `Install Dependencies - All`
- Run Task `Package Driver - Dev`
- Locate resultant driver file in `./dist` folder
- Include driver in RTI project
- Tick `Enable Trace` in Integration Designer driver configuration

## Overview

RTI driver for [Lyrion Music Server](https://lyrion.org/) (LMS, formerly Logitech Media Server / Squeezebox Server). Controls up to 20 Lyrion/Squeezebox-compatible players connected to a single server instance.

The driver communicates with LMS using the CometD/Slim API over TCP (default port 9000). It maintains a persistent connection and subscribes to real-time player status updates.

## Requirements

- Lyrion Music Server running on the local network
- One or more Lyrion/Squeezebox-compatible players (hardware Squeezebox devices or software players such as Squeezelite)
- RTI processor with a Two-Way IP connection slot available

## Configuration

### Server Settings

| Setting | Variable | Description |
|---|---|---|
| Server Name | `Default_Server_Name` | Friendly name (documentation only) |
| TCP Address | `Default_Server_IP` | IP address of the LMS server |
| TCP Port | `Default_Server_TCP_Port` | LMS port (default: `9000`) |

### Player Settings (P01–P20)

| Setting | Variable | Description |
|---|---|---|
| Player Name | `NameP##` | Must exactly match the player name shown in LMS |
| Use Custom Parent Menu | `Use_Custom_Parent_Menu_P##` | Enable custom home menu ordering/renaming |
| Custom Parent Menu Order | `Custom_Menu_Order_P##` | Colon-separated list of internal menu item names to display |
| Custom Parent Menu Names | `Custom_Menu_Names_P##` | Colon-separated display names (must match Order list length) |
| Skip First Pandora Menu | `SkipFirstPandoraMenuP##` | Jump directly to Pandora stations list |
| Hide MySqueezebox.com | `Favorites_Hide_MySqueeze_P##` | Hide MySqueezebox.com from the Favorites menu |

**Player names must exactly match what appears in LMS.** The driver discovers players from the server and matches them by name.

### Remote Control Settings (Advanced)

Optionally assign page-navigation macros per remote so the driver can automatically redirect to the browse list or keyboard page during user interaction.

| Setting | Variable | Description |
|---|---|---|
| Remote Control Name | `NameR#` | View name as it appears in Integration Designer |
| Keyboard Page Macro | `KeyboardPageMR#` | Macro to navigate to keyboard page when search input is required |
| Browse Page Macro | `BrowsePageMR#` | Macro to navigate to browse list page |

### Debug Settings

| Setting | Variable | Description |
|---|---|---|
| Enable Trace | `DebugTrace` | Enable verbose debug output (view with RTI Diagnostic Driver) |

## Custom Parent Menu

By default the driver shows all home menu items in the order returned by LMS. To control the order or rename items, enable **Use Custom Parent Menu** for a player and populate both **Custom Parent Menu Order** and **Custom Parent Menu Names** with colon-separated lists of equal length.

The **Order** field contains the exact internal menu names as returned by LMS; the **Names** field contains the display names shown on the remote.

**To discover internal menu names:** enable `Enable Trace`, load the driver, then call the **Print Home Menu Items to Log File** function. The trace log will contain a colon-separated list of available home menu names.

Example:
```
Custom Parent Menu Order: Favorites:Pandora:Spotify:radios:Artists:Genres
Custom Parent Menu Names: Favorites:Pandora:Spotify:Radio:Artists:Genres
```

## Testing & Diagnostics

Several functions are available under the **Print Out Data to Diagnostic Driver** and **Testing** function categories in Integration Designer:

| Function | Description |
|---|---|
| Print Home Menu Items to Log File | Logs colon-separated home menu item names — use this to build custom menu strings |
| Print Now Playing URL to Log File | Logs the current stream URL |
| Get Player Status | Requests a fresh status update from the server |
| Browse Test | Directly queries a specific browse location (bypasses browse list state) |
| Subscribe | Re-subscribes to player status updates |
