const ytdll = require("youtube-dl-exec");
const prettyMs = require("pretty-ms");
const requestImageSize = require("request-image-size");
const pm2 = require("pm2");
const percentage = require('calculate-percentages');
const byteSize = require("byte-size");
const si = require("systeminformation");

import {
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  readFileSync,
} from "fs";
import { config } from "dotenv";
import { startServer } from "./server";

if (existsSync("./config.env")) {
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

  async systemInfo() {
    let info:string = ""

    // Get system info
    const system = await si.system();
    const os = await si.osInfo();
    const time = await si.time();
    const cpu = await si.cpu();
    const cpuSpeed = await si.cpuCurrentSpeed();
    const mem = await si.mem();
    const fsSize = await (async () => {
        const fsSize = await si.fsSize();
        
        for (let f of fsSize) {
            if (f.mount === "/") return f
        }
    })();

    // Build system info
    info += `OS: ${os.platform}\n`
    info += `Uptime: ${prettyMs(time.uptime || 0 * 1000)}\n`
    info += `Is Virtual: ${system.virtual}\n\n`
    info += `CPU: ${cpu.manufacturer} ${cpu.brand}\n`;
    info += `Speed: ${cpu.speedMin}/${cpu.speed}/${cpu.speedMax} GHz\n`;
    info += `Load: ${(():string => {
      const pr = this.progressBar(cpuSpeed.avg || 0, cpuSpeed.max || 10);
      return `${pr.progressString} | ${pr.percent}%\n\n`;
    })()}`
    info += `Memory: ${byteSize(mem.total || 0)}\n`;
    info += `Available: ${byteSize(mem.available || 0)}\n`;
    info += `Load: ${(():string => {
      const pr = this.progressBar(mem.active || 0, mem.total || 10);
      return `${pr.progressString} | ${pr.percent}%\n\n`;
    })()}`
    info += `Swap: ${byteSize(mem.swaptotal || 0)}\n`;
    info += `Load: ${(():string => {
      const pr = this.progressBar(mem.swapused || 0, mem.swaptotal || 10);
      return `${pr.progressString} | ${pr.percent}%\n\n`;
    })()}`
    info += `Disk: ${fsSize.fs}\n`;
    info += `Type: ${fsSize.type}\n`;
    info += `Size: ${byteSize(fsSize.size || 0)}\n`;
    info += `Available: ${byteSize(fsSize.available || 0)}\n`
    info += `Used: ${(():string => {
      const pr = this.progressBar(fsSize.used || 0, fsSize.size || 10);
      return `${pr.progressString} | ${pr.percent}%`;
    })()}`

    return info;
  }

  progressBar(current:number|string, max:number|string): {
    progressString: string,
    percent: string
  } {
    const percent:string = percentage.calculate(current, max).toFixed(2);
    const fixNum:number = Math.round(Number(percent))/10;

    let progressString:string = "";
    for (let i = 1; i <= 10; i++) {
        if (i <= fixNum) progressString += "█";
        else progressString += "░"
    }

    return {
      progressString,
      percent
    };
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
      format: `best[height=${quality}]/best[height<=${quality}]/best`,
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
      format: `bestaudio/worst/best`,
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

  startServer();
})();
