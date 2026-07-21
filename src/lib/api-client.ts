"use client";

import { auth } from "@/lib/firebase/client";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  correlationId?: string;
}

async function getToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const json: ApiResponse<T> = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message ?? `Request failed with status ${res.status}`);
  }

  return json;
}

export const apiClient = {
  get: <T>(url: string) => request<T>(url),
  // Download endpoints stream the file bytes behind auth. Fetch them with the
  // token attached, then save the blob using the server-provided filename so
  // the file keeps its .pdf name and type.
  download: async (url: string): Promise<void> => {
    const token = await getToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(url, { headers });
    if (!res.ok) {
      let message = `Download failed with status ${res.status}`;
      try {
        const json = await res.json();
        message = json?.error?.message ?? message;
      } catch {
        // Response was not JSON (unexpected); keep the status-based message.
      }
      throw new Error(message);
    }

    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fileName = match?.[1] ?? "download.pdf";

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  },
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  postFormData: <T>(url: string, formData: FormData) =>
    request<T>(url, { method: "POST", body: formData }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
