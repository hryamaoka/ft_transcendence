// Throws an Error whose message is a server error code (see locales' "errors").
// Expected refusals come as 200 with { error }, so Chrome doesn't log them; misuse still gets a 4xx.
export async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(res.status === 400 && data.code === 'FST_ERR_VALIDATION' ? 'invalid_input' : data.error || 'generic');
  return data;
}
