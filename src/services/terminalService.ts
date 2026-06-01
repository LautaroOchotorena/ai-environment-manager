import * as vscode from 'vscode';
import { SettingsService } from './settingsService';
import { Platform } from '../types/configuration';

export class TerminalService {
	constructor(private readonly settingsService: SettingsService) {}

	public async openPreparedTerminal(): Promise<void> {
		const platform = this.settingsService.getPlatform();
		const condaEnv = this.settingsService.getCondaEnv();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const venvPath = this.settingsService.getVenvPath();

		if (!platform) {
			vscode.window.showWarningMessage('Configure the platform and environment first.');
			return;
		}

		if (envType === 'venv' && !venvPath) {
			vscode.window.showWarningMessage('Configure the venv/virtualenv path first.');
			return;
		}

		if (envType === 'conda' && !condaEnv) {
			vscode.window.showWarningMessage('Configure the Conda environment first.');
			return;
		}

		if (platform === 'wsl') {
			const useWsl = process.platform === 'win32';
			const terminal = vscode.window.createTerminal({
				name: useWsl ? 'AI Env (WSL)' : 'AI Env (Linux)',
				shellPath: useWsl ? 'wsl.exe' : undefined,
			});
			if (envType === 'conda') {
				terminal.sendText(`source ${this.settingsService.getCondaShPathWslLinux()}`);
				terminal.sendText(`conda activate ${condaEnv}`);
			} else {
				terminal.sendText(this.getUnixVenvActivateCommand(venvPath));
			}
			terminal.show();
			return;
		}

		if (platform === 'macos') {
			const terminal = vscode.window.createTerminal({
				name: 'AI Env (macOS)',
			});
			if (envType === 'conda') {
				terminal.sendText(`source ${this.settingsService.getCondaShPathMac()}`);
				terminal.sendText(`conda activate ${condaEnv}`);
			} else {
				terminal.sendText(this.getUnixVenvActivateCommand(venvPath));
			}
			terminal.show();
			return;
		}

		const terminal = vscode.window.createTerminal({
			name: 'AI Env (Windows)',
		});
		if (envType === 'conda') {
			terminal.sendText(`conda activate ${condaEnv}`);
		} else {
			terminal.sendText(this.getWindowsVenvActivateCommand(venvPath));
		}
		terminal.show();
	}

	public async setPreparedTerminalAsDefault(): Promise<void> {
		const platform = this.settingsService.getPlatform();
		const condaEnv = this.settingsService.getCondaEnv();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const venvPath = this.settingsService.getVenvPath();
		const workspaceUri = this.settingsService.getWorkspaceUri();

		if (!workspaceUri) {
			vscode.window.showWarningMessage('Open a workspace folder before changing the default terminal.');
			return;
		}

		if (!platform) {
			vscode.window.showWarningMessage('Configure the platform and environment first.');
			return;
		}

		if (envType === 'venv' && !venvPath) {
			vscode.window.showWarningMessage('Configure the venv/virtualenv path first.');
			return;
		}

		if (envType === 'conda' && !condaEnv) {
			vscode.window.showWarningMessage('Configure the Conda environment first.');
			return;
		}

		const configuration = vscode.workspace.getConfiguration(undefined, workspaceUri);
		const os = process.platform;
		if (os === 'win32') {
			const profileName = platform === 'wsl' ? 'AI Env (WSL)' : 'AI Env (Windows)';
			const profile = platform === 'wsl'
				? {
					path: 'wsl.exe',
					args: [
						'-e',
						'bash',
						'-lc',
						envType === 'conda'
							? `source ${this.settingsService.getCondaShPathWslLinux()} && conda activate ${condaEnv} && exec bash --noprofile --norc`
							: `${this.getUnixVenvActivateCommand(venvPath)} && exec bash --noprofile --norc`,
					],
				}
				: {
					path: 'powershell.exe',
					args: [
						'-NoExit',
						'-Command',
						envType === 'conda'
							? `conda activate ${condaEnv}`
							: this.getWindowsVenvActivateCommand(venvPath),
					],
				};

			await this.updateTerminalProfile(configuration, 'windows', profileName, profile);
			vscode.window.showInformationMessage(`Default terminal set to ${profileName} for this workspace.`);
			return;
		}

		const profileName = platform === 'macos' ? 'AI Env (macOS)' : 'AI Env (Linux)';
		const profile = {
			path: 'bash',
			args: [
				'-lc',
				envType === 'conda'
					? `source ${this.getUnixCondaShPath(platform)} && conda activate ${condaEnv}; exec bash --noprofile --norc`
					: `${this.getUnixVenvActivateCommand(venvPath)} && exec bash --noprofile --norc`,
			],
		};

		const profileOs = os === 'darwin' ? 'osx' : 'linux';
		await this.updateTerminalProfile(configuration, profileOs, profileName, profile);
		vscode.window.showInformationMessage(`Default terminal set to ${profileName} for this workspace.`);
	}

	private async updateTerminalProfile(
		configuration: vscode.WorkspaceConfiguration,
		profileOs: 'windows' | 'linux' | 'osx',
		profileName: string,
		profile: Record<string, unknown>
	): Promise<void> {
		const profilesKey = `terminal.integrated.profiles.${profileOs}`;
		const defaultKey = `terminal.integrated.defaultProfile.${profileOs}`;
		const existingProfiles = configuration.get<Record<string, unknown>>(profilesKey) ?? {};
		const nextProfiles = {
			...existingProfiles,
			[profileName]: profile,
		};

		await configuration.update(profilesKey, nextProfiles, vscode.ConfigurationTarget.Workspace);
		await configuration.update(defaultKey, profileName, vscode.ConfigurationTarget.Workspace);
	}

	private getUnixVenvActivateCommand(venvPath?: string): string {
		return `source ${venvPath ?? '.venv'}/bin/activate`;
	}

	private getWindowsVenvActivateCommand(venvPath?: string): string {
		const resolvedPath = venvPath ?? '.venv';
		return `& "${resolvedPath}\\Scripts\\Activate.ps1"`;
	}

	private getUnixCondaShPath(platform: Platform): string {
		return platform === 'macos'
			? this.settingsService.getCondaShPathMac()
			: this.settingsService.getCondaShPathWslLinux();
	}
}
