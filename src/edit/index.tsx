import { Hono } from "hono";
import path from "node:path";
import { BASE_PATH, PATH_PREFIX } from "../constant";
import { resolveSafePath } from "../api/file";

export const editPage = new Hono();

editPage.get("/*", (c) => {
  const logger = c.get("logger");
  const reqPath = c.req.path;
  logger("[editPage] reqPath", reqPath);

  // Strip leading /edit prefix
  let relativeFilePath = reqPath.replace(/^\/edit\/?/, "");
  // If absolute path was passed like /edit//mnt/user/...
  if (relativeFilePath.startsWith(BASE_PATH)) {
    relativeFilePath = relativeFilePath.slice(BASE_PATH.length);
  }
  relativeFilePath = relativeFilePath.replace(/^\/+/, "");

  const fullFilePath = resolveSafePath(relativeFilePath);
  const fileName = relativeFilePath ? path.basename(relativeFilePath) : "";
  const dirName = relativeFilePath ? path.dirname(relativeFilePath) : "";
  const folderHref = dirName && dirName !== "." ? `${PATH_PREFIX}/${dirName}` : PATH_PREFIX;

  // Breadcrumb segments
  const pathParts = relativeFilePath.split("/").filter(Boolean);
  const breadcrumbSegments = pathParts.map((part, index) => {
    const isLast = index === pathParts.length - 1;
    const href = `${PATH_PREFIX}/${pathParts.slice(0, index + 1).join("/")}`;
    return {
      title: part,
      href,
      isLast,
    };
  });

  return c.render(
    <div class="container-fluid px-4 py-3 d-flex flex-column" style="min-height: 100vh;">
      {/* Top Header & Breadcrumb */}
      <div class="d-flex flex-wrap justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <a href={folderHref} class="btn btn-outline-secondary btn-sm" id="back-btn">
            &larr; Back to Folder
          </a>
          <nav aria-label="breadcrumb" class="mb-0">
            <ol class="breadcrumb mb-0 align-items-center">
              <li class="breadcrumb-item">
                <a href={PATH_PREFIX} class="text-decoration-none">
                  {BASE_PATH}
                </a>
              </li>
              {breadcrumbSegments.map((segment, idx) =>
                segment.isLast ? (
                  <li class="breadcrumb-item active text-info fw-semibold" aria-current="page" key={idx}>
                    {segment.title}
                  </li>
                ) : (
                  <li class="breadcrumb-item" key={idx}>
                    <a href={segment.href} class="text-decoration-none">
                      {segment.title}
                    </a>
                  </li>
                )
              )}
            </ol>
          </nav>
        </div>

        {/* Action Controls */}
        <div class="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <span class="badge bg-secondary" id="file-language">Detecting...</span>
          <span class="badge bg-warning text-dark d-none" id="readonly-badge">READ ONLY</span>
          <span class="badge bg-info d-none" id="dirty-badge">● Unsaved</span>
          <span class="badge bg-success d-none" id="saved-badge">✓ Saved</span>

          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" id="save-btn">
            <span class="spinner-border spinner-border-sm d-none" id="save-spinner" role="status"></span>
            <span>Save</span>
            <kbd class="bg-dark text-white border border-secondary px-1 py-0 ms-1" style="font-size: 0.75rem;">
              Ctrl+S
            </kbd>
          </button>
          <button class="btn btn-success btn-sm" id="save-close-btn">
            Save &amp; Close
          </button>
        </div>
      </div>

      {/* Alert Banner for errors or notices */}
      <div id="editor-alert" class="alert d-none mb-2 py-2" role="alert"></div>

      {/* Monaco Container */}
      <div class="flex-grow-1 position-relative" style="min-height: 550px;">
        <div
          id="monaco-editor-container"
          class="w-100 h-100 rounded border border-secondary position-absolute top-0 start-0"
          style="min-height: 500px;"
        ></div>
        <div
          id="editor-loading"
          class="position-absolute top-50 start-50 translate-middle text-center"
        >
          <div class="spinner-border text-primary mb-2" role="status"></div>
          <div class="text-secondary">Loading file in Monaco Editor...</div>
        </div>
      </div>

      {/* Hidden inputs to pass page context to editor.js */}
      <input type="hidden" id="editor-file-path" value={fullFilePath || ""} />
      <input type="hidden" id="editor-raw-path" value={relativeFilePath} />
      <input type="hidden" id="editor-file-name" value={fileName} />
      <input type="hidden" id="editor-folder-href" value={folderHref} />

      {/* Scripts */}
      <script src="/public/monaco/vs/loader.js"></script>
      <script src="/public/edit/editor.js"></script>
    </div>,
    { title: `Edit ${fileName || "File"} - File Browser` }
  );
});
