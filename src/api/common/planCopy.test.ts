import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { identifyMedia, planCopy, planCopySync } from "./planCopy";
import { BASE_PATH } from "../../constant";

describe("identifyMedia with full absolute paths", () => {
  const PREFIX = `${BASE_PATH}/downloads/complete/`;

  test("correctly classifies movies from movies.txt using full absolute paths", () => {
    const moviesContent = readFileSync(
      join(process.cwd(), "src/example/movies.txt"),
      "utf-8"
    );
    const lines = moviesContent.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const fullPath = `${PREFIX}${line}`;
      const result = identifyMedia(fullPath);
      expect(result.type).toBe("movie");
    }
  });

  test("correctly classifies tvshows from tvshows.txt using full absolute paths", () => {
    const tvContent = readFileSync(
      join(process.cwd(), "src/example/tvshows.txt"),
      "utf-8"
    );
    const lines = tvContent.split("\n").filter((l) => l.trim().length > 0);

    let tvCount = 0;
    for (const line of lines) {
      if (line.includes(".DS_Store")) continue;

      const fullPath = `${PREFIX}${line}`;
      const result = identifyMedia(fullPath);
      expect(result.type).toBe("tvshow");
      expect(result.title).toBeDefined();
      expect(result.title!.length).toBeGreaterThan(0);
      tvCount++;
    }
    expect(tvCount).toBeGreaterThan(1000);
  });

  test("correctly classifies all entries in inputs.txt using full absolute paths", () => {
    const inputsContent = readFileSync(
      join(process.cwd(), "src/example/inputs.txt"),
      "utf-8"
    );
    const lines = inputsContent.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      if (line.includes(".DS_Store")) continue;
      const fullPath = `${PREFIX}${line}`;
      const result = identifyMedia(fullPath);
      expect(result.type).toBeDefined();
    }
    expect(lines.length).toBeGreaterThan(1500);
  });
});

describe("planCopy with real default base directories", () => {
  const PREFIX = `${BASE_PATH}/downloads/complete/`;
  const MOVIE_DIR = `${BASE_PATH}/Movies/Intl`;
  const TVSHOW_DIR = `${BASE_PATH}/Movie Series`;

  test("uses default movieBaseDir and tvshowBaseDir matching real examples", async () => {
    const moviePath = `${PREFIX}Project.Hail.Mary.2026.1080p.WEB-DL.TH.DDP5.1.Atmos.H.264-LOL-.mkv`;
    const tvPath = `${PREFIX}Rick.and.Morty.S09.COMPLETE.1080p.AMZN.WEB-DL.H.264-BSB/Rick.and.Morty.S09E10.1080p.AMZN.WEB-DL.DDP5.1.H.264-BSB.mkv`;

    const calls = await planCopy([moviePath, tvPath]);

    expect(calls.length).toBe(2);

    const movieCall = calls.find((c) => c.destination === MOVIE_DIR);
    expect(movieCall).toBeDefined();
    expect(movieCall?.sources).toEqual([moviePath]);

    const tvCall = calls.find(
      (c) => c.destination === `${TVSHOW_DIR}/Rick and Morty/Season 9`
    );
    expect(tvCall).toBeDefined();
    expect(tvCall?.sources).toEqual([tvPath]);
  });

  test("matches copy-api-call.movie.txt format for full path movie input", async () => {
    const fullPath = `${PREFIX}Project.Hail.Mary.2026.1080p.WEB-DL.TH.DDP5.1.Atmos.H.264-LOL-.mkv`;
    const calls = await planCopy(fullPath, {
      movieDir: MOVIE_DIR,
      tvshowDir: TVSHOW_DIR,
    });

    expect(calls).toEqual([
      {
        sources: [fullPath],
        destination: MOVIE_DIR,
        type: "movie",
      },
    ]);
  });

  test("matches copy-api-call.tvshows.txt format for full path tvshow episode input", async () => {
    const fullPath = `${PREFIX}Rick.and.Morty.S09.COMPLETE.1080p.AMZN.WEB-DL.H.264-BSB/Rick.and.Morty.S09E10.1080p.AMZN.WEB-DL.DDP5.1.H.264-BSB.mkv`;
    const calls = await planCopy(fullPath, {
      movieDir: MOVIE_DIR,
      tvshowDir: TVSHOW_DIR,
    });

    expect(calls).toEqual([
      {
        sources: [fullPath],
        destination: `${TVSHOW_DIR}/Rick and Morty/Season 9`,
        type: "tvshow",
        title: "Rick and Morty",
        season: "Season 9",
        tvshowBaseDir: TVSHOW_DIR,
        isShowDir: false,
      },
    ]);
  });

  test("handles Widows Bay season directory input correctly", () => {
    const input = `${PREFIX}Widows.Bay-S01.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-LOL-`;
    const calls = planCopySync(input, {
      movieDir: MOVIE_DIR,
      tvshowDir: TVSHOW_DIR,
    });

    expect(calls).toEqual([
      {
        sources: [input],
        destination: `${TVSHOW_DIR}/Widows Bay/Season 1`,
        type: "tvshow",
        title: "Widows Bay",
        season: "Season 1",
        tvshowBaseDir: TVSHOW_DIR,
        isShowDir: false,
      },
    ]);
  });

  test("handles Thai season folders with full absolute paths preserving release year (Alice in Borderland example)", () => {
    const fullPath1 = `${PREFIX}[Netflix] Alice in Borderland (TV Series 2020-2025)  (3 Season Complete)/ซีซั่น 2/S02E008_ตอน 8_by MerkavaMII.mkv.part`;
    const fullPath2 = `${PREFIX}[Netflix] Alice in Borderland (TV Series 2020-2025)  (3 Season Complete)/ซีซั่น 3/S03E001_ตอน 1_by MerkavaMII.mkv`;
    const fullPath3 = `${PREFIX}[Netflix] Alice in Borderland (TV Series 2020-2025)  (3 Season Complete)/ซีซั่น 3/S03E002_ตอน 2_by MerkavaMII.mkv`;

    const inputs = [fullPath1, fullPath2, fullPath3];

    const calls = planCopySync(inputs);

    expect(calls.length).toBe(2);

    const s2Call = calls.find(
      (c) => c.destination === `${TVSHOW_DIR}/Alice in Borderland (2020-2025)/Season 2`
    );
    expect(s2Call).toBeDefined();
    expect(s2Call?.sources).toEqual([fullPath1]);

    const s3Call = calls.find(
      (c) => c.destination === `${TVSHOW_DIR}/Alice in Borderland (2020-2025)/Season 3`
    );
    expect(s3Call).toBeDefined();
    expect(s3Call?.sources).toEqual([fullPath2, fullPath3]);
  });

  test("handles Thai series tag preserving release year and title (The Believers example)", () => {
    const fullPath1 = `${PREFIX}[Series-TH] The Believers 2 (2025) สาธุ 2/สาธุ_S02E01_ต้นไม้แห่งธรรม.mkv`;
    const fullPath2 = `${PREFIX}[Series-TH] The Believers 2 (2025) สาธุ 2/สาธุ_S02E02_วงล้อแห่งศรัทธา.mkv`;

    const calls = planCopySync([fullPath1, fullPath2]);

    expect(calls.length).toBe(1);
    expect(calls[0].destination).toBe(`${TVSHOW_DIR}/The Believers 2 สาธุ 2 (2025)/Season 2`);
    expect(calls[0].sources).toEqual([fullPath1, fullPath2]);
  });

  test("handles batch array with mixed movies and TV shows using full absolute paths", async () => {
    const movie1 = `${PREFIX}BlackBerry.(2023).1080p.BrRip.x264.DDP.5.1.THM.mkv`;
    const movie2 = `${PREFIX}Challengers.(2024).1080p.BrRip.x264.DDP.5.1.Atmos.THD.mkv`;
    const tv1 = `${PREFIX}Succession.S02.1080p/Succession.S02E01.The.Summer.Palace.1080p.mkv`;
    const tv2 = `${PREFIX}Succession.S02.1080p/Succession.S02E02.Vaulter.1080p.mkv`;
    const tv3 = `${PREFIX}Shrinking.S01.1080p/Shrinking.S01E01.Coin.Flip.1080p.mkv`;

    const inputs = [movie1, movie2, tv1, tv2, tv3];

    const calls = await planCopy(inputs);

    expect(calls.length).toBe(3);

    const movieCall = calls.find((c) => c.destination === MOVIE_DIR);
    expect(movieCall).toBeDefined();
    expect(movieCall?.sources).toEqual([movie1, movie2]);

    const successionCall = calls.find(
      (c) => c.destination === `${TVSHOW_DIR}/Succession/Season 2`
    );
    expect(successionCall).toBeDefined();
    expect(successionCall?.sources).toEqual([tv1, tv2]);

    const shrinkingCall = calls.find(
      (c) => c.destination === `${TVSHOW_DIR}/Shrinking/Season 1`
    );
    expect(shrinkingCall).toBeDefined();
    expect(shrinkingCall?.sources).toEqual([tv3]);
  });

  test("includes detailed metadata fields (type, title, season, tvshowBaseDir) for UI customization", async () => {
    const tvPath = `${PREFIX}Rick.and.Morty.S09E10.mkv`;
    const moviePath = `${PREFIX}Project.Hail.Mary.2026.mkv`;

    const calls = await planCopy([tvPath, moviePath], {
      movieDir: MOVIE_DIR,
      tvshowDir: TVSHOW_DIR,
    });

    const tvCall = calls.find((c) => c.type === "tvshow");
    expect(tvCall).toBeDefined();
    expect(tvCall?.title).toBe("Rick and Morty");
    expect(tvCall?.season).toBe("Season 9");
    expect(tvCall?.tvshowBaseDir).toBe(TVSHOW_DIR);

    const movieCall = calls.find((c) => c.type === "movie");
    expect(movieCall).toBeDefined();
    expect(movieCall?.type).toBe("movie");
  });
});
