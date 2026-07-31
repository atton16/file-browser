import { Hono } from "hono";
import { rename as fsRename } from "node:fs/promises";

export const renameApi = new Hono();

renameApi.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger("[rename]", json);
  const { oldPath, newPath } = json;

  if (!oldPath || !newPath) {
    return c.json({ error: "oldPath and newPath are required" }, 400);
  }

  try {
    await fsRename(oldPath, newPath);
    return c.json({ success: true, oldPath, newPath });
  } catch (error: any) {
    logger("[rename error]", error);
    return c.json({ error: error.message || String(error) }, 500);
  }
});
