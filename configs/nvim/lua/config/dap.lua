local dap = require('dap')
local dv = require('dap-view')

dv.setup()

-- Inline variable values next to their declarations while stopped.
require('nvim-dap-virtual-text').setup({
  virt_text_pos = 'eol',
  commented = true,
})

-- open/close the drawer with the session
dap.listeners.before.launch['dap-view'] = function() dv.open() end
dap.listeners.before.attach['dap-view'] = function() dv.open() end
dap.listeners.before.event_terminated['dap-view'] = function() dv.close() end
dap.listeners.before.event_exited['dap-view'] = function() dv.close() end

vim.fn.sign_define('DapBreakpoint', { text = '●', texthl = 'DiagnosticError' })
vim.fn.sign_define('DapBreakpointCondition', { text = '◐', texthl = 'DiagnosticError' })
vim.fn.sign_define('DapStopped', { text = '▶', texthl = 'DiagnosticWarn', linehl = 'Visual' })

-- Go: delve
dap.adapters.go = {
  type = 'server',
  port = '${port}',
  executable = { command = 'dlv', args = { 'dap', '-l', '127.0.0.1:${port}' } },
}
dap.configurations.go = {
  { type = 'go', name = 'Debug package', request = 'launch', mode = 'debug', program = '${fileDirname}' },
  { type = 'go', name = 'Debug test (package)', request = 'launch', mode = 'test', program = '${fileDirname}' },
  {
    type = 'go',
    name = 'Attach to process',
    request = 'attach',
    mode = 'local',
    processId = function() return require('dap.utils').pick_process() end,
  },
}

-- Rust + Zig + C/C++: lldb-dap (from the lldb system package)
dap.adapters.lldb = { type = 'executable', command = 'lldb-dap', name = 'lldb' }

local function launch_binary(default_dir)
  return {
    name = 'Launch binary',
    type = 'lldb',
    request = 'launch',
    program = function()
      return vim.fn.input('Executable: ', vim.fn.getcwd() .. default_dir, 'file')
    end,
    cwd = '${workspaceFolder}',
    stopOnEntry = false,
    args = {},
  }
end
dap.configurations.rust = { launch_binary('/target/debug/') }
dap.configurations.zig = { launch_binary('/zig-out/bin/') }
-- C/C++ share the adapter; build with -g first (cmake -DCMAKE_BUILD_TYPE=Debug)
dap.configurations.c = { launch_binary('/build/') }
dap.configurations.cpp = dap.configurations.c

-- Python: debugpy
local function python_exe()
  local venv = os.getenv('VIRTUAL_ENV')
  return venv and (venv .. '/bin/python') or 'python3'
end
dap.adapters.python = function(cb, config)
  if config.request == 'attach' then
    cb({
      type = 'server',
      host = (config.connect or {}).host or '127.0.0.1',
      port = (config.connect or {}).port or 5678,
    })
  else
    cb({ type = 'executable', command = python_exe(), args = { '-m', 'debugpy.adapter' } })
  end
end
dap.configurations.python = {
  {
    type = 'python',
    request = 'launch',
    name = 'Launch file',
    program = '${file}',
    console = 'integratedTerminal',
    pythonPath = python_exe,
    justMyCode = false,
  },
  {
    type = 'python',
    request = 'attach',
    name = 'Attach (localhost:5678)',
    connect = { host = '127.0.0.1', port = 5678 },
  },
}
