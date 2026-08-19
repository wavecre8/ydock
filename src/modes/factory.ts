import { ModeStrategy } from './types';
import { GenericStrategy } from './generic';
import { CfnStrategy } from './cfn';

export type ModeName = 'generic' | 'cfn';

/**
 * Factory for creating mode strategies based on configuration.
 */
export class ModeFactory {
    /**
     * Returns the strategy instance for the specified mode.
     * @param modeName The mode name string (e.g. 'cfn', 'generic')
     */
    static getStrategy(modeName: string): ModeStrategy {
        const mode = modeName as ModeName;
        switch (mode) {
            case 'cfn':
                return new CfnStrategy();
            case 'generic':
            default:
                return new GenericStrategy();
        }
    }
}
