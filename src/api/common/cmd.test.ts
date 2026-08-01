import { describe, expect, test, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createCmds, createCp, execCmds } from "./cmd";

describe("execCmds with Copy-on-Write (COPYFILE_FICLONE)", () => {
  const testDir = join(process.cwd(), "temp_test_cow");

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("executes copy with COPYFILE_FICLONE flag successfully on single file", async () => {
    mkdirSync(testDir, { recursive: true });
    const srcFile = join(testDir, "source.txt");
    const dstFile = join(testDir, "destination.txt");

    writeFileSync(srcFile, "hello cow copy");

    const cmds = createCmds();
    cmds.push(createCp({ source: srcFile, destination: dstFile }));

    const res = await execCmds(cmds);

    expect(res[0].error).toBeUndefined();
    expect(existsSync(dstFile)).toBe(true);
    expect(readFileSync(dstFile, "utf-8")).toBe("hello cow copy");
  });

  test("executes copy with COPYFILE_FICLONE flag successfully on directory tree", async () => {
    const srcSubDir = join(testDir, "src_dir/subdir");
    mkdirSync(srcSubDir, { recursive: true });
    const srcFile = join(srcSubDir, "data.txt");
    writeFileSync(srcFile, "nested content");

    const dstDir = join(testDir, "dst_dir");

    const cmds = createCmds();
    cmds.push(createCp({ source: join(testDir, "src_dir"), destination: dstDir }));

    const res = await execCmds(cmds);

    expect(res[0].error).toBeUndefined();
    expect(existsSync(join(dstDir, "subdir/data.txt"))).toBe(true);
    expect(readFileSync(join(dstDir, "subdir/data.txt"), "utf-8")).toBe("nested content");
  });
});
