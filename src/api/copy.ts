import { Hono } from "hono";
import { stat, cp, chmod, chown, mkdir } from "node:fs/promises";
import {
  createCmds,
  execCmds,
  createCp,
  createChmod,
  createChown,
} from "./common/cmd";

export const copy = new Hono();

copy.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger(json);
  const { sources, destination } = json;

  // Ensure destination directory exists
  try {
    await mkdir(destination, { recursive: true });
  } catch (err) {
    // Ignore if directory already exists
  }

  const cmds = createCmds();
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const parts = source.split("/");
    const filename = parts[parts.length - 1];
    const filestat = await stat(source);
    const uid = filestat.uid;
    const gid = filestat.gid;
    const mode = filestat.mode;

    const targetPath = filestat.isDirectory()
      ? destination
      : `${destination}/${filename}`;

    cmds.push(
      createCp({
        source,
        destination: targetPath,
      }),
    );
    cmds.push(
      createChmod({
        path: targetPath,
        mode,
      }),
    );
    cmds.push(
      createChown({
        path: targetPath,
        uid,
        gid,
      }),
    );
  }
  logger(cmds);
  await execCmds(cmds);
  return c.json({
    sources,
    destination,
    cmds,
  });
});

copy.post("/plan", async (c) => {
  const json = await c.req.json();
  const { input, sources, movieDir, tvshowDir } = json;
  const targetInput = input || sources;
  const { planCopy } = await import("./common/planCopy");
  const plans = await planCopy(targetInput, { movieDir, tvshowDir });
  return c.json({ plans });
});
