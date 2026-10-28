-- Scratchpads: one app each on its own special workspace, slid in over whatever
-- is on screen (Caelestia's idea). The key starts the app when its scratchpad
-- is empty, then shows or hides it. SUPER + S in binds.lua is the unnamed one,
-- for any window.

local mainMod = "SUPER"
local launchPrefix = "uwsm app -- " -- as in binds.lua

local pads = {
    {
        name  = "sysmon",
        key   = "CONTROL + SHIFT + Escape",
        match = { { class = "^dev\\.daedalus\\.btop$" } },
        cmd   = TERMINAL .. " --class=dev.daedalus.btop -e btop",
        description = "System monitor",
    },
    {
        name  = "music",
        key   = mainMod .. " + M",
        -- Spotify can open without a class under Wayland: its first title has to do
        match = { { class = "^[Ss]potify$" }, { initial_title = "^Spotify( Free| Premium)?$" } },
        cmd   = "spotify",
        description = "Music",
    },
    {
        name  = "chat",
        key   = mainMod .. " + D",
        match = { { class = "^(vesktop|discord)$" } },
        cmd   = "vesktop",
        description = "Chat",
    },
}

for _, pad in ipairs(pads) do
    local ws = "special:" .. pad.name

    for _, match in ipairs(pad.match) do
        hl.window_rule({ match = match, workspace = ws })
    end

    hl.bind(pad.key, function()
        local empty = true
        for _, win in ipairs(hl.get_windows() or {}) do
            if win.workspace and win.workspace.name == ws then
                empty = false
                break
            end
        end
        if empty then hl.dispatch(hl.dsp.exec_cmd(launchPrefix .. pad.cmd)) end
        hl.dispatch(hl.dsp.workspace.toggle_special(pad.name))
    end, { description = pad.description .. " scratchpad" })
end
