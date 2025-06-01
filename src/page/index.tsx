import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { removePathPrefix } from "./common/path";
import { Breadcrumb } from "./component/breadcrumb";
import { List } from "./component/list";

export const page = new Hono();
page.use(async (c, next) => {
  const logger = c.get("logger");
  const requestId = c.get("requestId");
  const middleware = jsxRenderer(({ children, Layout, title }) => {
    logger("[page middleware] c.req.path", c.req.path);
    const cwd = removePathPrefix(c.req.path);
    return (
      <Layout title={title}>
        <div class="container">
          {children}
          <Breadcrumb requestId={requestId} cwd={cwd} />
          <List requestId={requestId} cwd={cwd} />
        </div>
      </Layout>
    );
  });
  return middleware(c, next);
});
page.get("*", (c) => {
  return c.render(<h1>File Browser</h1>, { title: "File Browser" });
});
