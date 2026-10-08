/* eslint-disable */
/**
 * Auto-generated from schema/resume.schema.json. Do not edit directly.
 * Run `bun run generate` or `npm run generate` to regenerate.
 */

export interface ValidationError {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, unknown>;
  message?: string;
}

export interface ValidateFunction {
  (data: unknown): boolean;
  errors?: ValidationError[] | null;
}

export declare const validate: ValidateFunction;
export default validate;
