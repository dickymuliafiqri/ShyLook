import { DBShy } from "../index";
import { createWriteStream, unlinkSync } from "fs";
import { get } from "https";

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

export async function downloadFile(url: string, fileName: string) {
  const file = createWriteStream(fileName);
  return await new Promise(function (resolv, reject) {
    get(url, function (response: any) {
      response.pipe(file);
      file.on("finish", function () {
        file.close(); // close() is async
        resolv(0);
      });
    }).on("error", function (err: any) {
      // Handle errors
      unlinkSync(fileName); // Delete the file async. (But we don't check the result)
      console.error(err);
      reject(err);
    });
  });
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
