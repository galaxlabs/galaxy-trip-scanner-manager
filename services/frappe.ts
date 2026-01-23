
export class FrappeClient {
  private static BASE_URL = 'https://tms.galaxylabs.online';
  
  private static get API_KEY() { 
    const key = process.env.FRAPPE_API_KEY;
    if (!key) console.warn("Missing FRAPPE_API_KEY environment variable");
    return key || ''; 
  }

  private static get API_SECRET() { 
    const secret = process.env.FRAPPE_API_SECRET;
    if (!secret) console.warn("Missing FRAPPE_API_SECRET environment variable");
    return secret || ''; 
  }

  static async fetch(method: string, params: any = {}, options: RequestInit = {}) {
    const url = new URL(`${this.BASE_URL}/api/method/${method}`);
    
    if (!options.method || options.method === 'GET') {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          const val = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
          url.searchParams.append(key, val);
        }
      });
    }

    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `token ${this.API_KEY}:${this.API_SECRET}`,
      'X-Frappe-Api-Key': this.API_KEY,
      'X-Frappe-Api-Secret': this.API_SECRET,
      'X-Requested-With': 'XMLHttpRequest'
    };

    const fetchOptions: RequestInit = {
      ...options,
      mode: 'cors',
      credentials: 'omit',
      headers: { ...headers, ...options.headers }
    };

    if (options.method === 'POST' && Object.keys(params).length > 0 && !options.body) {
      fetchOptions.body = JSON.stringify(params);
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);
      if (response.status === 401) throw new Error("Authentication Failed. Check API Keys in Vercel Settings.");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let msg = "Validation Failed";
        if (errorData._server_messages) {
           try {
             const msgs = JSON.parse(errorData._server_messages);
             msg = msgs.map((m: any) => typeof m === 'string' ? m : (m.message || JSON.stringify(m))).join(', ');
           } catch(e) { msg = errorData._server_messages; }
        } else if (errorData.message) {
            msg = errorData.message;
        }
        throw new Error(msg);
      }
      return await response.json();
    } catch (err: any) {
      throw err;
    }
  }

  static async verifyConnection() {
    const data = await this.fetch('frappe.auth.get_logged_user');
    const username = data.message;
    try {
        const userDetails = await this.getList('User', { name: username }, ['full_name']);
        return { username, full_name: userDetails.message?.[0]?.full_name || username };
    } catch (e) {
        return { username, full_name: username };
    }
  }

  static async getList(doctype: string, filters: any = {}, fields: string[] = ['*']) {
    const userStr = localStorage.getItem('frappe_user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    const finalFilters = { ...filters };
    if (user && user.username !== 'Administrator' && doctype === 'Trip') {
        finalFilters.owner = user.username;
    }

    return this.fetch('frappe.client.get_list', {
      doctype,
      filters: JSON.stringify(finalFilters),
      fields: JSON.stringify(fields),
      limit_page_length: 50,
      order_by: 'creation desc'
    });
  }

  static async getDoc(doctype: string, name: string) {
    return this.fetch('frappe.client.get', { doctype, name });
  }

  private static cleanDoc(doc: any) {
    const isNew = !doc.name;
    const clean = { ...doc };
    const internalFields = ['owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx', '_user_tags', '_comments', '_assign', '_liked_by', 'amended_from'];
    internalFields.forEach(f => delete clean[f]);

    if (!clean.departure) clean.departure = new Date().toISOString().split('T')[0];
    
    if (clean.passengers) {
      clean.passengers = clean.passengers.map((p: any) => {
        const { name, parent, parentfield, parenttype, owner, creation, modified, modified_by, docstatus, idx, is_auto_filled, ...rest } = p;
        const row: any = { ...rest, doctype: 'Passenger' };
        if (!isNew && name) row.name = name;
        return row;
      });
    }
    return clean;
  }

  static async saveDoc(doctype: string, doc: any) {
    const cleanDoc = this.cleanDoc(doc);
    const isNew = !cleanDoc.name;
    const method = isNew ? 'frappe.client.insert' : 'frappe.client.save';
    const payload = { doc: JSON.stringify({ ...cleanDoc, doctype }) };
    const response = await this.fetch(method, payload, { method: 'POST' });
    return response.message; 
  }

  static getPrintUrl(doctype: string, name: string) {
    return `${this.BASE_URL}/printview?doctype=Trip&name=${encodeURIComponent(name)}&format=Trip&no_letterhead=0`;
  }

  static logout() {
    localStorage.removeItem('frappe_user');
  }
}
