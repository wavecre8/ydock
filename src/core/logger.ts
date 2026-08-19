export class Logger {
    private static silent: boolean = false;

    static setSilent(silent: boolean) {
        this.silent = silent;
    }

    static info(...args: any[]) {
        if (!this.silent) {
            console.log(...args);
        }
    }

    static warn(...args: any[]) {
        if (!this.silent) {
            console.warn(...args);
        }
    }

    static error(...args: any[]) {
        // Errors are usually printed even in silent mode, but we can make it respect silent or have a different level.
        // For now, let's always print errors, or only when not silent. We'll always print errors for critical issues.
        console.error(...args);
    }
}
