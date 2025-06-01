import { Hono } from "hono";
import { readdir } from "fs/promises";
import { BASE_PATH } from "../constant";

export const dir = new Hono();

dir.get("/", async (c) => {
  const logger = c.get("logger");
  let q = c.req.query("q");
  const raw = q;
  if (!q) {
    return c.json({ raw, q, dir: [] });
  }
  if (q.indexOf("/") !== 0) {
    q = "/" + q;
  }
  if (q.indexOf(BASE_PATH) === 0) {
    q = q.slice(BASE_PATH.length);
  }
  let qs = q.split("/");
  const cur = q;
  let parent = qs.slice(0, -1).join("/");
  if (parent === "") {
    parent = "/";
  }
  async function listFolders(q: string) {
    const myPath = `${BASE_PATH}${q === "/" ? "" : q}`;
    try {
      const files = await readdir(myPath, {
        encoding: "utf-8",
        withFileTypes: true,
      });
      return files
        .filter((f) => (f.isDirectory() ? true : false))
        .map((f) => `${myPath}/${f.name}`);
    } catch (error) {
      console.error(`Error reading directory ${myPath}:`, error);
      return [];
    }
  }
  let dir: string[] = [];
  dir = await listFolders(cur);
  if (dir.length === 0) {
    dir = await listFolders(parent);
  }
  logger("cur", cur);
  logger("parent", parent);
  return c.json({ raw, q, dir });
});
