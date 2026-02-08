// services/FrappeClient.ts
// ✅ Vite/React frontend -> calls Vercel Serverless proxy (/api/frappe)
// ✅ Fixes CORS because browser no longer calls https://tms.galaxylabs.online directly
// IMPORTANT: You must have api/frappe.js in repo and env vars set on Vercel.

export class FrappeClient {
  /**
   * Calls Vercel proxy endpoint:
   *   /api/frappe?method=frappe.client.get_list&doctype=Route...
   */
  static async fetch(
    method: string,
    params: any = {},
    options: RequestInit = {}
  ) {
    const reqMethod = (options.method || "GET").toUpperCase();

    // Same-origin proxy URL (your Vercel domain)
    const url = new URL("/api/frappe", window.location.origin);
    url.searchParams.set("method", method);

    // Send params via query for GET
    if (reqMethod === "GET") {
      Object.keys(params || {}).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== null) {
          const val = typeof v === "object" ? JSON.stringify(v) : String(v);
          url.searchParams.append(key, val);
        }
      });
    }

    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(options.headers || {}),
    };

    const fetchOptions: RequestInit = {
      ...options,
      method: reqMethod,
      headers,
    };

    // For POST/PUT: send JSON body
    if (reqMethod !== "GET" && !fetchOptions.body && params && Object.keys(params).length) {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), fetchOptions);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let msg = data?.message || `HTTP ${response.status}`;
      if (data?._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages);
          msg = msgs
            .map((m: any) => (typeof m === "string" ? m : m?.message || JSON.stringify(m)))
            .join(", ");
        } catch {
          msg = data._server_messages;
        }
      }
      throw new Error(msg);
    }

    return data;
  }

  static async getList(
    doctype: string,
    filters: any = {},
    fields: string[] = ["*"]
  ) {
    return this.fetch("frappe.client.get_list", {
      doctype,
      filters: JSON.stringify(filters),
      fields: JSON.stringify(fields),
      limit_page_length: 50,
      order_by: "creation desc",
    });
  }

  static async getDoc(doctype: string, name: string) {
    return this.fetch("frappe.client.get", { doctype, name });
  }

  static async saveDoc(doctype: string, doc: any) {
    // For save/insert, you can decide doc has name or not
    const isNew = !doc?.name;
    const method = isNew ? "frappe.client.insert" : "frappe.client.save";
    const payload = { doc: JSON.stringify({ ...doc, doctype }) };
    const res = await this.fetch(method, payload, { method: "POST" });
    return res.message;
  }
}
