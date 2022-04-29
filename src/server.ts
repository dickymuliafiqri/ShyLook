import { writeFileSync, statSync, existsSync, createReadStream } from "fs";

const express = require("express");
const mime = require("mime-types");
const path = require("path");
const ip = require("ip");
const contentDisposition = require("content-disposition");

const app = express();
const port = process.env.PORT || 8000;

app.get("/", function (req: any, res: any) {
  const fileName = req.query["w"];
  const filePath = path.resolve(`${__dirname}/../downloads/${fileName}`);
  if (!existsSync(filePath)) return res.status(404);
  const fileSize = statSync(filePath).size;

  if (req.query["dl"]) {
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

app.get("/qrcode", (req: any, res: any) => {
  console.log("[WA] QRCODE ACCESSED");
  res.sendFile(path.resolve(`${__dirname}/../assets/qrcode.png`));
});

export function startServer() {
  app.listen(port, "0.0.0.0", (e: any) => {
    if (e) console.error(e);
    writeFileSync(
      "./server.json",
      JSON.stringify(
        {
          host: process.env.RAILWAY_STATIC_URL || ip.address(),
          port,
        },
        null,
        "\t"
      )
    );
    console.log(
      `Server listening on http://${
        process.env.RAILWAY_STATIC_URL || ip.address()
      }:${port}`
    );
  });
}
