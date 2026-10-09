# Copy `profile.ps1` to `$PROFILE.AllUsersAllHosts`, and `shishir.omp.toml`
# (configs/powershell) to `$env:POSH_THEMES_PATH`
# (`%LOCALAPPDATA%\Programs\oh-my-posh\themes`).
if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }
oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\shishir.omp.toml" | Invoke-Expression; clear;
