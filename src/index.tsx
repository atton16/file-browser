import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { jsxRenderer } from "hono/jsx-renderer";
import { logger } from "hono/logger";
import * as constant from "./constant";
import { BASE_PATH } from "./constant";
import { customLogger, customLoggerWithRequestId } from "./customLogger";
import { copy } from "./api/copy";
import { dir } from "./api/dir";
import { page } from "./page";
import { randomUUIDv7 } from "bun";

declare module "hono" {
  interface ContextRenderer {
    (content: string | Promise<string>, props: { title: string }): Response;
  }
  interface ContextVariableMap {
    logger: typeof customLogger;
    requestId: string;
  }
}

const app = new Hono();

app.use(async (c, next) => {
  const requestId = randomUUIDv7();
  const myLogger = customLoggerWithRequestId(requestId);
  c.set("logger", myLogger);
  c.set("requestId", requestId);
  const middleware = logger(myLogger);
  return middleware(c, next);
});
app.use(
  jsxRenderer(({ children, title }) => {
    return (
      <html lang="en" data-bs-theme="dark">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <link
            href="/public/bootstrap-5.3.6-dist/css/bootstrap.min.css"
            rel="stylesheet"
            integrity="sha384-4Q6Gf2aSP4eDXB8Miphtr37CMZZQ5oXLH2yaXMJ2w8e2ZtHTl7GptT4jmndRuHDT"
            crossorigin="anonymous"
          />
          <link href="/public/DataTables/datatables.min.css" rel="stylesheet" />
          <script src="/public/jquery/jquery-3.7.1.min.js"></script>
          <script src="/public/DataTables/datatables.min.js"></script>
        </head>
        <body>
          <input type="hidden" id="constant" value={JSON.stringify(constant)} />
          {children}
        </body>
        <script
          src="/public/bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"
          integrity="sha384-j1CDi7MgGQ12Z7Qab0qlWQ/Qqz24Gc6BM0thvEMVjHnfYGF0rmFCozFSxQBxwHKO"
          crossorigin="anonymous"
        ></script>
      </html>
    );
  }),
);

app.get("/", (c) => c.redirect("/page"));
app.get("/api", (c) => c.json({ hello: "world" }));
app.route("/api/copy", copy);
app.route("/api/dir", dir);
app.route("/page", page);
app.use("/public/*", serveStatic({ root: `${process.cwd()}/src` }));

console.log("BASE_PATH", BASE_PATH);
export default {
  host: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
};
