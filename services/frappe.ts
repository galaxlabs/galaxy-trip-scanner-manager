// FrappeClient.ts
// ✅ Browser-safe session-cookie client for Frappe (Vercel / any frontend)
// ✅ Fixes your 401 + "not permitted / not whitelisted" issue by NOT using API key/secret in browser
// NOTE: This requires server-side CORS + cookies configured on Frappe:
//   allow_cors = your frontend origin (NOT "*")
//   cors_allow_credentials = true
//   cookie_samesite = "None"
//   cookie_secure = 1

export class FrappeClient {
  private static BASE_URL = "https://tms.galaxylabs.online";

  // -----------------------------
  // Internal helpers
  // -----------------------------

  private static buildUrl(method: string, params: any, reqMethod: string) {
    const url = new URL(`${this.BASE_URL}/api/method/${method}`);

    if (reqMethod === "GET") {
      Object.keys(params || {}).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== null) {
          const val = typeof v === "object" ? JSON.stringify(v) : String(v);
          url.searchParams.append(key, val);
        }
      });
    }

    return url;
  }

  private static normalizeFrappeError(data: any): string {
    if (!data) return "Request failed";

    // Frappe: _server_messages is a JSON-string array
    if (data._server_messages) {
      try {
        const msgs = JSON.parse(data._server_messages);
        const text = (msgs || [])
          .map((m: any) =>
            typeof m === "string" ? m : m?.message || JSON.stringify(m)
          )
          .join(", ");
        if (text) return text;
      } catch {
        // ignore
      }
      return String(data._server_messages);
    }

    if (typeof data.message === "string" && data.message) return data.message;

    // Sometimes error is in message as HTML details (like your sample)
    if (data.message && typeof data.message === "object") {
      try {
        return JSON.stringify(data.message);
      } catch {
        // ignore
      }
    }

    return "Request failed";
  }

  // -----------------------------
  // Core fetch
  // -----------------------------
  static async fetch(method: string, params: any = {}, options: RequestInit = {}) {
    const reqMethod = (options.method || "GET").toUpperCase();
    const url = this.buildUrl(method, params, reqMethod);

    const headers: HeadersInit = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(reqMethod !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    const fetchOptions: RequestInit = {
      ...options,
      method: reqMethod,
      mode: "cors",
      credentials: "include", // ✅ IMPORTANT: send/receive sid cookie cross-domain
      headers,
    };

    // Attach JSON body for non-GET if not provided
    if (reqMethod !== "GET" && !fetchOptions.body && params && Object.keys(params).length) {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Parse response safely
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(
        "401 Unauthorized: Not logged in / session cookie not sent. Fix CORS + SameSite=None; Secure on Frappe."
      );
    }

    if (!response.ok) {
      const msg = this.normalizeFrappeError(data);
      throw new Error(msg || `HTTP ${response.status}`);
    }

    return data;
  }

  // -----------------------------
  // Auth (Session Cookie)
  // -----------------------------

  /**
   * Login using Frappe session cookies.
   * Frappe login expects x-www-form-urlencoded.
   */
  static async login(usr: string, pwd: string) {
    const form = new URLSearchParams();
    form.append("usr", usr);
    form.append("pwd", pwd);

    const response = await fetch(`${this.BASE_URL}/api/method/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: form.toString(),
      mode: "cors",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    // Frappe typically returns {message:"Logged In"} on success
    if (!response.ok || (data?.message && data.message !== "Logged In")) {
      throw new Error("Invalid username or password");
    }

    // Store a minimal user object locally (optional)
    const profile = await this.verifyConnection();
    try {
      localStorage.setItem("frappe_user", JSON.stringify(profile));
    } catch {
      // ignore
    }
    return profile;
  }

  /**
   * Logout from server + clear local user
   */
  static async logout() {
    try {
      await this.fetch("logout", {}, { method: "POST" });
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem("frappe_user");
    } catch {
      // ignore
    }
  }

  /**
   * Check current session and return username/full_name if accessible
   */
  static async verifyConnection() {
    const who = await this.fetch("frappe.auth.get_logged_user");
    const username = who?.message;

    // If cookie not working, username may be "Guest"
    if (!username || username === "Guest") {
      return { username: "Guest", full_name: "Guest" };
    }

    // Try to fetch full name (might fail if user lacks permission)
    try {
      const userDetails = await this.getList("User", { name: username }, ["full_name"]);
      const full_name = userDetails?.message?.[0]?.full_name || username;
      return { username, full_name };
    } catch {
      return { username, full_name: username };
    }
  }

  // -----------------------------
  // Data APIs (Frappe client)
  // -----------------------------

  static async getList(
    doctype: string,
    filters: any = {},
    fields: string[] = ["name"],
    limit_page_length: number = 50,
    order_by: string = "creation desc"
  ) {
    // Optional: owner restriction for Trip for non-admin
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

  private static cleanDoc(doc: any) {
    const isNew = !doc?.name;
    const clean = { ...(doc || {}) };

    const internalFields = [
      "owner",
      "creation",
      "modified",
      "modified_by",
      "docstatus",
      "idx",
      "_user_tags",
      "_comments",
      "_assign",
      "_liked_by",
      "amended_from",
    ];
    internalFields.forEach((f) => delete clean[f]);

    // Your default Trip departure date
    if (!clean.departure) clean.departure = new Date().toISOString().split("T")[0];

    // Child table normalization (Passenger)
    if (clean.passengers) {
      clean.passengers = clean.passengers.map((p: any) => {
        const {
          name,
          parent,
          parentfield,
          parenttype,
          owner,
          creation,
          modified,
          modified_by,
          docstatus,
          idx,
          is_auto_filled,
          ...rest
        } = p || {};

        const row: any = { ...rest, doctype: "Passenger" };
        if (!isNew && name) row.name = name;
        return row;
      });
    }

    return clean;
  }

  static async saveDoc(doctype: string, doc: any) {
    const cleaned = this.cleanDoc(doc);
    const isNew = !cleaned.name;

    const method = isNew ? "frappe.client.insert" : "frappe.client.save";
    const payload = { doc: JSON.stringify({ ...cleaned, doctype }) };

    const res = await this.fetch(method, payload, { method: "POST" });
    return res.message;
  }

  // -----------------------------
  // Print helpers
  // -----------------------------
  static getPrintUrl(doctype: string, name: string, format?: string) {
    const fmt = format || doctype;
    return `${this.BASE_URL}/printview?doctype=${encodeURIComponent(
      doctype
    )}&name=${encodeURIComponent(name)}&format=${encodeURIComponent(fmt)}&no_letterhead=0`;
  }
}

// export class FrappeClient {
//   private static BASE_URL = 'https://tms.galaxylabs.online';
  
//   private static get API_KEY() { 
//     const key = process.env.FRAPPE_API_KEY;
//     if (!key) console.warn("Missing FRAPPE_API_KEY environment variable");
//     return key || ''; 
//   }

//   private static get API_SECRET() { 
//     const secret = process.env.FRAPPE_API_SECRET;
//     if (!secret) console.warn("Missing FRAPPE_API_SECRET environment variable");
//     return secret || ''; 
//   }

//   static async fetch(method: string, params: any = {}, options: RequestInit = {}) {
//     const url = new URL(`${this.BASE_URL}/api/method/${method}`);
    
//     if (!options.method || options.method === 'GET') {
//       Object.keys(params).forEach(key => {
//         if (params[key] !== undefined && params[key] !== null) {
//           const val = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
//           url.searchParams.append(key, val);
//         }
//       });
//     }

//     const headers: HeadersInit = {
//       'Accept': 'application/json',
//       'Content-Type': 'application/json',
//       'Authorization': `token ${this.API_KEY}:${this.API_SECRET}`,
//       'X-Frappe-Api-Key': this.API_KEY,
//       'X-Frappe-Api-Secret': this.API_SECRET,
//       'X-Requested-With': 'XMLHttpRequest'
//     };

//     const fetchOptions: RequestInit = {
//       ...options,
//       mode: 'cors',
//       credentials: 'omit',
//       headers: { ...headers, ...options.headers }
//     };

//     if (options.method === 'POST' && Object.keys(params).length > 0 && !options.body) {
//       fetchOptions.body = JSON.stringify(params);
//     }

//     try {
//       const response = await fetch(url.toString(), fetchOptions);
//       if (response.status === 401) throw new Error("Authentication Failed. Check API Keys in Vercel Settings.");
//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         let msg = "Validation Failed";
//         if (errorData._server_messages) {
//            try {
//              const msgs = JSON.parse(errorData._server_messages);
//              msg = msgs.map((m: any) => typeof m === 'string' ? m : (m.message || JSON.stringify(m))).join(', ');
//            } catch(e) { msg = errorData._server_messages; }
//         } else if (errorData.message) {
//             msg = errorData.message;
//         }
//         throw new Error(msg);
//       }
//       return await response.json();
//     } catch (err: any) {
//       throw err;
//     }
//   }

//   static async login(usr: string, pwd: string) {
//     // 1. Authenticate with Frappe via login method
//     const response = await fetch(`${this.BASE_URL}/api/method/login`, {
//       method: 'POST',
//       headers: {
//         'Accept': 'application/json',
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ usr, pwd })
//     });

//     if (!response.ok) {
//         throw new Error("Invalid username or password");
//     }

//     const loginData = await response.json();
    
//     // 2. Fetch the user's profile using the system credentials
//     // This bypasses permission issues normal users have when trying to read the User table.
//     try {
//       const userRes = await this.getList('User', { name: usr, enabled: 1 }, ['full_name', 'email']);
//       const user = userRes.message?.[0];
      
//       if (!user) {
//         throw new Error("Access Denied: User account not found or disabled.");
//       }

//       return { 
//         username: usr, 
//         full_name: user.full_name || loginData.full_name || usr 
//       };
//     } catch (e: any) {
//       // Fallback if system user cannot be fetched but login was successful
//       if (loginData.message === "Logged In") {
//         return { username: usr, full_name: loginData.full_name || usr };
//       }
//       throw e;
//     }
//   }

//   static async verifyConnection() {
//     const data = await this.fetch('frappe.auth.get_logged_user');
//     const username = data.message;
//     try {
//         const userDetails = await this.getList('User', { name: username }, ['full_name']);
//         return { username, full_name: userDetails.message?.[0]?.full_name || username };
//     } catch (e) {
//         return { username, full_name: username };
//     }
//   }

//   static async getList(doctype: string, filters: any = {}, fields: string[] = ['*']) {
//     const userStr = localStorage.getItem('frappe_user');
//     const user = userStr ? JSON.parse(userStr) : null;
    
//     const finalFilters = { ...filters };
//     if (user && user.username !== 'Administrator' && doctype === 'Trip') {
//         finalFilters.owner = user.username;
//     }

//     return this.fetch('frappe.client.get_list', {
//       doctype,
//       filters: JSON.stringify(finalFilters),
//       fields: JSON.stringify(fields),
//       limit_page_length: 50,
//       order_by: 'creation desc'
//     });
//   }

//   static async getDoc(doctype: string, name: string) {
//     return this.fetch('frappe.client.get', { doctype, name });
//   }

//   private static cleanDoc(doc: any) {
//     const isNew = !doc.name;
//     const clean = { ...doc };
//     const internalFields = ['owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx', '_user_tags', '_comments', '_assign', '_liked_by', 'amended_from'];
//     internalFields.forEach(f => delete clean[f]);

//     if (!clean.departure) clean.departure = new Date().toISOString().split('T')[0];
    
//     if (clean.passengers) {
//       clean.passengers = clean.passengers.map((p: any) => {
//         const { name, parent, parentfield, parenttype, owner, creation, modified, modified_by, docstatus, idx, is_auto_filled, ...rest } = p;
//         const row: any = { ...rest, doctype: 'Passenger' };
//         if (!isNew && name) row.name = name;
//         return row;
//       });
//     }
//     return clean;
//   }

//   static async saveDoc(doctype: string, doc: any) {
//     const cleanDoc = this.cleanDoc(doc);
//     const isNew = !cleanDoc.name;
//     const method = isNew ? 'frappe.client.insert' : 'frappe.client.save';
//     const payload = { doc: JSON.stringify({ ...cleanDoc, doctype }) };
//     const response = await this.fetch(method, payload, { method: 'POST' });
//     return response.message; 
//   }

//   static getPrintUrl(doctype: string, name: string) {
//     return `${this.BASE_URL}/printview?doctype=Trip&name=${encodeURIComponent(name)}&format=Trip&no_letterhead=0`;
//   }

//   static logout() {
//     localStorage.removeItem('frappe_user');
//   }
// }
