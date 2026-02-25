// services/frappe.ts
// ✅ Vite frontend -> calls Vercel proxy (/api/frappe)
// ✅ No direct calls to tms.galaxylabs.online from browser (avoids CORS)

export class FrappeClient {
  static async fetch(method: string, params: any = {}, options: RequestInit = {}) {
  const reqMethod = (options.method || "GET").toUpperCase();

  // Same-origin proxy endpoint on Vercel
  const url = new URL("/api/frappe", window.location.origin);
  url.searchParams.set("method", method);

  // GET params -> querystring
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

  // Non-GET: JSON body
  if (
    reqMethod !== "GET" &&
    reqMethod !== "HEAD" &&
    !fetchOptions.body &&
    params &&
    Object.keys(params).length
  ) {
    fetchOptions.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), fetchOptions);

  // ✅ ALWAYS read text first (Frappe 500 often returns HTML/text, not JSON)
  const rawText = await response.text();

  // Try parse JSON if possible
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    // Prefer frappe structured error
    let msg = data?.message || `HTTP ${response.status}`;

    if (data?._server_messages) {
      try {
        const msgs = JSON.parse(data._server_messages);
        msg = (msgs || [])
          .map((m: any) => (typeof m === "string" ? m : m?.message || JSON.stringify(m)))
          .join(", ");
      } catch {
        msg = data._server_messages;
      }
    }

    // ✅ attach raw server response for debugging
    const debug = rawText?.slice(0, 4000); // limit size
    console.error("FRAPPE ERROR RAW:", debug);

    throw new Error(`${msg}\n\n---RAW RESPONSE---\n${debug}`);
  }

  return data;
}


  // NOTE: Token-proxy approach doesn't require frappe login.
  // This is only for UI/local storage.
  static async login(username: string, _password?: string) {
    const profile = { username, full_name: username };
    localStorage.setItem("frappe_user", JSON.stringify(profile));
    return profile;
  }

  static logout() {
    localStorage.removeItem("frappe_user");
  }

  static async getList(
    doctype: string,
    filters: any = {},
    fields: string[] = ["name"],
    limit_page_length: number = 50,
    order_by: string = "creation desc"
  ) {
    // Keep your Trip owner filter if needed
    let user: any = null;
    try {
      const userStr = localStorage.getItem("frappe_user");
      user = userStr ? JSON.parse(userStr) : null;
    } catch {
      // ignore
    }

    const finalFilters: any = { ...(filters || {}) };
    if (user && user.username && user.username !== "Administrator" && doctype === "Trip") {
      finalFilters.owner = user.username;
    }

    return this.fetch("frappe.client.get_list", {
      doctype,
      filters: JSON.stringify(finalFilters),
      fields: JSON.stringify(fields),
      limit_page_length,
      order_by,
    });
  }

  static async getDoc(doctype: string, name: string) {
    return this.fetch("frappe.client.get", { doctype, name });
  }

  static async saveDoc(doctype: string, doc: any) {
  const isNew = !doc?.name;

  // 1) clone
  const clean: any = { ...(doc || {}) };

  // 2) remove internal/readonly fields (server will set these)
  const internalFields = [
    "owner", "creation", "modified", "modified_by",
    "docstatus", "idx",
    "__onload", "__last_sync_on",
    "_user_tags", "_comments", "_assign", "_liked_by",
    "amended_from"
  ];
  internalFields.forEach((f) => delete clean[f]);

  // ✅ IMPORTANT: Do NOT send base64 data URI into Attach Image field
  // Trip.qr_code is Attach Image, it expects file_url (not data:image/png;base64,...)
  if (typeof clean.qr_code === "string" && clean.qr_code.startsWith("data:image/")) {
    delete clean.qr_code;
  }

  // 3) clean child table rows (passengers)
  if (Array.isArray(clean.passengers)) {
    clean.passengers = clean.passengers.map((p: any) => {
      const row: any = { ...(p || {}) };

      // remove internal + parent linkage fields (Frappe will rebuild)
      [
        "name","owner","creation","modified","modified_by","docstatus","idx",
        "parent","parenttype","parentfield","__onload","__last_sync_on"
      ].forEach((f) => delete row[f]);

      // Your child table doctype is "Passengers"
      row.doctype = "Passengers";
      return row;
    });
  }

  // 4) choose correct method
  const method = isNew ? "frappe.client.insert" : "frappe.client.save";

  const payload = { doc: JSON.stringify({ ...clean, doctype }) };
  const res = await this.fetch(method, payload, { method: "POST" });
  return res.message;
}


  static getPrintUrl(doctype: string, name: string, format?: string) {
    const fmt = format || doctype;
    const url = new URL("/api/print", window.location.origin);
    url.searchParams.set("doctype", doctype);
    url.searchParams.set("name", name);
    url.searchParams.set("format", fmt);
    url.searchParams.set("no_letterhead", "0");
    return url.toString();
  }
}
