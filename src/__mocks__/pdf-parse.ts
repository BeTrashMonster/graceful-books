/**
 * Mock implementation of pdf-parse for browser builds
 *
 * The actual pdf-parse library is Node.js-only and doesn't work in browsers.
 * When PDF parsing is needed, we'll implement it with a browser-compatible
 * library like pdf.js from Mozilla.
 *
 * This mock allows the build to succeed without breaking.
 */

export default async function pdfParse(_buffer: Buffer | ArrayBuffer): Promise<{
  numpages: number;
  numrender: number;
  info: any;
  metadata: any;
  text: string;
  version: string;
}> {
  throw new Error(
    'PDF parsing is not yet implemented. This feature is planned for a future release.'
  );
}
