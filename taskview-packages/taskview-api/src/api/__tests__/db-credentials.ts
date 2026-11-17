import fs from "fs";
import path from "path";

function readEnv(filePath: string) {
    const fullPath = path.resolve(__dirname, filePath);
    const content = fs.readFileSync(fullPath, "utf8");

    return Object.fromEntries(
        content
            .split("\n")
            .filter(Boolean)
            .filter(line => !line.startsWith("#"))
            .map(line => {
                const [key, ...rest] = line.split("=");
                return [key.trim(), rest.join("=").trim()];
            })
    );
}

// Lista 01 uses a separate scratch database. Keep the legacy file for the
// original test stack, but never consult it in the guarded scratch run.
export const DB_CREDENTIALS = process.env.L01_TEST_DB_ONLY === '1'
    ? {
        DB_HOST: '127.0.0.1',
        DB_PORT: '25432',
        DB_NAME: 'taskview_l01_scratch_20261114',
        DB_USER: 'taskview_l01_scratch',
        DB_PASSWORD: process.env.L01_TEST_DB_PASSWORD || '',
    }
    : readEnv(".env.for-test");
