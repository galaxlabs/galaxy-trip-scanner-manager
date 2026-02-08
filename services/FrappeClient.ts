// services/FrappeClient.ts
// Vite frontend client -> calls Vercel proxy (/api/frappe)
// ✅ No direct calls to Frappe domain from browser
// ✅ No cookies, no CORS issues
// ✅ API key/secret stays ONLY in Vercel env (server-side)

export class FrappeClient {
  /**
   * Call Frappe method via Vercel proxy
   * Example:
   *   fetch("frappe.client.get_list", { doctype: "Trip", ... })
   * becomes:
   *   /api/frappe?method=frappe.client.get_list&doctype=Trip...
   */
  static async fetch(method: string, params: any = {}, options: RequestInit = {}) {
    const reqMethod = (options.method || "GET").toUpperCase();

    // same-origin proxy endpoint
    const url = new URL("/api/frappe", window.location.origin);
    url.searchParams.set("method", method);

    // For GET: querystring
    if (reqMethod === "GET") {
      Object.keys(params || {}).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== null) {
          const val = typeof v === "object" ? JSON.stringify(v) : String(v);
          url.searchParams.append(key, val);
        }
      });
    } else {
      // For POST/PUT etc, still include params in body (recommended)
      // Keep query clean.
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

    if (reqMethod !== "GET" && !fetchOptions.body && params && Object.keys(params).length) {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
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

    return await response.json();
  }

  static async getList(doctype: string, filters: any = {}, fields: string[] = ["*"]) {
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

  static getPrintUrl(doctype: string, name: string, format?: string) {
    const fmt = format || doctype;
    // Print URL still points to Frappe site, which is fine for opening in new tab
    return `https://tms.galaxylabs.online/printview?doctype=${encodeURIComponent(
      doctype
    )}&name=${encodeURIComponent(name)}&format=${encodeURIComponent(fmt)}&no_letterhead=0`;
  }

  static logout() {
    // If you used localStorage in UI, clear it here
    localStorage.removeItem("frappe_user");
  }
}
