import type { OutboundMessage } from "./workflow";

// Where outbound check-in messages go. Every message is also written to
// safety_net_messages, which is the conversation record.
//
// The prototype only has the simulated transport: the simulated phone page reads
// the conversation record. A WhatsApp Business (Cloud API) transport would send
// the opener as an approved utility template and later messages as interactive
// reply-button messages inside the 24-hour window, with replies arriving on a
// webhook that calls handleInbound().

export type WhatsAppTransport = {
  readonly name: "simulated";
  send(recipient: { phone: string | null }, message: OutboundMessage): Promise<void>;
};

const simulatedTransport: WhatsAppTransport = {
  name: "simulated",
  async send() {
    // Nothing to deliver: the simulated phone shows the stored conversation.
  },
};

export function getTransport(): WhatsAppTransport {
  return simulatedTransport;
}

/** The simulated phone is available in development, or when explicitly enabled. */
export function isSimulatorEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.SAFETY_NET_SIMULATOR === "1";
}
