const ytdll = require("youtube-dl-exec");
const ffmpeg = require("@ffmpeg-installer/ffmpeg");
const prettyMs = require("pretty-ms");

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
if (!existsSync("./queue.json")) writeFileSync("./queue.json", "{}");
if (!existsSync("./server.json")) writeFileSync("./server.json", "{}");

export class Shy {
  async getMetadata(link: string) {
    const server = JSON.parse(readFileSync(`./server.json`).toString());
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
        if (i <= 0)
          metadata[
            "thumbnail"
          ] = `http://${server.host}/assets/broken_image.png`;
        if (!metadata["thumbnails"][i]["url"].match(/\.(webp)/i)) {
          metadata["thumbnail"] =
            metadata["thumbnails"][i]["url"].match(/(.+\.\w+)/i)[0];
          break;
        }
      }

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
      ffmpegLocation: ffmpeg.path,
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
      ffmpegLocation: ffmpeg.path,
    });

    this.writeLog(subprocess, id);
    this.flushFile(output);
  }

  private async flushFile(filePath: string) {
    setTimeout(() => {
      try {
        unlinkSync(filePath);
        console.log(`${filePath} has been successfully deleted!`);
      } catch (e) {
        console.error(e);
      }
    }, 21600000);
  }
}

(() => {
  import("./tele");
  // import("./wa");

  startServer();
})();
