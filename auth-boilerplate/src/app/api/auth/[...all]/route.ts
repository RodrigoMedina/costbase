import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

let handler: ReturnType<typeof toNextJsHandler> | null = null;

function getHandler() {
  if (!handler) {
    handler = toNextJsHandler(getAuth());
  }
  return handler;
}

export const GET = (request: Request) => getHandler().GET(request);
export const POST = (request: Request) => getHandler().POST(request);
