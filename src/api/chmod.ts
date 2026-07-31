import { Hono } from "hono";
import { chmod as fsChmod } from "node:fs/promises";

export const chmodApi = new Hono();

chmodApi.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger("[chmod]", json);
  const { paths, mode } = json;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return c.json({ error: "paths array is required" }, 400);
  }
  if (mode === undefined || mode === null || mode === "") {
    return c.json({ error: "mode is required" }, 400);
  }

  let parsedMode: number;
  if (typeof mode === "number") {
    parsedMode = mode;
  } else {
    // Mode is an octal string like "755" or "0755"
    parsedMode = parseInt(mode.toString(), 8);
  }

  if (isNaN(parsedMode)) {
    return c.json({ error: "Invalid mode format" }, 400);
  }

  const errors: any[] = [];
  for (const path of paths) {
    try {
      await fsChmod(path, parsedMode);
    } catch (error: any) {
      logger("[chmod error]", path, error);
      errors.push({ path, error: error.message || String(error) });
    }
  }

  if (errors.length > 0) {
    return c.json({ error: "Failed to change permissions for some items", errors }, 500);
  }

  return c.json({ success: true, paths, mode: parsedMode });
});
