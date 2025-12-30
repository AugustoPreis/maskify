# Maskable

A simple and powerful string masking library for formatting phone numbers, credit cards, dates, and more.

> **Note:** This project is a rewrite of the [string-mask](https://github.com/the-darc/string-mask) dependency.

## Installation

```bash
npm install maskable
```

## Quick Start

```typescript
import { StringMasker } from 'maskable';

// Format a phone number
const phoneMasker = new StringMasker('(000) 000-0000');
console.log(phoneMasker.apply('1234567890'));
// Output: (123) 456-7890
```

## How to Use

### Available Mask Tokens

Use these characters in your mask patterns:

| Token | What it matches    | Example               |
| ----- | ------------------ | --------------------- |
| `0`   | Numbers (0-9)      | `000-000` → `123-456` |
| `9`   | Optional numbers   | `(00) 9000-0000`      |
| `A`   | Uppercase letters  | `AAA` → `ABC`         |
| `a`   | Lowercase letters  | `aaa` → `abc`         |
| `S`   | Any letter         | `SSS` → `AbC`         |
| `#`   | Letters or numbers | `###` → `A1b`         |

### Basic Formatting

Apply masks to format your strings:

```typescript
import { StringMasker } from 'maskable';

// Phone number
const phoneMasker = new StringMasker('(000) 000-0000');
console.log(phoneMasker.apply('1234567890'));
// Output: (123) 456-7890

// Credit card
const cardMasker = new StringMasker('0000 0000 0000 0000');
console.log(cardMasker.apply('1234567890123456'));
// Output: 1234 5678 9012 3456

// Date
const dateMasker = new StringMasker('00/00/0000');
console.log(dateMasker.apply('25122024'));
// Output: 25/12/2024
```

### Validate Input

Check if your input matches the mask pattern:

```typescript
const masker = new StringMasker('000-0000');

console.log(masker.validate('1234567')); // true
console.log(masker.validate('12345')); // false
```

### One-Time Use

No need to create an instance for single use:

```typescript
const formatted = StringMasker.apply('1234567890', '(000) 000-0000');
console.log(formatted); // (123) 456-7890
```

### Currency Formatting

Use reverse mode for currency and numbers:

```typescript
const moneyMasker = new StringMasker('000,000.00', { reverse: true });

console.log(moneyMasker.apply('123456')); // 001,234.56
console.log(moneyMasker.apply('1234567')); // 012,345.67
```

### Custom Patterns

Create your own mask tokens:

```typescript
import { StringMasker, createTokenRegistry } from 'maskable';

const customTokens = createTokenRegistry({
  H: {
    pattern: /[0-9A-F]/,
    transform: (char) => char.toUpperCase(),
  },
});

const hexMasker = new StringMasker('HH:HH:HH', {}, customTokens);
console.log(hexMasker.apply('1a2b3c')); // 1A:2B:3C
```
