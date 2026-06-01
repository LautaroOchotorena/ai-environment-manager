import * as vscode from 'vscode';
import { SettingsService } from '../services/settingsService';

export class StatusBarController implements vscode.Disposable {
	private readonly statusBarItem: vscode.StatusBarItem;

	constructor(private readonly settingsService: SettingsService) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.statusBarItem.command = 'aiEnvironmentManager.configureEnvironment';
		this.statusBarItem.show();
	}

	public update(): void {
		const platform = this.settingsService.getPlatform();
		const condaEnv = this.settingsService.getCondaEnv();
		const envType = this.settingsService.getPythonEnvType();
		const venvPath = this.settingsService.getVenvPath();

		const hasEnv = envType === 'venv' ? Boolean(venvPath) : Boolean(condaEnv);
		if (!platform || !envType || !hasEnv) {
			this.statusBarItem.text = '⚠ Configure Environment';
			this.statusBarItem.tooltip = 'Set the platform and Python environment.';
			return;
		}

		const icon = platform === 'wsl' ? '🐧' : platform === 'macos' ? '🍎' : '🪟';
		const label = envType === 'venv' ? `venv:${venvPath}` : `conda:${condaEnv}`;
		this.statusBarItem.text = `${icon} ${label}`;
		this.statusBarItem.tooltip = `AI Environment Manager (${platform})`;
	}

	public dispose(): void {
		this.statusBarItem.dispose();
	}
}
