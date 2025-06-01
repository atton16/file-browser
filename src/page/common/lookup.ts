import { $ } from "bun";

const usernameMap = new Map<number, string>();
const groupMap = new Map<number, string>();

export const getUsername = async (uid: number) => {
  const cached = usernameMap.get(uid);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const ret = await $`id -un ${uid}`;
    const out = ret.stdout.toString().trim();
    usernameMap.set(uid, out);
    return out;
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

export const getGroup = async (gid: number) => {
  const cached = groupMap.get(gid);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const ret = await $`cat /etc/group | grep :${gid}: | cut -d: -f1`;
    const out = ret.stdout.toString().trim();
    groupMap.set(gid, out);
    return out;
  } catch (error) {
    console.error(error);
  }
  try {
    const ret = await $`getent group ${gid} | cut -d: -f1`;
    const out = ret.stdout.toString().trim();
    groupMap.set(gid, out);
    return out;
  } catch (error) {
    console.error(error);
    return undefined;
  }
};
