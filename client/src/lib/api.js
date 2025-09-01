export async function apiGet(baseUrl, path) {
  const r = await fetch(`${baseUrl}${path}`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "Request failed");
  return d;
}
export async function apiPost(baseUrl, path, body) {
  const r = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "Request failed");
  return d;
}
export async function apiPostForm(baseUrl, path, formData) {
  const r = await fetch(`${baseUrl}${path}`, { method: "POST", body: formData });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "Request failed");
  return d;
}
