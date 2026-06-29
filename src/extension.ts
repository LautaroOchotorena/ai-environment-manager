import * as vscode from 'vscode';
import { CodexService } from './services/codexService';
import { CondaService } from './services/condaService';
import { ExportService } from './services/exportService';
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
	const codexService = new CodexService(settingsService);
	const terminalService = new TerminalService(settingsService, codexService);
	const verificationService = new VerificationService(settingsService);
	const exportService = new ExportService(settingsService);
	const statusBar = new StatusBarController(settingsService);

	context.subscriptions.push(statusBar);

	const configureEnvironment = async (): Promise<boolean> => {
		if (!settingsService.hasWorkspace()) {
			vscode.window.showWarningMessage(vscode.l10n.t('AI Environment Manager needs an open workspace to store settings.'));
			return false;
		}

		const platform = await showPlatformQuickPick();
		if (!platform) {
			return false;
		}

		await settingsService.updatePlatform(platform);
		const envType = await showPythonEnvTypeQuickPick(settingsService.getPythonEnvType());
		if (!envType) {
			return false;
		}

		await settingsService.updatePythonEnvType(envType);
		const configured = await configureEnvironmentDetails(envType, platform);
		if (!configured) {
			return false;
		}

		vscode.window.showInformationMessage(vscode.l10n.t('AI Environment Manager configured for {0}.', platform));
		return true;
	};

	const changePlatform = async () => {
		const platform = await showPlatformQuickPick();
		if (!platform) {
			return;
		}

		await settingsService.updatePlatform(platform);
		const envType = settingsService.getPythonEnvType() ?? 'conda';
		await configureEnvironmentDetails(envType, platform);
		vscode.window.showInformationMessage(vscode.l10n.t('Platform updated to {0}.', platform));
	};

	const changeCondaEnvironment = async () => {
		const platform = settingsService.getPlatform();
		if (!platform) {
			vscode.window.showWarningMessage(vscode.l10n.t('Select a platform before choosing a Conda environment.'));
			await changePlatform();
			return;
		}

		const envType = settingsService.getPythonEnvType() ?? 'conda';
		if (envType === 'conda') {
			const envs = await getCondaEnvironments(platform, condaService, settingsService);
			if (envs.length === 0) {
				vscode.window.showWarningMessage(vscode.l10n.t('No Conda environments were found.'));
				return;
			}

			const selectedEnv = await showCondaEnvironmentQuickPick(envs, settingsService.getCondaEnv());
			if (!selectedEnv) {
				return;
			}

			await settingsService.updateCondaEnv(selectedEnv);
			vscode.window.showInformationMessage(vscode.l10n.t('Conda environment set to {0}.', selectedEnv));
			return;
		}

		const venvPath = await showVenvPathInput(settingsService.getVenvPath());
		if (!venvPath) {
			return;
		}

		await settingsService.updateVenvPath(venvPath);
		vscode.window.showInformationMessage(vscode.l10n.t('Venv path set to {0}.', venvPath));
	};

	const changePythonEnvironmentType = async () => {
		const platform = settingsService.getPlatform();
		if (!platform) {
			vscode.window.showWarningMessage(vscode.l10n.t('Select a platform before choosing an environment type.'));
			await changePlatform();
			return;
		}

		const envType = await showPythonEnvTypeQuickPick(settingsService.getPythonEnvType());
		if (!envType) {
			return;
		}

		await settingsService.updatePythonEnvType(envType);
		await configureEnvironmentDetails(envType, platform);
		vscode.window.showInformationMessage(vscode.l10n.t('Environment type set to {0}.', envType));
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

	const exportRequirements = async () => {
		await exportService.exportRequirements();
	};

	const exportEnvironmentYaml = async () => {
		await exportService.exportEnvironmentYaml();
	};

	const refreshEnvironments = async () => {
		const platform = settingsService.getPlatform();
		const envType = settingsService.getPythonEnvType() ?? 'conda';
		if (!platform) {
			vscode.window.showWarningMessage(vscode.l10n.t('Select a platform before refreshing environments.'));
			return;
		}

		if (envType === 'venv') {
			const venvPath = await showVenvPathInput(settingsService.getVenvPath());
			if (!venvPath) {
				return;
			}

			await settingsService.updateVenvPath(venvPath);
			vscode.window.showInformationMessage(vscode.l10n.t('Venv path refreshed.'));
			return;
		}

		const envs = await getCondaEnvironments(platform, condaService, settingsService);
		if (envs.length === 0) {
			vscode.window.showWarningMessage(vscode.l10n.t('No Conda environments were found.'));
			return;
		}

		const selectedEnv = await showCondaEnvironmentQuickPick(envs, settingsService.getCondaEnv());
		if (!selectedEnv) {
			return;
		}

		await settingsService.updateCondaEnv(selectedEnv);
		vscode.window.showInformationMessage(vscode.l10n.t('Conda environments refreshed.'));
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

		const action = await showStatusMenuQuickPick(envType);
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
		vscode.commands.registerCommand('aiEnvironmentManager.setPreparedTerminalAsDefault', setPreparedTerminalAsDefault),
		vscode.commands.registerCommand('aiEnvironmentManager.exportRequirements', exportRequirements),
		vscode.commands.registerCommand('aiEnvironmentManager.exportEnvironmentYaml', exportEnvironmentYaml)
	);

	context.subscriptions.push(
		settingsService.onDidChangeConfiguration(() => {
			statusBar.update();
		})
	);

	statusBar.update();
	void maybeRunFirstRun(settingsService, configureEnvironment);

	async function configureEnvironmentDetails(envType: PythonEnvType, platform: Platform): Promise<boolean> {
		if (envType === 'venv') {
			const venvPath = await showVenvPathInput(settingsService.getVenvPath());
			if (!venvPath) {
				return false;
			}

			await settingsService.updateVenvPath(venvPath);
			return true;
		}

		const envs = await getCondaEnvironments(platform, condaService, settingsService);
		if (envs.length === 0) {
			vscode.window.showWarningMessage(vscode.l10n.t('No Conda environments were found.'));
			return false;
		}

		const selectedEnv = await showCondaEnvironmentQuickPick(envs, settingsService.getCondaEnv());
		if (!selectedEnv) {
			return false;
		}

		await settingsService.updateCondaEnv(selectedEnv);
		return true;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function maybeRunFirstRun(
	settingsService: SettingsService,
	configureEnvironment: () => Promise<boolean>
) {
	if (!settingsService.hasWorkspace()) {
		return;
	}

	if (!settingsService.getPromptOnMissingEnvironment()) {
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

	const configured = await configureEnvironment();
	if (configured) {
		return;
	}

	const configureNow = vscode.l10n.t('Configure Now');
	const dontShowAgain = vscode.l10n.t("Don't Show Again");
	const action = await vscode.window.showInformationMessage(
		vscode.l10n.t('AI Environment Manager: no environment configured for this workspace.'),
		configureNow,
		dontShowAgain
	);
	if (action === dontShowAgain) {
		await settingsService.updatePromptOnMissingEnvironment(false);
	} else if (action === configureNow) {
		await configureEnvironment();
	}
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
		const message = error instanceof Error ? error.message : vscode.l10n.t('Failed to list Conda environments.');
		vscode.window.showErrorMessage(message);
		return [];
	}
}
