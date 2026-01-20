import { describe, it, expect } from 'vitest';
import { ModeFactory } from './factory';
import { CfnStrategy } from './cfn';
import { GenericStrategy } from './generic';

describe('ModeFactory', () => {
    it('should return CfnStrategy for "cfn"', () => {
        const strategy = ModeFactory.getStrategy('cfn');
        expect(strategy).toBeInstanceOf(CfnStrategy);
    });

    it('should return GenericStrategy for "generic"', () => {
        const strategy = ModeFactory.getStrategy('generic');
        expect(strategy).toBeInstanceOf(GenericStrategy);
    });

    it('should return GenericStrategy for unknown mode (default)', () => {
        const strategy = ModeFactory.getStrategy('unknown');
        expect(strategy).toBeInstanceOf(GenericStrategy);
    });
});
