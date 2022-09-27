const ytdll = require("youtube-dl-exec");
const prettyMs = require("pretty-ms");
const requestImageSize = require("request-image-size");
const pm2 = require("pm2");

import { mkdirSync, existsSync } from "fs";
import { config } from "dotenv";
import { startServer } from "./server";
import { DB } from "./ext/db";
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
if (!existsSync("./db")) mkdirSync("./db");

export const DBShy = new DB();

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
        cookies: process.env.COOKIES ? `${process.cwd()}/cookies.txt` : "",
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

  getVideo(link: string, fileName: string, id: number | string, fileId: number) {
    const subprocess = ytdl.exec(link, {
      noCheckCertificate: true,
      format: `best`,
      recodeVideo: "mp4",
      output: `./downloads/${fileId}/${fileName}.mp4`,
      cookies: `${process.cwd()}/cookies.txt`,
      concurrentFragments: 3,
    });

    writeLog(subprocess, id);
    flushFile(`./downloads/${fileName}.mp4`);
  }

  getAudio(link: string, fileName: string, id: number, fileId: number) {
    const subprocess = ytdl.exec(link, {
      noCheckCertificate: true,
      format: `bestaudio/worst/best`,
      output: `./downloads/${fileId}/${fileName}.mp3`,
      extractAudio: true,
      audioFormat: "mp3",
      cookies: `${process.cwd()}/cookies.txt`,
      concurrentFragments: 3,
    });

    writeLog(subprocess, id);
    flushFile(`./downloads/${fileName}.mp3`);
  }
}

(async () => {
  // Initialize database
  await DBShy.initialize();

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
