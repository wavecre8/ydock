import * as fs from 'fs';
import * as path from 'path';
import { merge } from 'lodash';
import { GuideData } from '../types';
import { DocDockConstants } from './constants';
import { FileNotFoundError } from './errors';
import { Loader } from './loader';

export class ImportResolver {
    /**
     * Recursively resolves _imports for GuideData.
     * Imports are merged first (base), then current data overrides them.
     */
    static resolve(data: GuideData, baseDir: string): GuideData {
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
            const importPath = path.resolve(baseDir, importFile);
            
            if (!fs.existsSync(importPath)) {
                throw new FileNotFoundError(importPath, 'import resolution');
            }

            // Load and resolve sub-imports recursively
            let subData = Loader.loadTemplate(importPath, undefined) as GuideData;
            subData = this.resolve(subData, path.dirname(importPath));
            
            importedData = merge(importedData, subData);
        }

        // Destructure to remove _imports from the merged result
        const { [importsKey]: _, ...ownData } = inputWithImports;
        
        return merge(importedData, ownData as GuideData);
    }
}
