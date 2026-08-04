/**
 * 断言操作符执行逻辑 - 薄 re-export
 *
 * 实际实现已迁移至 @rabjs/shared，此文件仅作转发，
 * 保留以不破坏现有消费方的 import 路径。
 * 待下一 major 版本再清理此文件。
 */

export { executeAssertion, executeAssertions } from '@rabjs/shared';
