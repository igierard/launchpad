import { getConfig as getContentConfig } from '@bluecadet/launchpad-content/test/test.js';
import { getConfig as getMonitorConfig } from '@bluecadet/launchpad-monitor/test/test.js';

const config = {
	"content": await getContentConfig(),
	"monitor": await getMonitorConfig(),
	"logging": {
		"level": "debug"
	},
	"commands": {
		"concurrency": 1
	} 
};

export default config;