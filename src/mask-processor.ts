/**
 * Mask Processor
 *
 * Core of the mask application algorithm.
 * Coordinates processing using PatternAnalyzer and StringProcessor.
 */
import {
  MaskResult,
  MaskOptions,
  ProcessingDirection,
  IterationConfig,
  TokenRegistry,
} from './types';
import { PatternAnalyzer } from './pattern-analyzer';
import { StringProcessor } from './string-processor';

/**
 * Interface that encapsulates all processing state
 */
interface ProcessingContext {
  value: string;
  modifiedPattern: string;
  isValid: boolean;
  formattedResult: string;
  valuePosition: number;
  patternPosition: number;
  optionalNumbersToUse: number;
  escapeNextCharacter: boolean;
  recursiveTokens: string[];
  inRecursiveMode: boolean;
  iteration: IterationConfig;
}

export class MaskProcessor {
  private readonly stringProcessor: StringProcessor;
  private readonly patternAnalyzer: PatternAnalyzer;

  public constructor(
    private readonly pattern: string,
    private readonly options: MaskOptions,
    tokenRegistry: TokenRegistry,
  ) {
    this.stringProcessor = new StringProcessor();
    this.patternAnalyzer = new PatternAnalyzer(tokenRegistry);
  }

  /**
   * Processes a value applying the configured mask
   */
  public process(value: string): MaskResult {
    const normalizedValue = this.stringProcessor.normalizeToString(value);

    if (!normalizedValue) {
      return { result: '', valid: false };
    }

    const context = this.initializeProcessingContext(normalizedValue);

    while (this.shouldContinueProcessing(context)) {
      this.processNextCharacter(context);

      context.patternPosition += context.iteration.increment;
    }

    return {
      result: context.formattedResult,
      valid: context.isValid,
    };
  }

  /**
   * Initializes the processing context with all necessary states
   */
  private initializeProcessingContext(value: string): ProcessingContext {
    const iteration = this.createIterationConfig();

    const valuePosition = this.options.reverse ? value.length - 1 : 0;
    const optionalNumbersToUse =
      this.patternAnalyzer.calculateOptionalNumbersToUse(this.pattern, value);

    return {
      value,
      isValid: true,
      iteration,
      valuePosition,
      optionalNumbersToUse,
      patternPosition: iteration.start,
      modifiedPattern: this.pattern,
      formattedResult: '',
      escapeNextCharacter: false,
      inRecursiveMode: false,
      recursiveTokens: [],
    };
  }

  /**
   * Creates the iteration configuration based on options
   */
  private createIterationConfig(): IterationConfig {
    if (this.options.reverse) {
      return {
        start: this.pattern.length - 1,
        end: -1,
        increment: ProcessingDirection.REVERSE,
      };
    }

    return {
      start: 0,
      end: this.pattern.length,
      increment: ProcessingDirection.FORWARD,
    };
  }

  /**
   * Determines if processing should continue
   */
  private shouldContinueProcessing(context: ProcessingContext): boolean {
    const { patternPosition, modifiedPattern, iteration } = context;

    // Recursive mode not initiated
    if (!context.inRecursiveMode && context.recursiveTokens.length === 0) {
      return this.patternAnalyzer.hasMoreTokens(
        modifiedPattern,
        patternPosition,
        iteration.increment,
      );
    }

    // Looking for more recursive tokens
    if (!context.inRecursiveMode && context.recursiveTokens.length > 0) {
      const hasMoreTokens = this.patternAnalyzer.hasMoreRecursiveTokens(
        modifiedPattern,
        patternPosition,
        iteration.increment,
      );

      if (hasMoreTokens) {
        return true;
      }

      // Start recursive mode
      context.inRecursiveMode = context.recursiveTokens.length > 0;
    }

    // Process recursive mode
    if (context.inRecursiveMode) {
      return this.handleRecursiveMode(context);
    }

    return patternPosition < modifiedPattern.length && patternPosition >= 0;
  }

  /**
   * Manages the recursive mode logic
   */
  private handleRecursiveMode(context: ProcessingContext): boolean {
    const patternChar = context.recursiveTokens.shift();

    if (!patternChar) {
      return false;
    }

    context.recursiveTokens.push(patternChar);

    const hasMoreValue = this.options.reverse
      ? context.valuePosition >= 0
      : context.valuePosition < context.value.length;

    if (hasMoreValue) {
      if (this.options.reverse) {
        context.patternPosition++;
      }

      context.modifiedPattern = this.stringProcessor.insertCharacterAt(
        context.modifiedPattern,
        patternChar,
        context.patternPosition,
      );
    }

    return hasMoreValue;
  }

  /**
   * Processes the next character of pattern and value
   */
  private processNextCharacter(context: ProcessingContext): void {
    const valueChar = context.value.charAt(context.valuePosition);
    const patternChar = context.modifiedPattern.charAt(context.patternPosition);

    let token = this.patternAnalyzer.getToken(patternChar);

    // Non-recursive tokens in recursive mode are treated as literals
    if (context.recursiveTokens.length > 0 && token && !token.recursive) {
      token = undefined;
    }

    // 1. Process escape characters
    if (this.handleEscapeCharacters(context, patternChar, token, valueChar)) {
      return;
    }

    // 2. Process recursive tokens
    if (this.handleRecursiveTokens(context, patternChar, token, valueChar)) {
      return;
    }

    // 3. Process input value
    this.handleValueCharacter(context, patternChar, token, valueChar);
  }

  /**
   * Processes escape characters
   */
  private handleEscapeCharacters(
    context: ProcessingContext,
    patternChar: string,
    token: ReturnType<PatternAnalyzer['getToken']>,
    valueChar: string,
  ): boolean {
    if (!context.inRecursiveMode || valueChar) {
      // Reverse mode: check direct escape
      if (
        this.options.reverse &&
        this.patternAnalyzer.isCharacterEscaped(
          context.modifiedPattern,
          context.patternPosition,
        )
      ) {
        context.formattedResult = this.stringProcessor.concatenateCharacter(
          context.formattedResult,
          patternChar,
          this.options,
          token,
        );
        context.patternPosition += context.iteration.increment;
        return true;
      }

      // Normal mode: check escape flag
      if (!this.options.reverse && context.escapeNextCharacter) {
        context.formattedResult = this.stringProcessor.concatenateCharacter(
          context.formattedResult,
          patternChar,
          this.options,
          token,
        );
        context.escapeNextCharacter = false;
        return true;
      }

      // Mark next character for escape
      if (!this.options.reverse && token?.escape) {
        context.escapeNextCharacter = true;
        return true;
      }
    }

    return false;
  }

  /**
   * Processes recursive tokens
   */
  private handleRecursiveTokens(
    context: ProcessingContext,
    patternChar: string,
    token: ReturnType<PatternAnalyzer['getToken']>,
    valueChar: string,
  ): boolean {
    // Save recursive token to process later
    if (!context.inRecursiveMode && token?.recursive) {
      context.recursiveTokens.push(patternChar);
      return false;
    }

    // In recursive mode but value ended
    if (context.inRecursiveMode && !valueChar) {
      context.formattedResult = this.stringProcessor.concatenateCharacter(
        context.formattedResult,
        patternChar,
        this.options,
        token,
      );
      return true;
    }

    // Not in recursive mode but in recursive portion of pattern
    if (
      !context.inRecursiveMode &&
      context.recursiveTokens.length > 0 &&
      !valueChar
    ) {
      return true;
    }

    return false;
  }

  /**
   * Processes the input value character
   */
  private handleValueCharacter(
    context: ProcessingContext,
    patternChar: string,
    token: ReturnType<PatternAnalyzer['getToken']>,
    valueChar: string,
  ): void {
    // No token: add literal character from pattern
    if (!token) {
      context.formattedResult = this.stringProcessor.concatenateCharacter(
        context.formattedResult,
        patternChar,
        this.options,
      );

      if (!context.inRecursiveMode && context.recursiveTokens.length > 0) {
        context.recursiveTokens.push(patternChar);
      }

      return;
    }

    // Optional token
    if (token.optional) {
      this.handleOptionalToken(context, token, valueChar);
      return;
    }

    // Required token with pattern
    if (token.pattern?.test(valueChar)) {
      context.formattedResult = this.stringProcessor.concatenateCharacter(
        context.formattedResult,
        valueChar,
        this.options,
        token,
      );
      context.valuePosition += context.iteration.increment;
      return;
    }

    // Use default value if available
    if (!valueChar && token.defaultValue && this.options.useDefaults) {
      context.formattedResult = this.stringProcessor.concatenateCharacter(
        context.formattedResult,
        token.defaultValue,
        this.options,
        token,
      );
      return;
    }

    // Invalid value
    context.isValid = false;
  }

  /**
   * Processes optional token
   */
  private handleOptionalToken(
    context: ProcessingContext,
    token: ReturnType<PatternAnalyzer['getToken']>,
    valueChar: string,
  ): void {
    if (token?.pattern?.test(valueChar) && context.optionalNumbersToUse > 0) {
      context.formattedResult = this.stringProcessor.concatenateCharacter(
        context.formattedResult,
        valueChar,
        this.options,
        token,
      );
      context.valuePosition += context.iteration.increment;
      context.optionalNumbersToUse--;
    } else if (context.recursiveTokens.length > 0 && valueChar) {
      context.isValid = false;
    }
  }
}
