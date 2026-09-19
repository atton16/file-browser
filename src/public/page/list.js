/**
 * Load constant
 */
const constant = JSON.parse(document.getElementById("constant").value);

/**
 * Helper to normalize path slashes
 */
function cleanPath(p) {
  if (!p) return "";
  return p.replace(/\/+/g, "/");
}

/**
 * Get selected file/folder checkboxes
 */
function getSelectedCheckboxes() {
  return Array.from(
    document.querySelectorAll('input[type="checkbox"].form-check-input.child:checked')
  );
}

/**
 * Control enablement of action buttons based on selection count
 */
function controlActionButtons() {
  const selected = getSelectedCheckboxes();
  const count = selected.length;

  const copySel = document.getElementById("copy-selected");
  if (copySel) copySel.disabled = count === 0;

  const autoCopySel = document.getElementById("auto-copy-selected");
  if (autoCopySel) autoCopySel.disabled = count === 0;

  const renameSel = document.getElementById("rename-selected");
  if (renameSel) renameSel.disabled = count !== 1;

  const chmodSel = document.getElementById("chmod-selected");
  if (chmodSel) chmodSel.disabled = count === 0;

  const chownSel = document.getElementById("chown-selected");
  if (chownSel) chownSel.disabled = count === 0;

  const editSel = document.getElementById("edit-selected");
  if (editSel) {
    const isSingleNonDir = count === 1 && selected[0].dataset.isDirectory === "false";
    editSel.disabled = !isSingleNonDir;
  }

  const deleteSel = document.getElementById("delete-selected");
  if (deleteSel) deleteSel.disabled = count === 0;
}

const editBtn = document.getElementById("edit-selected");
if (editBtn) {
  editBtn.addEventListener("click", function () {
    const selected = getSelectedCheckboxes();
    if (selected.length === 1 && selected[0].dataset.isDirectory === "false") {
      const absPath = selected[0].value;
      window.location.href = `/edit/${cleanPath(absPath)}`;
    }
  });
}

// Check all / Uncheck all
document.getElementById("check-all").addEventListener("change", function () {
  const checkboxes = document.querySelectorAll(
    'input[type="checkbox"].form-check-input.child'
  );
  checkboxes.forEach((checkbox) => (checkbox.checked = this.checked));
  controlActionButtons();
});

// Event delegation for row checkboxes
$(document).on("change", 'input[type="checkbox"].form-check-input.child', controlActionButtons);

/**
 * Autocomplete destination folder search on destination input change
 */
function debounce(func, delay) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => func.apply(this, args), delay);
  };
}

function handleInputChange(event) {
  $.get(
    "/api/dir?q=" + encodeURIComponent(event.target.value),
    function (data) {
      const dir = data.dir || [];
      document.getElementById("copy-destination-datalist").innerHTML = dir
        .map((item) => `<option value="${cleanPath(item)}" />`)
        .join("");
    }
  );
}

const copyDestination = document.getElementById("copy-destination");
if (copyDestination) {
  copyDestination.addEventListener("keyup", debounce(handleInputChange, 200));
  copyDestination.addEventListener("keyup", () => {
    const copyButton = document.getElementById("copy-button");
    copyButton.disabled = !copyDestination.value;
  });
}

/**
 * Copy Modal Setup & Submit
 */
let redirectTo = null;
let isLoading = false;
const copyModal = document.getElementById("copy-modal");
if (copyModal) {
  document.getElementById("copy-selected").addEventListener("click", function () {
    const selected = getSelectedCheckboxes();
    const sources = selected.map((el) => cleanPath(el.value));
    document.getElementById("copy-list").innerHTML = sources.join("<br />");
  });

  copyModal.addEventListener("hide.bs.modal", (e) => {
    if (redirectTo) {
      e.preventDefault();
      window.location.href = redirectTo;
      return;
    }
    if (isLoading) {
      e.preventDefault();
      return;
    }
    $("#output-content").html("");
    $("#spinner").hide();
    $("#copy-destination").val("");
  });

  copyModal.addEventListener("show.bs.modal", () => {
    document.getElementById("copy-button").disabled = true;
  });

  document.getElementById("my-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const selected = getSelectedCheckboxes();
    const sources = selected.map((el) => cleanPath(el.value));
    const destination = cleanPath(document.getElementById("copy-destination").value);
    $("#output-content").html("");
    $("#spinner").show();
    isLoading = true;

    $.ajax({
      url: "/api/copy",
      type: "POST",
      data: JSON.stringify({ sources, destination }),
      contentType: "application/json",
      success: function (data) {
        isLoading = false;
        $("#spinner").hide();
        const { cmds } = data;
        for (let i = 0; i < cmds.length; i++) {
          if (cmds[i].error) {
            $("#output-content").html(JSON.stringify(cmds[i], null, 2));
            return;
          }
        }
        $("#output-content").html("Done");
        redirectTo = cleanPath(
          constant.PATH_PREFIX + destination.slice(constant.BASE_PATH.length)
        );
      },
      error: function (e) {
        isLoading = false;
        $("#spinner").hide();
        $("#output-content").html(JSON.stringify(e.responseJSON || e, null, 2));
      },
    });
  });
}

/**
 * Auto Copy Modal Setup & Submit
 */
let autoCopyRedirectTo = null;
let isAutoCopyLoading = false;
let currentAutoCopyPlans = [];
const autoCopyModal = document.getElementById("auto-copy-modal");
if (autoCopyModal) {
  autoCopyModal.addEventListener("hide.bs.modal", (e) => {
    if (autoCopyRedirectTo) {
      e.preventDefault();
      window.location.href = autoCopyRedirectTo;
      return;
    }
    if (isAutoCopyLoading) {
      e.preventDefault();
      return;
    }
    $("#auto-copy-output-content").text("");
    $("#auto-copy-spinner").hide();
  });

  // Delegated event listener for Type dropdown changes
  $(document).off("change", ".auto-copy-type-select").on("change", ".auto-copy-type-select", function () {
    const idx = parseInt($(this).attr("data-plan-index"), 10);
    if (isNaN(idx) || !currentAutoCopyPlans[idx]) return;

    const plan = currentAutoCopyPlans[idx];
    const newType = $(this).val();
    plan.type = newType;

    const tvFields = $(`#auto-copy-tv-fields-${idx}`);

    if (newType === "movie") {
      tvFields.hide();
      const movieBase = plan.movieBaseDir || (constant.BASE_PATH ? cleanPath(`${constant.BASE_PATH}/media/Movies/Intl`) : "/mnt/user/media/media/Movies/Intl");
      plan.destination = cleanPath(movieBase);
      $(`#auto-copy-dest-${idx}`).val(plan.destination);
    } else if (newType === "tvshow") {
      tvFields.show();
      let title = $(`#auto-copy-title-${idx}`).val().trim();
      let season = $(`#auto-copy-season-${idx}`).val().trim();

      if (!title) {
        title = plan.title || "Unknown Show";
        $(`#auto-copy-title-${idx}`).val(title);
      }
      if (!season) {
        season = plan.season || "Season 1";
        $(`#auto-copy-season-${idx}`).val(season);
      }

      plan.title = title;
      plan.season = season;

      let tvBase = plan.tvshowBaseDir || (constant.BASE_PATH ? cleanPath(`${constant.BASE_PATH}/media/Movie Series`) : "/mnt/user/media/media/Movie Series");
      let newDest = "";
      if (plan.isShowDir) {
        newDest = title ? `${tvBase}/${title}` : tvBase;
      } else {
        if (title && season) {
          newDest = `${tvBase}/${title}/${season}`;
        } else if (title) {
          newDest = `${tvBase}/${title}`;
        } else {
          newDest = tvBase;
        }
      }
      newDest = cleanPath(newDest);
      plan.destination = newDest;
      $(`#auto-copy-dest-${idx}`).val(newDest);
    }
  });

  // Delegated event listener for Title & Season input changes
  $(document).off("input", ".auto-copy-title-input, .auto-copy-season-input").on("input", ".auto-copy-title-input, .auto-copy-season-input", function () {
    const idx = parseInt($(this).attr("data-plan-index"), 10);
    if (isNaN(idx) || !currentAutoCopyPlans[idx]) return;

    const plan = currentAutoCopyPlans[idx];
    const newTitle = $(`#auto-copy-title-${idx}`).val().trim();
    const newSeason = $(`#auto-copy-season-${idx}`).val().trim();

    plan.title = newTitle;
    plan.season = newSeason;

    let baseDir = plan.tvshowBaseDir;
    if (!baseDir && plan.destination) {
      if (plan.title) {
        const titleIdx = plan.destination.indexOf("/" + plan.title);
        if (titleIdx !== -1) {
          baseDir = plan.destination.substring(0, titleIdx);
        }
      }
    }

    if (baseDir) {
      let newDest = "";
      if (plan.isShowDir) {
        newDest = newTitle ? `${baseDir}/${newTitle}` : baseDir;
      } else {
        if (newTitle && newSeason) {
          newDest = `${baseDir}/${newTitle}/${newSeason}`;
        } else if (newTitle) {
          newDest = `${baseDir}/${newTitle}`;
        } else {
          newDest = baseDir;
        }
      }
      newDest = cleanPath(newDest);
      plan.destination = newDest;
      $(`#auto-copy-dest-${idx}`).val(newDest);
    }
  });

  // Delegated event listener for direct Destination input changes
  $(document).off("input", ".auto-copy-dest-input").on("input", ".auto-copy-dest-input", function () {
    const idx = parseInt($(this).attr("data-plan-index"), 10);
    if (isNaN(idx) || !currentAutoCopyPlans[idx]) return;

    currentAutoCopyPlans[idx].destination = cleanPath($(this).val());
  });

  autoCopyModal.addEventListener("show.bs.modal", function () {
    autoCopyRedirectTo = null;
    isAutoCopyLoading = false;
    const selected = getSelectedCheckboxes();
    const sources = selected.map((el) => cleanPath(el.value));

    $("#auto-copy-plan-container").hide().empty();
    $("#auto-copy-output").hide();
    $("#auto-copy-output-content").text("");
    $("#auto-copy-spinner").hide();
    $("#auto-copy-plan-loading").show();
    $("#auto-copy-confirm-button").prop("disabled", true);

    $.ajax({
      url: "/api/copy/plan",
      type: "POST",
      data: JSON.stringify({ sources }),
      contentType: "application/json",
      success: function (data) {
        currentAutoCopyPlans = (data.plans || []).map((plan) => ({
          destination: cleanPath(plan.destination),
          sources: (plan.sources || []).map((s) => cleanPath(s)),
          type: plan.type || "movie",
          title: plan.title || "",
          season: plan.season || "",
          tvshowBaseDir: plan.tvshowBaseDir || "",
          movieBaseDir: plan.movieBaseDir || "",
          isShowDir: !!plan.isShowDir,
        }));
        $("#auto-copy-plan-loading").hide();

        if (currentAutoCopyPlans.length === 0) {
          $("#auto-copy-plan-container")
            .html('<div class="alert alert-warning">No copy plans generated.</div>')
            .show();
          return;
        }

        let html = "";
        currentAutoCopyPlans.forEach((plan, idx) => {
          const isTv = plan.type === "tvshow";
          html += `
            <div class="card mb-3 border-primary-subtle shadow-sm">
              <div class="card-header bg-light-subtle d-flex justify-content-between align-items-center flex-wrap gap-2 py-2">
                <span class="fw-bold text-primary">
                  Plan #${idx + 1}
                </span>
                <span class="badge bg-primary rounded-pill">${plan.sources.length} item(s)</span>
              </div>
              <div class="card-body p-3">
                <div class="mb-3">
                  <label class="form-label form-label-sm fw-semibold mb-1" for="auto-copy-type-${idx}">Detected Type</label>
                  <select id="auto-copy-type-${idx}" class="form-select form-select-sm auto-copy-type-select" data-plan-index="${idx}">
                    <option value="tvshow" ${isTv ? "selected" : ""}>TV Show</option>
                    <option value="movie" ${!isTv ? "selected" : ""}>Movie</option>
                  </select>
                </div>

                <div id="auto-copy-tv-fields-${idx}" class="row g-2 mb-3" style="${isTv ? "" : "display: none;"}">
                  <div class="col-12 col-md-7">
                    <label class="form-label form-label-sm fw-semibold mb-1" for="auto-copy-title-${idx}">Title</label>
                    <input
                      type="text"
                      id="auto-copy-title-${idx}"
                      class="form-control form-control-sm auto-copy-title-input"
                      data-plan-index="${idx}"
                      value="${escapeHtml(plan.title)}"
                      placeholder="TV Show Title"
                    />
                  </div>
                  <div class="col-12 col-md-5">
                    <label class="form-label form-label-sm fw-semibold mb-1" for="auto-copy-season-${idx}">Season</label>
                    <input
                      type="text"
                      id="auto-copy-season-${idx}"
                      class="form-control form-control-sm auto-copy-season-input"
                      data-plan-index="${idx}"
                      value="${escapeHtml(plan.season)}"
                      placeholder="Season (e.g. Season 1)"
                    />
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label form-label-sm fw-semibold mb-1" for="auto-copy-dest-${idx}">Destination</label>
                  <input
                    type="text"
                    id="auto-copy-dest-${idx}"
                    class="form-control form-control-sm font-monospace auto-copy-dest-input"
                    data-plan-index="${idx}"
                    value="${escapeHtml(plan.destination)}"
                    placeholder="/path/to/destination"
                  />
                </div>

                <div>
                  <label class="form-label form-label-sm text-muted mb-1">Sources (${plan.sources.length})</label>
                  <ul class="list-group list-group-flush font-monospace small border rounded" style="max-height: 120px; overflow-y: auto;">
                    ${plan.sources
                      .map(
                        (src) =>
                          `<li class="list-group-item py-1 text-break" style="word-break: break-all;" title="${escapeHtml(src)}">${escapeHtml(src)}</li>`
                      )
                      .join("")}
                  </ul>
                </div>
              </div>
            </div>
          `;
        });

        $("#auto-copy-plan-container").html(html).show();
        $("#auto-copy-confirm-button").prop("disabled", false);
      },
      error: function (xhr) {
        $("#auto-copy-plan-loading").hide();
        const errText = xhr.responseJSON ? xhr.responseJSON.error : "Failed to generate copy plan";
        $("#auto-copy-output-content").text(errText);
        $("#auto-copy-output").show();
      },
    });
  });

  document.getElementById("auto-copy-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!currentAutoCopyPlans || currentAutoCopyPlans.length === 0) return;

    // Collect latest destinations from inputs
    const finalPlans = currentAutoCopyPlans.map((plan, idx) => {
      const destInputVal = $(`#auto-copy-dest-${idx}`).val();
      const destination = destInputVal !== undefined ? cleanPath(destInputVal.trim()) : plan.destination;
      return {
        sources: plan.sources,
        destination,
      };
    });

    isAutoCopyLoading = true;
    $("#auto-copy-confirm-button").prop("disabled", true);
    $("#auto-copy-cancel-button").prop("disabled", true);
    $("#auto-copy-output").show();
    $("#auto-copy-spinner").show();
    $("#auto-copy-output-content").text("Starting copy process...\n");

    for (let i = 0; i < finalPlans.length; i++) {
      const plan = finalPlans[i];
      const stepMsg = `[${i + 1}/${finalPlans.length}] Copying to ${plan.destination}...\n`;
      $("#auto-copy-output-content").append(stepMsg);

      try {
        const res = await $.ajax({
          url: "/api/copy",
          type: "POST",
          data: JSON.stringify({
            sources: plan.sources,
            destination: plan.destination,
          }),
          contentType: "application/json",
        });

        if (res.cmds) {
          const failedCmd = res.cmds.find((cmd) => cmd.error);
          if (failedCmd) {
            isAutoCopyLoading = false;
            $("#auto-copy-spinner").hide();
            $("#auto-copy-output-content").append(
              `ERROR: Copy failed for destination ${plan.destination}\n` +
                JSON.stringify(failedCmd.error, null, 2)
            );
            $("#auto-copy-cancel-button").prop("disabled", false);
            return;
          }
        }
      } catch (err) {
        isAutoCopyLoading = false;
        $("#auto-copy-spinner").hide();
        const errJson = err.responseJSON || err.statusText || "Failed";
        $("#auto-copy-output-content").append(
          `ERROR: Failed to execute copy to ${plan.destination}\n` +
            JSON.stringify(errJson, null, 2)
        );
        $("#auto-copy-cancel-button").prop("disabled", false);
        return;
      }
    }

    isAutoCopyLoading = false;
    $("#auto-copy-spinner").hide();
    $("#auto-copy-output-content").append("Done! All items copied successfully.");

    if (finalPlans.length > 0 && finalPlans[0].destination) {
      const destination = finalPlans[0].destination;
      let destPath = destination;
      if (destPath.startsWith(constant.BASE_PATH)) {
        destPath = destPath.slice(constant.BASE_PATH.length);
      }
      autoCopyRedirectTo = cleanPath(
        constant.PATH_PREFIX + (destPath.startsWith("/") ? destPath : "/" + destPath)
      );
      setTimeout(function () {
        window.location.href = autoCopyRedirectTo;
      }, 1200);
    } else {
      setTimeout(function () {
        window.location.reload();
      }, 1200);
    }
  });
}

/**
 * Helper to escape HTML characters
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Create Folder Modal & Submit
 */
const mkdirModal = document.getElementById("mkdir-modal");
if (mkdirModal) {
  mkdirModal.addEventListener("show.bs.modal", () => {
    $("#mkdir-name").val("");
    $("#mkdir-output").hide();
    $("#mkdir-output-content").text("");
  });

  document.getElementById("mkdir-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const folderName = $("#mkdir-name").val().trim();
    const cwd = $("#mkdir-cwd").val();
    const rawPath = cwd.endsWith("/") ? cwd + folderName : cwd + "/" + folderName;
    const path = cleanPath(rawPath);

    $.ajax({
      url: "/api/mkdir",
      type: "POST",
      data: JSON.stringify({ path }),
      contentType: "application/json",
      success: function () {
        window.location.reload();
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Failed to create folder";
        $("#mkdir-output-content").text(err);
        $("#mkdir-output").show();
      },
    });
  });
}

/**
 * Rename Modal & Submit
 */
const renameModal = document.getElementById("rename-modal");
if (renameModal) {
  renameModal.addEventListener("show.bs.modal", () => {
    const selected = getSelectedCheckboxes();
    if (selected.length === 1) {
      const el = selected[0];
      const oldPath = cleanPath(el.value);
      const oldName = el.dataset.name;
      $("#rename-old-path").val(oldPath);
      $("#rename-old-name").val(oldName);
      $("#rename-new-name").val(oldName);
    }
    $("#rename-output").hide();
    $("#rename-output-content").text("");
  });

  document.getElementById("rename-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const oldPath = cleanPath($("#rename-old-path").val());
    const newName = $("#rename-new-name").val().trim();
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const rawPath = (parentPath === "" ? "" : parentPath) + "/" + newName;
    const newPath = cleanPath(rawPath);

    $.ajax({
      url: "/api/rename",
      type: "POST",
      data: JSON.stringify({ oldPath, newPath }),
      contentType: "application/json",
      success: function () {
        window.location.reload();
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Failed to rename";
        $("#rename-output-content").text(err);
        $("#rename-output").show();
      },
    });
  });
}

/**
 * Change Permission (chmod) Modal & Submit
 */
const chmodModal = document.getElementById("chmod-modal");
if (chmodModal) {
  chmodModal.addEventListener("show.bs.modal", () => {
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => cleanPath(el.value));
    $("#chmod-list").html(paths.join("<br />"));
    if (selected.length > 0) {
      $("#chmod-mode").val(selected[0].dataset.mode || "755");
    }
    $("#chmod-output").hide();
    $("#chmod-output-content").text("");
  });

  document.getElementById("chmod-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => cleanPath(el.value));
    const mode = $("#chmod-mode").val().trim();

    $.ajax({
      url: "/api/chmod",
      type: "POST",
      data: JSON.stringify({ paths, mode }),
      contentType: "application/json",
      success: function () {
        window.location.reload();
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Failed to change permission";
        $("#chmod-output-content").text(err);
        $("#chmod-output").show();
      },
    });
  });
}

/**
 * Change Owner (chown) Modal & Submit
 */
const chownModal = document.getElementById("chown-modal");
if (chownModal) {
  chownModal.addEventListener("show.bs.modal", () => {
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => cleanPath(el.value));
    $("#chown-list").html(paths.join("<br />"));
    if (selected.length > 0) {
      const el = selected[0];
      $("#chown-user").val(el.dataset.username || el.dataset.uid || "");
      $("#chown-group").val(el.dataset.group || el.dataset.gid || "");
    }
    $("#chown-output").hide();
    $("#chown-output-content").text("");
  });

  document.getElementById("chown-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => cleanPath(el.value));
    const user = $("#chown-user").val().trim();
    const group = $("#chown-group").val().trim();

    $.ajax({
      url: "/api/chown",
      type: "POST",
      data: JSON.stringify({ paths, user, group }),
      contentType: "application/json",
      success: function () {
        window.location.reload();
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Failed to change owner";
        $("#chown-output-content").text(err);
        $("#chown-output").show();
      },
    });
  });
}

/**
 * Delete Modal & Submit
 */
const deleteModal = document.getElementById("delete-modal");
if (deleteModal) {
  deleteModal.addEventListener("show.bs.modal", () => {
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => cleanPath(el.value));
    $("#delete-list").html(paths.join("<br />"));
    $("#delete-output").hide();
    $("#delete-output-content").text("");
  });

  document.getElementById("delete-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => cleanPath(el.value));

    $.ajax({
      url: "/api/delete",
      type: "POST",
      data: JSON.stringify({ paths }),
      contentType: "application/json",
      success: function () {
        window.location.reload();
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Failed to delete";
        $("#delete-output-content").text(err);
        $("#delete-output").show();
      },
    });
  });
}

/**
 * Initialize data table
 */
new DataTable("#dir", {
  order: [[5, "desc"]],
  columnDefs: [
    {
      orderable: false,
      targets: [0],
    },
  ],
  paging: false,
});
