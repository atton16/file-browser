import { DateTime } from "luxon";

export const customLogger = (...messages: any[]) => {
  const now = DateTime.now().setZone("Asia/Bangkok").toISO();
  console.log(now, ...messages);
};

export const customLoggerWithRequestId = (requestId: string) => {
  return (...messages: any[]) => {
    const now = DateTime.now().setZone("Asia/Bangkok").toISO();
    console.log(`${now} [${requestId}]`, ...messages);
  };
};
