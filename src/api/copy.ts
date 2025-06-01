import { Hono } from "hono";
import { stat, cp, chmod, chown } from "node:fs/promises";

export const copy = new Hono();

copy.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger(json);
  const { sources, destination } = json;
  const cmds: Array<{
    command?: string;
    source?: string;
    destination?: string;
    path?: string;
    uid?: number;
    gid?: number;
    mode?: number;
    error?: any;
  }> = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const parts = source.split("/");
    const filename = parts[parts.length - 1];
    const filestat = await stat(source);
    const uid = filestat.uid;
    const gid = filestat.gid;
    const mode = filestat.mode;
    cmds.push({
      command: "cp",
      source,
      destination: `${destination}/${filename}`,
    });
    cmds.push({
      command: "chmod",
      path: `${destination}/${filename}`,
      mode,
    });
    cmds.push({
      command: "chown",
      path: `${destination}/${filename}`,
      uid,
      gid,
    });
  }
  logger(cmds);
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    if (cmd.command === "cp") {
      try {
        await cp(cmd.source!, cmd.destination!, {
          recursive: true,
          force: false,
          errorOnExist: true,
          preserveTimestamps: true,
        });
      } catch (error) {
        console.error(error);
        logger(error);
        cmd.error = error;
        break;
      }
    } else if (cmd.command === "chmod") {
      try {
        await chmod(cmd.path!, cmd.mode!);
      } catch (error) {
        console.error(error);
        logger(error);
        cmd.error = error;
        break;
      }
    } else if (cmd.command === "chown") {
      try {
        await chown(cmd.path!, cmd.uid!, cmd.gid!);
      } catch (error) {
        console.error(error);
        logger(error);
        cmd.error = error;
        break;
      }
    }
  }
  return c.json({
    sources,
    destination,
    cmds,
  });
});
