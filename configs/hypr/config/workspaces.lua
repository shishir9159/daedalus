-- Workspace rules wiki https://wiki.hypr.land/Configuring/Basics/Workspace-Rules/
-- Add your workspace rules here. Do not have duplicate workspaces.
hl.workspace_rule({ workspace = "name:gaming", monitor = PRIMARY_MONITOR, default = true })
for i = 1, PERSISTENT_WORKSPACES do
    hl.workspace_rule({ workspace = tostring(i), monitor = MONITOR1, default = i == 1, persistent = true })
end

-- More room around a window that has its workspace to itself (not scratchpads)
hl.workspace_rule({ workspace = "w[tv1]s[false]", gaps_out = 20 })
hl.workspace_rule({ workspace = "f[1]s[false]",   gaps_out = 20 })

-- For other layouts such as scrolling, see example below
-- hl.workspace_rule({ workspace = "1", monitor = MONITOR1, default = true, persistent = true, layout = "scrolling" })
