import { systemInfo } from "./ext/msg_helper";
import { downloadFile } from "./ext/fs_helper";
import { Telegraf, Markup } from "telegraf";
import { statSync, rmSync, mkdirSync, rename } from "fs";
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
  const metadata = JSON.parse(data["metadata"]);

  if (data == undefined) await bot.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
  let format: string = isAudio ? ".mp3" : ".mp4";
  const fileName: string = `shyLook-${slug(metadata["title"]).substring(0, 190)}`;
  const fileId = Math.floor(Math.random() * 10000);

  mkdirSync(`${process.cwd()}/downloads/${fileId}`);
  if (isAudio) {
    shy.getAudio(metadata["webpage_url"], fileName, Number(ctx.from.id), fileId);
  } else {
    shy.getVideo(metadata["webpage_url"], fileName, Number(ctx.from.id), fileId);
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

      if (error_code >= 0) {
        if (error_code == 0) {
          await new Promise(function (resolve, reject) {
            rename(
              `${process.cwd()}/downloads/${fileId}/${fileName}${format}`,
              `${process.cwd()}/downloads/${fileName}${format}`,
              (err) => {
                if (err) {
                  console.error(err);
                  reject(err);
                }
                resolve(0);
              }
            );
          });
          const fileSize: string = byteSize(statSync(`./downloads/${fileName}${format}`).size);
          await ctx.editMessageCaption(`${data.caption}\nSize: ${fileSize}\nThis file will be deleted in 6 hrs`, {
            message_id: data.message_id,
            ...Markup.inlineKeyboard([
              [Markup.button.url("Download", `${DBShy.host}/?d=${fileName}${format}`)],
              [Markup.button.url("Stream", `${DBShy.host}/?w=${fileName}${format}`)],
            ]),
          });
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

        rmSync(`${process.cwd()}/downloads/${fileId}`, {
          recursive: true,
          force: true,
        });
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
    metadata = JSON.parse(data["metadata"]);
    let button: any;

    if (isActive(data.pid) && data.pid > 0) {
      button = Markup.inlineKeyboard([[Markup.button.callback("Cancel", "cancel")]]);
    } else {
      button = Markup.inlineKeyboard([
        [Markup.button.callback("Video", "video"), Markup.button.callback("Audio", "audio")],
        [Markup.button.callback("Cancel", "cancel")],
      ]);
    }

    await ctx
      .replyWithPhoto(metadata["thumbnail"], {
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
    return;
  } else {
    if (process.env.COOKIES) await downloadFile(process.env.COOKIES, `${process.cwd()}/cookies.txt`);
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
        ctx.from.id,
        r.chat.id,
        JSON.stringify(metadata),
        caption,
        ctx.update.message.message_id,
        "",
        r.message_id,
        -1,
        -1,
      ]);
    });
});

bot.action(/^video/, (ctx) => {
  return getMedia(ctx);
});

bot.action(/^audio/, (ctx) => {
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
    if (isActive(data.pid) && data.pid > 0) {
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
