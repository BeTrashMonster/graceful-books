/**
 * Argon2 WASM Loader
 *
 * Loads argon2-browser from public/ via script tag to avoid bundler issues.
 * The bundled version (argon2-bundled.min.js) has WASM embedded as base64,
 * so it works in both dev and production without separate WASM file loading.
 *
 * WHY SCRIPT TAG INSTEAD OF IMPORT:
 * - Rollup/Vite cannot bundle argon2-browser's WASM correctly
 * - Dynamic import('argon2-browser') fails in production builds
 * - Loading via script tag bypasses the bundler entirely
 * - The bundled version has WASM inlined, so no separate fetch needed
 */

// Type for the argon2 module API
export interface Argon2Module {
  ArgonType: {
    Argon2d: 0;
    Argon2i: 1;
    Argon2id: 2;
  };
  hash: (options: {
    pass: string;
    salt: Uint8Array;
    time: number;
    mem: number;
    parallelism: number;
    hashLen: number;
    type: number;
  }) => Promise<{ hash: Uint8Array; hashHex: string }>;
  verify: (options: unknown) => Promise<boolean>;
  unloadRuntime: () => void;
}

// Lazy-loaded argon2 module
let argon2Module: Argon2Module | null = null;
let loadPromise: Promise<Argon2Module> | null = null;

/**
 * Load the argon2-browser module via script tag.
 * Safe to call multiple times - will only load once.
 *
 * Uses the bundled version from public/ which has WASM embedded as base64.
 * This bypasses Rollup/Vite bundling issues entirely.
 */
export async function loadArgon2(): Promise<Argon2Module> {
  // Already loaded
  if (argon2Module) {
    return argon2Module;
  }

  // Already loading
  if (loadPromise) {
    return loadPromise;
  }

  // Check if window.argon2 is already available (e.g., loaded by another script)
  if (typeof window !== 'undefined' && (window as any).argon2) {
    const argon2 = (window as any).argon2 as Argon2Module;
    if (typeof argon2.hash === 'function') {
      argon2Module = argon2;
      console.log('[Argon2] Module already available on window.argon2');
      return argon2;
    }
  }

  loadPromise = new Promise<Argon2Module>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Argon2 requires a browser environment'));
      return;
    }

    // Check if script is already in DOM (avoid duplicate loading)
    const existingScript = document.querySelector('script[data-argon2-loader]');
    if (existingScript) {
      // Wait for existing script to load
      const checkLoaded = setInterval(() => {
        if ((window as any).argon2) {
          clearInterval(checkLoaded);
          argon2Module = (window as any).argon2;
          console.log('[Argon2] Module loaded (waited for existing script)');
          resolve(argon2Module);
        }
      }, 50);
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkLoaded);
        if (!argon2Module) {
          reject(new Error('Timeout waiting for argon2 to load'));
        }
      }, 10000);
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = '/argon2-bundled.min.js';
    script.async = true;
    script.setAttribute('data-argon2-loader', 'true');

    script.onload = () => {
      const argon2 = (window as any).argon2 as Argon2Module | undefined;

      if (!argon2) {
        loadPromise = null;
        reject(new Error('argon2-bundled.min.js loaded but window.argon2 is undefined'));
        return;
      }

      if (typeof argon2.hash !== 'function') {
        loadPromise = null;
        console.error('[Argon2] window.argon2 structure:', Object.keys(argon2));
        reject(new Error(`argon2 loaded but hash is ${typeof argon2.hash}, not a function`));
        return;
      }

      argon2Module = argon2;
      console.log('[Argon2] Module loaded successfully via script tag');
      console.log('[Argon2] Available methods:', Object.keys(argon2));
      resolve(argon2);
    };

    script.onerror = (event) => {
      loadPromise = null;
      console.error('[Argon2] Script load failed:', event);
      reject(new Error('Failed to load argon2-bundled.min.js from /argon2-bundled.min.js'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Check if argon2-browser is loaded
 */
export function isArgon2Loaded(): boolean {
  return argon2Module !== null;
}

/**
 * Derive a key using Argon2id
 *
 * @throws Error if argon2-browser fails to load
 */
export async function deriveKeyArgon2id(
  password: string,
  salt: Uint8Array,
  options?: {
    memoryCost?: number; // KB, default 65536 (64MB)
    timeCost?: number;   // iterations, default 3
    parallelism?: number; // threads, default 4
    hashLength?: number; // bytes, default 32
  }
): Promise<{ hash: Uint8Array; hashHex: string }> {
  const argon2 = await loadArgon2();

  const result = await argon2.hash({
    pass: password,
    salt: salt,
    time: options?.timeCost ?? 3,
    mem: options?.memoryCost ?? 65536,
    parallelism: options?.parallelism ?? 4,
    hashLen: options?.hashLength ?? 32,
    type: argon2.ArgonType.Argon2id,
  });

  return {
    hash: result.hash,
    hashHex: result.hashHex,
  };
}
