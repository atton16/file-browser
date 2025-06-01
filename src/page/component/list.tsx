import { readdir, stat } from "node:fs/promises";
import { DateTime } from "luxon";
import { customLoggerWithRequestId as loggerWithRequestId } from "../../customLogger";
import { PATH_PREFIX, BASE_PATH } from "../common/path";
import { modeToLinux } from "../common/mode";
import { formatBytes } from "../common/format";
import { getUsername, getGroup } from "../common/lookup";

export const List = async ({
  requestId,
  cwd,
}: {
  requestId: string;
  cwd: string;
}) => {
  const logger = loggerWithRequestId(requestId);
  const myPath = `${BASE_PATH}${cwd}`;
  const files = await readdir(myPath, {
    encoding: "utf-8",
    withFileTypes: true,
  });
  const myFiles: Array<{
    name: string;
    isDirectory: boolean;
    href: string;
    absolutePath: string;
    size: string;
    mode: string;
    uid: number;
    gid: number;
    username: string;
    group: string;
    mtimeMs: number;
    mtime: string;
  }> = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filepath = `${myPath}/${file.name}`;
    const filestat = await stat(`${myPath}/${file.name}`);
    // logger("[List] filepath", filepath);
    const username = await getUsername(filestat.uid);
    const group = await getGroup(filestat.gid);
    myFiles.push({
      name: file.name,
      isDirectory: file.isDirectory(),
      href: `${PATH_PREFIX}${cwd}/${file.name}`,
      absolutePath: filepath,
      size: file.isDirectory() ? "" : formatBytes(filestat.size),
      mode: modeToLinux(filestat.mode),
      uid: filestat.uid,
      gid: filestat.gid,
      username: username!,
      group: group!,
      mtimeMs: filestat.mtimeMs,
      mtime: DateTime.fromMillis(filestat.mtimeMs)
        .setZone("Asia/Bangkok")
        .toFormat("yyyy-MM-dd HH:mm:ss"),
    });
  }
  logger("[List] cwd", cwd);
  // logger("[List] files", JSON.stringify(files, null, 2));
  // logger("[List] myFiles", JSON.stringify(myFiles, null, 2));
  return (
    <form id="my-form">
      <button
        type="button"
        class="btn btn-outline-secondary"
        id="copy-selected"
        data-bs-toggle="modal"
        data-bs-target="#copy-modal"
        disabled
      >
        Copy selected
      </button>
      <div
        class="modal fade"
        id="copy-modal"
        tabindex={-1}
        aria-labelledby="copy-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h1 class="modal-title fs-5" id="copy-modal-label">
                Copy selected
              </h1>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div class="modal-body">
              <h6>Source</h6>
              <div class="mb-3" id="copy-list"></div>
              <h6>Destination</h6>
              <input
                class="form-control mb-3"
                type="text"
                placeholder="/path/to/destination"
                aria-label="Copy destination folder"
                list="copy-destination-datalist"
                id="copy-destination"
              />
              <datalist id="copy-destination-datalist"></datalist>
              <h6>Output</h6>
              <div class="mb-3" id="output">
                <div
                  class="spinner-border"
                  role="status"
                  id="spinner"
                  style="display: none;"
                >
                  <span class="visually-hidden">Loading...</span>
                </div>
                <pre id="output-content"></pre>
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
              <button type="submit" id="copy-button" class="btn btn-primary">
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
      <table class="table table-striped" id="dir">
        <thead>
          <tr>
            <th scope="col">
              <div class="form-check">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="check-all"
                />
              </div>
            </th>
            <th scope="col">NAME</th>
            <th scope="col">OWNER</th>
            <th scope="col">PERMISSION</th>
            <th scope="col" class="text-end">
              SIZE
            </th>
            <th scope="col" class="text-end">
              MODIFIED
            </th>
          </tr>
        </thead>
        <tbody>
          {myFiles.map((file, index) => (
            <tr key={index}>
              <th scope="row">
                <div class="form-check">
                  <input
                    class="form-check-input child"
                    type="checkbox"
                    value={file.absolutePath}
                  />
                </div>
              </th>
              {file.isDirectory ? (
                <td>
                  <a href={file.href}>{file.name}</a>
                </td>
              ) : (
                <td>{file.name}</td>
              )}
              <td>
                {file.username ? file.username : file.uid}:
                {file.group ? file.group : file.gid}
              </td>
              <td>{file.mode}</td>
              <td class="text-end">{file.size}</td>
              <td class="text-end">{file.mtime}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <script src="/public/page/list.js"></script>
    </form>
  );
};
