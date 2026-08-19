import * as path from 'path';
import * as fs from 'fs';
import { ExcludeProcessor } from './exclude-processor';

describe('ExcludeProcessor', () => {
    const testDir = path.join(__dirname, '__test_excludes__');
    const testFile = path.join(testDir, 'test.exclude.yml');
    
    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir);
        }
        fs.writeFileSync(testFile, `
"connectivityAt": true
"containers[].networkInterfaces[].attachmentId": true
"containers": true
"containers[].name": false
        `.trim(), 'utf8');
    });

    afterAll(() => {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
        if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
    });

    it('should parse flat paths into ExcludeTree with __value', () => {
        const tree = ExcludeProcessor.loadAndProcess(testFile, testDir);
        console.log(JSON.stringify(tree, null, 2));
        
        expect(tree.connectivityAt).toBeDefined();
        expect(tree.connectivityAt).toBe(true);

        expect(tree.containers).toBeDefined();
        expect((tree.containers as any).__value).toBe(true);
        expect((tree.containers as any)['[]'].name.__value).toBe(false);
        expect((tree.containers as any)['[]'].networkInterfaces['[]'].attachmentId.__value).toBe(true);
    });
});
