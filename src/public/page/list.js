/**
 * Load constant
 */
const constant = JSON.parse(document.getElementById("constant").value);

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

  document.getElementById("copy-selected").disabled = count === 0;
  document.getElementById("rename-selected").disabled = count !== 1;
  document.getElementById("chmod-selected").disabled = count === 0;
  document.getElementById("chown-selected").disabled = count === 0;
  document.getElementById("delete-selected").disabled = count === 0;
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
        .map((item) => `<option value="${item}" />`)
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
    const sources = selected.map((el) => el.value);
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
    const sources = selected.map((el) => el.value);
    const destination = document.getElementById("copy-destination").value;
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
        redirectTo =
          constant.PATH_PREFIX + destination.slice(constant.BASE_PATH.length);
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
    const path = cwd.endsWith("/") ? cwd + folderName : cwd + "/" + folderName;

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
      const oldPath = el.value;
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
    const oldPath = $("#rename-old-path").val();
    const newName = $("#rename-new-name").val().trim();
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath = (parentPath === "" ? "" : parentPath) + "/" + newName;

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
    const paths = selected.map((el) => el.value);
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
    const paths = selected.map((el) => el.value);
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
    const paths = selected.map((el) => el.value);
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
    const paths = selected.map((el) => el.value);
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
    const paths = selected.map((el) => el.value);
    $("#delete-list").html(paths.join("<br />"));
    $("#delete-output").hide();
    $("#delete-output-content").text("");
  });

  document.getElementById("delete-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const selected = getSelectedCheckboxes();
    const paths = selected.map((el) => el.value);

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
