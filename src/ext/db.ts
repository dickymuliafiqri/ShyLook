const sqlite3 = require("sqlite3").verbose();
const ip = require("ip");

import { existsSync, mkdirSync } from "fs";

if (!existsSync("./db")) mkdirSync("./db");

export class DB {
  private db: Array<any> = [];

  async initialize() {
    // Create tables
    await this.run(`CREATE TABLE IF NOT EXISTS app (
            host TEXT,
            port INT,
            is_restart INT
        );`);

    await this.run(`CREATE TABLE IF NOT EXISTS queue (
            uid INT,
            metadata TEXT,
            caption TEXT,
            pid INT,
            msg TEXT,
            msgid INT,
            error_code INT
        );`);

    await this.setServer();
  }

  private connect() {
    // Dynamically create object pool of connection
    if (this.db.length >= 1) return this.db.pop();
    else return new sqlite3.Database(`${process.cwd()}/db/shylook.db`);
  }

  private close(db: any) {
    // Return connection to object pool
    return this.db.push(db);
  }

  async run(sql: string, param?: any) {
    return await new Promise((resolve, reject) => {
      const db = this.connect();
      db.run(sql, param, (err: any) => {
        if (err) reject(err);
        else resolve(1);

        // Close/return connection
        this.close(db);
      });
    });
  }

  async get(sql: string, param?: any) {
    return await new Promise((resolve, reject) => {
      const db = this.connect();
      db.get(sql, param, (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);

        // Close/return connection
        this.close(db);
      });
    });
  }

  async all(sql: string, param?: any) {
    return await new Promise((resolve, reject) => {
      const db = this.connect();
      db.all(sql, param, (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);

        // Close/return connection
        this.close(db);
      });
    });
  }

  private async setServer() {
    const server = await this.get("SELECT * FROM app WHERE rowid = 1");
    if (server == undefined) {
      await this.run(`INSERT INTO app VALUES (?, ?, ?);`, [
        process.env.HOST || ip.address(),
        process.env.PORT || 8080,
        0,
      ]);
    }
  }

  async setRestart(value: number) {
    this.run(`UPDATE app SET is_restart = ? WHERE rowid = 1;`, value);
  }

  async getAppHost(): Promise<any> {
    return await this.get("SELECT * FROM app;");
  }
}
