import type { NextRequest } from "next/server";

let handlerPromise: Promise<{ GET: Function; POST: Function }> | null = null;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = Promise.all([
      import("@/lib/auth"),
      import("better-auth/next-js"),
    ]).then(([{ getAuth }, { toNextJsHandler }]) =>
      toNextJsHandler(getAuth()),
    );
  }
  return handlerPromise;
}

export async function GET(request: NextRequest) {
  const h = await getHandler();
  return h.GET(request);
}
export async function POST(request: NextRequest) {
  const h = await getHandler();
  return h.POST(request);
}
