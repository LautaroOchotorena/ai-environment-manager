import * as vscode from 'vscode';
import { CondaService } from './services/condaService';
import { SettingsService } from './services/settingsService';
import { TerminalService } from './services/terminalService';
import { VerificationService } from './services/verificationService';
import { StatusBarController } from './ui/statusBar';
import {
	showCondaEnvironmentQuickPick,
	showPlatformQuickPick,
	showPythonEnvTypeQuickPick,
	showStatusMenuQuickPick,
	showVenvPathInput,
} from './ui/quickPick';
import { Platform, PythonEnvType } from './types/configuration';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const settingsService = new SettingsService();
	const condaService = new CondaService();
	const terminalService = new TerminalService(settingsService);
	const verificationService = new VerificationService(settingsService);
	const statusBar = new StatusBarController(settingsService);

	context.subscriptions.push(statusBar);

	const configureEnvironment = async () => {
		if (!settingsService.hasWorkspace()) {
			vscode.window.showWarningMessage('AI Environment Manager needs an open workspace to store settings.');
			return;
		}

		const platform = await showPlatformQuickPick();
		if (!platform) {
			return;
		}

		await settingsService.updatePlatform(platform);
		const envType = await showPythonEnvTypeQuickPick(settingsService.getPythonEnvType());
		if (!envType) {
			return;
		}

		await settingsService.updatePythonEnvType(envType);
		await configureEnvironmentDetails(envType, platform);
		vscode.window.showInformationMessage(`AI Environment Manager configured for ${platform}.`);
	};

	const changePlatform = async () => {
		const platform = await showPlatformQuickPick();
		if (!platform) {
			return;
		}

		await settingsService.updatePlatform(platform);
		const envType = settingsService.getPythonEnvType() ?? 'conda';
		await configureEnvironmentDetails(envType, platform);
		vscode.window.showInformationMessage(`Platform updated to ${platform}.`);
	};

	const changeCondaEnvironment = async () => {
		const platform = settingsService.getPlatform();
		if (!platform) {
			vscode.window.showWarningMessage('Select a platform before choosing a Conda environment.');
			await changePlatform();
			return;
		}

		const envType = settingsService.getPythonEnvType() ?? 'conda';
		if (envType === 'conda') {
			const envs = await getCondaEnvironments(platform, condaService, settingsService);
			if (envs.length === 0) {
				vscode.window.showWarningMessage('No Conda environments were found.');
				return;
			}

			const selectedEnv = await showCondaEnvironmentQuickPick(envs, settingsService.getCondaEnv());
			if (!selectedEnv) {
				return;
			}

			await settingsService.updateCondaEnv(selectedEnv);
			vscode.window.showInformationMessage(`Conda environment set to ${selectedEnv}.`);
			return;
		}

		const venvPath = await showVenvPathInput(settingsService.getVenvPath());
		if (!venvPath) {
			return;
		}

		await settingsService.updateVenvPath(venvPath);
		vscode.window.showInformationMessage(`Venv path set to ${venvPath}.`);
	};

	const changePythonEnvironmentType = async () => {
		const platform = settingsService.getPlatform();
		if (!platform) {
			vscode.window.showWarningMessage('Select a platform before choosing an environment type.');
			await changePlatform();
			return;
		}

		const envType = await showPythonEnvTypeQuickPick(settingsService.getPythonEnvType());
		if (!envType) {
			return;
		}

		await settingsService.updatePythonEnvType(envType);
		await configureEnvironmentDetails(envType, platform);
		vscode.window.showInformationMessage(`Environment type set to ${envType}.`);
	};

	const verifyEnvironment = async () => {
		await verificationService.verifyEnvironment();
	};

	const openPreparedTerminal = async () => {
		await terminalService.openPreparedTerminal();
	};

	const setPreparedTerminalAsDefault = async () => {
		await terminalService.setPreparedTerminalAsDefault();
	};

	const refreshEnvironments = async () => {
		const platform = settingsService.getPlatform();
		const envType = settingsService.getPythonEnvType() ?? 'conda';
		if (!platform) {
			vscode.window.showWarningMessage('Select a platform before refreshing environments.');
			return;
		}

		if (envType === 'venv') {
			const venvPath = await showVenvPathInput(settingsService.getVenvPath());
			if (!venvPath) {
				return;
			}

			await settingsService.updateVenvPath(venvPath);
			vscode.window.showInformationMessage('Venv path refreshed.');
			return;
		}

		const envs = await getCondaEnvironments(platform, condaService, settingsService);
		if (envs.length === 0) {
			vscode.window.showWarningMessage('No Conda environments were found.');
			return;
		}

		const selectedEnv = await showCondaEnvironmentQuickPick(envs, settingsService.getCondaEnv());
		if (!selectedEnv) {
			return;
		}

		await settingsService.updateCondaEnv(selectedEnv);
		vscode.window.showInformationMessage('Conda environments refreshed.');
	};

	const showStatusMenu = async () => {
		const platform = settingsService.getPlatform();
		const envType = settingsService.getPythonEnvType();
		const condaEnv = settingsService.getCondaEnv();
		const venvPath = settingsService.getVenvPath();
		const hasEnv = envType === 'venv' ? Boolean(venvPath) : Boolean(condaEnv);
		if (!platform || !envType || !hasEnv) {
			await configureEnvironment();
			return;
		}

		const action = await showStatusMenuQuickPick();
		if (!action) {
			return;
		}

		await vscode.commands.executeCommand(action);
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('aiEnvironmentManager.configureEnvironment', showStatusMenu),
		vscode.commands.registerCommand('aiEnvironmentManager.changePlatform', changePlatform),
		vscode.commands.registerCommand('aiEnvironmentManager.changeCondaEnvironment', changeCondaEnvironment),
		vscode.commands.registerCommand('aiEnvironmentManager.changePythonEnvironmentType', changePythonEnvironmentType),
		vscode.commands.registerCommand('aiEnvironmentManager.verifyEnvironment', verifyEnvironment),
		vscode.commands.registerCommand('aiEnvironmentManager.openPreparedTerminal', openPreparedTerminal),
		vscode.commands.registerCommand('aiEnvironmentManager.refreshEnvironments', refreshEnvironments),
		vscode.commands.registerCommand('aiEnvironmentManager.setPreparedTerminalAsDefault', setPreparedTerminalAsDefault)
	);

	context.subscriptions.push(
		settingsService.onDidChangeConfiguration(() => {
			statusBar.update();
		})
	);

	statusBar.update();
	void maybeRunFirstRun(settingsService, configureEnvironment);

	async function configureEnvironmentDetails(envType: PythonEnvType, platform: Platform) {
		if (envType === 'venv') {
			const venvPath = await showVenvPathInput(settingsService.getVenvPath());
			if (!venvPath) {
				return;
			}

			await settingsService.updateVenvPath(venvPath);
			return;
		}

		const envs = await getCondaEnvironments(platform, condaService, settingsService);
		if (envs.length === 0) {
			vscode.window.showWarningMessage('No Conda environments were found.');
			return;
		}

		const selectedEnv = await showCondaEnvironmentQuickPick(envs, settingsService.getCondaEnv());
		if (!selectedEnv) {
			return;
		}

		await settingsService.updateCondaEnv(selectedEnv);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function maybeRunFirstRun(settingsService: SettingsService, configureEnvironment: () => Promise<void>) {
	if (!settingsService.hasWorkspace()) {
		return;
	}

	const platform = settingsService.getPlatform();
	const envType = settingsService.getPythonEnvType();
	const condaEnv = settingsService.getCondaEnv();
	const venvPath = settingsService.getVenvPath();
	const hasEnv = envType === 'venv' ? Boolean(venvPath) : Boolean(condaEnv);
	if (platform && envType && hasEnv) {
		return;
	}

	await configureEnvironment();
}

async function getCondaEnvironments(
	platform: Platform,
	condaService: CondaService,
	settingsService: SettingsService
): Promise<string[]> {
	try {
		if (platform === 'windows') {
			return await condaService.getWindowsCondaEnvs();
		}

		const isWindowsHost = process.platform === 'win32';
			const condaShPath = platform === 'macos'
				? settingsService.getCondaShPathMac()
				: settingsService.getCondaShPathWslLinux();

		if (platform === 'macos') {
			return await condaService.getMacCondaEnvs(condaShPath);
		}

		return await condaService.getWslLinuxCondaEnvs(condaShPath, isWindowsHost);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to list Conda environments.';
		vscode.window.showErrorMessage(message);
		return [];
	}
}
