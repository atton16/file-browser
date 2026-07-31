import { Hono } from "hono";
import { chown as fsChown } from "node:fs/promises";
import { $ } from "bun";

export const resolveUid = async (userStr: string): Promise<number> => {
  const trimmed = userStr.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  // Try system `id -u <user>` (works on both Mac & Linux)
  try {
    const ret = await $`id -u ${trimmed}`;
    const out = ret.stdout.toString().trim();
    if (/^\d+$/.test(out)) {
      return parseInt(out, 10);
    }
  } catch {}

  // Try python3 pwd module if available
  try {
    const ret = await $`python3 -c "import pwd; print(pwd.getpwnam('${trimmed}').pw_uid)"`;
    const out = ret.stdout.toString().trim();
    if (/^\d+$/.test(out)) {
      return parseInt(out, 10);
    }
  } catch {}

  throw new Error(`Could not resolve username "${userStr}" to UID`);
};

export const resolveGid = async (groupStr: string): Promise<number> => {
  const trimmed = groupStr.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  // Try Linux `getent group <group>`
  try {
    const ret = await $`getent group ${trimmed}`;
    const out = ret.stdout.toString().trim();
    if (out) {
      const parts = out.split(":");
      if (parts.length >= 3 && /^\d+$/.test(parts[2])) {
        return parseInt(parts[2], 10);
      }
    }
  } catch {}

  // Try Linux `/etc/group`
  try {
    const ret = await $`grep -E "^${trimmed}:" /etc/group`;
    const out = ret.stdout.toString().trim();
    if (out) {
      const parts = out.split(":");
      if (parts.length >= 3 && /^\d+$/.test(parts[2])) {
        return parseInt(parts[2], 10);
      }
    }
  } catch {}

  // Try macOS `dscl . -read /Groups/<group> PrimaryGroupID`
  try {
    const ret = await $`dscl . -read /Groups/${trimmed} PrimaryGroupID`;
    const out = ret.stdout.toString().trim();
    const match = out.match(/PrimaryGroupID:\s*(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  } catch {}

  // Try python3 grp module if available
  try {
    const ret = await $`python3 -c "import grp; print(grp.getgrnam('${trimmed}').gr_gid)"`;
    const out = ret.stdout.toString().trim();
    if (/^\d+$/.test(out)) {
      return parseInt(out, 10);
    }
  } catch {}

  throw new Error(`Could not resolve group name "${groupStr}" to GID`);
};

export const chownApi = new Hono();

chownApi.post("/", async (c) => {
  const logger = c.get("logger");
  const json = await c.req.json();
  logger("[chown]", json);
  const { paths, user, group } = json;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return c.json({ error: "paths array is required" }, 400);
  }
  if (!user && !group) {
    return c.json({ error: "At least user or group must be specified" }, 400);
  }

  let uid = -1;
  let gid = -1;

  if (user) {
    try {
      uid = await resolveUid(user);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  }

  if (group) {
    try {
      gid = await resolveGid(group);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  }

  const errors: any[] = [];
  for (const path of paths) {
    try {
      await fsChown(path, uid, gid);
    } catch (error: any) {
      logger("[chown error]", path, error);
      errors.push({ path, error: error.message || String(error) });
    }
  }

  if (errors.length > 0) {
    return c.json({ error: "Failed to change owner/group for some items", errors }, 500);
  }

  return c.json({ success: true, paths, uid, gid });
});
