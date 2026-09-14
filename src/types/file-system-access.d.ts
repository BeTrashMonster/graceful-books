/**
 * Type declarations for File System Access API
 *
 * These APIs are available in Chromium-based browsers but not yet
 * fully included in TypeScript's DOM lib.
 *
 * References:
 * - https://wicg.github.io/file-system-access/
 * - https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

/**
 * Options for the file picker
 */
interface OpenFilePickerOptions {
  /** Whether to allow multiple file selection */
  multiple?: boolean;
  /** Exclude all files except those matching these criteria */
  types?: FilePickerAcceptType[];
  /** Whether to exclude accept-all option */
  excludeAcceptAllOption?: boolean;
  /** A well-known directory or file handle to start in */
  startIn?: FileSystemHandle | WellKnownDirectory;
  /** ID to remember picker location */
  id?: string;
}

/**
 * Options for the save file picker
 */
interface SaveFilePickerOptions {
  /** Exclude all files except those matching these criteria */
  types?: FilePickerAcceptType[];
  /** Whether to exclude accept-all option */
  excludeAcceptAllOption?: boolean;
  /** Suggested name for the file */
  suggestedName?: string;
  /** A well-known directory or file handle to start in */
  startIn?: FileSystemHandle | WellKnownDirectory;
  /** ID to remember picker location */
  id?: string;
}

/**
 * Options for the directory picker
 */
interface DirectoryPickerOptions {
  /** ID to remember picker location */
  id?: string;
  /** The mode (read or readwrite) */
  mode?: 'read' | 'readwrite';
  /** A well-known directory or file handle to start in */
  startIn?: FileSystemHandle | WellKnownDirectory;
}

/**
 * File type criteria for pickers
 */
interface FilePickerAcceptType {
  /** Description shown to user */
  description?: string;
  /** Map of MIME types to file extensions */
  accept: Record<string, string[]>;
}

/**
 * Well-known directory identifiers
 */
type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

/**
 * Extended Window interface with File System Access API methods
 */
interface Window {
  /**
   * Show a file picker that lets users select one or more files
   */
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;

  /**
   * Show a file picker that lets users save a file
   */
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

  /**
   * Show a directory picker that lets users select a directory
   */
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

/**
 * Extended FileSystemDirectoryHandle with iteration support
 */
interface FileSystemDirectoryHandle {
  /**
   * Returns an async iterator of [name, handle] pairs for all entries
   */
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;

  /**
   * Returns an async iterator of all entry keys (names)
   */
  keys(): AsyncIterableIterator<string>;

  /**
   * Returns an async iterator of all entry handles
   */
  values(): AsyncIterableIterator<FileSystemHandle>;
}
