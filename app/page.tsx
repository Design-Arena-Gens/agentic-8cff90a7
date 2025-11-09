"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import "./globals.css";

type Uuid = string;

export type Member = {
  id: Uuid;
  name: string;
  email?: string;
  phone?: string;
};

export type Session = {
  id: Uuid;
  title: string;
  dateISO: string; // e.g. 2025-11-09
  notes?: string;
};

export type AttendanceRecord = {
  sessionId: Uuid;
  memberId: Uuid;
  present: boolean;
};

export type StoreShape = {
  members: Member[];
  sessions: Session[];
  attendance: AttendanceRecord[];
};

const DEFAULT_STORE: StoreShape = { members: [], sessions: [], attendance: [] };

function generateId(): Uuid {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function useLocalStore(key: string, initial: StoreShape) {
  const [state, setState] = useState<StoreShape>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

const DataCtx = createContext<{
  store: StoreShape;
  addMember: (input: Omit<Member, "id">) => void;
  updateMember: (id: Uuid, patch: Partial<Member>) => void;
  removeMember: (id: Uuid) => void;
  addSession: (input: Omit<Session, "id">) => void;
  updateSession: (id: Uuid, patch: Partial<Session>) => void;
  removeSession: (id: Uuid) => void;
  setAttendance: (sessionId: Uuid, memberId: Uuid, present: boolean) => void;
  clearAll: () => void;
  importJson: (json: StoreShape) => void;
} | null>(null);

function DataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useLocalStore("ngo-attendance-store", DEFAULT_STORE);

  const api = useMemo(() => ({
    store,
    addMember: (input: Omit<Member, "id">) =>
      setStore(s => ({ ...s, members: [...s.members, { ...input, id: generateId() }] })),
    updateMember: (id: Uuid, patch: Partial<Member>) =>
      setStore(s => ({ ...s, members: s.members.map(m => (m.id === id ? { ...m, ...patch } : m)) })),
    removeMember: (id: Uuid) =>
      setStore(s => ({
        ...s,
        members: s.members.filter(m => m.id !== id),
        attendance: s.attendance.filter(a => a.memberId !== id),
      })),
    addSession: (input: Omit<Session, "id">) =>
      setStore(s => ({ ...s, sessions: [...s.sessions, { ...input, id: generateId() }] })),
    updateSession: (id: Uuid, patch: Partial<Session>) =>
      setStore(s => ({ ...s, sessions: s.sessions.map(sess => (sess.id === id ? { ...sess, ...patch } : sess)) })),
    removeSession: (id: Uuid) =>
      setStore(s => ({
        ...s,
        sessions: s.sessions.filter(sess => sess.id !== id),
        attendance: s.attendance.filter(a => a.sessionId !== id),
      })),
    setAttendance: (sessionId: Uuid, memberId: Uuid, present: boolean) =>
      setStore(s => {
        const idx = s.attendance.findIndex(a => a.sessionId === sessionId && a.memberId === memberId);
        const next = [...s.attendance];
        if (idx >= 0) next[idx] = { ...next[idx], present };
        else next.push({ sessionId, memberId, present });
        return { ...s, attendance: next };
      }),
    clearAll: () => setStore(DEFAULT_STORE),
    importJson: (json: StoreShape) => setStore(json),
  }), [store]);

  return <DataCtx.Provider value={api}>{children}</DataCtx.Provider>;
}

function useData() {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("Data context missing");
  return ctx;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card vstack">
      <div>
        <h3 className="section-title">{title}</h3>
        {subtitle ? <div className="small">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function MembersManager() {
  const { store, addMember, updateMember, removeMember } = useData();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  return (
    <Section title="Members" subtitle="Add and manage participants">
      <div className="grid cols-3">
        <input className="input" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <div className="hstack">
          <input className="input" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <button className="btn" onClick={() => {
            if (!form.name.trim()) return;
            addMember({ name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined });
            setForm({ name: "", email: "", phone: "" });
          }}>Add</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Contact</th><th></th></tr>
        </thead>
        <tbody>
          {store.members.map(m => (
            <tr key={m.id}>
              <td>
                <input className="input" value={m.name} onChange={e => updateMember(m.id, { name: e.target.value })} />
              </td>
              <td className="small">{[m.email, m.phone].filter(Boolean).join(" ? ") || <span className="badge">No contact</span>}</td>
              <td style={{ textAlign: "right" }}>
                <button className="btn danger" onClick={() => removeMember(m.id)}>Remove</button>
              </td>
            </tr>
          ))}
          {store.members.length === 0 && (
            <tr><td colSpan={3} className="small">No members yet. Add your first member above.</td></tr>
          )}
        </tbody>
      </table>
    </Section>
  );
}

function SessionsManager() {
  const { store, addSession, updateSession, removeSession } = useData();
  const [form, setForm] = useState({ title: "", dateISO: new Date().toISOString().slice(0,10), notes: "" });

  return (
    <Section title="Sessions" subtitle="Create and manage sessions">
      <div className="grid cols-3">
        <input className="input" type="date" value={form.dateISO} onChange={e => setForm(f => ({ ...f, dateISO: e.target.value }))} />
        <input className="input" placeholder="Title (e.g., Weekly Meeting)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <div className="hstack">
          <input className="input" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button className="btn" onClick={() => {
            if (!form.title.trim()) return;
            addSession({ title: form.title.trim(), dateISO: form.dateISO, notes: form.notes.trim() || undefined });
            setForm({ title: "", dateISO: new Date().toISOString().slice(0,10), notes: "" });
          }}>Add</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr><th>Date</th><th>Title</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          {store.sessions.map(s => (
            <tr key={s.id}>
              <td><input className="input" type="date" value={s.dateISO} onChange={e => updateSession(s.id, { dateISO: e.target.value })} /></td>
              <td><input className="input" value={s.title} onChange={e => updateSession(s.id, { title: e.target.value })} /></td>
              <td><input className="input" value={s.notes || ""} onChange={e => updateSession(s.id, { notes: e.target.value })} /></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn danger" onClick={() => removeSession(s.id)}>Remove</button>
              </td>
            </tr>
          ))}
          {store.sessions.length === 0 && (
            <tr><td colSpan={4} className="small">No sessions yet. Create one above.</td></tr>
          )}
        </tbody>
      </table>
    </Section>
  );
}

function AttendanceManager() {
  const { store, setAttendance } = useData();
  const [sessionId, setSessionId] = useState<string>(() => store.sessions[0]?.id || "");
  useEffect(() => {
    if (!sessionId && store.sessions[0]) setSessionId(store.sessions[0].id);
  }, [store.sessions, sessionId]);

  const selected = store.sessions.find(s => s.id === sessionId);
  const attendanceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const rec of store.attendance) {
      if (rec.sessionId === sessionId) map.set(rec.memberId, rec.present);
    }
    return map;
  }, [store.attendance, sessionId]);

  function exportCsvForSession() {
    if (!selected) return;
    const rows = [["Member Name", "Email", "Phone", "Present", "Session Title", "Date"]];
    for (const m of store.members) {
      const present = attendanceMap.get(m.id) ? "Yes" : "No";
      rows.push([m.name, m.email || "", m.phone || "", present, selected.title, selected.dateISO]);
    }
    const csv = rows.map(r => r.map(field => /[",\n]/.test(field) ? '"' + field.replaceAll('"', '""') + '"' : field).join(",")).join("\n");
    downloadFile(`${selected.dateISO}-${selected.title}-attendance.csv`, csv, "text/csv");
  }

  return (
    <Section title="Attendance" subtitle="Mark presence for a session">
      <div className="hstack">
        <select className="input" value={sessionId} onChange={e => setSessionId(e.target.value)}>
          {store.sessions.map(s => (
            <option key={s.id} value={s.id}>{`${s.dateISO} ? ${s.title}`}</option>
          ))}
        </select>
        <button className="btn" disabled={!selected} onClick={exportCsvForSession}>Export CSV</button>
      </div>
      {!selected ? (
        <div className="small">Create a session first to mark attendance.</div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Member</th><th>Present</th></tr>
          </thead>
          <tbody>
            {store.members.map(m => {
              const present = attendanceMap.get(m.id) || false;
              return (
                <tr key={m.id}>
                  <td>{m.name} {m.email ? <span className="badge" style={{ marginLeft: 8 }}>{m.email}</span> : null}</td>
                  <td>
                    <div className={`toggle ${present ? "on" : ""}`} onClick={() => setAttendance(selected.id, m.id, !present)}>
                      <div className="knob" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {store.members.length === 0 && (
              <tr><td colSpan={2} className="small">No members yet. Add members to mark attendance.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function BackupPanel() {
  const { store, importJson, clearAll } = useData();

  function exportJson() {
    const json = JSON.stringify(store, null, 2);
    downloadFile("attendance-backup.json", json, "application/json");
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (isStoreShape(data)) importJson(data);
        else alert("Invalid backup format");
      } catch {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  }

  return (
    <Section title="Backup & Restore" subtitle="Export CSV or full JSON backup">
      <div className="hstack">
        <button className="btn" onClick={exportJson}>Download JSON Backup</button>
        <label className="btn secondary" style={{ display: "inline-block" }}>
          Import JSON
          <input type="file" accept="application/json" onChange={onImport} style={{ display: "none" }} />
        </label>
        <button className="btn warn" onClick={() => {
          if (confirm("This will erase all local data on this device. Continue?")) clearAll();
        }}>Clear All Data</button>
      </div>
      <div className="small">Data is stored locally in your browser (per device). Use backup to move across devices.</div>
    </Section>
  );
}

function isStoreShape(x: any): x is StoreShape {
  return x && Array.isArray(x.members) && Array.isArray(x.sessions) && Array.isArray(x.attendance);
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Header({ active, setActive }: { active: string; setActive: (k: string) => void }) {
  const tabs = [
    { key: "members", label: "Members" },
    { key: "sessions", label: "Sessions" },
    { key: "attendance", label: "Attendance" },
    { key: "backup", label: "Backup" },
  ];
  return (
    <div className="vstack" style={{ marginBottom: 16 }}>
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>NGO Attendance Manager</h2>
        <span className="badge">Local-only ? No login needed</span>
      </div>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.key} className={`tab ${active === t.key ? "active" : ""}`} onClick={() => setActive(t.key)}>{t.label}</div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [active, setActive] = useState("attendance");
  return (
    <DataProvider>
      <Header active={active} setActive={setActive} />
      <div className="vstack" style={{ gap: 16 }}>
        {active === "members" && <MembersManager />}
        {active === "sessions" && <SessionsManager />}
        {active === "attendance" && <AttendanceManager />}
        {active === "backup" && <BackupPanel />}
      </div>
    </DataProvider>
  );
}
