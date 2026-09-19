import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { fileApi, resolveSafePath } from "./file";
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

describe("fileApi and resolveSafePath", () => {
  const localBase = path.join(process.cwd(), "tmp_test_dir");
  const testDir = path.join(localBase, "sub");
  const sampleFile = path.join(testDir, "test.txt");
  const binaryFile = path.join(testDir, "test.bin");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(sampleFile, "Hello World from test!", "utf-8");
    await writeFile(binaryFile, Buffer.from([0x00, 0x01, 0x02, 0xff]));
  });

  afterEach(async () => {
    await rm(localBase, { recursive: true, force: true });
  });

  describe("resolveSafePath", () => {
    it("safely resolves relative paths within localBase", () => {
      const resolved = resolveSafePath("sub/test.txt", localBase);
      expect(resolved).toBe(sampleFile);
    });

    it("strips /page/ and /edit/ prefixes", () => {
      const p1 = resolveSafePath("/page/sub/test.txt", localBase);
      expect(p1).toBe(sampleFile);

      const p2 = resolveSafePath("/edit/sub/test.txt", localBase);
      expect(p2).toBe(sampleFile);
    });

    it("accepts valid absolute paths within localBase", () => {
      const resolved = resolveSafePath(sampleFile, localBase);
      expect(resolved).toBe(sampleFile);
    });

    it("rejects path traversal attempts outside localBase", () => {
      const resolved = resolveSafePath("../../../../etc/passwd", localBase);
      expect(resolved).toBeNull();
    });
  });

  describe("API endpoints", () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("logger", () => {});
      c.set("basePath", localBase);
      return next();
    });
    app.route("/api/file", fileApi);

    it("GET /api/file reads text file content successfully", async () => {
      const res = await app.request(`/api/file?path=${encodeURIComponent(sampleFile)}`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.name).toBe("test.txt");
      expect(json.content).toBe("Hello World from test!");
      expect(json.isReadOnly).toBe(false);
      expect(typeof json.size).toBe("number");
    });

    it("GET /api/file rejects directory paths", async () => {
      const res = await app.request(`/api/file?path=${encodeURIComponent(testDir)}`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("directory");
    });

    it("GET /api/file rejects binary files", async () => {
      const res = await app.request(`/api/file?path=${encodeURIComponent(binaryFile)}`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.isBinary).toBe(true);
    });

    it("GET /api/file rejects path traversal with 403", async () => {
      const res = await app.request(`/api/file?path=${encodeURIComponent("../../../../etc/passwd")}`);
      expect(res.status).toBe(403);
    });

    it("POST /api/file saves new content", async () => {
      const res = await app.request("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: sampleFile,
          content: "Updated content from test",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const readBack = await Bun.file(sampleFile).text();
      expect(readBack).toBe("Updated content from test");
    });
  });
});
