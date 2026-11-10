/**
 * Exhaustiveness guard for closed union dispatch.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/assert-never
 */
/**
 * Prove at compile time that a union member is unreachable, and fail loudly when it is reached at
 * runtime (a payload that produced an unrecognized discriminant, or a caller that cast one).
 * @param value - the value the caller's dispatch proved unreachable.
 * @returns never; the call always throws.
 */
export declare function assertNever(value: never): never;
//# sourceMappingURL=assert-never.d.ts.map