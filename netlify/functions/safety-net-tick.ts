// Runs the safety-net follow-up scheduler: sends due WhatsApp check-ins and
// turns overdue silence into nurse calls. Schedule set in netlify.toml.

export default async () => {
  const base = process.env.URL;
  const secret = process.env.SAFETY_NET_CRON_SECRET;
  if (!base || !secret) {
    console.error("safety-net-tick: URL or SAFETY_NET_CRON_SECRET is missing.");
    return new Response("Missing configuration.", { status: 500 });
  }

  const response = await fetch(`${base}/api/safety-net/tick`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.text();
  if (!response.ok) {
    console.error("safety-net-tick failed:", response.status, body);
    return new Response(body, { status: 500 });
  }
  console.log("safety-net-tick:", body);
  return new Response(body, { status: 200 });
};
