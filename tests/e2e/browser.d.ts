import type { EventTemplate, VerifiedEvent } from "nostr-tools/pure";
import type { WindowNostr } from "nostr-tools/nip07";

interface TrackedSocket extends WebSocket {
  messages: unknown[][];
  sent: unknown[][];
}

declare global {
  var nostr: WindowNostr;
  var signForTest: (event: EventTemplate) => Promise<VerifiedEvent>;
  var signAdmin: (event: EventTemplate) => Promise<VerifiedEvent>;
  var signUnauthorized: (event: EventTemplate) => Promise<VerifiedEvent>;
  var signScreenshotRequest: (event: EventTemplate) => Promise<VerifiedEvent>;
  var beforeSubscription: () => Promise<void>;
  var updateSockets: TrackedSocket[];
}
