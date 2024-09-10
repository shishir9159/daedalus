# initiate oh-my-posh
#$env:VIRTUAL_ENV_DISABLE_PROMPT = 1
if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }
oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\shishir.omp.toml" | Invoke-Expression; clear;