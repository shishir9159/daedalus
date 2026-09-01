return {
  cmd = { 'gopls' },
  filetypes = { 'go', 'gomod', 'gowork', 'gotmpl' },
  root_markers = { 'go.work', 'go.mod', '.git' },
  settings = {
    gopls = {
      gofumpt = true,
      staticcheck = true,
      semanticTokens = true,
      analyses = {
        unusedparams = true,
        unusedwrite = true,
        nilness = true,
      },
      -- gopls emits no lenses unless they are named here
      codelenses = {
        generate = true,
        test = true,
        tidy = true,
        upgrade_dependency = true,
        vendor = true,
        run_govulncheck = true,
      },
      hints = {
        assignVariableTypes = true,
        compositeLiteralFields = true,
        constantValues = true,
        functionTypeParameters = true,
        parameterNames = true,
        rangeVariableTypes = true,
      },
    },
  },
}
