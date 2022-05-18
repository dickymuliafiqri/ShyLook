import { unlinkSync } from "fs";
import { DBShy } from "../index";

/**
 * TODO
 *
 * - Delete oldest file when run out of storage
 */

export async function flushFile(filePath: string) {
  setTimeout(() => {
    try {
      unlinkSync(filePath);
      console.log(`[DELETE] SUCCESS: ${filePath}`);
    } catch (e: any) {
      console.log(`[DELETE] FAILED: ${filePath} (${e.message})`);
    }
  }, 21600000);
}

export function writeLog(subprocess: any, uid: number | string) {
  subprocess.stdout.on("data", async (data: string) => {
    await DBShy.run(`UPDATE queue SET msg = ?, pid = ? WHERE uid = ?;`, [data.toString(), subprocess.pid, uid]);
  });

  subprocess.stderr.on("data", async (data: string) => {
    await DBShy.run(`UPDATE queue SET msg = ?, pid = ? WHERE uid = ?;`, [data.toString(), subprocess.pid, uid]);
  });

  subprocess.on("close", async (code: number) => {
    await DBShy.run(`UPDATE queue SET error_code = ? WHERE uid = ?;`, [code, uid]);
  });
}
