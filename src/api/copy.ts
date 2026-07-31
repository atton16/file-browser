import { Hono } from "hono";
import { stat, cp, chmod, chown } from "node:fs/promises";
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
  const cmds = createCmds();
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const parts = source.split("/");
    const filename = parts[parts.length - 1];
    const filestat = await stat(source);
    const uid = filestat.uid;
    const gid = filestat.gid;
    const mode = filestat.mode;
    cmds.push(
      createCp({
        source,
        destination: `${destination}/${filename}`,
      }),
    );
    cmds.push(
      createChmod({
        path: `${destination}/${filename}`,
        mode,
      }),
    );
    cmds.push(
      createChown({
        path: `${destination}/${filename}`,
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
