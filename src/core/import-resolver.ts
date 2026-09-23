import * as fs from 'fs';
import * as path from 'path';
import { GuideData } from '../types';
import { DocDockConstants } from './constants';
import { FileNotFoundError, CircularImportError, InvalidImportError } from './errors';
import { Loader } from './loader';
import { Merger } from './merger';

export class ImportResolver {
    /**
     * Recursively resolves _imports for GuideData.
     * Imports are merged first (base), then current data overrides them.
     */
    static resolve(data: GuideData, baseDir: string, visitedStack: string[] = []): GuideData {
        if (!data || typeof data !== 'object') return data;

        const inputWithImports = data as GuideData & Record<string, any>;
        const importsKey = DocDockConstants.ReservedKeys.Imports;
        const importFiles = inputWithImports[importsKey];

        // If no _imports array exists, just return the data itself
        if (!Array.isArray(importFiles) || importFiles.length === 0) {
            return data;
        }

        let importedData: GuideData = {};

        // Resolve each imported file sequentially
        for (const importFile of importFiles) {
            // インポート指定値の型検証
            if (typeof importFile !== 'string' || importFile.trim() === '') {
                throw new InvalidImportError(baseDir, importFile);
            }

            const importPath = path.resolve(baseDir, importFile);

            // 循環インポートの検知
            if (visitedStack.includes(importPath)) {
                throw new CircularImportError([...visitedStack, importPath]);
            }

            if (!fs.existsSync(importPath)) {
                throw new FileNotFoundError(importPath, 'import resolution');
            }

            // Load and resolve sub-imports recursively
            let subData = Loader.loadTemplate(importPath, undefined) as GuideData;
            // 再帰的なインポート解決の実行
            subData = this.resolve(subData, path.dirname(importPath), [...visitedStack, importPath]);

            // 読み込み済みインポートデータに対するガイドマージ処理
            importedData = Merger.mergeDescriptions([importedData, subData]) as GuideData;
        }

        // Destructure to remove _imports from the merged result
        const { [importsKey]: _, ...ownData } = inputWithImports;

        // インポート定義に対する個別定義の優先マージ処理
        return Merger.mergeDescriptions([importedData, ownData as GuideData]) as GuideData;
    }
}
