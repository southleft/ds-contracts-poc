/** Types for scripts/build-plugin-zip.mjs (imported by playground/vite.config.ts
 *  and scripts/plugin-engine-check.mjs). */
export declare const ZIP_BASENAME: string;
export declare function verifyEmbeddedDumpSource(): Promise<void>;
export declare function buildEngineBundle(): Promise<{
  code: string;
  inputHash: string;
  minifiedBytes: number;
  inputFiles: number;
  esbuildVersion: string;
}>;
export declare function verifyEngineReceipt(
  bundle: { inputHash: string; minifiedBytes: number; inputFiles: number; esbuildVersion: string },
  opts?: { update?: boolean },
): Promise<void>;
export declare function injectEngine(uiHtml: string, engineCode: string): string;
export declare function buildPluginZip(
  outFile?: string,
  opts?: { updateEngineReceipt?: boolean },
): Promise<{ outFile: string; bytes: number; files: number; engineBytes: number }>;
