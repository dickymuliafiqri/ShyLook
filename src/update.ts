const exec = require("child_process");

import { existsSync } from "fs";

const UPSTREAM_REPO: string = "https://github.com/dickymuliafiqri/ShyLook";
const UPSTREAM_BRANCH: string = "main";

const UPDATE_COMMAND: string = `git init -q \
&& git config --global user.email e.dickymuliafiqri@shylook.tk \
&& git config --global user.name shylook \
&& git add . \
&& git commit -sm update -q \
&& git remote add origin ${UPSTREAM_REPO} \
&& git fetch origin -q \
&& git reset --hard origin/${UPSTREAM_BRANCH} -q \
&& bash dl.sh \
&& npx tsc`;

if (existsSync(".git")) exec("rm -rf .git");

export default async () => {
  return await new Promise((resolve, reject) => {
    exec(UPDATE_COMMAND, (error: any, stdout: any, stderr: any) => {
      if (error) {
        reject(error.message);
      }
      if (stderr) {
        console.log(`[ERROR]: ${stderr}`);
        reject(stderr);
      }
      console.log(`[GIT]: Successfully updated from ${UPSTREAM_REPO}:${UPSTREAM_BRANCH}`);
      resolve(stdout);
    });
  });
};
