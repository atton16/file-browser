import { readdir, stat } from "node:fs/promises";
import { DateTime } from "luxon";
import { customLoggerWithRequestId as loggerWithRequestId } from "../../customLogger";
import { PATH_PREFIX, BASE_PATH } from "../common/path";
import { modeToLinux, modeToOctal } from "../common/mode";
import { formatBytes } from "../common/format";
import { getUsername, getGroup } from "../common/lookup";

const normalizePath = (p: string) => p.replace(/\/+/g, "/");

export const List = async ({
  requestId,
  cwd,
}: {
  requestId: string;
  cwd: string;
}) => {
  const logger = loggerWithRequestId(requestId);
  const rawPath = `${BASE_PATH}/${cwd}`;
  const myPath = normalizePath(rawPath);
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
    modeOctal: string;
    uid: number;
    gid: number;
    username: string;
    group: string;
    mtimeMs: number;
    mtime: string;
  }> = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filepath = normalizePath(`${myPath}/${file.name}`);
    const filestat = await stat(filepath);
    const username = await getUsername(filestat.uid);
    const group = await getGroup(filestat.gid);
    myFiles.push({
      name: file.name,
      isDirectory: file.isDirectory(),
      href: normalizePath(`${PATH_PREFIX}/${cwd}/${file.name}`),
      absolutePath: filepath,
      size: file.isDirectory() ? "" : formatBytes(filestat.size),
      mode: modeToLinux(filestat.mode),
      modeOctal: modeToOctal(filestat.mode),
      uid: filestat.uid,
      gid: filestat.gid,
      username: username!,
      group: group!,
      mtimeMs: filestat.mtimeMs,
      mtime: DateTime.fromMillis(filestat.mtimeMs)
        .setZone("Asia/Bangkok")
        .toFormat("yyyy-MM-dd HH:mm:ss"),
  }
  myFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  logger("[List] cwd", cwd);

  const currentFolderPath = myPath;

  return (
    <div>
      {/* Toolbar Buttons */}
      <div class="btn-toolbar mb-3 gap-2" role="toolbar">
        <button
          type="button"
          class="btn btn-outline-success"
          id="mkdir-selected"
          data-bs-toggle="modal"
          data-bs-target="#mkdir-modal"
        >
          + CREATE FOLDER
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          id="copy-selected"
          data-bs-toggle="modal"
          data-bs-target="#copy-modal"
          disabled
        >
          COPY
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          id="auto-copy-selected"
          data-bs-toggle="modal"
          data-bs-target="#auto-copy-modal"
          disabled
        >
          ⚡ AUTO COPY
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          id="rename-selected"
          data-bs-toggle="modal"
          data-bs-target="#rename-modal"
          disabled
        >
          RENAME
        </button>
        <button
          type="button"
          class="btn btn-outline-info"
          id="chmod-selected"
          data-bs-toggle="modal"
          data-bs-target="#chmod-modal"
          disabled
        >
          PERMISSION
        </button>
        <button
          type="button"
          class="btn btn-outline-warning"
          id="chown-selected"
          data-bs-toggle="modal"
          data-bs-target="#chown-modal"
          disabled
        >
          OWNER
        </button>
        <button
          type="button"
          class="btn btn-outline-danger"
          id="delete-selected"
          data-bs-toggle="modal"
          data-bs-target="#delete-modal"
          disabled
        >
          DELETE
        </button>
      </div>

      {/* Modal: Create Folder */}
      <div
        class="modal fade"
        id="mkdir-modal"
        tabindex={-1}
        aria-labelledby="mkdir-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="mkdir-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="mkdir-modal-label">
                  Create New Folder
                </h1>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Current Directory</label>
                  <input
                    type="text"
                    class="form-control"
                    value={currentFolderPath}
                    id="mkdir-cwd"
                    readonly
                  />
                </div>
                <div class="mb-3">
                  <label for="mkdir-name" class="form-label">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="mkdir-name"
                    placeholder="Enter folder name"
                    required
                  />
                </div>
                <div class="mb-3" id="mkdir-output" style="display: none;">
                  <pre class="alert alert-danger" id="mkdir-output-content"></pre>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button type="submit" id="mkdir-button" class="btn btn-success">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Copy */}
      <div
        class="modal fade"
        id="copy-modal"
        tabindex={-1}
        aria-labelledby="copy-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="my-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="copy-modal-label">
                  Copy
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
                <div class="mb-3 text-break" id="copy-list"></div>
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
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Auto Copy */}
      <div
        class="modal fade"
        id="auto-copy-modal"
        tabindex={-1}
        aria-labelledby="auto-copy-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <form id="auto-copy-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="auto-copy-modal-label">
                  Auto Copy Plan Review
                </h1>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <p class="text-muted small">
                  Review the automatically identified destination paths for your selected media files/folders before confirming copy.
                </p>
                <div class="mb-3" id="auto-copy-plan-loading">
                  <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                  <span>Analyzing files & generating copy plan...</span>
                </div>
                <div class="mb-3" id="auto-copy-plan-container" style="display: none;">
                  {/* Copy API Call Plans will be rendered here dynamically */}
                </div>
                <div class="mb-3" id="auto-copy-output" style="display: none;">
                  <h6>Status</h6>
                  <div class="spinner-border text-primary me-2 mb-2" role="status" id="auto-copy-spinner" style="display: none;"></div>
                  <pre id="auto-copy-output-content" class="bg-light p-2 border rounded text-break"></pre>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                  id="auto-copy-cancel-button"
                >
                  Cancel
                </button>
                <button type="submit" id="auto-copy-confirm-button" class="btn btn-primary" disabled>
                  Confirm & Copy
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Rename */}
      <div
        class="modal fade"
        id="rename-modal"
        tabindex={-1}
        aria-labelledby="rename-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="rename-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="rename-modal-label">
                  Rename
                </h1>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <input type="hidden" id="rename-old-path" />
                <div class="mb-3">
                  <label class="form-label">Current Name</label>
                  <input
                    type="text"
                    class="form-control"
                    id="rename-old-name"
                    readonly
                  />
                </div>
                <div class="mb-3">
                  <label for="rename-new-name" class="form-label">
                    New Name
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="rename-new-name"
                    placeholder="Enter new name"
                    required
                  />
                </div>
                <div class="mb-3" id="rename-output" style="display: none;">
                  <pre class="alert alert-danger" id="rename-output-content"></pre>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button type="submit" id="rename-button" class="btn btn-secondary">
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Change Permission */}
      <div
        class="modal fade"
        id="chmod-modal"
        tabindex={-1}
        aria-labelledby="chmod-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="chmod-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="chmod-modal-label">
                  Change Permission
                </h1>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <h6>Target Item(s)</h6>
                <div class="mb-3 text-break" id="chmod-list"></div>
                <div class="mb-3">
                  <label for="chmod-mode" class="form-label">
                    Permission (Octal format, e.g. 755 or 644)
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="chmod-mode"
                    placeholder="755"
                    pattern="[0-7]{3,4}"
                    required
                  />
                </div>
                <div class="mb-3" id="chmod-output" style="display: none;">
                  <pre class="alert alert-danger" id="chmod-output-content"></pre>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button type="submit" id="chmod-button" class="btn btn-info">
                  Save Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Change Owner */}
      <div
        class="modal fade"
        id="chown-modal"
        tabindex={-1}
        aria-labelledby="chown-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="chown-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="chown-modal-label">
                  Change Owner / Group
                </h1>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <h6>Target Item(s)</h6>
                <div class="mb-3 text-break" id="chown-list"></div>
                <div class="mb-3">
                  <label for="chown-user" class="form-label">
                    User / Owner (Username or UID)
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="chown-user"
                    placeholder="e.g. root or 0"
                  />
                </div>
                <div class="mb-3">
                  <label for="chown-group" class="form-label">
                    Group (Group Name or GID)
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="chown-group"
                    placeholder="e.g. wheel or 0"
                  />
                </div>
                <div class="mb-3" id="chown-output" style="display: none;">
                  <pre class="alert alert-danger" id="chown-output-content"></pre>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button type="submit" id="chown-button" class="btn btn-warning">
                  Save Owner
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Delete */}
      <div
        class="modal fade"
        id="delete-modal"
        tabindex={-1}
        aria-labelledby="delete-modal-label"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="delete-form">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="delete-modal-label">
                  Delete Confirmation
                </h1>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <p class="text-danger fw-bold">
                  Are you sure you want to permanently delete the following item(s)?
                </p>
                <div class="mb-3 text-break alert alert-secondary" id="delete-list"></div>
                <div class="mb-3" id="delete-output" style="display: none;">
                  <pre class="alert alert-danger" id="delete-output-content"></pre>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button type="submit" id="delete-button" class="btn btn-danger">
                  Delete Permanently
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Table */}
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
                    data-name={file.name}
                    data-username={file.username || file.uid.toString()}
                    data-group={file.group || file.gid.toString()}
                    data-uid={file.uid}
                    data-gid={file.gid}
                    data-mode={file.modeOctal}
                    data-is-directory={file.isDirectory ? "true" : "false"}
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
    </div>
  );
};
