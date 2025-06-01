/**
 * Load constant
 */
const constant = JSON.parse(document.getElementById("constant").value);

/**
 * List the selected files to modal as source
 */
document.getElementById("copy-selected").addEventListener("click", function () {
  const selected = document.querySelectorAll(
    'input[type="checkbox"].form-check-input.child:checked',
  );
  const sources = Array.from(selected).map((el) => el.value);
  document.getElementById("copy-list").innerHTML = sources.join("<br />");
});

/**
 * Autocomplete destination folder searchs on destination input change
 */
function debounce(func, delay) {
  let timerId;
  const ret = function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => func.apply(this, args), delay);
  };
  return ret;
}
function handleInputChange(event) {
  console.log("input", event.target.value);
  $.get(
    "/api/dir?q=" + encodeURIComponent(event.target.value),
    function (data) {
      const dir = data.dir;
      console.log(dir);
      document.getElementById("copy-destination-datalist").innerHTML = dir
        .map((item) => `<option value="${item}" />`)
        .join("");
    },
  );
}
const debouncedInputChange = debounce(handleInputChange, 200);
const copyDestination = document.getElementById("copy-destination");
copyDestination.addEventListener("keyup", debouncedInputChange);

/**
 * Redirect to destination folder if copy done
 * Prevent modal from closing when copying
 * Reset modal state when hide
 */
let redirectTo = null;
let isLoading = false;
const modal = document.getElementById("copy-modal");
modal.addEventListener("hide.bs.modal", (e) => {
  // Redirect to destination folder if copy done
  if (redirectTo) {
    e.preventDefault();
    window.location.href = redirectTo;
    return;
  }
  // Prevent modal from closing when copying
  if (isLoading) {
    e.preventDefault();
    return;
  }
  // Reset modal state when hide
  $("#output-content").html("");
  $("#spinner").hide();
  $("#copy-destination").val("");
});

/**
 * Disable copy button when showing modal
 */
modal.addEventListener("show.bs.modal", () => {
  const copyButton = document.getElementById("copy-button");
  copyButton.disabled = true;
});

/**
 * Enable copy button when copy destination is valid
 */
copyDestination.addEventListener("keyup", () => {
  const copyButton = document.getElementById("copy-button");
  copyButton.disabled = !copyDestination.value;
});

/**
 * Submit form and start file(s) copy
 */
document.getElementById("my-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const selected = document.querySelectorAll(
    'input[type="checkbox"].form-check-input.child:checked',
  );
  const sources = Array.from(selected).map((el) => el.value);
  const destination = document.getElementById("copy-destination").value;
  $("#output-content").html("");
  $("#spinner").show();
  isLoading = true;
  $.post(
    "/api/copy",
    JSON.stringify({ sources, destination }),
    function (data) {
      isLoading = false;
      $("#spinner").hide();
      console.log(data);
      const { cmds } = data;
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        if (cmd.error) {
          $("#output-content").html(JSON.stringify(cmd, null, 2));
          return;
        }
      }
      $("#output-content").html("Done");
      redirectTo =
        constant.PATH_PREFIX + destination.slice(constant.BASE_PATH.length);
    },
  ).fail(function (e) {
    isLoading = false;
    $("#spinner").hide();
    $("#output-content").html(JSON.stringify(e, null, 2));
    console.error("error", e);
  });
  console.log(sources, destination);
});

/**
 * Check all / Uncheck all checkboxes from the header checkbox
 */
document.getElementById("check-all").addEventListener("change", function () {
  const checkboxes = document.querySelectorAll(
    'input[type="checkbox"].form-check-input.child',
  );
  checkboxes.forEach((checkbox) => (checkbox.checked = this.checked));
});

/**
 * Enable / Disable "Copy selected" button based on the number of checkbox checked
 */
function controlCopySelected() {
  const checkboxes = document.querySelectorAll(
    'input[type="checkbox"].form-check-input.child',
  );
  let count = 0;
  for (let i = 0; i < checkboxes.length; i++) {
    const checkbox = checkboxes[i];
    if (checkbox.checked) {
      count++;
    }
  }
  if (count) {
    document.getElementById("copy-selected").disabled = false;
  } else {
    document.getElementById("copy-selected").disabled = true;
  }
}
document
  .getElementById("check-all")
  .addEventListener("change", controlCopySelected);
const nodes = document.querySelectorAll(
  "input[type='checkbox'].form-check-input.child",
);
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i];
  node.addEventListener("change", controlCopySelected);
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
