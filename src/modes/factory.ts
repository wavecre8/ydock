import { ModeStrategy } from './types';
import { GenericStrategy } from './generic';
import { CfnStrategy } from './cfn';
import { DocDockConstants } from '../core/constants';

export type ModeName = typeof DocDockConstants.StrategyModes[keyof typeof DocDockConstants.StrategyModes];

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
            case DocDockConstants.StrategyModes.Cfn:
                return new CfnStrategy();
            case DocDockConstants.StrategyModes.Generic:
            default:
                return new GenericStrategy();
        }
    }
}
