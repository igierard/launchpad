import LaunchpadCore from '@bluecadet/launchpad-core';
import { ConfigManager, launchFromCli } from '@bluecadet/launchpad-utils';

const getConfig = async (paths = ['user-config.js', 'config.js']) => {
	return ConfigManager.importJsConfig(paths, import.meta);
}

const wait = async (seconds) => {
	console.debug(`Waiting for ${seconds}s...`);
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

launchFromCli(import.meta, {
	userConfig: await getConfig()
}).then(async config => {
	const launchpad = new LaunchpadCore(config);
	
	await launchpad.startup();
	
	const appNames = launchpad._monitor.getAllAppNames();
	await Promise.all([...appNames, 'fake-app'].map(async (appName) => {
		const isRunning = await launchpad._monitor.isRunning(appName);
		console.debug(`App '${appName}' is running: ${isRunning}`);
	}));
	
	await wait(10);
	await launchpad.updateContent();
	
	await wait(10);
	await launchpad.shutdown();
	
}).catch(err => {
	if (err) {
		console.error('Launch error', err);
		throw err;
	}
});