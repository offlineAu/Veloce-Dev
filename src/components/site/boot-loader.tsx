import { BOOT_STORAGE_KEY } from "./boot-constants";
import { BootLoaderClient } from "./boot-loader-client";

// Runs before first paint: a visitor who has already seen the loader this session never sees it again (see globals.css).
// Rendered by the root layout (BootInitScript), not inside BootLoader: BootLoader sits under the client MarketingOnly
// boundary, and a <script> that React creates on the client (e.g. navigating back from /build) never runs and logs an error.
const bootInitScript = `try{if(sessionStorage.getItem(${JSON.stringify(BOOT_STORAGE_KEY)})==="1")document.documentElement.dataset.booted="1"}catch(e){}`;

export function BootInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: bootInitScript }} />;
}

/** Full-screen first-visit loader with a centred logo and 0-100% progress. Server-rendered at 0% so there is no blank frame. */
export function BootLoader() {
  return <BootLoaderClient />;
}
