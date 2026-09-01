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

    -- Highlight other references to the symbol under the cursor.
    if client:supports_method('textDocument/documentHighlight') then
      local hl = vim.api.nvim_create_augroup('config.lsp.highlight', { clear = false })
      vim.api.nvim_create_autocmd({ 'CursorHold', 'CursorHoldI' }, {
        group = hl, buffer = ev.buf, callback = vim.lsp.buf.document_highlight,
      })
      vim.api.nvim_create_autocmd({ 'CursorMoved', 'CursorMovedI' }, {
        group = hl, buffer = ev.buf, callback = vim.lsp.buf.clear_references,
      })
    end

    -- Code lens: gopls (generate/test/tidy) and rust-analyzer (run/debug/
    -- implementations) emit them; lua_ls does when Lua.codeLens is on. clangd
    -- has no codeLens support at all — it uses inlay hints instead, so this
    -- branch is simply skipped for C/C++.
    -- Refresh on cheap events only; TextChanged would fire a request per keystroke.
    if client:supports_method('textDocument/codeLens') then
      local cl = vim.api.nvim_create_augroup('config.lsp.codelens', { clear = false })
      vim.api.nvim_create_autocmd({ 'BufEnter', 'InsertLeave', 'BufWritePost' }, {
        group = cl,
        buffer = ev.buf,
        callback = function() vim.lsp.codelens.refresh({ bufnr = ev.buf }) end,
      })
      vim.lsp.codelens.refresh({ bufnr = ev.buf })
      vim.keymap.set('n', '<leader>cl', vim.lsp.codelens.run,
        { buffer = ev.buf, desc = 'Run code lens' })
    end
  end,
})

-- Tear down buffer state when a server detaches (restart, :LspStop, etc.)
vim.api.nvim_create_autocmd('LspDetach', {
  group = group,
  callback = function(ev)
    pcall(vim.lsp.buf.clear_references)
    pcall(vim.lsp.codelens.clear, ev.data.client_id, ev.buf)
    for _, g in ipairs({ 'config.lsp.highlight', 'config.lsp.codelens' }) do
      pcall(vim.api.nvim_clear_autocmds, { group = g, buffer = ev.buf })
    end
  end,
})

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
      for _, action in pairs(result and result.result or {}) do
        if action.edit then
          vim.lsp.util.apply_workspace_edit(action.edit, client.offset_encoding)
        end
      end
    end

    vim.lsp.buf.format({
      bufnr = ev.buf,
      timeout_ms = 2000,
      filter = function(client)
        return client.name ~= 'ty' -- python formats via ruff
      end,
    })
  end,
})
