import { m } from "#lib/paraglide/messages.js";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { validateEvent, verifyEvent } from "nostr-tools/pure";
import type { WindowNostr } from "nostr-tools/nip07";
import { isHex32 } from "nostr-tools/utils";

export function createRevision(input: {
  wikiPubkey: string;
  d: string;
  title: string;
  summary: string;
  editSummary: string;
  content: string;
  base?: string;
}): EventTemplate {
  return {
    kind: 2818,
    created_at: Math.floor(Date.now() / 1000),
    content: input.content,
    tags: [
      ["a", `30818:${input.wikiPubkey}:${input.d}`],
      ...(input.base ? [["e", input.base]] : []),
      ["title", input.title],
      ...(input.summary ? [["summary", input.summary]] : []),
      ...(input.editSummary ? [["edit_summary", input.editSummary]] : []),
    ],
  };
}
export type SubmissionResult = {
  type: "accepted" | "signing" | "connection" | "conflict" | "rejected";
  message: string;
  id?: string;
};

export async function submitRevision(
  signer: WindowNostr | undefined,
  relay: string,
  template: EventTemplate,
): Promise<SubmissionResult> {
  if (!signer) {
    return {
      type: "signing",
      message:
        m.a_nip_07_compatible_signing_extension_is_required_to_create_or_edit_articles(),
    };
  }
  let event: Event;
  try {
    const signed = await signer.signEvent(structuredClone(template));
    if (
      !validateEvent(signed) ||
      typeof signed.id !== "string" ||
      !isHex32(signed.id) ||
      typeof signed.sig !== "string"
    ) {
      throw new Error();
    }
    event = {
      id: signed.id,
      pubkey: signed.pubkey,
      created_at: signed.created_at,
      kind: signed.kind,
      content: signed.content,
      tags: signed.tags,
      sig: signed.sig,
    };
    if (
      event.kind !== template.kind ||
      event.created_at !== template.created_at ||
      event.content !== template.content ||
      JSON.stringify(event.tags) !== JSON.stringify(template.tags) ||
      !verifyEvent(event)
    ) {
      throw new Error();
    }
  } catch {
    return {
      type: "signing",
      message:
        m.signing_was_declined_or_the_signer_returned_an_invalid_revision_your_draft_is_preserved(),
    };
  }
  return new Promise((resolve) => {
    let socket: WebSocket;
    let settled = false;
    const finish = (result: SubmissionResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close();
      }
      resolve(result);
    };
    const failed: SubmissionResult = {
      type: "connection",
      message:
        m.no_acceptance_confirmation_was_received_your_draft_is_preserved_check_the_article_before_resubmitting(),
    };
    const timeout = setTimeout(() => finish(failed), 15000);
    try {
      socket = new WebSocket(relay);
    } catch {
      finish(failed);
      return;
    }
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify(["EVENT", event])),
    );
    socket.addEventListener("error", () => finish(failed));
    socket.addEventListener("close", () => finish(failed));
    socket.addEventListener("message", ({ data }) => {
      let message: unknown;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (
        !Array.isArray(message) ||
        message[0] !== "OK" ||
        message[1] !== event.id ||
        typeof message[2] !== "boolean"
      ) {
        return;
      }
      const reason =
        typeof message[3] === "string" ? message[3] : m.revision_rejected();
      finish(
        message[2]
          ? {
              type: "accepted",
              message: m.revision_accepted_checking_publication(),
              id: event.id,
            }
          : {
              type: /conflict/i.test(reason) ? "conflict" : "rejected",
              message: m.relay_rejection({ reason }),
            },
      );
    });
  });
}
