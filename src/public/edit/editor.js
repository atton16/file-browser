(function () {
  const filePathEl = document.getElementById("editor-file-path");
  const fileNameEl = document.getElementById("editor-file-name");
  const folderHrefEl = document.getElementById("editor-folder-href");

  const filePath = filePathEl ? filePathEl.value : "";
  const fileName = fileNameEl ? fileNameEl.value : "";
  const folderHref = folderHrefEl ? folderHrefEl.value : "/page";

  const saveBtn = document.getElementById("save-btn");
  const saveCloseBtn = document.getElementById("save-close-btn");
  const saveSpinner = document.getElementById("save-spinner");
  const dirtyBadge = document.getElementById("dirty-badge");
  const savedBadge = document.getElementById("saved-badge");
  const readonlyBadge = document.getElementById("readonly-badge");
  const languageBadge = document.getElementById("file-language");
  const alertEl = document.getElementById("editor-alert");
  const loadingEl = document.getElementById("editor-loading");
  const container = document.getElementById("monaco-editor-container");
  const backBtn = document.getElementById("back-btn");

  let editorInstance = null;
  let originalContent = "";
  let isDirty = false;
  let isReadOnly = false;
  let savedBadgeTimer = null;

  function showAlert(message, type = "danger") {
    alertEl.className = `alert alert-${type} mb-2 py-2`;
    alertEl.innerHTML = message;
    alertEl.classList.remove("d-none");
  }

  function hideAlert() {
    alertEl.classList.add("d-none");
  }

  function setDirty(dirty) {
    isDirty = dirty;
    if (dirty) {
      dirtyBadge.classList.remove("d-none");
      savedBadge.classList.add("d-none");
    } else {
      dirtyBadge.classList.add("d-none");
    }
  }

  function getLanguageByFilename(name) {
    if (!name) return "plaintext";
    const lowerName = name.toLowerCase();
    if (lowerName === "dockerfile") return "dockerfile";
    if (lowerName === ".env" || lowerName.endsWith(".env")) return "shell";

    const parts = lowerName.split(".");
    const ext = parts.length > 1 ? parts.pop() : "";

    const map = {
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      ts: "typescript",
      tsx: "typescript",
      json: "json",
      html: "html",
      htm: "html",
      css: "css",
      scss: "scss",
      less: "less",
      md: "markdown",
      markdown: "markdown",
      py: "python",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      svg: "xml",
      sql: "sql",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      c: "c",
      h: "c",
      cpp: "cpp",
      hpp: "cpp",
      cs: "csharp",
      java: "java",
      kt: "kotlin",
      dart: "dart",
      lua: "lua",
      ini: "ini",
      toml: "ini",
    };

    return map[ext] || "plaintext";
  }

  // Intercept back button if dirty
  if (backBtn) {
    backBtn.addEventListener("click", function (e) {
      if (isDirty) {
        if (!confirm("You have unsaved changes. Are you sure you want to leave?")) {
          e.preventDefault();
        }
      }
    });
  }

  // Prevent leaving page with unsaved changes
  window.addEventListener("beforeunload", function (e) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // Setup Monaco environment for workers
  window.MonacoEnvironment = {
    getWorkerUrl: function (workerId, label) {
      if (label === "json") {
        return "/public/monaco/vs/language/json/json.worker.js";
      }
      if (label === "css" || label === "scss" || label === "less") {
        return "/public/monaco/vs/language/css/css.worker.js";
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return "/public/monaco/vs/language/html/html.worker.js";
      }
      if (label === "typescript" || label === "javascript") {
        return "/public/monaco/vs/language/typescript/ts.worker.js";
      }
      return "/public/monaco/vs/editor/editor.worker.js";
    },
  };

  // Configure AMD loader
  require.config({
    paths: {
      vs: "/public/monaco/vs",
    },
  });

  async function loadFileContent() {
    try {
      const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load file content");
      }

      return data;
    } catch (err) {
      showAlert(`<strong>Error loading file:</strong> ${err.message}`, "danger");
      loadingEl.classList.add("d-none");
      if (saveBtn) saveBtn.disabled = true;
      if (saveCloseBtn) saveCloseBtn.disabled = true;
      return null;
    }
  }

  async function saveFile(closeAfter = false) {
    if (isReadOnly || !editorInstance) return;

    hideAlert();
    saveBtn.disabled = true;
    saveCloseBtn.disabled = true;
    saveSpinner.classList.remove("d-none");

    const currentContent = editorInstance.getValue();

    try {
      const response = await fetch("/api/file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: filePath,
          content: currentContent,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save file");
      }

      originalContent = currentContent;
      setDirty(false);

      savedBadge.classList.remove("d-none");
      if (savedBadgeTimer) clearTimeout(savedBadgeTimer);
      savedBadgeTimer = setTimeout(() => {
        savedBadge.classList.add("d-none");
      }, 3000);

      if (closeAfter) {
        window.location.href = folderHref;
      }
    } catch (err) {
      showAlert(`<strong>Save Failed:</strong> ${err.message}`, "danger");
    } finally {
      saveSpinner.classList.add("d-none");
      saveBtn.disabled = false;
      saveCloseBtn.disabled = false;
    }
  }

  // Load editor and file
  require(["vs/editor/editor.main"], async function () {
    const fileData = await loadFileContent();
    if (!fileData) return;

    loadingEl.classList.add("d-none");

    const lang = getLanguageByFilename(fileName);
    languageBadge.textContent = lang.toUpperCase();

    isReadOnly = Boolean(fileData.isReadOnly);
    if (isReadOnly) {
      readonlyBadge.classList.remove("d-none");
      saveBtn.disabled = true;
      saveCloseBtn.disabled = true;
    }

    originalContent = fileData.content || "";

    editorInstance = monaco.editor.create(container, {
      value: originalContent,
      language: lang,
      theme: "vs-dark",
      automaticLayout: true,
      readOnly: isReadOnly,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      minimap: { enabled: true },
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      renderWhitespace: "selection",
      tabSize: 2,
    });

    // Track dirty state
    editorInstance.onDidChangeModelContent(() => {
      const current = editorInstance.getValue();
      setDirty(current !== originalContent);
    });

    // Add Save Shortcut (Ctrl+S / Cmd+S)
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(false);
    });

    // Button event listeners
    if (saveBtn) {
      saveBtn.addEventListener("click", () => saveFile(false));
    }
    if (saveCloseBtn) {
      saveCloseBtn.addEventListener("click", () => saveFile(true));
    }
  });
})();
