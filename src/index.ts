const ytdll = require("youtube-dl-exec");
const prettyMs = require("pretty-ms");
const requestImageSize = require("request-image-size");
const pm2 = require("pm2");

import { mkdirSync, existsSync, writeFileSync } from "fs";
import { config } from "dotenv";
import { startServer } from "./server";
import { flushFile, writeLog } from "./ext/fs_helper";
import update from "./update";

if (existsSync(`./config.env`)) {
  console.log("[INFO] - config.env found");
  config({
    path: "./config.env",
  });
}

const ytdl = ytdll.create("./bin/youtube-dlp");

if (!existsSync("./downloads")) mkdirSync("./downloads");
if (!existsSync("./log")) mkdirSync("./log");
if (!existsSync("./assets")) mkdirSync("./assets");
if (!existsSync("./queue.json")) writeFileSync("./queue.json", "{}");
if (!existsSync("./server.json")) writeFileSync("./server.json", "{}");

export class Shy {
  restart() {
    pm2.connect((e: Error) => {
      if (e) {
        console.error(e);
      }

      pm2.reload("shy", (e: Error) => {
        if (e) {
          console.error(e);
        }
      });
    });
  }

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
          metadata["thumbnail"] = metadata["thumbnails"][i]["url"].match(/(.+\.\w+)/i)[0];
          break;
        } else if (i <= 0) {
          metadata["thumbnail"] = "https://bitsofco.de/content/images/2018/12/broken-1.png";
        }
      }

      await requestImageSize(metadata["thumbnail"])
        .then((size: any) => {
          console.log(`IMAGE DATA: ${size.weight}x${size.height}/${size.type}`);
        })
        .catch((e: any) => {
          console.error(`ERROR GETTING IMAGE: ${e.message}`);

          if (e.message != "aborted") metadata["thumbnail"] = "https://bitsofco.de/content/images/2018/12/broken-1.png";
        });

      return metadata;
    } catch (e: any) {
      return e.message;
    }
  }

  /**
   * TODO
   *
   * - Delete canceled or error file/task
   */

  getVideo(link: string, quality: string, fileName: string, id: number | string) {
    const output: string = `./downloads/${fileName}.mp4`;
    const subprocess = ytdl.exec(link, {
      noCheckCertificate: true,
      format: `best[height=${quality}]/best[height<=${quality}]/best`,
      recodeVideo: "mp4",
      output,
    });

    writeLog(subprocess, id);
    flushFile(output);
  }

  getAudio(link: string, fileName: string, id: number) {
    const output: string = `./downloads/${fileName}.mp3`;
    const subprocess = ytdl.exec(link, {
      noCheckCertificate: true,
      format: `bestaudio/worst/best`,
      output,
      extractAudio: true,
      audioFormat: "mp3",
    });

    writeLog(subprocess, id);
    flushFile(output);
  }
}

(async () => {
  // Update from upstream repo
  await update().catch((e) => {
    console.error("[ERROR]: Fetch upstream repo...");
    console.error(e);
  });

  // Run bot
  import("./tele");

  // Run server
  startServer();
})();
