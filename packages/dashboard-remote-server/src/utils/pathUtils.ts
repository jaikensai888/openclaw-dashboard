/**
 * Path Utilities for File System Operations
 *
 * Provides path normalization, validation, and file info utilities
 * with security checks to prevent path traversal attacks.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { FileInfo, FileType } from '../types/index.js';

// ============================================================
// Path Normalization
// ============================================================

/**
 * Normalize and resolve a path to its absolute form
 *
 * @param inputPath - The path to normalize
 * @returns Normalized absolute path
 */
export function normalizePath(inputPath: string): string {
  // Normalize the path (resolve .. and . segments)
  let normalized = path.normalize(inputPath);

  // Resolve to absolute path
  normalized = path.resolve(normalized);

  return normalized;
}

// ============================================================
// Path Validation
// ============================================================

/**
 * Validate that a path is within one of the allowed root directories
 *
 * This prevents path traversal attacks by ensuring the resolved path
 * is contained within an allowed root directory.
 *
 * @param inputPath - The path to validate
 * @param allowedRoots - Array of allowed root directory paths
 * @returns Object with validation result
 */
export function validatePath(
  inputPath: string,
  allowedRoots: string[]
): { valid: true; resolvedPath: string } | { valid: false; error: string } {
  // Normalize and resolve the input path
  const resolvedPath = normalizePath(inputPath);

  // Resolve all allowed roots to absolute paths
  const resolvedRoots = allowedRoots.map((root) => normalizePath(root));

  // Check if the resolved path starts with any of the allowed roots
  for (const root of resolvedRoots) {
    // Ensure the root ends with a separator for proper comparison
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;

    // Check if path is exactly the root or starts with root + separator
    if (resolvedPath === root || resolvedPath.startsWith(rootWithSep)) {
      return { valid: true, resolvedPath };
    }
  }

  // Path is not within any allowed root
  return {
    valid: false,
    error: 'Path is outside of allowed directories',
  };
}

// ============================================================
// File Information
// ============================================================

/**
 * Get file type from stats
 */
function getFileType(stats: fs.Stats, filePath: string): FileType {
  if (stats.isDirectory()) {
    return 'directory';
  }
  if (stats.isSymbolicLink()) {
    return 'symlink';
  }
  return 'file';
}

/**
 * Check if a file is likely a text file based on extension
 */
function isTextFile(filePath: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
    '.html', '.css', '.scss', '.less', '.xml', '.yaml', '.yml',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h',
    '.sh', '.bash', '.zsh', '.fish',
    '.sql', '.graphql', '.proto',
    '.toml', '.ini', '.cfg', '.conf', '.env',
    '.log', '.csv', '.tsv',
    '.astro', '.vue', '.svelte',
    '.prisma', '.sol', '.wasm',
  ];

  const ext = path.extname(filePath).toLowerCase();
  return textExtensions.includes(ext);
}

/**
 * Get file information
 *
 * @param filePath - Absolute path to the file
 * @returns FileInfo object with file metadata
 * @throws Error if file does not exist or cannot be accessed
 */
export function getFileInfo(filePath: string): FileInfo {
  const stats = fs.statSync(filePath);

  return {
    path: filePath,
    absolutePath: filePath,
    type: getFileType(stats, filePath),
    size: stats.size,
    modifiedAt: stats.mtime,
    mode: stats.mode,
    isText: stats.isFile() ? isTextFile(filePath) : undefined,
  };
}

/**
 * Get file information asynchronously
 *
 * @param filePath - Absolute path to the file
 * @returns FileInfo object with file metadata
 */
export async function getFileInfoAsync(filePath: string): Promise<FileInfo> {
  const stats = await fs.promises.stat(filePath);

  return {
    path: filePath,
    absolutePath: filePath,
    type: getFileType(stats, filePath),
    size: stats.size,
    modifiedAt: stats.mtime,
    mode: stats.mode,
    isText: stats.isFile() ? isTextFile(filePath) : undefined,
  };
}

// ============================================================
// Size Formatting
// ============================================================

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Human-readable size string (e.g., "1.5 MB")
 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];

  if (bytes === 0) {
    return '0 B';
  }

  const absBytes = Math.abs(bytes);
  const sign = bytes < 0 ? '-' : '';

  let unitIndex = 0;
  let size = absBytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Format with appropriate decimal places
  const formatted = unitIndex === 0
    ? size.toString()
    : size.toFixed(1);

  return `${sign}${formatted} ${units[unitIndex]}`;
}
