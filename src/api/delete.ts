import { Hono } from "hono";
import { rm as fsRm } from "node:fs/promises";

export const deleteApi = new Hono();

deleteApi.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger("[delete]", json);
  const { paths } = json;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return c.json({ error: "paths array is required" }, 400);
  }

  const errors: any[] = [];
  for (const path of paths) {
    try {
      await fsRm(path, { recursive: true, force: true });
    } catch (error: any) {
      logger("[delete error]", path, error);
      errors.push({ path, error: error.message || String(error) });
    }
  }

  if (errors.length > 0) {
    return c.json({ error: "Failed to delete some files/folders", errors }, 500);
  }

  return c.json({ success: true, paths });
});
