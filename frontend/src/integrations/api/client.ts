/**
 * API-Client: Ersetzt den Supabase-Client.
 *
 * Lokal → eigenes Express-Backend
 * AWS  → API Gateway / ECS – nur VITE_API_URL in .env ändern
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

function clearToken(): void {
  localStorage.removeItem("auth_token");
}

// ─── Fetch-Wrapper ────────────────────────────────────────────────────────────

async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/auth";
  }

  return response;
}

async function apiJson<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unbekannter Fehler" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Upload-Helper ────────────────────────────────────────────────────────────

async function apiUpload(path: string, file: File, extraFields?: Record<string, string>) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  if (extraFields) {
    Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v));
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Storage URL ──────────────────────────────────────────────────────────────

function getStorageUrl(bucket: string, filePath: string | null): string | null {
  if (!filePath) return null;
  if (import.meta.env.VITE_USE_S3 === "true") {
    const region = import.meta.env.VITE_AWS_REGION || "eu-central-1";
    const bucketName = import.meta.env.VITE_AWS_S3_BUCKET || "schuetzenhub-uploads";
    return `https://${bucketName}.s3.${region}.amazonaws.com/${bucket}/${filePath}`;
  }
  return `${API_BASE}/uploads/${bucket}/${filePath}`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const data = await apiJson<{ token: string; userId: string; email: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      setToken(data.token);
      return { data, error: null };
    } catch (err: unknown) {
      return { data: null, error: { message: (err as Error).message } };
    }
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { emailRedirectTo?: string } }) {
    // Für Self-Signup ohne Club-Auswahl – Register-Seite nutzt registerWithClub()
    return { data: null, error: { message: "Bitte nutze die Registrierungsseite" } };
  },

  async signOut() {
    clearToken();
    return { error: null };
  },

  async getSession() {
    const token = getToken();
    if (!token) return { data: { session: null } };
    try {
      const me = await apiJson<{ member: unknown; userRole: unknown; permissions: unknown[] }>("/api/auth/me");
      return { data: { session: { token, user: { id: "local" }, ...me } } };
    } catch {
      clearToken();
      return { data: { session: null } };
    }
  },

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    // Kein Realtime – einmal beim Laden prüfen
    auth.getSession().then(({ data }) => {
      callback(data.session ? "SIGNED_IN" : "SIGNED_OUT", data.session);
    });
    return { data: { subscription: { unsubscribe: () => {} } } };
  },

  async getUser(token?: string) {
    try {
      const me = await apiJson<{ member: unknown }>("/api/auth/me");
      return { data: { user: me.member }, error: null };
    } catch {
      return { data: { user: null }, error: { message: "Nicht angemeldet" } };
    }
  },
};

// ─── Hilfsfunktion für Tabellen-Queries ──────────────────────────────────────

type QueryBuilder = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number;
};

/**
 * Direkte Tabellen-API – wird von migrierten Seiten genutzt
 * Ersetzt: supabase.from("members").select(...).eq(...).order(...)
 */
function from(table: string) {
  return new TableQuery(table);
}

class TableQuery {
  private table: string;
  private method: string = "GET";
  private body: unknown = null;
  private filters: Record<string, unknown> = {};
  private _select: string = "*";
  private _order: string | null = null;
  private _limit: number | null = null;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _count: string | null = null;
  private _gte: Record<string, string> = {};
  private _lte: Record<string, string> = {};
  private _in: Record<string, unknown[]> = {};
  private _is: Record<string, null | boolean> = {};
  private _not: Record<string, unknown> = {};

  constructor(table: string) {
    this.table = table;
  }

  select(cols: string, opts?: { count?: string }) {
    this._select = cols;
    if (opts?.count) this._count = opts.count;
    return this;
  }

  eq(col: string, val: unknown) { this.filters[col] = val; return this; }
  neq(col: string, val: unknown) { this._not[col] = val; return this; }
  gte(col: string, val: string) { this._gte[col] = val; return this; }
  lte(col: string, val: string) { this._lte[col] = val; return this; }
  in(col: string, vals: unknown[]) { this._in[col] = vals; return this; }
  is(col: string, val: null | boolean) { this._is[col] = val; return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order = `${col}:${opts?.ascending === false ? "desc" : "asc"}`;
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  insert(data: unknown) {
    this.method = "POST";
    this.body = data;
    return this;
  }

  update(data: unknown) {
    this.method = "PUT";
    this.body = data;
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  upsert(data: unknown) {
    this.method = "POST";
    this.body = data;
    return this;
  }

  async then(resolve: (result: { data: unknown; error: unknown; count?: number }) => void) {
    const result = await this._execute();
    resolve(result);
    return result;
  }

  // Für Promise-Auflösung
  async _execute(): Promise<{ data: unknown; error: { message: string } | null; count?: number }> {
    // Tabellen-zu-API Mapping
    const tableApiMap: Record<string, string> = {
      members: "/api/members",
      events: "/api/events",
      clubs: "/api/clubs/me",
      clubs_registration: "/api/clubs/registration",
      companies: "/api/companies",
      posts: "/api/posts",
      notifications: "/api/notifications",
      gallery_images: "/api/gallery",
      documents: "/api/documents",
      work_shifts: "/api/work-shifts",
      work_shift_assignments: "/api/work-shifts",
      member_company_memberships: "/api/memberships",
      member_awards: "/api/awards",
      award_types: "/api/award-types",
      roles: "/api/roles",
      permissions: "/api/permissions",
    };

    const apiPath = tableApiMap[this.table];
    if (!apiPath) {
      console.warn(`[API] Tabelle "${this.table}" hat kein API-Mapping. Query übersprungen.`);
      return { data: null, error: null };
    }

    try {
      // Für einfache Queries: direkte API-Calls
      if (this.method === "GET") {
        const params = new URLSearchParams();
        Object.entries(this.filters).forEach(([k, v]) => params.set(k, String(v)));
        Object.entries(this._gte).forEach(([k, v]) => params.set(`gte_${k}`, v));
        Object.entries(this._lte).forEach(([k, v]) => params.set(`lte_${k}`, v));
        Object.entries(this._is).forEach(([k, v]) => params.set(`is_${k}`, v === null ? "null" : String(v)));
        if (this._order) params.set("order", this._order);
        if (this._limit) params.set("limit", String(this._limit));
        if (this._count) params.set("count", this._count);

        const url = `${apiPath}${params.toString() ? "?" + params.toString() : ""}`;
        const data = await apiJson(url);

        let result = Array.isArray(data) ? data : [data];

        // Client-side Filterung für Felder die API nicht direkt filtert
        if (Object.keys(this.filters).length > 0) {
          result = result.filter((row: Record<string, unknown>) =>
            Object.entries(this.filters).every(([k, v]) => row[k] === v)
          );
        }
        if (Object.keys(this._gte).length > 0) {
          result = result.filter((row: Record<string, unknown>) =>
            Object.entries(this._gte).every(([k, v]) => String(row[k]) >= v)
          );
        }
        if (Object.keys(this._in).length > 0) {
          result = result.filter((row: Record<string, unknown>) =>
            Object.entries(this._in).every(([k, vals]) => (vals as unknown[]).includes(row[k]))
          );
        }
        if (Object.keys(this._is).length > 0) {
          result = result.filter((row: Record<string, unknown>) =>
            Object.entries(this._is).every(([k, v]) =>
              v === null ? row[k] == null : row[k] === v
            )
          );
        }

        if (this._limit) result = result.slice(0, this._limit);

        if (this._single || this._maybeSingle) {
          return { data: result[0] || null, error: null, count: result.length };
        }
        return { data: result, error: null, count: result.length };
      }

      // POST (insert)
      if (this.method === "POST") {
        const data = await apiJson(apiPath, {
          method: "POST",
          body: JSON.stringify(this.body),
        });
        return { data, error: null };
      }

      // Für Update/Delete brauchen wir die ID aus den Filtern
      const id = this.filters["id"] as string;
      if (!id) {
        console.warn("[API] Update/Delete ohne ID-Filter");
        return { data: null, error: null };
      }

      if (this.method === "PUT") {
        const data = await apiJson(`${apiPath}/${id}`, {
          method: "PUT",
          body: JSON.stringify(this.body),
        });
        return { data, error: null };
      }

      if (this.method === "DELETE") {
        await apiJson(`${apiPath}/${id}`, { method: "DELETE" });
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err: unknown) {
      return { data: null, error: { message: (err as Error).message } };
    }
  }
}

// ─── RPC-Emulation ────────────────────────────────────────────────────────────

async function rpc(fn: string, params?: Record<string, unknown>) {
  try {
    const data = await apiJson(`/api/rpc/${fn}`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
    return { data, error: null };
  } catch (err: unknown) {
    return { data: null, error: { message: (err as Error).message } };
  }
}

// ─── Storage-Emulation ───────────────────────────────────────────────────────

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        try {
          const res = await apiUpload(`/api/upload`, file, { bucket, path });
          return { data: res, error: null };
        } catch (err: unknown) {
          return { data: null, error: { message: (err as Error).message } };
        }
      },
      async remove(paths: string[]) {
        try {
          await apiJson("/api/storage/delete", {
            method: "POST",
            body: JSON.stringify({ bucket, paths }),
          });
          return { error: null };
        } catch (err: unknown) {
          return { error: { message: (err as Error).message } };
        }
      },
      getPublicUrl(filePath: string) {
        return { data: { publicUrl: getStorageUrl(bucket, filePath) || "" } };
      },
      async download(filePath: string) {
        try {
          const res = await apiFetch(`/api/documents/download?path=${encodeURIComponent(filePath)}&bucket=${bucket}`);
          const blob = await res.blob();
          return { data: blob, error: null };
        } catch (err: unknown) {
          return { data: null, error: { message: (err as Error).message } };
        }
      },
    };
  },
};

// ─── Functions-Emulation (Supabase Edge Functions) ───────────────────────────

const functions = {
  async invoke(fnName: string, options?: { body?: unknown }) {
    try {
      const data = await apiJson(`/api/functions/${fnName}`, {
        method: "POST",
        body: JSON.stringify(options?.body || {}),
      });
      return { data, error: null };
    } catch (err: unknown) {
      return { data: null, error: { message: (err as Error).message } };
    }
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const api = {
  fetch: apiFetch,
  json: apiJson,
  upload: apiUpload,
  getStorageUrl,
  from,
  auth,
  storage,
  functions,
  rpc,
};

// Rückwärtskompatibel mit "supabase" Import
export const supabase = {
  auth,
  storage,
  functions,
  from,
  rpc,
};

export { setToken, clearToken, getToken, getStorageUrl, apiUpload, apiJson };
