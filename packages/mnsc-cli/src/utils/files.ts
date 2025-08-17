import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileNotFoundError, writeError } from './errors';
import type { Logger } from './logger';

export async function readFileContent(filePath: string, logger?: Logger): Promise<string> {
  try {
    const absolutePath = resolve(filePath);
    logger?.verbose(`Reading file: ${absolutePath}`);
    const content = await readFile(absolutePath, 'utf-8');
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw fileNotFoundError(filePath);
    }
    throw error;
  }
}

export async function writeFileContent(
  filePath: string,
  content: string,
  options: { createDir?: boolean; logger?: Logger } = {},
): Promise<void> {
  try {
    const absolutePath = resolve(filePath);

    if (options.createDir) {
      const dir = dirname(absolutePath);
      await mkdir(dir, { recursive: true });
    }

    options.logger?.verbose(`Writing file: ${absolutePath}`);
    await writeFile(absolutePath, content, 'utf-8');
  } catch (error) {
    throw writeError(filePath, { error });
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function generateOutputPath(
  inputPath: string,
  outputOption?: string,
  options: { preservePath?: boolean; outputDir?: string; extension?: string } = {},
): string {
  const { preservePath = false, outputDir, extension = '.json' } = options;

  // 明示的な出力パスが指定されている場合
  if (outputOption && !outputDir) {
    return resolve(outputOption);
  }

  // 出力ディレクトリが指定されている場合
  if (outputDir) {
    if (preservePath) {
      const relativePath = relative(process.cwd(), inputPath);
      const outputPath = join(outputDir, relativePath);
      return outputPath.replace(/\.[^.]+$/, extension);
    }

    const fileName = basename(inputPath).replace(/\.[^.]+$/, extension);
    if (!fileName) {
      throw new Error(`Invalid input path: ${inputPath}`);
    }
    return join(outputDir, fileName);
  }

  return inputPath.replace(/\.[^.]+$/, extension);
}

export async function safeWriteFile(
  filePath: string,
  content: string,
  options: { force?: boolean; createDir?: boolean; logger?: Logger } = {},
): Promise<boolean> {
  const exists = await fileExists(filePath);

  if (exists && !options.force) return false;

  await writeFileContent(filePath, content, {
    createDir: options.createDir,
    logger: options.logger,
  });

  return true;
}
