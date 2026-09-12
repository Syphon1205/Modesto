import { LISTENING_ARTWORK_PATH_PREFIX } from "@modesto/shared/listeningLibraryArtwork";
import { resolveListeningArtworkFile } from "@modesto/shared/listeningLibraryArtworkStore";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

export const listeningArtworkRouteLayer = HttpRouter.add(
  "GET",
  `${LISTENING_ARTWORK_PATH_PREFIX}/*`,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = HttpServerRequest.toURL(request);
    if (Option.isNone(url)) {
      return HttpServerResponse.text("Bad Request", { status: 400 });
    }
    const id = url.value.pathname.slice(`${LISTENING_ARTWORK_PATH_PREFIX}/`.length);
    const file = resolveListeningArtworkFile(id);
    if (!file) {
      return HttpServerResponse.text("Not Found", { status: 404 });
    }
    return yield* HttpServerResponse.file(file, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    }).pipe(
      Effect.orElseSucceed(() => HttpServerResponse.text("Internal Server Error", { status: 500 })),
    );
  }),
);
