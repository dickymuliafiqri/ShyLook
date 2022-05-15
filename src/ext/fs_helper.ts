import { readFileSync, unlinkSync, writeFileSync } from "fs";

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

export function writeLog(subprocess: any, fileId: number | string) {
  subprocess.stdout.on("data", (data: string) => {
    writeFileSync(
      `./log/${fileId}.json`,
      JSON.stringify(
        {
          pid: subprocess.pid,
          log: data.toString(),
        },
        null,
        "\t"
      )
    );
  });
  subprocess.stderr.on("data", (data: string) => {
    writeFileSync(
      `./log/${fileId}.json`,
      JSON.stringify(
        {
          pid: subprocess.pid,
          log: data.toString(),
        },
        null,
        "\t"
      )
    );
  });
  subprocess.on("close", (code: any) => {
    const data = JSON.parse(readFileSync(`./log/${fileId}.json`).toString());

    writeFileSync(
      `./log/${fileId}.json`,
      JSON.stringify(
        {
          ...data,
          code,
        },
        null,
        "\t"
      )
    );
  });
}
