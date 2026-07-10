/** Types for scripts/build-plugin-zip.mjs (imported by playground/vite.config.ts). */
export declare const ZIP_BASENAME: string;
export declare function verifyEmbeddedDumpSource(): Promise<void>;
export declare function buildPluginZip(
  outFile?: string,
): Promise<{ outFile: string; bytes: number; files: number }>;
