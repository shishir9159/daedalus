vim.lsp.config('*', {
  capabilities = require('blink.cmp').get_lsp_capabilities(),
})

vim.lsp.enable({ 'gopls', 'rust_analyzer', 'zls', 'ty', 'ruff', 'clangd', 'lua_ls' })

vim.diagnostic.config({
  severity_sort = true,
  virtual_text = { source = 'if_many', spacing = 2 },
  float = { source = true, border = 'rounded' },
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = '󰅚',
      [vim.diagnostic.severity.WARN] = '󰀪',
      [vim.diagnostic.severity.INFO] = '󰋽',
      [vim.diagnostic.severity.HINT] = '󰌶',
    },
  },
})

local group = vim.api.nvim_create_augroup('config.lsp', {})
local hl = vim.api.nvim_create_augroup('config.lsp.highlight', {})

vim.api.nvim_create_autocmd('LspAttach', {
  group = group,
  callback = function(ev)
    local client = assert(vim.lsp.get_client_by_id(ev.data.client_id))

    -- ty owns hover; ruff only lints/formats
    if client.name == 'ruff' then
      client.server_capabilities.hoverProvider = false
    end

    if client:supports_method('textDocument/inlayHint') then
      vim.keymap.set('n', '<leader>th', function()
        local enabled = vim.lsp.inlay_hint.is_enabled({ bufnr = ev.buf })
        vim.lsp.inlay_hint.enable(not enabled, { bufnr = ev.buf })
      end, { buffer = ev.buf, desc = 'Toggle inlay hints' })
    end

    -- Highlight other references to the symbol under the cursor. One set of
    -- autocmds per buffer, however many attached servers support it (the
    -- requests already go to all of them).
    if client:supports_method('textDocument/documentHighlight') then
      vim.api.nvim_clear_autocmds({ group = hl, buffer = ev.buf })
      vim.api.nvim_create_autocmd({ 'CursorHold', 'CursorHoldI' }, {
        group = hl, buffer = ev.buf, callback = vim.lsp.buf.document_highlight,
      })
      vim.api.nvim_create_autocmd({ 'CursorMoved', 'CursorMovedI' }, {
        group = hl, buffer = ev.buf, callback = vim.lsp.buf.clear_references,
      })
    end
  end,
})

-- Stop highlighting when the last server that could do it detaches (restart,
-- :lsp stop, ...). The detaching client is still listed while this runs.
vim.api.nvim_create_autocmd('LspDetach', {
  group = group,
  callback = function(ev)
    for _, c in ipairs(vim.lsp.get_clients({ bufnr = ev.buf, method = 'textDocument/documentHighlight' })) do
      if c.id ~= ev.data.client_id then
        return
      end
    end
    vim.api.nvim_clear_autocmds({ group = hl, buffer = ev.buf })
    vim.lsp.util.buf_clear_references(ev.buf)
  end,
})

-- Code lens, builtin since 0.12: refreshed as you edit, drawn as virtual lines
-- for the visible rows only; `grx` runs the one under the cursor. gopls
-- (generate/test/tidy) and rust-analyzer (run/debug/implementations) emit
-- them, lua_ls with Lua.codeLens on; clangd has none (it has inlay hints).
vim.lsp.codelens.enable(true)

vim.api.nvim_create_autocmd('BufWritePre', {
  group = group,
  pattern = {
    '*.go', '*.rs', '*.zig', '*.py',
    '*.c', '*.h', '*.cpp', '*.cc', '*.cxx', '*.hpp', '*.hh', '*.hxx', -- clang-format
    '*.lua',
  },
  callback = function(ev)
    -- gopls: organize imports before formatting
    for _, client in ipairs(vim.lsp.get_clients({ bufnr = ev.buf, name = 'gopls' })) do
      local params = vim.lsp.util.make_range_params(0, client.offset_encoding)
      params.context = { only = { 'source.organizeImports' }, diagnostics = {} }
      local result = client:request_sync('textDocument/codeAction', params, 2000, ev.buf)
      local actions = result and result.result
      -- 0.12 hands JSON null over as vim.NIL, which pairs() rejects
      for _, action in ipairs(type(actions) == 'table' and actions or {}) do
        if action.edit then
          vim.lsp.util.apply_workspace_edit(action.edit, client.offset_encoding)
        end
      end
    end

    local function formatter(client)
      return client.name ~= 'ty' -- python formats via ruff
    end
    -- Without this, saving with the server not installed (or still starting)
    -- warns "Format request failed" on every write.
    local clients = vim.lsp.get_clients({ bufnr = ev.buf, method = 'textDocument/formatting' })
    if #vim.tbl_filter(formatter, clients) > 0 then
      vim.lsp.buf.format({ bufnr = ev.buf, timeout_ms = 2000, filter = formatter })
    end
  end,
})
