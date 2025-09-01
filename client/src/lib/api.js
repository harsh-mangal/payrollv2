// src/lib/api.js
export async function apiGet(baseUrl, path) {
  const token = localStorage.getItem("token");
  const r = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || r.statusText);
  return json;
}

export async function apiPost(baseUrl, path, body) {
  const token = localStorage.getItem("token");
  const r = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
    credentials: "include",
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || r.statusText);
  return json;
}

// NEW: multipart/form-data (e.g., file upload)
// Don't set Content-Type; the browser will add the correct boundary
export async function apiPostForm(baseUrl, path, formData) {
  const token = localStorage.getItem("token");
  const r = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    credentials: "include",
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || r.statusText);
  return json;
}
