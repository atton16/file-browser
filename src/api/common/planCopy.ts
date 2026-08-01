import { existsSync, readdirSync, statSync } from "node:fs";
import { BASE_PATH, MOVIE_BASE_PATH, TVSHOW_BASE_PATH } from "../../constant";

export interface CopyApiCall {
  sources: string[];
  destination: string;
  type?: "movie" | "tvshow";
  title?: string;
  season?: string;
  tvshowBaseDir?: string;
  movieBaseDir?: string;
  isShowDir?: boolean;
}

export interface PlanCopyOptions {
  movieDir?: string;
  tvshowDir?: string;
}

export interface MediaInfo {
  type: "movie" | "tvshow";
  title?: string;
  season?: string;
}

/**
 * Helper to check if a directory name matches a Season directory pattern.
 */
export function parseSeasonDir(dirName: string): string | null {
  if (!dirName) return null;

  // Match "Season X", "ซีซั่น X", "SXX"
  const seasonMatch =
    dirName.match(/^(?:Season|ซีซั่น)\s*(\d+)$/i) ||
    dirName.match(/^S(\d{1,2})$/i) ||
    dirName.match(/\bS(\d{1,2})\b/i) ||
    dirName.match(/^.*?S(\d{1,2})\s*-\s*\(/i);

  if (seasonMatch) {
    if (dirName.includes("(") && dirName.includes(")")) {
      return dirName; // preserve special arc names like "One Piece S01 - (East Blue)"
    }
    const numStr = seasonMatch[1] || seasonMatch[2];
    if (numStr !== undefined) {
      const sNum = parseInt(numStr, 10);
      return sNum === 0 ? "S00" : `Season ${sNum}`;
    }
  }
  return null;
}

/**
 * Clean raw title strings dynamically by removing release noise, tags, quality markers, etc.
 * Preserves release years (e.g. 2025, (2025), (2020-2025)) for accurate Plex metadata matching.
 */
export function cleanTitle(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // Remove brackets [...] and braces {...}
  s = s.replace(/\[.*?\]/g, " ").replace(/\{.*?\}/g, " ");

  // Extract years in parentheses before stripping parentheses noise
  const preservedYears: string[] = [];
  s = s.replace(/\((.*?)\)/g, (match, inner) => {
    const yearMatch = inner.match(/\b(19|20)\d{2}(?:-(19|20)\d{2})?\b/);
    if (yearMatch) {
      preservedYears.push(`(${yearMatch[0]})`);
    }
    return " ";
  });

  // Remove season range/folder tags before dot replacement
  s = s.replace(/\b(?:Season|ซีซั่น)[\.\s]*\d+(?:-\d+)?\b/gi, " ");
  s = s.replace(/\bS\d{1,2}(?:E\d{1,3})?\b/gi, " ");

  // Remove codecs, resolution, audio formats before dot replacement
  s = s.replace(/\b(?:1080p|720p|2160p|4k)\b/gi, " ");
  s = s.replace(
    /\b(?:DDP|AAC|AC3|E-AC-3|Atmos|TRUEHD|THD|THM|MP4|MKV)[\.\s\d]*\b/gi,
    " "
  );
  s = s.replace(/\b(?:H\.?264|H\.?265|x264|x265|AV1|HEVC|AVC)\b/gi, " ");
  s = s.replace(
    /\b(?:WEB-DL|WEBRip|BrRip|BDRip|BluRay|HDTV|AMZN|ATVP|NF|HS|IQ|DUAL|COMPLETE|REPACK)\b/gi,
    " "
  );

  // Remove scene release group tags & common words
  s = s.replace(
    /\b(?:LOL|BAPHOMET|SkiesIT|BSB|NTb|NOSiViD|cakes|MerkavaMII|BearBit|ZEZA|mxn|Celdra|YTS|SWAXXON|OAB|SCOPE|BYNDR|Blackops)\b/gi,
    " "
  );

  // Replace dots, underscores, dashes with spaces
  s = s.replace(/[\._]/g, " ");

  // Replace multiple spaces/dashes with a single space
  s = s.replace(/[\s\-\:]+/g, " ").trim();

  // Re-append preserved parenthetical years if not already present in the title
  for (const py of preservedYears) {
    if (!s.includes(py)) {
      s += ` ${py}`;
    }
  }

  return s.trim();
}

/**
 * Identify if a file or directory path is a TV show or Movie based on naming conventions.
 */
export function identifyMedia(pathStr: string): MediaInfo {
  const parts = pathStr.split("/").filter(Boolean);
  const lastPart = parts.length > 0 ? parts[parts.length - 1] : pathStr;

  // 1. Check if path contains TV Series / Season Complete / Series indicators
  const isTvPath = parts.some(
    (p) =>
      /TV Series/i.test(p) ||
      /Season Complete/i.test(p) ||
      /Series/i.test(p) ||
      parseSeasonDir(p) !== null
  );

  // 2. Check if episode code SXXEXX exists in lastPart or pathStr
  let seasonFromCode: string | null = null;
  let sExMatch = lastPart.match(
    /(?:^|[\._\-\s\[\(])S(\d{1,2})\s*E(\d{1,3})(?!\d)/i
  );
  if (!sExMatch && parts.length >= 2) {
    sExMatch = pathStr.match(
      /(?:^|[\._\-\s\[\(])S(\d{1,2})\s*E(\d{1,3})(?!\d)/i
    );
  }

  if (sExMatch) {
    const sNum = parseInt(sExMatch[1], 10);
    seasonFromCode = sNum === 0 ? "S00" : `Season ${sNum}`;
  }

  // 3. Check Season & Parent folder in path
  let seasonFromFolder: string | null = null;
  let titleFromFolder: string | null = null;

  if (parts.length >= 3) {
    const parent = parts[parts.length - 2];
    const sDir = parseSeasonDir(parent);
    if (sDir) {
      seasonFromFolder = sDir;
      titleFromFolder = cleanTitle(parts[parts.length - 3]);
    } else {
      // Parent directory itself contains the show folder name e.g. [Series-TH] The Believers...
      titleFromFolder = cleanTitle(parent);
    }
  } else if (parts.length === 2) {
    const parent = parts[parts.length - 2];
    const sDir = parseSeasonDir(parent);
    if (sDir) {
      seasonFromFolder = sDir;
      const idx = parent.search(/\bS\d{1,2}\b/i);
      titleFromFolder = cleanTitle(idx > 0 ? parent.substring(0, idx) : parent);
    } else {
      titleFromFolder = cleanTitle(parent);
    }
  }

  // 4. Check anime episode pattern "- 0031" (excluding release years 19xx/20xx)
  const dashEpMatch = lastPart.match(/\b-\s*(\d{3,4})\b/);
  const isDashEp =
    dashEpMatch !== null && !/^(19|20)\d{2}$/.test(dashEpMatch[1]);

  // 5. Check if filename/lastPart indicates TV Show
  const isTv = !!(
    isTvPath ||
    seasonFromCode ||
    seasonFromFolder ||
    lastPart.includes("ตอนที่") ||
    lastPart.includes("ตอน") ||
    lastPart.match(/\bEP\.?\s*\d+/i) ||
    isDashEp
  );

  // Check filesystem if path exists
  if (!isTv) {
    try {
      if (existsSync(pathStr) && statSync(pathStr).isDirectory()) {
        const children = readdirSync(pathStr);
        for (const child of children) {
          if (parseSeasonDir(child)) {
            return { type: "tvshow", title: cleanTitle(lastPart), season: "Season 1" };
          }
          const childInfo = identifyMedia(`${pathStr}/${child}`);
          if (childInfo.type === "tvshow") {
            return { type: "tvshow", title: cleanTitle(lastPart), season: childInfo.season };
          }
        }
      }
    } catch (err) {
      // Ignore filesystem read errors
    }

    return { type: "movie" };
  }

  const season = seasonFromFolder || seasonFromCode || "Season 1";

  let title = titleFromFolder;
  if (!title) {
    const idx = lastPart.search(/\bS\d{1,2}\s*E\d{1,3}\b/i);
    if (idx > 0) {
      title = cleanTitle(lastPart.substring(0, idx));
    } else {
      title = cleanTitle(lastPart);
    }
  }

  return { type: "tvshow", title, season };
}

/**
 * Plan the copy process for a file, directory, or list of files/directories.
 * Returns an array of CopyApiCall objects ({ sources: string[], destination: string }).
 */
export async function planCopy(
  input: string | string[],
  options?: PlanCopyOptions
): Promise<CopyApiCall[]> {
  return planCopySync(input, options);
}

/**
 * Synchronous version of planCopy.
 */
interface DestMapEntry {
  sources: string[];
  type: "movie" | "tvshow";
  title?: string;
  season?: string;
  tvshowBaseDir?: string;
  movieBaseDir?: string;
  isShowDir?: boolean;
}

export function planCopySync(
  input: string | string[],
  options?: PlanCopyOptions
): CopyApiCall[] {
  const movieBaseDir = options?.movieDir || MOVIE_BASE_PATH;
  const tvshowBaseDir = options?.tvshowDir || TVSHOW_BASE_PATH;

  const sourcesList = Array.isArray(input) ? input : [input];
  const destMap = new Map<string, DestMapEntry>();

  for (const itemPath of sourcesList) {
    const media = identifyMedia(itemPath);
    let destination: string;
    let title: string | undefined;
    let season: string | undefined;
    let isShowDir: boolean | undefined;

    const parts = itemPath.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || "";

    if (media.type === "movie") {
      destination = movieBaseDir;
      title = media.title || cleanTitle(lastPart);
      season = "Season 1";
    } else {
      title = media.title || "Unknown Show";
      season = media.season || "Season 1";

      const isSeasonDir = parseSeasonDir(lastPart) !== null;
      const isMediaFile =
        /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|part|jpg|png|nfo|srt|sub|ass)$/i.test(
          lastPart
        );

      isShowDir =
        !isMediaFile &&
        !isSeasonDir &&
        cleanTitle(lastPart).toLowerCase() === title.toLowerCase();

      if (isShowDir) {
        destination = `${tvshowBaseDir}/${title}`;
      } else {
        destination = `${tvshowBaseDir}/${title}/${season}`;
      }
    }

    if (!destMap.has(destination)) {
      destMap.set(destination, {
        sources: [],
        type: media.type,
        title,
        season,
        tvshowBaseDir,
        movieBaseDir,
        isShowDir,
      });
    }
    destMap.get(destination)!.sources.push(itemPath);
  }

  const calls: CopyApiCall[] = [];
  for (const [destination, entry] of destMap.entries()) {
    calls.push({
      sources: entry.sources,
      destination,
      type: entry.type,
      title: entry.title,
      season: entry.season,
      tvshowBaseDir: entry.tvshowBaseDir,
      movieBaseDir: entry.movieBaseDir,
      isShowDir: entry.isShowDir,
    });
  }

  return calls;
}
