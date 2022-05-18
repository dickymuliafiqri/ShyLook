import { statSync, existsSync, createReadStream } from "fs";
import { DBShy } from "./index";

const express = require("express");
const mime = require("mime-types");
const contentDisposition = require("content-disposition");

const app = express();

app.get("/", function (req: any, res: any) {
  const fileName = req.query["w"] || req.query["d"];
  if (!fileName) return res.sendStatus(200);
  const filePath = `${process.cwd()}/downloads/${fileName}`;
  if (!existsSync(filePath)) return res.sendStatus(404);
  const fileSize = statSync(filePath).size;

  if (req.query["d"]) {
    console.log(`[DOWNLOAD] ${fileName}`);
    const head = {
      "Content-Length": fileSize,
      "Content-Type": mime.lookup(filePath),
      "Content-Disposition": contentDisposition(filePath),
    };
    res.writeHead(200, head);
    createReadStream(filePath).pipe(res);
  } else {
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      console.log(`[STREAM] ${fileName}: ${start} - ${end} = ${chunkSize}`);

      const file = createReadStream(filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mime.lookup(filePath),
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": mime.lookup(filePath),
      };
      res.writeHead(200, head);
      createReadStream(filePath).pipe(res);
    }
  }
});

export async function startServer() {
  const appHost = await DBShy.getAppHost();
  app.listen(appHost.port, "0.0.0.0", (e: any) => {
    if (e) console.error(e);
    console.log(`Server listening on ${appHost.host}:${appHost.port}`);
  });
}
