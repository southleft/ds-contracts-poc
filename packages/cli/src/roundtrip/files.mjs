import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const fileHash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
