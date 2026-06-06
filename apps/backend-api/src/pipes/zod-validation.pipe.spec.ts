import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const simpleSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it('should pass valid data through unchanged', () => {
    const pipe = new ZodValidationPipe(simpleSchema);
    const validData = { name: 'Alice', age: 30 };

    const result = pipe.transform(validData, {} as any);

    expect(result).toEqual(validData);
  });

  it('should throw BadRequestException for invalid data', () => {
    const pipe = new ZodValidationPipe(simpleSchema);
    const invalidData = { name: '', age: -5 };

    expect(() => pipe.transform(invalidData, {} as any)).toThrow(BadRequestException);
  });

  it('should include field paths and messages in error response', () => {
    const pipe = new ZodValidationPipe(simpleSchema);
    const invalidData = { name: '', age: 'not-a-number' };

    try {
      pipe.transform(invalidData, {} as any);
      expect.fail('Should have thrown BadRequestException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse();
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Validation failed');
      expect(response.errors).toBeInstanceOf(Array);
      expect(response.errors.length).toBeGreaterThan(0);
    }
  });

  it('should handle missing required fields', () => {
    const pipe = new ZodValidationPipe(simpleSchema);
    const incompleteData = { name: 'Bob' };

    try {
      pipe.transform(incompleteData, {} as any);
      expect.fail('Should have thrown BadRequestException');
    } catch (error: any) {
      const response = error.getResponse();
      expect(response.errors.some((e: string) => e.includes('age'))).toBe(true);
    }
  });

  it('should handle nested object validation', () => {
    const nestedSchema = z.object({
      user: z.object({
        email: z.string().email(),
        profile: z.object({
          bio: z.string().max(100),
        }),
      }),
    });

    const pipe = new ZodValidationPipe(nestedSchema);
    const invalidData = {
      user: {
        email: 'not-an-email',
        profile: { bio: 'x'.repeat(101) },
      },
    };

    try {
      pipe.transform(invalidData, {} as any);
      expect.fail('Should have thrown BadRequestException');
    } catch (error: any) {
      const response = error.getResponse();
      expect(response.errors.some((e: string) => e.includes('user.email'))).toBe(true);
      expect(response.errors.some((e: string) => e.includes('user.profile.bio'))).toBe(true);
    }
  });

  it('should handle array validation', () => {
    const arraySchema = z.object({
      tags: z.array(z.string().min(1)).min(1),
    });

    const pipe = new ZodValidationPipe(arraySchema);
    const validData = { tags: ['tag1', 'tag2'] };

    const result = pipe.transform(validData, {} as any);
    expect(result).toEqual(validData);
  });

  it('should handle custom refinements', () => {
    const refinedSchema = z.object({
      password: z.string().min(8),
      confirmPassword: z.string(),
    }).refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords must match',
      path: ['confirmPassword'],
    });

    const pipe = new ZodValidationPipe(refinedSchema);
    const mismatchData = { password: 'password123', confirmPassword: 'different' };

    try {
      pipe.transform(mismatchData, {} as any);
      expect.fail('Should have thrown BadRequestException');
    } catch (error: any) {
      const response = error.getResponse();
      expect(response.errors.some((e: string) => e.includes('Passwords must match'))).toBe(true);
    }
  });

  it('should coerce types when schema uses transformations', () => {
    const coerceSchema = z.object({
      count: z.coerce.number(),
    });

    const pipe = new ZodValidationPipe(coerceSchema);
    const stringData = { count: '42' };

    const result = pipe.transform(stringData, {} as any);
    expect(result).toEqual({ count: 42 });
  });

  it('should handle optional fields correctly', () => {
    const optionalSchema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const pipe = new ZodValidationPipe(optionalSchema);
    const dataWithoutOptional = { required: 'value' };

    const result = pipe.transform(dataWithoutOptional, {} as any);
    expect(result).toEqual({ required: 'value' });
  });
});
