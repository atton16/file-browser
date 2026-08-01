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

  const deleteSel = document.getElementById("delete-selected");
  if (deleteSel) deleteSel.disabled = count === 0;
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
        }));
        $("#auto-copy-plan-loading").hide();

        if (currentAutoCopyPlans.length === 0) {
          $("#auto-copy-plan-container")
            .html('<div class="alert alert-warning">No copy plans generated.</div>')
            .show();
          return;
        }

        let html = "";
        currentAutoCopyPlans.forEach((plan) => {
          html += `
            <div class="card mb-3 border-primary-subtle shadow-sm">
              <div class="card-header bg-light-subtle d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span class="fw-bold text-primary text-break" style="word-break: break-all;">Destination: ${escapeHtml(plan.destination)}</span>
                <span class="badge bg-primary rounded-pill">${plan.sources.length} item(s)</span>
              </div>
              <div class="card-body p-2">
                <ul class="list-group list-group-flush font-monospace small">
                  ${plan.sources
                    .map(
                      (src) =>
                        `<li class="list-group-item py-1 text-break" style="word-break: break-all;" title="${escapeHtml(src)}">${escapeHtml(src)}</li>`
                    )
                    .join("")}
                </ul>
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

    isAutoCopyLoading = true;
    $("#auto-copy-confirm-button").prop("disabled", true);
    $("#auto-copy-cancel-button").prop("disabled", true);
    $("#auto-copy-output").show();
    $("#auto-copy-spinner").show();
    $("#auto-copy-output-content").text("Starting copy process...\n");

    for (let i = 0; i < currentAutoCopyPlans.length; i++) {
      const plan = currentAutoCopyPlans[i];
      const stepMsg = `[${i + 1}/${currentAutoCopyPlans.length}] Copying to ${plan.destination}...\n`;
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

    if (currentAutoCopyPlans.length > 0 && currentAutoCopyPlans[0].destination) {
      const destination = currentAutoCopyPlans[0].destination;
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
  order: [[1, "asc"]],
  columnDefs: [
    {
      orderable: false,
      targets: [0],
    },
  ],
  paging: false,
});
