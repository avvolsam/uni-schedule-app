// Sends a push notification to every subscriber tagged with a given group, via the
// OneSignal REST API. The REST API key is a secret: it is only ever passed in from the
// environment (GitHub Actions secret), used in the Authorization header, and never
// logged or written anywhere.

const API_URL = 'https://api.onesignal.com/notifications?c=push';
const TIMEOUT_MS = 15000;

export async function sendGroupNotification({
  appId,
  apiKey,
  groupSlug,
  title,
  body,
  url,
  fetchImpl = fetch,
}) {
  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      target_channel: 'push',
      filters: [{ field: 'tag', key: 'group', relation: '=', value: groupSlug }],
      headings: { en: title, ru: title },
      contents: { en: body, ru: body },
      url,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) {
    // The response body is OneSignal's error description; it does not contain our key.
    throw new Error(`OneSignal HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return text;
}
