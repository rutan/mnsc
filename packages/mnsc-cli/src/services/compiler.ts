import { type ParseOptions, parse } from '@rutan/mnsc';
import { type Logger, parseError, readFileContent } from '../utils';

export interface CompileOptions extends ParseOptions {
  logger?: Logger;
  pretty?: boolean;
  output?: string;
}

export interface CompileResult {
  file: string;
  success: boolean;
  result?: string;
  error?: Error;
}

export function compile(content: string, options: CompileOptions = {}): string {
  const { logger, includeLoc = false, pretty = false } = options;
  try {
    logger?.verbose('Parsing MNSC content...');
    const ast = parse(content, {
      includeLoc,
    });

    logger?.verbose('Converting to JSON...');
    return JSON.stringify(ast, null, pretty ? 2 : 0);
  } catch (error) {
    if (error instanceof Error) {
      throw parseError(error.message, undefined, { originalError: error });
    }
    throw error;
  }
}

export async function compileFile(filePath: string, options: CompileOptions = {}): Promise<string> {
  options.logger?.verbose?.(`Compiling file: ${filePath}`);

  const content = await readFileContent(filePath, options.logger);
  try {
    return compile(content, options);
  } catch (error) {
    if (error instanceof Error) {
      throw parseError(error.message, filePath, { originalError: error });
    }
    throw error;
  }
}

export async function compileBatch(files: string[], options: CompileOptions = {}): Promise<CompileResult[]> {
  options.logger?.verbose?.(`Batch compiling ${files.length} files...`);

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const result = await compileFile(file, options);
        return {
          file,
          success: true,
          result,
        };
      } catch (error) {
        return {
          file,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }),
  );

  return results;
}

export function validate(content: string, options: CompileOptions = {}): boolean {
  try {
    parse(content, {
      includeLoc: options.includeLoc ?? false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function validateFile(filePath: string, options: CompileOptions = {}): Promise<boolean> {
  try {
    const content = await readFileContent(filePath, options.logger);
    return validate(content, options);
  } catch {
    return false;
  }
}
