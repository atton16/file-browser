import { customLoggerWithRequestId as loggerWithRequestId } from "../../customLogger";
import { PATH_PREFIX, BASE_PATH } from "../common/path";

export const Breadcrumb = ({
  requestId,
  cwd,
}: {
  requestId: string;
  cwd: string;
}) => {
  const logger = loggerWithRequestId(requestId);
  const myPath = cwd.split("/");
  const breadcrumb = myPath.map((text, index) => {
    return {
      href: `${PATH_PREFIX}${myPath.slice(0, index + 1).join("/")}`,
      text: index === 0 ? BASE_PATH : text,
    };
  });
  const last = breadcrumb.pop()?.text;
  logger("[Breadcrumb] cwd", cwd);
  logger("[Breadcrumb] myPath", myPath);
  logger("[Breadcrumb] breadcrumb", breadcrumb);
  logger("[Breadcrumb] last", last);
  return (
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        {breadcrumb.map((bc, index) => (
          <li class="breadcrumb-item" key={index}>
            <a href={bc.href}>{bc.text}</a>
          </li>
        ))}
        <li class="breadcrumb-item active" aria-current="page">
          {last}
        </li>
      </ol>
    </nav>
  );
};
