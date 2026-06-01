export type Platform = 'windows' | 'wsl' | 'macos';

export type PythonEnvType = 'conda' | 'venv';

export interface AiEnvironmentConfiguration {
	platform?: Platform;
	pythonEnvType?: PythonEnvType;
	condaEnv?: string;
	venvPath?: string;
	condaShPathWslLinux?: string;
	condaShPathMac?: string;
}
