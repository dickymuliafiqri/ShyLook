import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import { Shy } from "./index";
import {
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";

const ffmpeg = require("@ffmpeg-installer/ffmpeg");
const isurl = require("is-url");
const slug = require("slug");
const byteSize = require("byte-size");
const isActive = require("is-running");
const qrcode = require("qrcode");
const shy = new Shy();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox"],
  },
  ffmpegPath: ffmpeg.path,
});

client.initialize();

client.on("qr", (qr) => {
  console.log("[WA] GO TO /qrcode TO GET QRCODE");

  if (existsSync("./assets/qrcode.png")) unlinkSync("./assets/qrcode.png");

  qrcode.toFile("./assets/qrcode.png", qr, (e: any) => {
    if (e) console.error(e);
  });
});

client.on("authenticated", () => {
  console.log("[WA] AUTHENTICATED");
});

client.on("auth_failure", (msg) => {
  console.error("[WA] AUTHENTICATION FAILURE", msg);
});

client.on("ready", () => {
  console.log("[WA] READY");
});

function getMedia(
  msg: any,
  format: string,
  server: any,
  queue: any,
  isVideo?: boolean
) {
  const quality: string = msg.body.split(" ")[1];

  const fileName: string = `shyLook-${slug(queue[msg.from]["title"]).substring(
    0,
    190
  )}-${quality}`;

  if (isVideo) {
    shy.getVideo(queue[msg.from]["webpage_url"], quality, fileName, msg.from);
  } else {
    shy.getAudio(queue[msg.from]["webpage_url"], fileName, msg.from);
  }

  const updateProgress = setInterval(async () => {
    let queue = JSON.parse(readFileSync("./queue.json").toString());
    if (existsSync(`./log/${msg.from}.json`)) {
      const log = JSON.parse(readFileSync(`./log/${msg.from}.json`).toString());
      const progress = log.log;
      const code = log.code;

      try {
        await msg.reply(progress);
      } catch (e) {
        console.error(e);
      }

      if (!isNaN(code)) {
        if (code == 0) {
          await msg.reply(
            `File Name: ${fileName}${format}\nSize: ${byteSize(
              statSync(`./downloads/${fileName}${format}`).size
            )}\nThis file will be deleted in 6 hrs\n\nDownload:\nhttp://${
              server.host
            }/?w=${fileName}${format}&dl=1\n\nStream:\nhttp://${
              server.host
            }/?w=${fileName}${format}`,
            msg.from,
            {
              media: queue[msg.from]["media"],
            }
          );
        } else {
          await msg.reply(`Problem during download\n\n${msg}`);
        }

        delete queue[msg.from];
        writeFileSync(`./queue.json`, JSON.stringify(queue, null, "\t"));
        clearInterval(updateProgress);
      }
    }
  }, 7000);
}

client.on("message", async (msg) => {
  let format: string = ".mp4";
  const server = JSON.parse(readFileSync("./server.json").toString());
  let queue = JSON.parse(readFileSync("./queue.json").toString());

  if (msg.body.startsWith("!ping")) {
    await msg.reply("pong");
  } else if (msg.body.startsWith("!link")) {
    const link = msg.body.split(" ")[1];

    if (!isurl(link)) return await msg.reply("Not a valid link");
    console.log(`[WA] Link received: ${link}`);

    msg.reply("Please wait...");
    let metadata: any;

    if (queue[msg.from]) {
      if (existsSync(`./log/${msg.from}.json`)) {
        const log = JSON.parse(
          readFileSync(`./log/${msg.from}.json`).toString()
        );

        if (isActive(log["pid"])) {
          return await msg.reply(
            "You already have an active task\n\nSend !cancel to cancel your task"
          );
        } else {
          metadata = queue[msg.from];
        }
      } else {
        await msg.reply(
          "You already have a pending task\n\nSend !cancel to cancel your task"
        );
        metadata = queue[msg.from];
      }
    } else {
      metadata = await shy.getMetadata(link);
    }

    if (!metadata["title"]) {
      console.log(metadata);
      return await msg.reply(`Failed parsing video metadata\n\n${metadata}`);
    }

    const formats: Array<string> = [];
    metadata["formats"].forEach((format: any) => {
      const height = format["height"];
      if (!(height == null)) {
        if (!formats.includes(height)) {
          formats.push(height);
        }
      }
    });

    let caption: string = `
*MEDIA DETAILS*
Title: ${metadata["title"]}
Duration: ${metadata["duration"]}
Channel: ${metadata["channel"]}
Source: ${metadata["extractor_key"]}
Description: ${
      metadata["description"]
        ? metadata["description"].substring(0, 100) + "..."
        : "-"
    }
      
*FORMATS*
${formats.join(" | ")}
      
Answer this message with !video [FORMAT] or !audio to download the format you desire
    `;

    const media = await MessageMedia.fromUrl(metadata["thumbnail"], {
      unsafeMime: true,
    });

    await msg
      .reply(caption, msg.from, {
        media,
      })
      .then(() => {
        queue[msg.from] = metadata;
        queue[msg.from]["media"] = media;
        writeFileSync(`./queue.json`, JSON.stringify(queue, null, "\t"));
      });
  } else if (msg.body.startsWith("!video")) {
    if (!queue[msg.from]) return await msg.reply("You have no task");
    getMedia(msg, format, server, queue, true);
  } else if (msg.body.startsWith("!audio")) {
    format = ".mp3";
    if (!queue[msg.from]) return await msg.reply("You have no task");
    getMedia(msg, format, server, queue, false);
  } else if (msg.body.startsWith("!cancel")) {
    if (existsSync(`./log/${msg.from}.json`)) {
      const log = JSON.parse(readFileSync(`./log/${msg.from}.json`).toString());

      if (isActive(log["pid"])) process.kill(log["pid"]);
      unlinkSync(`./log/${msg.from}.json`);
    }

    delete queue[msg.from];
    writeFileSync("./queue.json", JSON.stringify(queue, null, "\t"));

    await msg.reply("Your task has been successfully canceled");
  }
});
