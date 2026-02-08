// FrappeClient.ts
// Browser-safe session-cookie client for Frappe (recommended for Vercel frontend)

export class FrappeClient {
  private static BASE_URL = "https://tms.galaxylabs.online";

  /**
   * Generic Frappe method caller:
   * - Uses session cookies (sid) via credentials: "include"
   * - No API key/secret in browser (secure)
   */
  static async fetch(
    method: string,
    params: any = {},
    options: RequestInit = {}
  ) {
    const url = new URL(`${this.BASE_URL}/api/method/${method}`);

    const reqMethod = (options.method || "GET").toUpperCase();

    // Attach params as querystring for GET
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
      "X-Requested-With": "XMLHttpRequest",
      ...(reqMethod !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    const fetchOptions: RequestInit = {
      ...options,
      method: reqMethod,
      mode: "cors",
      credentials: "include", // ✅ IMPORTANT: send/receive sid cookie
      headers,
    };

    // Attach JSON body for non-GET when body not already provided
    if (reqMethod !== "GET" && !fetchOptions.body && params && Object.keys(params).length) {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Handle auth error explicitly
    if (response.status === 401) {
      throw new Error("Unauthorized (401): Not logged in or session expired.");
    }

    // Parse JSON safely
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Frappe often returns _server_messages stringified JSON array
      let msg = data?.message || "Request failed";
      if (data?._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages);
          msg = msgs
            .map((m: any) =>
              typeof m === "string" ? m : m?.message || JSON.stringify(m)
            )
            .join(", ");
        } catch {
          msg = data._server_messages;
        }
      }
      throw new Error(msg);
    }

    return data;
  }

  /**
   * Login (sets sid cookie)
   * IMPORTANT:
   * - Use x-www-form-urlencoded, not JSON
   * - Must use credentials: "include" to store cookie in browser
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

    // Frappe sometimes returns 200 even for failure, so parse message too
    const data = await response.json().catch(() => ({}));

    if (!response.ok || (data?.message && data.message !== "Logged In")) {
      throw new Error("Invalid username or password");
    }

    // Return user profile from session
    return await this.verifyConnection();
  }

  /**
   * Verify current session user
   */
  static async verifyConnection() {
    const data = await this.fetch("frappe.auth.get_logged_user");
    const username = data.message;

    // Try fetching full_name (may fail due to permissions)
    try {
      const userDetails = await this.getList(
        "User",
        { name: username },
        ["full_name", "email"]
      );
      const u = userDetails?.message?.[0];
      return { username, full_name: u?.full_name || username, email: u?.email };
    } catch {
      return { username, full_name: username };
    }
  }

  /**
   * Get list (frappe.client.get_list)
   */
  static async getList(
    doctype: string,
    filters: any = {},
    fields: string[] = ["name"],
    limit_page_length: number = 50,
    order_by: string = "creation desc"
  ) {
    // Optional: owner filter for Trip for non-admin user (as you had)
    const userStr =
      typeof window !== "undefined" ? localStorage.getItem("frappe_user") : null;
    const user = userStr ? JSON.parse(userStr) : null;

    const finalFilters = { ...(filters || {}) };
    if (user && user.username !== "Administrator" && doctype === "Trip") {
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

  /**
   * Get single doc (frappe.client.get)
   */
  static async getDoc(doctype: string, name: string) {
    return this.fetch("frappe.client.get", { doctype, name });
  }

  private static cleanDoc(doc: any) {
    const isNew = !doc?.name;
    const clean = { ...(doc || {}) };

    // remove internal/readonly fields
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

    // default date
    if (!clean.departure) clean.departure = new Date().toISOString().split("T")[0];

    // child table normalization example
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

  /**
   * Insert or Save doc
   */
  static async saveDoc(doctype: string, doc: any) {
    const cleaned = this.cleanDoc(doc);
    const isNew = !cleaned.name;

    const method = isNew ? "frappe.client.insert" : "frappe.client.save";
    const payload = { doc: JSON.stringify({ ...cleaned, doctype }) };

    const res = await this.fetch(method, payload, { method: "POST" });
    return res.message;
  }

  static getPrintUrl(doctype: string, name: string, format?: string) {
    const fmt = format || doctype;
    return `${this.BASE_URL}/printview?doctype=${encodeURIComponent(
      doctype
    )}&name=${encodeURIComponent(name)}&format=${encodeURIComponent(
      fmt
    )}&no_letterhead=0`;
  }

  /**
   * Logout (server + local)
   */
  static async logout() {
    try {
      await this.fetch("logout", {}, { method: "POST" });
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("frappe_user");
    }
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
