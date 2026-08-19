import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ExcludeTree } from '../types';
import { AliasTreeBuilder } from './alias-tree-builder';
import { ImportResolver } from './import-resolver';
import { DocDockConstants } from './constants';

export class ExcludeProcessor {
    /**
     * Loads and processes an exclude file.
     * 1. Resolves _imports
     * 2. Parses flat string paths into an ExcludeTree
     */
    static loadAndProcess(filePath: string, baseDir: string): ExcludeTree {
        if (!fs.existsSync(filePath)) {
            return {};
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        let parsedData: any = yaml.load(fileContent) || {};

        if (typeof parsedData !== 'object' || Array.isArray(parsedData)) {
            return {};
        }

        // 1. Resolve imports recursively
        parsedData = ImportResolver.resolve(parsedData, baseDir);

        // 2. Build the ExcludeTree using AliasTreeBuilder with ExcludeValue as terminal
        return AliasTreeBuilder.build(parsedData, DocDockConstants.ReservedKeys.ExcludeValue) as ExcludeTree;
    }
}
