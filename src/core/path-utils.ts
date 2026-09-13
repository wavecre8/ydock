import * as fs from 'fs';
import * as path from 'path';
import { DocDockConstants } from './constants';

export class PathUtils {
    /**
     * Resolves a target path relative to a base directory if it's not already absolute.
     */
    static resolveRelative(baseDir: string, targetPath: string): string {
        if (!targetPath) return baseDir;
        return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
    }

    /**
     * Extracts the directory from a config path.
     */
    static getConfigDir(configPath: string): string {
        return path.dirname(path.resolve(configPath));
    }

    /**
     * Finds the default configuration file in the current working directory.
     */
    static findDefaultConfigPath(): string {
        const candidates = DocDockConstants.ConfigFiles.Candidates;
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return DocDockConstants.Defaults.ConfigFile;
    }

    /**
     * Finds a file given a base directory, base name, and a list of possible extensions.
     */
    static findFileWithExtensions(baseDir: string, baseName: string, extensions: string[]): string | null {
        const resolvedBaseDir = path.resolve(baseDir);
        for (const ext of extensions) {
            const candidate = path.join(resolvedBaseDir, `${baseName}${ext}`);
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
}
