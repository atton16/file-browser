import fs from "node:fs";

export function modeToLinux(mode: number) {
  const fileType =
    (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR
      ? "d"
      : (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK
        ? "l"
        : "-";
  const owner =
    (mode & fs.constants.S_IRUSR ? "r" : "-") +
    (mode & fs.constants.S_IWUSR ? "w" : "-") +
    (mode & fs.constants.S_IXUSR ? "x" : "-");
  const group =
    (mode & fs.constants.S_IRGRP ? "r" : "-") +
    (mode & fs.constants.S_IWGRP ? "w" : "-") +
    (mode & fs.constants.S_IXGRP ? "x" : "-");
  const others =
    (mode & fs.constants.S_IROTH ? "r" : "-") +
    (mode & fs.constants.S_IWOTH ? "w" : "-") +
    (mode & fs.constants.S_IXOTH ? "x" : "-");
  return fileType + owner + group + others;
}

export function modeToOctal(mode: number) {
  return mode.toString(8).slice(-3);
}
