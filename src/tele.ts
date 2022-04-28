import { Context, Telegraf, Markup } from "telegraf";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  statSync,
} from "fs";
import { Shy } from "./index";

interface ShyLook extends Context {
  queue?: string | any;
}

const isurl = require("is-url");
const slug = require("slug");
const isActive = require("is-running");
const byteSize = require("byte-size");
const bot = new Telegraf<ShyLook>(String(process.env.BOT_TOKEN));
const shy = new Shy();

const server = JSON.parse(readFileSync(`./server.json`).toString());

function getQueue() {
  return JSON.parse(readFileSync("./queue.json").toString());
}

function getMedia(ctx: any, isAudio?: boolean) {
  if (!ctx.from?.id) return;

  let format: string = isAudio ? ".mp3" : ".mp4";
  let queue = ctx.queue[String(ctx.from.id)];
  let caption = queue["caption"];
  const quality = ctx.match[1];
  const fileName: string = `shyLook-${slug(queue["title"]).substring(
    0,
    190
  )}-${quality}`;

  if (isAudio) {
    shy.getAudio(queue["webpage_url"], fileName, Number(ctx.from.id));
  } else {
    shy.getVideo(queue["webpage_url"], quality, fileName, Number(ctx.from.id));
  }

  const updateProgress = setInterval(async () => {
    let queue = getQueue()[String(ctx.from?.id)];
    if (existsSync(`./log/${ctx.from?.id}.json`)) {
      const log = JSON.parse(
        readFileSync(`./log/${ctx.from?.id}.json`).toString()
      );
      const msg = log.log;
      const code = log.code;

      try {
        await ctx.editMessageCaption(`${caption}\n\nProgress: ${msg}`, {
          // @ts-ignore
          message_id: queue?.message_id,
          ...Markup.inlineKeyboard([
            [Markup.button.callback("Cancel", "cancel")],
          ]),
        });
      } catch (e) {
        console.error(e);
      }

      if (!isNaN(code)) {
        if (code == 0) {
          await ctx.editMessageCaption(
            `${caption}\nSize: ${byteSize(
              statSync(`./downloads/${fileName}${format}`).size
            )}\nThis file will be deleted in 6 hrs`,
            {
              // @ts-ignore
              message_id: queue?.message_id,
              ...Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    "Download",
                    `http://${server.host}/?w=${fileName}${format}&dl=1`
                  ),
                ],
                [
                  Markup.button.url(
                    "Stream",
                    `http://${server.host}/?w=${fileName}${format}`
                  ),
                ],
              ]),
            }
          );
        } else {
          try {
            await ctx.editMessageCaption(`Problem during download\n\n${msg}`, {
              // @ts-ignore
              message_id: queue?.message_id,
              ...Markup.inlineKeyboard([]),
            });
          } catch (e) {
            console.error(e);
          }
        }

        delete ctx.queue[String(ctx.from?.id)];
        writeFileSync(`./queue.json`, JSON.stringify(ctx.queue, null, "\t"));
        clearInterval(updateProgress);
      }
    }
  }, 7000);
}

bot.use((ctx, next) => {
  const update: any = ctx.update;
  ctx.queue = getQueue();

  if (update.callback_query) {
    if (
      update.callback_query.from.id !=
      update.callback_query.message.reply_to_message.from.id
    )
      return ctx.answerCbQuery("Not your business 🤡");
  }

  next();
});

bot.start((ctx) => {
  return ctx.reply("Gimme a link!!!");
});

bot.on("text", async (ctx) => {
  const link: string = ctx.update.message.text;
  if (!isurl(link)) return ctx.reply("Send me a URL and i'll proceed that");

  console.log(`[TG] Link received: ${link}`);
  let metadata: any;

  ctx.replyWithChatAction("upload_photo");
  if (ctx.queue[ctx.from.id]) {
    const message_id = ctx.queue[ctx.from.id]["message_id"];
    if (existsSync(`./log/${ctx.from.id}.json`)) {
      const data = JSON.parse(
        readFileSync(`./log/${ctx.from.id}.json`).toString()
      );
      if (isActive(data["pid"])) {
        await ctx.reply("You already have an active task");

        await ctx
          .replyWithPhoto(ctx.queue[ctx.from.id]["thumbnail"], {
            caption: ctx.queue[ctx.from.id]["caption"],
            ...Markup.inlineKeyboard([
              [Markup.button.callback("Cancel", "cancel")],
            ]),
          })
          .then((r) => {
            ctx.queue[ctx.from.id]["message_id"] = r.message_id;
          });
      } else {
        unlinkSync(`./log/${ctx.from.id}.json`);
      }
    } else {
      await ctx.reply("You already have a pending task");

      await ctx
        .replyWithPhoto(ctx.queue[ctx.from.id]["thumbnail"], {
          caption: ctx.queue[ctx.from.id]["caption"],
          reply_to_message_id: ctx.update.message.message_id,
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("Video", "video"),
              Markup.button.callback("Audio", "audio"),
            ],
            [Markup.button.callback("Cancel", "cancel")],
          ]),
        })
        .then((r) => {
          ctx.queue[ctx.from.id]["message_id"] = r.message_id;
        });
    }
    try {
      await bot.telegram.deleteMessage(
        ctx.queue[ctx.from.id]["chat_id"],
        message_id
      );
    } catch (e) {
      console.error(e);
    }
    return writeFileSync("./queue.json", JSON.stringify(ctx.queue, null, "\t"));
  } else {
    metadata = await shy.getMetadata(link);
  }

  if (!metadata["title"]) {
    console.log(metadata);
    return ctx.reply(`Failed parsing video metadata\n\n${metadata}`);
  }

  let caption: string = `Title: ${metadata["title"]}\n`;
  caption += `Duration: ${metadata["duration"]}\n`;
  caption += `Views: ${metadata["view_count"]}\n`;
  caption += `Channel: ${metadata["channel"]}\n`;
  caption += `Source: ${metadata["extractor_key"]}\n`;
  caption += `Description: ${
    metadata["description"]
      ? metadata["description"].substring(0, 200) + "..."
      : "-"
  }`;

  for (let i = metadata["thumbnails"].length - 1; i >= 0; i--) {
    if (i <= 0)
      metadata["thumbnail"] =
        "https://bitsofco.de/content/images/2018/12/broken-1.png";
    if (!metadata["thumbnails"][i]["url"].match(/\.(webp)/i)) {
      metadata["thumbnail"] =
        metadata["thumbnails"][i]["url"].match(/(.+\.\w+)/i)[0];
      break;
    }
  }

  await ctx
    .replyWithPhoto(metadata["thumbnail"], {
      caption,
      reply_to_message_id: ctx.update.message.message_id,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("Video", "video"),
          Markup.button.callback("Audio", "audio"),
        ],
        [Markup.button.callback("Cancel", "cancel")],
      ]),
    })
    .then((r) => {
      ctx.queue[ctx.from.id] = metadata;
      ctx.queue[ctx.from.id]["message_id"] = r.message_id;
      ctx.queue[ctx.from.id]["reply_to_message_id"] =
        ctx.update.message.message_id;
      ctx.queue[ctx.from.id]["caption"] = caption;
      ctx.queue[ctx.from.id]["chat_id"] = r.chat.id;
      ctx.queue[ctx.from.id]["from_id"] = r.from?.id;
    });

  return writeFileSync("./queue.json", JSON.stringify(ctx.queue, null, "\t"));
});

bot.action("video", (ctx) => {
  let buttonRow: Array<Array<any>> = [[]];
  const formats: Array<number> = [];
  if (!ctx.from?.id) return;

  ctx.queue[String(ctx.from?.id)]["formats"].forEach((format: any) => {
    const height = format["height"];
    if (!(height == null)) {
      if (!formats.includes(height)) {
        formats.push(height);
      }
    }
  });

  let rowIndex: number = 0;
  formats.forEach((format) => {
    if (buttonRow[rowIndex]) {
      buttonRow[rowIndex] = [
        ...buttonRow[rowIndex],
        Markup.button.callback(`${format}p`, `v-${format}`),
      ];
    } else {
      buttonRow[rowIndex] = [
        Markup.button.callback(`${format}p`, `v-${format}`),
      ];
    }

    if (buttonRow[rowIndex].length > 2) rowIndex += 1;
  });

  return ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      ...buttonRow,
      [Markup.button.callback("Back", "menu")],
    ]).reply_markup
  );
});

bot.action(/^v-(\d+)/, (ctx) => {
  return getMedia(ctx);
});

bot.action(/^(audio)/, (ctx) => {
  return getMedia(ctx, true);
});

bot.action("menu", (ctx) => {
  return ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Video", "video"),
        Markup.button.callback("Audio", "audio"),
      ],
      [Markup.button.callback("Cancel", "cancel")],
    ]).reply_markup
  );
});

bot.action("cancel", (ctx) => {
  if (existsSync(`./log/${ctx.from?.id}.json`)) {
    let log = JSON.parse(readFileSync(`./log/${ctx.from?.id}.json`).toString());
    if (isActive(log["pid"])) process.kill(log["pid"], 1);

    log["log"] = "[Canceled] Download canceled";
    writeFileSync(
      `./log/${ctx.from?.id}.json`,
      JSON.stringify(log, null, "\t")
    );
  } else {
    if (ctx.queue[String(ctx.from?.id)]) {
      ctx.editMessageCaption(ctx.queue[String(ctx.from?.id)]["caption"], {
        ...Markup.inlineKeyboard([]),
      });

      delete ctx.queue[String(ctx.from?.id)];
      writeFileSync(`./queue.json`, JSON.stringify(ctx.queue, null, "\t"));
    } else {
      ctx.deleteMessage();
    }
  }
});

bot.launch().then(() => {
  console.log("Bot started...");
});
