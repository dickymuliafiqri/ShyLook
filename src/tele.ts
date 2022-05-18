import { systemInfo, progressBar } from "./ext/msg_helper";
import { Telegraf, Markup } from "telegraf";
import { statSync } from "fs";
import { Shy, DBShy } from "./index";

const isurl = require("is-url");
const slug = require("slug");
const isActive = require("is-running");
const byteSize = require("byte-size");
const bot = new Telegraf(String(process.env.BOT_TOKEN));
const shy = new Shy();

async function getMedia(ctx: any, isAudio?: boolean) {
  if (!ctx.from?.id) return;

  const data = await DBShy.get(`SELECT * FROM queue WHERE uid = ?;`, ctx.from?.id);
  let format: string = isAudio ? ".mp3" : ".mp4";
  const quality = ctx.match[1];
  const fileName: string = `shyLook-${slug(data["metadata"]["title"]).substring(0, 190)}-${quality}`;

  if (isAudio) {
    shy.getAudio(data["metadata"]["webpage_url"], fileName, Number(ctx.from.id));
  } else {
    shy.getVideo(data["metadata"]["webpage_url"], quality, fileName, Number(ctx.from.id));
  }

  const updateProgress = setInterval(async () => {
    const data = await DBShy.get(`SELECT * FROM queue WHERE uid = ?;`, ctx.from?.id);
    if (data) {
      const msg = data.msg;
      const error_code = data.error_code;

      try {
        await ctx.editMessageCaption(`${data.caption}\n\nProgress: ${msg}\n\n${await systemInfo(true)}`, {
          message_id: data.message_id,
          ...Markup.inlineKeyboard([[Markup.button.callback("Cancel", "cancel")]]),
        });
      } catch (e: any) {
        console.error(`[TG] UPDATE ERROR: ${e.message}`);
      }

      if (!isNaN(error_code)) {
        if (error_code == 0) {
          await ctx.editMessageCaption(
            `${data.caption}\nSize: ${byteSize(
              statSync(`./downloads/${fileName}${format}`).size
            )}\nThis file will be deleted in 6 hrs`,
            {
              message_id: data.message_id,
              ...Markup.inlineKeyboard([
                [Markup.button.url("Download", `${DBShy.host}/?d=${fileName}${format}`)],
                [Markup.button.url("Stream", `${DBShy.host}/?w=${fileName}${format}`)],
              ]),
            }
          );
        } else if (error_code > 0) {
          try {
            await ctx.editMessageCaption(`Problem during download\n\n${msg}`, {
              message_id: data.message_id,
              ...Markup.inlineKeyboard([]),
            });
          } catch (e: any) {
            console.error(`[TG] DOWNLOAD ERROR: ${e.message}`);
          }
        }

        await DBShy.run(`DELETE FROM queue WHERE uid = ?;`, ctx.from?.id);
        clearInterval(updateProgress);
      }
    }
  }, 7000);
}

bot.use((ctx, next) => {
  const update: any = ctx.update;

  if (update.callback_query) {
    if (update.callback_query.from.id != update.callback_query.message.reply_to_message.from.id)
      return ctx.answerCbQuery("Not your business 🤡");
  }

  next();
});

bot.start((ctx) => {
  return ctx.reply("Gimme a link!!!");
});

bot.on("text", async (ctx, next) => {
  const link: string = ctx.update.message.text;
  if (!isurl(link)) return next();

  console.log(`[TG] Link received: ${link}`);
  let metadata: any;

  const data = await DBShy.get(`SELECT * FROM queue WHERE uid = ?`, ctx.from.id);

  ctx.replyWithChatAction("upload_photo");
  if (data) {
    const message_id = data.message_id;
    let button: any;

    if (isActive(data["pid"])) {
      await ctx.reply("You already have an active task");

      button = Markup.inlineKeyboard([[Markup.button.callback("Cancel", "cancel")]]);
    } else {
      await ctx.reply("You already have a pending task");

      button = Markup.inlineKeyboard([
        [Markup.button.callback("Video", "video"), Markup.button.callback("Audio", "audio")],
        [Markup.button.callback("Cancel", "cancel")],
      ]);
    }

    await ctx
      .replyWithPhoto(data["metadata"]["thumbnail"], {
        caption: data["caption"],
        reply_to_message_id: ctx.update.message.message_id,
        ...button,
      })
      .then(async (r) => {
        await DBShy.run(`UPDATE queue SET message_id = ? WHERE uid = ?;`, [r.message_id, ctx.from.id]);
      });

    try {
      await bot.telegram.deleteMessage(data["cid"], message_id);
    } catch (e) {
      console.error(e);
    }
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
  caption += `Description: ${metadata["description"] ? metadata["description"].substring(0, 200) + "..." : "-"}`;

  await ctx
    .replyWithPhoto(metadata["thumbnail"], {
      caption,
      reply_to_message_id: ctx.update.message.message_id,
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Video", "video"), Markup.button.callback("Audio", "audio")],
        [Markup.button.callback("Cancel", "cancel")],
      ]),
    })
    .then(async (r) => {
      await DBShy.run(`INSERT INTO queue VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        r.from?.id,
        r.chat.id,
        metadata,
        caption,
        ctx.update.message.message_id,
        "",
        r.message_id,
        -1,
        -1,
      ]);
    });
});

bot.action("video", async (ctx) => {
  let buttonRow: Array<Array<any>> = [[]];
  const formats: Array<number> = [];
  if (!ctx.from?.id) return;

  const data = await DBShy.get(`SELECT * FROM queue WHERE uid = ?;`, ctx.from.id);

  data["metadata"]["formats"].forEach((format: any) => {
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
      buttonRow[rowIndex] = [...buttonRow[rowIndex], Markup.button.callback(`${format}p`, `v-${format}`)];
    } else {
      buttonRow[rowIndex] = [Markup.button.callback(`${format}p`, `v-${format}`)];
    }

    if (buttonRow[rowIndex].length > 2) rowIndex += 1;
  });

  return ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([...buttonRow, [Markup.button.callback("Back", "menu")]]).reply_markup
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
      [Markup.button.callback("Video", "video"), Markup.button.callback("Audio", "audio")],
      [Markup.button.callback("Cancel", "cancel")],
    ]).reply_markup
  );
});

bot.action("cancel", async (ctx) => {
  const data = await DBShy.get(`SELECT * FROM queue WHERE uid = ?;`, ctx.from?.id);

  if (data) {
    if (isActive(data.pid)) {
      process.kill(data.pid, 1);
      DBShy.run(`UPDATE queue SET msg = "[Canceled] Download canceled" WHERE uid = ?;`, ctx.from?.id);
    } else {
      ctx.editMessageCaption(data.caption, {
        ...Markup.inlineKeyboard([]),
      });
      DBShy.run(`DELETE FROM queue WHERE uid = ?;`, ctx.from?.id);
    }
  } else {
    ctx.deleteMessage();
  }
});

bot.command("stats", async (ctx) => {
  return ctx.replyWithHTML(await systemInfo());
});

bot.command("restart", async (ctx) => {
  if (ctx.from.id != Number(process.env["TELE_OWNER"])) return await ctx.reply("Forbidden");

  ctx.replyWithChatAction("typing");

  await DBShy.setRestart(1);
  shy.restart();
});

bot.launch().then(async () => {
  if (DBShy.is_restart) {
    console.log("[TG] RESTARTED");

    try {
      await bot.telegram.sendMessage(Number(process.env["TELE_OWNER"]), "BOT RESTARTED");
    } catch (e: any) {
      console.error(e.message);
    } finally {
      DBShy.setRestart(0);
    }
  }
  console.log("[TG] READY");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
