import * as vscode from 'vscode';
import { AiEnvironmentConfiguration, Platform, PythonEnvType } from '../types/configuration';
import { SettingsService } from './settingsService';

export const AGENTS_MD_START_MARKER = '<!-- ai-environment-manager:start -->';
export const AGENTS_MD_END_MARKER = '<!-- ai-environment-manager:end -->';
export const CONFIG_TOML_START_MARKER = '# ai-environment-manager:start';
export const CONFIG_TOML_END_MARKER = '# ai-environment-manager:end';

const CODEX_EXTENSION_ID = 'openai.chatgpt';
const CODEX_WSL_SETTING = 'chatgpt.runCodexInWindowsSubsystemForLinux';

export interface ExtensionLike {
	id: string;
	packageJSON: {
		contributes?: {
			commands?: Array<{ command?: string }>;
			configuration?: {
				properties?: Record<string, unknown>;
			};
		};
	};
}

export function isConfigurationComplete(config: AiEnvironmentConfiguration): boolean {
	if (!config.platform || !config.pythonEnvType) {
		return false;
	}

	if (config.pythonEnvType === 'venv') {
		return Boolean(config.venvPath);
	}

	return Boolean(config.condaEnv);
}

export function hasCodexContributions(extension: ExtensionLike): boolean {
	const contributes = extension.packageJSON.contributes;
	if (!contributes) {
		return false;
	}

	const hasChatGptCommand = contributes.commands?.some(
		(command) => typeof command.command === 'string' && command.command.startsWith('chatgpt.')
	);
	if (hasChatGptCommand) {
		return true;
	}

	const properties = contributes.configuration?.properties;
	if (!properties) {
		return false;
	}

	return Object.keys(properties).some((key) => key.startsWith('chatgpt.'));
}

export function detectCodexExtension(extensions: readonly ExtensionLike[]): boolean {
	if (extensions.some((extension) => extension.id === CODEX_EXTENSION_ID)) {
		return true;
	}

	return extensions.some(hasCodexContributions);
}

export function updateMarkedBlock(
	existingContent: string,
	startMarker: string,
	endMarker: string,
	newBlock: string
): string {
	const startIndex = existingContent.indexOf(startMarker);
	const endIndex = existingContent.indexOf(endMarker);

	if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
		const before = existingContent.slice(0, startIndex);
		const after = existingContent.slice(endIndex + endMarker.length);
		return `${before}${newBlock}${after}`.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
	}

	if (existingContent.trim().length === 0) {
		return `${newBlock}\n`;
	}

	return `${existingContent.trimEnd()}\n\n${newBlock}\n`;
}

export function buildAgentsMdManagedBlock(config: AiEnvironmentConfiguration): string {
	const instructions = buildAgentInstructions(config);
	const activeEnvironment = config.pythonEnvType === 'venv' ? config.venvPath : config.condaEnv;

	return [
		AGENTS_MD_START_MARKER,
		'## Python Environment (AI Environment Manager)',
		'',
		'This section is managed by AI Environment Manager. Manual edits inside these markers will be overwritten.',
		'',
		`- **Platform:** ${config.platform}`,
		`- **Environment type:** ${config.pythonEnvType}`,
		`- **Active environment:** ${activeEnvironment}`,
		'',
		instructions,
		AGENTS_MD_END_MARKER,
	].join('\n');
}

export function buildConfigTomlManagedBlock(config: AiEnvironmentConfiguration): string {
	const lines = [
		CONFIG_TOML_START_MARKER,
		'# Managed by AI Environment Manager — do not edit this block.',
		`# platform = "${config.platform}"`,
		`# python_env_type = "${config.pythonEnvType}"`,
	];

	if (config.pythonEnvType === 'conda' && config.condaEnv) {
		lines.push(`# conda_env = "${config.condaEnv}"`);
	}

	if (config.pythonEnvType === 'venv' && config.venvPath) {
		lines.push(`# venv_path = "${config.venvPath}"`);
	}

	lines.push(CONFIG_TOML_END_MARKER);
	return lines.join('\n');
}

export function buildAgentInstructions(config: AiEnvironmentConfiguration): string {
	const platform = config.platform;
	const envType = config.pythonEnvType;
	const condaEnv = config.condaEnv;
	const venvPath = config.venvPath;
	const isWindowsHost = process.platform === 'win32';

	if (!platform || !envType) {
		return '';
	}

	if (isWindowsHost && platform === 'wsl') {
		return buildWslInstructions(envType, config.condaShPathWslLinux ?? '~/miniconda3/etc/profile.d/conda.sh', condaEnv, venvPath);
	}

	if (platform === 'windows') {
		return buildWindowsInstructions(envType, condaEnv, venvPath);
	}

	return buildUnixInstructions(platform, envType, config.condaShPathMac, config.condaShPathWslLinux, condaEnv, venvPath);
}

function buildWslInstructions(
	envType: PythonEnvType,
	condaShPath: string,
	condaEnv: string | undefined,
	venvPath: string | undefined
): string {
	let activation: string;
	if (envType === 'conda' && condaEnv) {
		activation = `source ${condaShPath} && conda activate ${condaEnv}`;
	} else if (envType === 'venv' && venvPath) {
		activation = `source ${venvPath}/bin/activate`;
	} else {
		return '';
	}

	return [
		'This project uses WSL/Linux. ALL terminal commands MUST be executed inside WSL.',
		'',
		'NEVER run commands directly in PowerShell or cmd. Always use this pattern:',
		'',
		'```',
		`wsl.exe bash -lc "${activation} && <YOUR_COMMAND>"`,
		'```',
		'',
		'For example, to run `python --version`:',
		'',
		'```',
		`wsl.exe bash -lc "${activation} && python --version"`,
		'```',
		'',
		'NEVER skip the activation step. Every command must include it.',
	].join('\n');
}

function buildWindowsInstructions(
	envType: PythonEnvType,
	condaEnv: string | undefined,
	venvPath: string | undefined
): string {
	if (envType === 'conda' && condaEnv) {
		return [
			'This project uses Conda on Windows.',
			'',
			'Run EVERY command inside the environment using `conda run` (do not rely on terminal state):',
			'',
			'```',
			`conda run -n ${condaEnv} <YOUR_COMMAND>`,
			'```',
			'',
			'For example, to run `python --version`:',
			'',
			'```',
			`conda run -n ${condaEnv} python --version`,
			'```',
			'',
			'NEVER omit `conda run -n ...` when running commands.',
		].join('\n');
	}

	if (envType === 'venv' && venvPath) {
		const activation = `& "${venvPath}\\Scripts\\Activate.ps1"`;
		return [
			'Before running ANY command in the terminal, you MUST first activate the Python environment.',
			'',
			'Run this activation command FIRST, as a separate command or prepended with `;`:',
			'',
			'```',
			activation,
			'```',
			'',
			'NEVER skip this step. If you open a new terminal or run a new command, always activate first.',
		].join('\n');
	}

	return '';
}

function buildUnixInstructions(
	platform: Platform,
	envType: PythonEnvType,
	condaShPathMac: string | undefined,
	condaShPathWslLinux: string | undefined,
	condaEnv: string | undefined,
	venvPath: string | undefined
): string {
	let activation: string;
	if (envType === 'conda' && condaEnv) {
		const condaShPath = platform === 'macos'
			? (condaShPathMac ?? '~/miniconda3/etc/profile.d/conda.sh')
			: (condaShPathWslLinux ?? '~/miniconda3/etc/profile.d/conda.sh');
		activation = `source ${condaShPath} && conda activate ${condaEnv}`;
	} else if (envType === 'venv' && venvPath) {
		activation = `source ${venvPath}/bin/activate`;
	} else {
		return '';
	}

	return [
		'Before running ANY command in the terminal, you MUST first activate the Python environment.',
		'',
		'Run this activation command FIRST, as a separate command or prepended with `&&`:',
		'',
		'```',
		activation,
		'```',
		'',
		'NEVER skip this step. If you open a new terminal or run a new command, always activate first.',
	].join('\n');
}

export class CodexService {
	constructor(private readonly settingsService: SettingsService) {}

	public isCodexInstalled(): boolean {
		const direct = vscode.extensions.getExtension(CODEX_EXTENSION_ID);
		if (direct) {
			return true;
		}

		return detectCodexExtension(vscode.extensions.all);
	}

	public async sync(): Promise<boolean> {
		if (!this.canSync()) {
			return false;
		}

		const config = this.settingsService.getCurrentConfiguration();
		const workspaceUri = this.settingsService.getWorkspaceUri();
		if (!workspaceUri) {
			return false;
		}

		try {
			await this.updateAgentsMd(workspaceUri, config);
			await this.updateConfigToml(workspaceUri, config);
			await this.updateCodexWslSetting(workspaceUri, config.platform!);
			return true;
		} catch {
			// Non-critical: Codex artifacts may not be writable
			return false;
		}
	}

	public canSync(): boolean {
		if (!this.settingsService.getGenerateCodexArtifacts()) {
			return false;
		}

		if (!this.settingsService.hasWorkspace()) {
			return false;
		}

		if (!this.isCodexInstalled()) {
			return false;
		}

		return isConfigurationComplete(this.settingsService.getCurrentConfiguration());
	}

	private async updateAgentsMd(workspaceUri: vscode.Uri, config: AiEnvironmentConfiguration): Promise<void> {
		const agentsMdUri = vscode.Uri.joinPath(workspaceUri, 'AGENTS.md');
		const managedBlock = buildAgentsMdManagedBlock(config);
		const existingContent = await this.readTextFile(agentsMdUri);
		const nextContent = updateMarkedBlock(
			existingContent,
			AGENTS_MD_START_MARKER,
			AGENTS_MD_END_MARKER,
			managedBlock
		);
		await vscode.workspace.fs.writeFile(agentsMdUri, new TextEncoder().encode(nextContent));
	}

	private async updateConfigToml(workspaceUri: vscode.Uri, config: AiEnvironmentConfiguration): Promise<void> {
		const codexDir = vscode.Uri.joinPath(workspaceUri, '.codex');
		const configTomlUri = vscode.Uri.joinPath(codexDir, 'config.toml');
		await vscode.workspace.fs.createDirectory(codexDir);

		const managedBlock = buildConfigTomlManagedBlock(config);
		const existingContent = await this.readTextFile(configTomlUri);
		const nextContent = updateMarkedBlock(
			existingContent,
			CONFIG_TOML_START_MARKER,
			CONFIG_TOML_END_MARKER,
			managedBlock
		);
		await vscode.workspace.fs.writeFile(configTomlUri, new TextEncoder().encode(nextContent));
	}

	private async updateCodexWslSetting(workspaceUri: vscode.Uri, platform: Platform): Promise<void> {
		if (process.platform !== 'win32') {
			return;
		}

		const configuration = vscode.workspace.getConfiguration(undefined, workspaceUri);
		const value = platform === 'wsl';
		await configuration.update(CODEX_WSL_SETTING, value, vscode.ConfigurationTarget.Workspace);
	}

	private async readTextFile(uri: vscode.Uri): Promise<string> {
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			return new TextDecoder().decode(bytes);
		} catch {
			return '';
		}
	}
}
