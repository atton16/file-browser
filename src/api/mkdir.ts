import { Hono } from "hono";
import { mkdir as fsMkdir } from "node:fs/promises";

export const mkdirApi = new Hono();

mkdirApi.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger("[mkdir]", json);
  const { path } = json;

  if (!path) {
    return c.json({ error: "Path is required" }, 400);
  }

  try {
    await fsMkdir(path, { recursive: false });
    return c.json({ success: true, path });
  } catch (error: any) {
    logger("[mkdir error]", error);
    return c.json({ error: error.message || String(error) }, 500);
  }
});
