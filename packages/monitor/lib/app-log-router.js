import pm2 from "pm2";
import path from "path";
import { Tail } from "tail";
import autoBind from "auto-bind";
import { SubEmitterSocket } from "axon"; // used by PM2
import { Logger, LogManager } from "@bluecadet/launchpad-utils";
import { AppOptions, AppLogOptions, LogModes } from "./monitor-options.js";

class LogRelay {
	/**
	 * @protected
	 * @type {AppOptions}
	 */
	_appOptions;

	/**
	 * @protected
	 * @type {AppLogOptions}
	 */
	_logOptions;

	/**
	 * @protected
	 * @type {Logger}
	 */
	_logger;

	/**
	 * @param {AppOptions} appOptions
	 * @param {Logger} logger
	 */
	constructor(appOptions, logger) {
		logger.debug(`Saving output logs to ${appOptions.pm2.output}`);
		logger.debug(`Saving error logs to ${appOptions.pm2.error}`);

		// Writing to these fields for backwards compatiblity
		// @see https://pm2.keymetrics.io/docs/usage/application-declaration/#log-files
		appOptions.pm2.out_file = appOptions.pm2.output;
		appOptions.pm2.error_file = appOptions.pm2.error;

		if (
			appOptions.pm2.output !== "/dev/null" ||
			appOptions.pm2.error !== "/dev/null"
		) {
			logger.warn("Launchpad is unable to rotate log files generated by pm2");
			logger.warn(
				"Set log mode to 'bus' and unset pm2 output/error properties to hide this warning."
			);
		}

		this._appOptions = appOptions;
		this._logOptions = appOptions.logging;
		this._logger = logger;
	}

	/**
	 * @param {string} _eventType
	 * @param {*} _eventData
	 */
	handleEvent(_eventType, _eventData) {
		// implement this fn in all child classes
		throw new Error("not implemented");
	}
}

class FileLogRelay extends LogRelay {
	/**
	 * @private
	 * @type {Tail}
	 */
	_outTail = null;

	/**
	 * @private
	 * @type {Tail}
	 */
	_errTail = null;

	/**
	 * @param {AppOptions} appOptions
	 * @param {Logger} logger
	 */
	constructor(appOptions, logger) {
		const appName = appOptions.pm2.name;

		if (appOptions.logging.logToLaunchpadDir) {
			// Move app logs from default pm2 dir to launchpad dir
			const outPath = LogManager.getInstance().getFilePath(`${appName}-stdout`);
			const errPath = LogManager.getInstance().getFilePath(`${appName}-stderr`);
			appOptions.pm2.output ??= path.resolve(outPath);
			appOptions.pm2.error ??= path.resolve(errPath);
		} else {
			appOptions.pm2.output = null;
			appOptions.pm2.error = null;
		}

		super(appOptions, logger);
	}

	/**
	 * @param {string} eventType
	 * @param {*} eventData
	 */
	handleEvent(eventType, eventData) {
		switch (eventType) {
			case "process:event":
				if (eventData.event === "online") this._handleOnline();
				else if (eventData.event === "exit") this._handleOffline();
				break;
			default:
				break;
		}
	}

	/** @private */
	_handleOnline() {
		const tailOptions = {
			useWatchFile: true,
			fsWatchOptions: { interval: 100 },
		};
		const outFilepath = this._appOptions.pm2.output;
		const errFilepath = this._appOptions.pm2.error;

		if (this._outTail) {
			this._outTail.unwatch();
			this._outTail = null;
		}
		if (this._errTail) {
			this._errTail.unwatch();
			this._errTail = null;
		}

		if (!outFilepath) {
			this._logger.warn(
				`App process for ${this._appOptions.pm2.name} is missing the 'output' property.`
			);
		}
		if (!errFilepath) {
			this._logger.warn(
				`App process for ${this._appOptions.pm2.name} is missing the 'error' property.`
			);
		}

		if (this._logOptions.showStdout) {
			this._logger.debug(`Tailing stdout from ${outFilepath}`);
			this._outTail = new Tail(outFilepath, tailOptions);
			this._outTail.on("line", (data) => this._handleTailOutput(data));
			this._outTail.on("error", (data) => this._handleTailError(data, true));
			this._outTail.watch();
		}

		if (this._logOptions.showStderr) {
			this._logger.debug(`Tailing stderr from ${errFilepath}`);
			this._errTail = new Tail(errFilepath, tailOptions);
			this._errTail.on("line", (data) => this._handleTailError(data));
			this._errTail.on("error", (data) => this._handleTailError(data, true));
			this._errTail.watch();
		}
	}

	/** @private */
	_handleOffline() {
		if (this._outTail) {
			this._outTail.unwatch();
			this._outTail = null;
		}
		if (this._errTail) {
			this._errTail.unwatch();
			this._errTail = null;
		}
	}

	/** @private */
	_handleTailOutput(data) {
		if (this._logOptions.showStdout) {
			this._logger.info(data);
		}
	}

	/** @private */
	_handleTailError(data, isTailError = false) {
		if (isTailError || this._logOptions.showStderr) {
			this._logger.error(data);
		}
	}
}

class BusLogRelay extends LogRelay {
	/**
	 * @param {AppOptions} appOptions
	 * @param {Logger} logger
	 */
	constructor(appOptions, logger) {
		// default log outputs to '/dev/null' if not defined
		appOptions.pm2.output ??= "/dev/null";
		appOptions.pm2.error ??= "/dev/null";

		super(appOptions, logger);
	}

	/**
	 * @param {string} eventType
	 * @param {*} eventData
	 */
	handleEvent(eventType, eventData) {
		switch (eventType) {
			case "log:out":
				this._handleBusLogOut(eventData);
				break;
			case "log:err":
				this._handleBusLogErr(eventData);
				break;
			default:
				break;
		}
	}

	/**
	 * @private
	 * @param {string} buffer
	 * @returns {string[]}
	 */
	_splitLines(buffer) {
		const parts = buffer.split(/[\r]{0,1}\n/);
		parts.pop(); // last item will always be an empty string because every line ends with a carriage return
		return parts;
	}

	/**
	 * @private
	 * @param {*} event
	 */
	_handleBusLogOut(event) {
		if (this._logOptions.showStdout) {
			this._splitLines(event.data.toString()).forEach((line) => {
				this._logger.info(line);
			});
		}
	}

	/**
	 * @private
	 * @param {*} event
	 */
	_handleBusLogErr(event) {
		if (this._logOptions.showStderr) {
			this._splitLines(event.data.toString()).forEach((line) => {
				this._logger.error(line);
			});
		}
	}
}

export default class AppLogRouter {
	/**
	 * @private
	 * @type {Logger}
	 */
	_logger = null;

	/**
	 * @private
	 * @type {Map<string, LogRelay>}
	 */
	_logRelays = new Map();

	/**
	 * @param {Logger} logger
	 */
	constructor(logger) {
		autoBind(this);
		this._logger = logger;
	}

	/**
	 * @param {AppOptions} appOptions
	 * @return {AppOptions}
	 */
	initAppOptions(appOptions) {
		const pm2Options = appOptions.pm2;
		const logOptions = appOptions.logging;
		const appName = pm2Options.name;

		const appLogger = LogManager.getInstance().getLogger(appName, this._logger);

		if (logOptions.mode === LogModes.TailLogFile) {
			const fileRelay = new FileLogRelay(appOptions, appLogger);
			this._logRelays.set(appName, fileRelay);
		} else {
			const busRelay = new BusLogRelay(appOptions, appLogger);
			this._logRelays.set(appName, busRelay);
		}
	}

	/**
	 * @param {SubEmitterSocket} pm2Bus
	 */
	connectToBus(pm2Bus) {
		pm2Bus.on("*", this._handleEvent);
	}

	/**
	 * @param {SubEmitterSocket} pm2Bus
	 */
	disconnectFromBus(pm2Bus) {
		pm2Bus.off("*");
	}

	/**
	 * @private
	 * @param {string} eventType
	 * @param {*} eventData
	 */
	_handleEvent(eventType, eventData) {
		if (!eventData?.process?.name) return;
		this._logRelays
			.get(eventData.process.name)
			?.handleEvent(eventType, eventData);
	}
}
