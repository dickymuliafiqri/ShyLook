const ip = require("ip");
const os = require("os");
const si = require("systeminformation");
const df = require("node-df");
const prettyMs = require("pretty-ms");
const byteSize = require("byte-size");
const percentage = require("calculate-percentages");

import { existsSync } from "fs";

export async function systemInfo(isFooter: boolean = false) {
  let info: string = "";

  // Get system info
  const cpus = os.cpus();
  const cpuSpeed = await si.currentLoad();
  const mem = await si.mem();
  const dlDisk = (await new Promise((resolve, reject) => {
    df(
      {
        file: existsSync(`${process.cwd()}/downloads`) ? `${process.cwd()}/downloads` : process.cwd(),
      },
      (e: any, r: any) => {
        if (e) reject(e);
        else resolve(r[0]);
      }
    );
  })) as any;

  // Progress bar and percentage
  const cpuLoad = (() => {
    const maxLoad: number = cpuSpeed.rawCurrentLoad + cpuSpeed.rawCurrentLoadIdle;
    const pr = progressBar(cpuSpeed.rawCurrentLoad || 0, maxLoad || 10);
    return pr;
  })();
  const memLoad = progressBar(mem.active || 0, mem.total || 10);
  const swapLoad = progressBar(mem.swapused || 0, mem.swaptotal || 10);
  const diskUsed = progressBar(dlDisk.used || 0, dlDisk.size || 10);

  // Build system info
  if (!isFooter) {
    info += `OS: ${os.release()}  ${os.arch()}\n`;
    info += `Platform: ${os.platform()}\n`;
    info += `IP Address: ${ip.address()}\n`;
    info += `Uptime: ${prettyMs(os.uptime() * 1000)}\n\n`;

    info += `CPU: ${cpus[0].model}\n`;
    info += `Load: ${cpuLoad.progressString} | ${cpuLoad.percent}%\n\n`;

    info += `Memory: ${byteSize(mem.total || 0)}\n`;
    info += `Available: ${byteSize(mem.available || 0)}\n`;
    info += `Load: ${memLoad.progressString} | ${memLoad.percent}%\n\n`;
    info += `Swap: ${byteSize(mem.swaptotal || 0)}\n`;
    info += `Load: ${swapLoad.progressString} | ${swapLoad.percent}%\n\n`;

    info += `Disk: ${dlDisk.filesystem}\n`;
    info += `Mount Point: ${dlDisk.mount}\n`;
    info += `Size: ${byteSize(dlDisk.size * 1000)}\n`;
    info += `Available: ${byteSize(dlDisk.available * 1000 || 0)}\n`;
    info += `Used: ${diskUsed.progressString} | ${diskUsed.percent}%\n\n`;
  } else {
    info += `CPU: ${cpuLoad.percent}% | FREE: ${byteSize(dlDisk.available * 1000 || 0)}\n`;
    info += `MEM: ${memLoad.percent}% | TASK: ~`;
    /**
     * TODO
     *
     * - Active task total
     * - DL/UL speed
     */
  }

  return info;
}

export function progressBar(
  current: number | string,
  max: number | string
): {
  progressString: string;
  percent: string;
} {
  const percent: string = percentage.calculate(current, max).toFixed(2);
  const fixNum: number = Math.round(Number(percent)) / 10;

  let progressString: string = "";
  for (let i = 1; i <= 10; i++) {
    if (i <= fixNum) progressString += "█";
    else progressString += "░";
  }

  return {
    progressString: `[${progressString}]`,
    percent,
  };
}
