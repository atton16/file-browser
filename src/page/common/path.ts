import { PATH_PREFIX } from "../../constant";
export { PATH_PREFIX } from "../../constant";
export { BASE_PATH } from "../../constant";

export function removePathPrefix(path: string): string {
  return path.replace(PATH_PREFIX, "");
}
