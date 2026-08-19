import { describe, it, expect } from 'vitest';
import { RenderContext } from './render-context';

describe('RenderContext', () => {
    it('should initialize with default values', () => {
        const ctx = new RenderContext();
        expect(ctx.level).toBe(0);
        expect(ctx.path).toBeUndefined();
        expect(ctx.rawPath).toEqual([]);
        expect(ctx.copyPath).toBe('');
    });

    it('should allow initializing with provided values', () => {
        const ctx = new RenderContext(2, 'root', ['root'], 'root');
        expect(ctx.level).toBe(2);
        expect(ctx.path).toBe('root');
        expect(ctx.rawPath).toEqual(['root']);
        expect(ctx.copyPath).toBe('root');
    });

    it('should derive child context and increment level by default', () => {
        const ctx = new RenderContext(0, 'root', ['root'], 'root');
        const childCtx = ctx.child('child-seg', 'child-raw');
        
        expect(childCtx.level).toBe(1);
        expect(childCtx.path).toBe('root__child-seg'); // '-' is allowed
        expect(childCtx.rawPath).toEqual(['root', 'child-raw']);
        expect(childCtx.copyPath).toBe('root.child-raw');
    });

    it('should derive copyPath correctly for numeric segments', () => {
        const ctx = new RenderContext(0, 'root', ['root'], 'root');
        const childCtx = ctx.child('0', '0');
        
        expect(childCtx.copyPath).toBe('root[]');
    });

    it('should derive copyPath correctly for condition segments', () => {
        const ctx = new RenderContext(0, 'root', ['root'], 'root');
        const childCtx = ctx.child('=name:web', '=name:web');
        
        expect(childCtx.copyPath).toBe('root[=name:web]');
    });

    it('should derive child context without incrementing level if specified', () => {
        const ctx = new RenderContext(1, 'root', ['root'], 'root');
        const childCtx = ctx.child('seg', 'raw', false);
        
        expect(childCtx.level).toBe(1);
        expect(childCtx.path).toBe('root__seg');
        expect(childCtx.rawPath).toEqual(['root', 'raw']);
        expect(childCtx.copyPath).toBe('root.raw');
    });

    it('should handle deriving path when current path is undefined', () => {
        const ctx = new RenderContext();
        const childCtx = ctx.child('seg', 'raw');
        
        expect(childCtx.path).toBe('seg');
        expect(childCtx.rawPath).toEqual(['raw']);
        expect(childCtx.copyPath).toBe('raw');
    });

    it('should derive copyPath correctly in RenderContext.create for condition segments', () => {
        const ctx = RenderContext.create(['tasks', '=taskArn:arn:aws...', 'attachments']);
        expect(ctx.copyPath).toBe('tasks[=taskArn:arn:aws...].attachments');
    });
});
