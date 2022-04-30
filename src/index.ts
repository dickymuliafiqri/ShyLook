const ytdll = require("youtube-dl-exec");
const prettyMs = require("pretty-ms");
const requestImageSize = require("request-image-size");

import {
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  readFileSync,
} from "fs";
import { config } from "dotenv";
import { startServer } from "./server";

config({
  path: "./config.env",
});

const ytdl = ytdll.create("./bin/youtube-dlp");

if (!existsSync("./downloads")) mkdirSync("./downloads");
if (!existsSync("./log")) mkdirSync("./log");
if (!existsSync("./assets")) mkdirSync("./assets");
if (!existsSync("./queue.json")) writeFileSync("./queue.json", "{}");
if (!existsSync("./server.json")) writeFileSync("./server.json", "{}");

export class Shy {
  async getMetadata(link: string) {
    try {
      let metadata = await ytdl(link, {
        noCheckCertificate: true,
        noCallHome: true,
        noWarnings: true,
        dumpSingleJson: true,
        youtubeSkipDashManifest: true,
        retries: 3,
        referer: link,
      });
      metadata["duration"] = prettyMs(Number(metadata["duration"] || 0) * 1000);

      for (let i = metadata["thumbnails"].length - 1; i >= 0; i--) {
        if (!metadata["thumbnails"][i]["url"].match(/\.(webp)/i)) {
          metadata["thumbnail"] =
            metadata["thumbnails"][i]["url"].match(/(.+\.\w+)/i)[0];
          break;
        } else if (i <= 0) {
          metadata["thumbnail"] =
            "https://bitsofco.de/content/images/2018/12/broken-1.png";
        }
      }

      await requestImageSize(metadata["thumbnail"])
        .then((size: any) => {
          console.log(`IMAGE DATA: ${size.weight}x${size.height}/${size.type}`);
        })
        .catch((e: any) => {
          console.error(`ERROR GETTING IMAGE: ${e.message}`);

          if (e.message != "aborted")
            metadata["thumbnail"] =
              "https://bitsofco.de/content/images/2018/12/broken-1.png";
        });

      return metadata;
    } catch (e: any) {
      return e.message;
    }
  }

  private writeLog(subprocess: any, fileId: number | string) {
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

  getVideo(
    link: string,
    quality: string,
    fileName: string,
    id: number | string
  ) {
    const output: string = `./downloads/${fileName}.mp4`;
    const subprocess = ytdl.exec(link, {
      noCheckCertificate: true,
      format: `best[ext=mp4][height=${quality}]/best[height=${quality}]/best[height<=${quality}]/best`,
      recodeVideo: "mp4",
      output,
    });

    this.writeLog(subprocess, id);
    this.flushFile(output);
  }

  getAudio(link: string, fileName: string, id: number) {
    const output: string = `./downloads/${fileName}.mp3`;
    const subprocess = ytdl.exec(link, {
      noCheckCertificate: true,
      format: `bestaudio`,
      output,
      extractAudio: true,
      audioFormat: "mp3",
    });

    this.writeLog(subprocess, id);
    this.flushFile(output);
  }

  private async flushFile(filePath: string) {
    setTimeout(() => {
      try {
        unlinkSync(filePath);
        console.log(`[DELETE] SUCCESS: ${filePath}`);
      } catch (e: any) {
        console.log(`[DELETE] FAILED: ${filePath} (${e.message})`);
      }
    }, 21600000);
  }
}

(() => {
  import("./tele");
  import("./wa");

  startServer();
})();
