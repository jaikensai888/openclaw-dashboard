/**
 * File System Manager
 *
 * Provides secure file system operations with path validation
 * to ensure all operations are confined to allowed directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { pino } from 'pino';
import type { FilesystemConfig, FileInfo, FileContent } from '../types/index.js';
import { validatePath, getFileInfoAsync, formatSize } from '../utils/pathUtils.js';

// ============================================================
// Custom Errors
// ============================================================

/**
 * Error thrown when path validation fails
 */
export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/**
 * Error thrown when file operation fails
 */
export class FileOperationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'FileOperationError';
  }
}

/**
 * Error thrown when file size exceeds limit
 */
export class FileSizeExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileSizeExceededError';
  }
}

// ============================================================
// FileSystemManager Class
// ============================================================

/**
 * Manages file system operations with security constraints
 */
export class FileSystemManager {
  private readonly resolvedRoots: string[];

  constructor(
    private readonly config: FilesystemConfig,
    private readonly logger: pino.Logger
  ) {
    // Resolve all allowed roots to absolute paths at construction time
    this.resolvedRoots = config.allowedRoots.map((root) =>
      path.resolve(root)
    );

    this.logger.debug(
      { allowedRoots: this.resolvedRoots },
      'FileSystemManager initialized'
    );
  }

  // ============================================================
  // Path Validation Helper
  // ============================================================

  /**
   * Validate and resolve a path
   * @throws PathValidationError if path is invalid
   */
  private validateAndResolve(inputPath: string): string {
    const result = validatePath(inputPath, this.resolvedRoots);

    if (!result.valid) {
      this.logger.warn(
        { inputPath, error: result.error },
        'Path validation failed'
      );
      throw new PathValidationError(result.error);
    }

    return result.resolvedPath;
  }

  /**
   * Check file size against configured limit
   * @throws FileSizeExceededError if file is too large
   */
  private checkFileSize(filePath: string, stats: fs.Stats): void {
    const maxSize = this.config.maxFileSize ?? 10 * 1024 * 1024; // Default 10MB

    if (stats.size > maxSize) {
      throw new FileSizeExceededError(
        `File size (${formatSize(stats.size)}) exceeds maximum allowed size (${formatSize(maxSize)})`
      );
    }
  }

  // ============================================================
  // File Operations
  // ============================================================

  /**
   * Read file content
   *
   * @param inputPath - Path to the file (relative or absolute)
   * @returns File content
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if file cannot be read
   */
  async readFile(inputPath: string): Promise<FileContent> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath }, 'Reading file');

    try {
      // Check if file exists and get stats
      const stats = await fs.promises.stat(resolvedPath);

      if (!stats.isFile()) {
        throw new FileOperationError(`Path is not a file: ${inputPath}`);
      }

      // Check file size
      this.checkFileSize(resolvedPath, stats);

      // Read file content
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');

      return {
        path: inputPath,
        content,
        encoding: 'utf-8',
        truncated: false,
      };
    } catch (error) {
      if (error instanceof PathValidationError || error instanceof FileSizeExceededError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileOperationError(`File not found: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      throw new FileOperationError(
        `Failed to read file: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Write content to a file
   *
   * @param inputPath - Path to the file (relative or absolute)
   * @param content - Content to write
   * @param encoding - Content encoding (default: 'utf-8')
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if file cannot be written
   */
  async writeFile(inputPath: string, content: string, encoding: string = 'utf-8'): Promise<void> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath, encoding }, 'Writing file');

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(resolvedPath);
      await fs.promises.mkdir(parentDir, { recursive: true });

      // Write file
      await fs.promises.writeFile(resolvedPath, content, encoding as BufferEncoding);

      this.logger.info({ path: resolvedPath, size: content.length }, 'File written successfully');
    } catch (error) {
      if (error instanceof PathValidationError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
        throw new FileOperationError(`Cannot write to a directory: ${inputPath}`);
      }

      throw new FileOperationError(
        `Failed to write file: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a file
   *
   * @param inputPath - Path to the file (relative or absolute)
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if file cannot be deleted
   */
  async deleteFile(inputPath: string): Promise<void> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath }, 'Deleting file');

    try {
      // Check if it's a file
      const stats = await fs.promises.stat(resolvedPath);

      if (!stats.isFile()) {
        throw new FileOperationError(`Path is not a file: ${inputPath}`);
      }

      await fs.promises.unlink(resolvedPath);

      this.logger.info({ path: resolvedPath }, 'File deleted successfully');
    } catch (error) {
      if (error instanceof PathValidationError || error instanceof FileOperationError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileOperationError(`File not found: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      throw new FileOperationError(
        `Failed to delete file: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get file information
   *
   * @param inputPath - Path to the file or directory (relative or absolute)
   * @returns File information
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if file cannot be accessed
   */
  async stat(inputPath: string): Promise<FileInfo> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath }, 'Getting file stats');

    try {
      const info = await getFileInfoAsync(resolvedPath);
      return info;
    } catch (error) {
      if (error instanceof PathValidationError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileOperationError(`File or directory not found: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      throw new FileOperationError(
        `Failed to get file info: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a file or directory exists
   *
   * @param inputPath - Path to check (relative or absolute)
   * @returns True if exists, false otherwise
   */
  async exists(inputPath: string): Promise<boolean> {
    try {
      const resolvedPath = this.validateAndResolve(inputPath);
      await fs.promises.access(resolvedPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // Directory Operations
  // ============================================================

  /**
   * List directory contents
   *
   * @param inputPath - Path to the directory (relative or absolute)
   * @param recursive - Whether to list recursively (default: false)
   * @returns Array of file information
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if directory cannot be read
   */
  async listDirectory(inputPath: string, recursive: boolean = false): Promise<FileInfo[]> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath, recursive }, 'Listing directory');

    try {
      // Check if it's a directory
      const stats = await fs.promises.stat(resolvedPath);

      if (!stats.isDirectory()) {
        throw new FileOperationError(`Path is not a directory: ${inputPath}`);
      }

      const results: FileInfo[] = [];

      if (recursive) {
        await this.listDirectoryRecursive(resolvedPath, results);
      } else {
        const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(resolvedPath, entry.name);
          try {
            const info = await getFileInfoAsync(entryPath);
            results.push(info);
          } catch (error) {
            // Skip entries that can't be accessed
            this.logger.warn(
              { path: entryPath, error: error instanceof Error ? error.message : String(error) },
              'Skipping inaccessible entry'
            );
          }
        }
      }

      return results;
    } catch (error) {
      if (error instanceof PathValidationError || error instanceof FileOperationError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileOperationError(`Directory not found: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      throw new FileOperationError(
        `Failed to list directory: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Recursively list directory contents
   */
  private async listDirectoryRecursive(
    dirPath: string,
    results: FileInfo[]
  ): Promise<void> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      try {
        const info = await getFileInfoAsync(entryPath);
        results.push(info);

        // Recurse into directories
        if (entry.isDirectory()) {
          await this.listDirectoryRecursive(entryPath, results);
        }
      } catch (error) {
        // Skip entries that can't be accessed
        this.logger.warn(
          { path: entryPath, error: error instanceof Error ? error.message : String(error) },
          'Skipping inaccessible entry in recursive list'
        );
      }
    }
  }

  /**
   * Create a directory
   *
   * @param inputPath - Path to the directory to create (relative or absolute)
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if directory cannot be created
   */
  async createDirectory(inputPath: string): Promise<void> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath }, 'Creating directory');

    try {
      await fs.promises.mkdir(resolvedPath, { recursive: true });

      this.logger.info({ path: resolvedPath }, 'Directory created successfully');
    } catch (error) {
      if (error instanceof PathValidationError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new FileOperationError(`Directory already exists: ${inputPath}`);
      }

      throw new FileOperationError(
        `Failed to create directory: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a directory
   *
   * @param inputPath - Path to the directory to delete (relative or absolute)
   * @param recursive - Whether to delete recursively (default: false)
   * @throws PathValidationError if path is outside allowed roots
   * @throws FileOperationError if directory cannot be deleted
   */
  async deleteDirectory(inputPath: string, recursive: boolean = false): Promise<void> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug({ path: resolvedPath, recursive }, 'Deleting directory');

    try {
      // Check if it's a directory
      const stats = await fs.promises.stat(resolvedPath);

      if (!stats.isDirectory()) {
        throw new FileOperationError(`Path is not a directory: ${inputPath}`);
      }

      if (recursive) {
        await fs.promises.rm(resolvedPath, { recursive: true, force: false });
      } else {
        await fs.promises.rmdir(resolvedPath);
      }

      this.logger.info({ path: resolvedPath }, 'Directory deleted successfully');
    } catch (error) {
      if (error instanceof PathValidationError || error instanceof FileOperationError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileOperationError(`Directory not found: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FileOperationError(`Permission denied: ${inputPath}`);
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOTEMPTY') {
        throw new FileOperationError(
          `Directory is not empty. Use recursive=true to delete non-empty directories: ${inputPath}`
        );
      }

      throw new FileOperationError(
        `Failed to delete directory: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Get the list of allowed root directories
   */
  getAllowedRoots(): string[] {
    return [...this.resolvedRoots];
  }

  /**
   * Get the maximum allowed file size
   */
  getMaxFileSize(): number {
    return this.config.maxFileSize ?? 10 * 1024 * 1024;
  }
}
