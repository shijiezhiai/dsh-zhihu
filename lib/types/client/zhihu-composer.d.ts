/**
 * The composer the reader types into, as the ask action sees it: whether the
 * draft landed there, and where to put the text when it did not.
 */
/**
 * Text of the composer on screen.
 * @returns the composer's text, or an empty string when no composer is mounted.
 */
export declare function readComposerText(): string;
/**
 * Type the draft into the composer, for a Session whose own draft never arrived.
 *
 * The text goes in through the browser's editing pipeline, so the editor's state
 * follows it exactly as it follows the reader's own typing. That pipeline is
 * `execCommand` alone; mutating the DOM leaves a model-backed editor out of step.
 * @param text - the draft to type.
 * @returns whether the editor took it; false when the page has no editor to type into.
 */
export declare function typeComposerText(text: string): boolean;
//# sourceMappingURL=zhihu-composer.d.ts.map