import { MaskProcessor } from '../src/mask-processor';
import { MaskOptions, TokenRegistry } from '../src/types';

describe('MaskProcessor', () => {
  let tokenRegistry: TokenRegistry;

  beforeEach(() => {
    tokenRegistry = {
      '0': { pattern: /\d/, defaultValue: '0' },
      '9': { pattern: /\d/, optional: true },
      '#': { pattern: /\d/, optional: true, recursive: true },
      A: { pattern: /[a-zA-Z0-9]/ },
      S: { pattern: /[a-zA-Z]/ },
      U: {
        pattern: /[a-zA-Z]/,
        transform: (char: string) => char.toUpperCase(),
      },
      L: {
        pattern: /[a-zA-Z]/,
        transform: (char: string) => char.toLowerCase(),
      },
      $: { escape: true },
    };
  });

  describe('process - Basic Masks', () => {
    it('should apply simple numeric mask', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000-0000', options, tokenRegistry);
      const result = processor.process('1234567');

      expect(result.result).toBe('123-4567');
      expect(result.valid).toBe(true);
    });

    it('should return invalid when value is too short', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000-0000', options, tokenRegistry);
      const result = processor.process('12345');

      expect(result.result).toBe('123-45');
      expect(result.valid).toBe(false);
    });

    it('should return empty for empty value', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000-0000', options, tokenRegistry);
      const result = processor.process('');

      expect(result.result).toBe('');
      expect(result.valid).toBe(false);
    });

    it('should apply mask with literal characters', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor(
        '(000) 000-0000',
        options,
        tokenRegistry,
      );
      const result = processor.process('1234567890');

      expect(result.result).toBe('(123) 456-7890');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Reverse Mode', () => {
    it('should apply mask in reverse', () => {
      const options: MaskOptions = { reverse: true };
      const processor = new MaskProcessor('000.000,00', options, tokenRegistry);
      const result = processor.process('123456');

      expect(result.result).toBe('1.234,56');
      expect(result.valid).toBe(false);
    });

    it('should handle short values in reverse', () => {
      const options: MaskOptions = { reverse: true };
      const processor = new MaskProcessor('000.000,00', options, tokenRegistry);
      const result = processor.process('12');

      expect(result.result).toBe('.,12');
      expect(result.valid).toBe(false);
    });

    it('should handle default values in reverse', () => {
      const options: MaskOptions = { reverse: true, useDefaults: true };
      const processor = new MaskProcessor('000,00', options, tokenRegistry);
      const result = processor.process('1');

      expect(result.result).toBe('000,01');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Optional Tokens', () => {
    it('should skip optional tokens when not enough digits', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000.999-00', options, tokenRegistry);
      const result = processor.process('12345');

      expect(result.result).toBe('123.-45');
      expect(result.valid).toBe(true);
    });

    it('should use optional tokens when enough digits', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000.999-00', options, tokenRegistry);
      const result = processor.process('1234567');

      expect(result.result).toBe('123.45-67');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Recursive Tokens', () => {
    it('should handle recursive tokens', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('###.###', options, tokenRegistry);
      const result = processor.process('123456');

      expect(result.result).toBe('123.456');
      expect(result.valid).toBe(true);
    });

    it('should expand recursive tokens for longer values', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('###.###', options, tokenRegistry);
      const result = processor.process('123456789');

      expect(result.result).toBe('123.456789');
      expect(result.valid).toBe(true);
    });

    it('should handle short values with recursive tokens', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('###.###', options, tokenRegistry);
      const result = processor.process('12');

      expect(result.result).toBe('12');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Transform Functions', () => {
    it('should apply uppercase transformation', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('UUU-000', options, tokenRegistry);
      const result = processor.process('abc123');

      expect(result.result).toBe('ABC-123');
      expect(result.valid).toBe(true);
    });

    it('should apply lowercase transformation', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('LLL-000', options, tokenRegistry);
      const result = processor.process('ABC123');

      expect(result.result).toBe('abc-123');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Escape Characters', () => {
    it('should escape special characters in forward mode', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000$-0000', options, tokenRegistry);
      const result = processor.process('1234567');

      expect(result.result).toBe('123-4567');
      expect(result.valid).toBe(true);
    });

    it('should escape tokens in forward mode', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000$0', options, tokenRegistry);
      const result = processor.process('123');

      expect(result.result).toBe('1230');
      expect(result.valid).toBe(true);
    });

    it('should escape characters in reverse mode', () => {
      const options: MaskOptions = { reverse: true };
      const processor = new MaskProcessor('000$-00', options, tokenRegistry);
      const result = processor.process('12345');

      expect(result.result).toBe('123-45');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Default Values', () => {
    it('should use default values when enabled', () => {
      const options: MaskOptions = { reverse: false, useDefaults: true };
      const processor = new MaskProcessor('000-0000', options, tokenRegistry);
      const result = processor.process('123');

      expect(result.result).toBe('123-0000');
      expect(result.valid).toBe(true);
    });

    it('should not use default values when disabled', () => {
      const options: MaskOptions = { reverse: false, useDefaults: false };
      const processor = new MaskProcessor('000-0000', options, tokenRegistry);
      const result = processor.process('123');

      expect(result.result).toBe('123-');
      expect(result.valid).toBe(false);
    });
  });

  describe('process - Invalid Values', () => {
    it('should mark as invalid when non-digit in digit position', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('000-0000', options, tokenRegistry);
      const result = processor.process('12a4567');

      expect(result.valid).toBe(false);
    });

    it('should mark as invalid when letter in numeric-only mask', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('0000', options, tokenRegistry);
      const result = processor.process('abcd');

      expect(result.result).toBe('');
      expect(result.valid).toBe(false);
    });
  });

  describe('process - Complex Patterns', () => {
    it('should handle CPF pattern', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor(
        '000.000.000-00',
        options,
        tokenRegistry,
      );
      const result = processor.process('12345678901');

      expect(result.result).toBe('123.456.789-01');
      expect(result.valid).toBe(true);
    });

    it('should handle CNPJ pattern', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor(
        '00.000.000/0000-00',
        options,
        tokenRegistry,
      );
      const result = processor.process('12345678000199');

      expect(result.result).toBe('12.345.678/0001-99');
      expect(result.valid).toBe(true);
    });

    it('should handle CEP pattern', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('00000-000', options, tokenRegistry);
      const result = processor.process('12345678');

      expect(result.result).toBe('12345-678');
      expect(result.valid).toBe(true);
    });

    it('should handle credit card pattern', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor(
        '0000 0000 0000 0000',
        options,
        tokenRegistry,
      );
      const result = processor.process('1234567890123456');

      expect(result.result).toBe('1234 5678 9012 3456');
      expect(result.valid).toBe(true);
    });
  });

  describe('process - Alphanumeric Patterns', () => {
    it('should handle alphanumeric token', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('AAA-000', options, tokenRegistry);
      const result = processor.process('ABC123');

      expect(result.result).toBe('ABC-123');
      expect(result.valid).toBe(true);
    });

    it('should handle letter-only token', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('SSS-000', options, tokenRegistry);
      const result = processor.process('ABC123');

      expect(result.result).toBe('ABC-123');
      expect(result.valid).toBe(true);
    });

    it('should reject digits in letter-only position', () => {
      const options: MaskOptions = { reverse: false };
      const processor = new MaskProcessor('SSS', options, tokenRegistry);
      const result = processor.process('A1C');

      expect(result.valid).toBe(false);
    });
  });
});
