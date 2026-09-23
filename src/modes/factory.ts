import { ModeStrategy, DocumentMode } from './types';
import { GenericStrategy } from './generic';
import { CfnStrategy } from './cfn';
import { DocDockConstants } from '../core/constants';

export type ModeName =
    | DocumentMode
    | (typeof DocDockConstants.StrategyModes)[keyof typeof DocDockConstants.StrategyModes];
export type StrategyCreator = () => ModeStrategy;

/**
 * モード戦略のファクトリおよびレジストリクラス
 */
export class ModeFactory {
    private static registry = new Map<string, StrategyCreator>([
        [DocumentMode.Cfn, () => new CfnStrategy()],
        [DocumentMode.Generic, () => new GenericStrategy()]
    ]);

    /**
     * モード戦略生成関数の登録
     */
    static registerMode(modeName: string, creator: StrategyCreator): void {
        this.registry.set(modeName.toLowerCase(), creator);
    }

    /**
     * 登録済みサポートモード名一覧の取得
     */
    static getSupportedModes(): string[] {
        return Array.from(this.registry.keys());
    }

    /**
     * 指定されたモードに応じた戦略インスタンスの取得
     */
    static getStrategy(modeName?: DocumentMode | string): ModeStrategy {
        const creator = this.registry.get(modeName ? modeName.toLowerCase() : '');
        if (creator) {
            return creator();
        }
        return new GenericStrategy();
    }
}
