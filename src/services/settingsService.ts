import * as vscode from 'vscode';
import { AiEnvironmentConfiguration, Platform, PythonEnvType } from '../types/configuration';

export class SettingsService {
	public hasWorkspace(): boolean {
		return Boolean(vscode.workspace.workspaceFolders?.length);
	}

	public getPlatform(): Platform | undefined {
		return this.getConfiguration().get<Platform>('platform');
	}

	public getCondaEnv(): string | undefined {
		return this.getConfiguration().get<string>('condaEnv');
	}

	public getPythonEnvType(): PythonEnvType | undefined {
		return this.getConfiguration().get<PythonEnvType>('pythonEnvType');
	}

	public getVenvPath(): string | undefined {
		return this.getConfiguration().get<string>('venvPath');
	}

	public getCondaShPathWslLinux(): string {
		return this.getConfiguration().get<string>('condaShPathWslLinux') ?? '~/miniconda3/etc/profile.d/conda.sh';
	}

	public getCondaShPathMac(): string {
		return this.getConfiguration().get<string>('condaShPathMac') ?? '~/miniconda3/etc/profile.d/conda.sh';
	}

	public async updatePlatform(platform?: Platform): Promise<void> {
		await this.getConfiguration().update('platform', platform, vscode.ConfigurationTarget.Workspace);
	}

	public async updateCondaEnv(condaEnv?: string): Promise<void> {
		await this.getConfiguration().update('condaEnv', condaEnv, vscode.ConfigurationTarget.Workspace);
	}

	public async updatePythonEnvType(pythonEnvType?: PythonEnvType): Promise<void> {
		await this.getConfiguration().update('pythonEnvType', pythonEnvType, vscode.ConfigurationTarget.Workspace);
	}

	public async updateVenvPath(venvPath?: string): Promise<void> {
		await this.getConfiguration().update('venvPath', venvPath, vscode.ConfigurationTarget.Workspace);
	}

	public onDidChangeConfiguration(callback: () => void): vscode.Disposable {
		return vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('aiEnvironmentManager')) {
				callback();
			}
		});
	}

	public getConfiguration(): vscode.WorkspaceConfiguration {
		const workspaceUri = this.getWorkspaceUri();
		return vscode.workspace.getConfiguration('aiEnvironmentManager', workspaceUri);
	}

	public getCurrentConfiguration(): AiEnvironmentConfiguration {
		return {
			platform: this.getPlatform(),
			pythonEnvType: this.getPythonEnvType(),
			condaEnv: this.getCondaEnv(),
			venvPath: this.getVenvPath(),
			condaShPathWslLinux: this.getCondaShPathWslLinux(),
			condaShPathMac: this.getCondaShPathMac(),
		};
	}

	public getWorkspaceUri(): vscode.Uri | undefined {
		return this.getWorkspaceUriInternal();
	}

	private getWorkspaceUriInternal(): vscode.Uri | undefined {
		const activeDocument = vscode.window.activeTextEditor?.document;
		if (activeDocument) {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeDocument.uri);
			return workspaceFolder?.uri;
		}

		return vscode.workspace.workspaceFolders?.[0]?.uri;
	}
}
