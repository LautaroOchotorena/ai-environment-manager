# AI Environment Manager

Configure the Python environment that AI agents should use for a workspace. The extension helps you pick the right platform (Windows, WSL/Linux, or macOS) and environment type (Conda or venv/virtualenv), then prepares terminals and verifies that the expected interpreter is active.

## Objective

Ensure AI agents execute commands in the same environment your project actually uses, especially when your workspace runs on Windows but the runtime lives in WSL/Linux or macOS. This prevents mismatched interpreters, missing dependencies, and inconsistent results.

## Features

- First-run setup flow with platform and environment selection.
- Conda environment discovery for Windows, WSL/Linux, and macOS.
- venv/virtualenv support via a workspace-relative folder (for example `.venv`).
- Status bar indicator showing platform and active environment.
- Prepared terminal launcher and a command to set it as the default terminal.
- Environment verification output in an Output Channel.

## Commands

- AI Environment Manager: Configure Environment
- AI Environment Manager: Change Platform
- AI Environment Manager: Change Environment Type
- AI Environment Manager: Change Conda Environment
- AI Environment Manager: Verify Environment
- AI Environment Manager: Open Prepared Terminal
- AI Environment Manager: Refresh Environments
- AI Environment Manager: Use Prepared Terminal for Commands

## Settings

This extension contributes the following settings:

- `aiEnvironmentManager.platform`: `windows` | `wsl` | `macos`
- `aiEnvironmentManager.pythonEnvType`: `conda` | `venv`
- `aiEnvironmentManager.condaEnv`: Conda environment name
- `aiEnvironmentManager.venvPath`: Workspace-relative venv folder (for example `.venv`)
- `aiEnvironmentManager.condaShPathWslLinux`: Path to `conda.sh` in WSL/Linux
- `aiEnvironmentManager.condaShPathMac`: Path to `conda.sh` in macOS

Example:

```json
{
  "aiEnvironmentManager.platform": "wsl",
  "aiEnvironmentManager.pythonEnvType": "conda",
  "aiEnvironmentManager.condaEnv": "speech-recognition"
}
```

## Requirements

- Conda installed on the target platform when using `conda` environments.
- A venv/virtualenv folder inside the workspace when using `venv`.
- WSL installed when using the WSL/Linux option on Windows.

## Known Issues

- Copilot and other agents may use their own terminal selection. Use **AI Environment Manager: Use Prepared Terminal for Commands** to set the default terminal profile in the current workspace.

## Release Notes

### 0.0.1

- Initial release.