import { cp, chmod, chown, constants } from "node:fs/promises";

export const createCmds = (): Array<{
  command?: string;
  source?: string;
  destination?: string;
  path?: string;
  uid?: number;
  gid?: number;
  mode?: number;
  error?: any;
}> => [];

export const execCmds = async (
  cmds: Array<{
    command?: string;
    source?: string;
    destination?: string;
    path?: string;
    uid?: number;
    gid?: number;
    mode?: number;
    error?: any;
  }>,
) => {
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    if (cmd.command === "cp") {
      try {
        await cp(cmd.source!, cmd.destination!, {
          recursive: true,
          force: false,
          errorOnExist: true,
          preserveTimestamps: true,
          mode: constants.COPYFILE_FICLONE,
        });
      } catch (error) {
        console.error(error);
        cmd.error = error;
        break;
      }
    } else if (cmd.command === "chmod") {
      try {
        await chmod(cmd.path!, cmd.mode!);
      } catch (error) {
        console.error(error);
        cmd.error = error;
        break;
      }
    } else if (cmd.command === "chown") {
      try {
        await chown(cmd.path!, cmd.uid!, cmd.gid!);
      } catch (error) {
        console.error(error);
        cmd.error = error;
        break;
      }
    }
  }
  return cmds;
};
export const createCp = ({
  source,
  destination,
}: {
  source: string;
  destination: string;
}) => ({
  command: "cp",
  source,
  destination,
});
export const createChmod = ({
  path,
  mode,
}: {
  path: string;
  mode: number;
}) => ({
  command: "chmod",
  path,
  mode,
});
export const createChown = ({
  path,
  uid,
  gid,
}: {
  path: string;
  uid: number;
  gid: number;
}) => ({
  command: "chown",
  path,
  uid,
  gid,
});
