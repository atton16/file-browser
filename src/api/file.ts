import { Hono } from "hono";
import { readFile, writeFile, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { BASE_PATH } from "../constant";

export const fileApi = new Hono();

export function resolveSafePath(inputPath: string, basePath: string = BASE_PATH): string | null {
  if (!inputPath) return null;
  let clean = inputPath;
  if (clean.startsWith("/page/")) {
    clean = clean.replace("/page/", "/");
  } else if (clean.startsWith("/edit/")) {
    clean = clean.replace("/edit/", "/");
  }

  let fullPath = clean;
  if (!clean.startsWith(basePath)) {
    fullPath = path.join(basePath, clean);
  }
  const normalized = path.normalize(fullPath);

  // Security check: ensure path is within basePath
  if (!normalized.startsWith(basePath)) {
    return null;
  }
  return normalized;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

fileApi.get("/", async (c) => {
  const logger = c.get("logger");
  const basePath = (c.get("basePath") as string) || BASE_PATH;
  const rawPath = c.req.query("path");
  if (!rawPath) {
    return c.json({ error: "Query parameter 'path' is required" }, 400);
  }

  const filePath = resolveSafePath(rawPath, basePath);
  if (!filePath) {
    return c.json({ error: "Invalid path or access outside BASE_PATH" }, 403);
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      return c.json({ error: "Specified path is a directory, not a file" }, 400);
    }

    if (fileStat.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File size (${(fileStat.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit for in-browser editing.`,
          isTooLarge: true,
        },
        400
      );
    }

    // Binary check: inspect file buffer for null bytes
    const buffer = await readFile(filePath);
    const sampleLength = Math.min(buffer.length, 8000);
    let isBinary = false;
    for (let i = 0; i < sampleLength; i++) {
      if (buffer[i] === 0) {
        isBinary = true;
        break;
      }
    }

    if (isBinary) {
      return c.json(
        {
          error: "Binary file cannot be opened in the text editor.",
          isBinary: true,
        },
        400
      );
    }

    let isReadOnly = false;
    try {
      await access(filePath, constants.W_OK);
    } catch {
      isReadOnly = true;
    }

    const content = buffer.toString("utf-8");
    logger("[fileApi GET]", filePath, "size:", fileStat.size);

    return c.json({
      path: filePath,
      name: path.basename(filePath),
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      isReadOnly,
      content,
    });
  } catch (err: any) {
    logger("[fileApi GET error]", err);
    if (err.code === "ENOENT") {
      return c.json({ error: "File not found" }, 404);
    }
    return c.json({ error: err.message || String(err) }, 500);
  }
});

fileApi.post("/", async (c) => {
  const logger = c.get("logger");
  const basePath = (c.get("basePath") as string) || BASE_PATH;
  const json = await c.req.json();
  const { path: rawPath, content } = json;

  if (!rawPath) {
    return c.json({ error: "Field 'path' is required" }, 400);
  }
  if (content === undefined || content === null) {
    return c.json({ error: "Field 'content' is required" }, 400);
  }

  const filePath = resolveSafePath(rawPath, basePath);
  if (!filePath) {
    return c.json({ error: "Invalid path or access outside BASE_PATH" }, 403);
  }

  try {
    await writeFile(filePath, content, "utf-8");
    const updatedStat = await stat(filePath);
    logger("[fileApi POST saved]", filePath, "bytes:", updatedStat.size);

    return c.json({
      success: true,
      path: filePath,
      size: updatedStat.size,
      mtimeMs: updatedStat.mtimeMs,
    });
  } catch (err: any) {
    logger("[fileApi POST error]", err);
    if (err.code === "EACCES") {
      return c.json({ error: "Permission denied (read-only file or insufficient permissions)" }, 403);
    }
    return c.json({ error: err.message || String(err) }, 500);
  }
});
