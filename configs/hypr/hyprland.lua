-- CachyOS Hyprland Configuration

require("config.animations")
require("config.autostart")
require("config.colors")
require("config.decorations")
-- Borders in the wallpaper's colours: Noctalia's "hyprland" template renders
-- noctalia.lua next to this file. Until it has, the Cachy colours above stay.
if pcall(require, "noctalia") then require("noctalia").apply_theme() end
require("config.variables")
require("config.environment")
require("config.inputs")
require("config.binds")
require("config.scratchpads")
require("config.misc")
require("config.monitors")
require("config.windowrules")
require("config.workspaces")
