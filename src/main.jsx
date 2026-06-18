import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const roles = ["Admin", "Doctor", "Nurse", "Emergency"];
const priorityScore = { Critical: 3, Watch: 2, Stable: 1 };

const fallbackData = {
  users: [],
  patients: [],
  appointments: [],
  beds: [],
  ambulances: [],
};

function loadCachedData() {
  try {
    return JSON.parse(localStorage.getItem("careflow-data")) || fallbackData;
  } catch {
    return fallbackData;
  }
}

function App() {
  const [data, setData] = useState(loadCachedData);
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("careflow-session"));
    } catch {
      return null;
    }
  });
  const [apiStatus, setApiStatus] = useState("Connecting to API...");

  async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  function persistDashboard(next) {
    setData(next);
    localStorage.setItem("careflow-data", JSON.stringify(next));
  }

  async function loadDashboard() {
    try {
      const dashboard = await request("/dashboard");
      persistDashboard(dashboard);
      setApiStatus("Backend connected");
    } catch {
      setApiStatus("Offline demo mode");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function login(credentials) {
    const result = await request("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setSession(result);
    localStorage.setItem("careflow-session", JSON.stringify(result));
    await loadDashboard();
  }

  function logout() {
    setSession(null);
    localStorage.removeItem("careflow-session");
  }

  async function refreshAfter(action) {
    await action();
    await loadDashboard();
  }

  if (!session?.user) {
    return <LoginScreen apiStatus={apiStatus} onLogin={login} />;
  }

  return (
    <Dashboard
      apiStatus={apiStatus}
      data={data}
      loadDashboard={loadDashboard}
      logout={logout}
      refreshAfter={refreshAfter}
      request={request}
      session={session}
    />
  );
}

function LoginScreen({ apiStatus, onLogin }) {
  const [role, setRole] = useState("Admin");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demoAccounts = {
    Admin: ["admin", "admin123"],
    Doctor: ["doctor", "doctor123"],
    Nurse: ["nurse", "nurse123"],
    Emergency: ["emergency", "emergency123"],
  };

  function chooseRole(nextRole) {
    setRole(nextRole);
    setUsername(demoAccounts[nextRole][0]);
    setPassword(demoAccounts[nextRole][1]);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onLogin({ role, username, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <p className="eyebrow">CareFlow HMS</p>
        <h1>Role-based hospital access</h1>
        <p>Every department logs into its own workspace: Admin, Doctor, Nurse, and Emergency.</p>
        <span className={apiStatus === "Backend connected" ? "api-status online" : "api-status"}>{apiStatus}</span>
      </section>

      <form className="login-panel" onSubmit={submit}>
        <div>
          <p className="eyebrow">Choose access</p>
          <h2>{role} login</h2>
        </div>
        <div className="role-grid">
          {roles.map((item) => (
            <button className={role === item ? "active" : ""} key={item} onClick={() => chooseRole(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <input placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <strong className="form-error">{error}</strong>}
        <button type="submit" disabled={loading}>{loading ? "Signing in..." : `Enter ${role} space`}</button>
        <p className="hint">Demo credentials are filled automatically when you choose a role.</p>
      </form>
    </main>
  );
}

function Dashboard({ apiStatus, data, loadDashboard, logout, refreshAfter, request, session }) {
  const role = session.user.role;
  const insights = useMemo(() => {
    const admitted = data.patients.filter((patient) => patient.status !== "Discharged").length;
    const critical = data.patients.filter((patient) => patient.priority === "Critical").length;
    const revenue = data.patients.reduce((sum, patient) => sum + Number(patient.bill || 0), 0);
    const totalBeds = data.beds.reduce((sum, bed) => sum + bed.total, 0);
    const occupiedBeds = data.beds.reduce((sum, bed) => sum + bed.occupied, 0);
    const highRisk = [...data.patients].sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority])[0];

    return {
      admitted,
      critical,
      revenue,
      bedUse: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      highRisk,
    };
  }, [data]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">CareFlow HMS</p>
          <h1>{role} space</h1>
          <p className="sidebar-copy">{session.user.name}</p>
        </div>
        <nav>
          {roles.map((item) => (
            <button className={role === item ? "active" : ""} disabled={role !== item} key={item}>
              {item}
            </button>
          ))}
        </nav>
        <div className="innovation-note">
          <strong>Secured workspace</strong>
          <span>Each role sees tools for its own hospital responsibility.</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{role} dashboard</p>
            <h2>Welcome, {session.user.name}</h2>
          </div>
          <div className="topbar-actions">
            <span className={apiStatus === "Backend connected" ? "api-status online" : "api-status"}>{apiStatus}</span>
            <button className="ghost" onClick={loadDashboard}>Refresh</button>
            <button className="ghost danger" onClick={logout}>Logout</button>
          </div>
        </header>

        <section className="stats-grid">
          <Metric label="Admitted patients" value={insights.admitted} tone="blue" />
          <Metric label="Critical cases" value={insights.critical} tone="red" />
          <Metric label="Bed occupancy" value={`${insights.bedUse}%`} tone="green" />
          <Metric label="Appointments" value={data.appointments.length} tone="gold" />
        </section>

        {role === "Admin" && <AdminSpace data={data} refreshAfter={refreshAfter} request={request} />}
        {role === "Doctor" && <DoctorSpace data={data} refreshAfter={refreshAfter} request={request} />}
        {role === "Nurse" && <NurseSpace data={data} refreshAfter={refreshAfter} request={request} />}
        {role === "Emergency" && <EmergencySpace data={data} refreshAfter={refreshAfter} request={request} />}
      </section>
    </main>
  );
}

function AdminSpace({ data, refreshAfter, request }) {
  return (
    <>
      <section className="main-grid">
        <StaffManager data={data} refreshAfter={refreshAfter} request={request} />
        <AppointmentManager data={data} refreshAfter={refreshAfter} request={request} canDelete />
      </section>
      <section className="lower-grid">
        <BedPanel beds={data.beds} />
        <AmbulancePanel ambulances={data.ambulances} />
        <PatientQueue patients={data.patients} refreshAfter={refreshAfter} request={request} />
      </section>
    </>
  );
}

function DoctorSpace({ data, refreshAfter, request }) {
  const doctorAppointments = data.appointments.filter((appointment) => appointment.doctor.includes("Dr."));
  return (
    <>
      <section className="main-grid">
        <PatientQueue patients={data.patients} refreshAfter={refreshAfter} request={request} />
        <AppointmentList appointments={doctorAppointments} refreshAfter={refreshAfter} request={request} title="My appointments" />
      </section>
      <section className="lower-grid two">
        <BedPanel beds={data.beds} />
        <ReportPanel patients={data.patients} />
      </section>
    </>
  );
}

function NurseSpace({ data, refreshAfter, request }) {
  return (
    <>
      <section className="main-grid">
        <PatientIntake data={data} refreshAfter={refreshAfter} request={request} />
        <AppointmentManager data={data} refreshAfter={refreshAfter} request={request} />
      </section>
      <section className="lower-grid two">
        <PatientQueue patients={data.patients} refreshAfter={refreshAfter} request={request} />
        <BedPanel beds={data.beds} />
      </section>
    </>
  );
}

function EmergencySpace({ data, refreshAfter, request }) {
  const criticalPatients = data.patients.filter((patient) => patient.priority === "Critical");
  return (
    <>
      <section className="main-grid">
        <div className="panel wide">
          <p className="eyebrow">Emergency triage</p>
          <h3>Critical cases</h3>
          <PatientQueue patients={criticalPatients} refreshAfter={refreshAfter} request={request} embedded />
        </div>
        <AmbulancePanel ambulances={data.ambulances} />
      </section>
      <section className="lower-grid two">
        <AppointmentList appointments={data.appointments.filter((item) => item.type === "Emergency")} refreshAfter={refreshAfter} request={request} title="Emergency appointments" />
        <BedPanel beds={data.beds.filter((bed) => bed.ward === "ICU" || bed.ward === "General")} />
      </section>
    </>
  );
}

function StaffManager({ data, refreshAfter, request }) {
  const [form, setForm] = useState({ name: "", username: "", password: "care123", role: "Nurse", department: "" });

  async function addUser(event) {
    event.preventDefault();
    await refreshAfter(() => request("/users", { method: "POST", body: JSON.stringify(form) }));
    setForm({ name: "", username: "", password: "care123", role: "Nurse", department: "" });
  }

  return (
    <div className="panel wide">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Admin control</p>
          <h3>Staff categories and access</h3>
        </div>
        <span className="pill">{data.users.length} active accounts</span>
      </div>

      <form className="compact-form" onSubmit={addUser}>
        <input placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        <input placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {roles.map((role) => <option key={role}>{role}</option>)}
        </select>
        <input placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
        <button type="submit">Add staff</button>
      </form>

      <div className="table">
        {data.users.map((user) => (
          <article className="staff-row" key={user.id}>
            <div>
              <strong>{user.name}</strong>
              <span>{user.username} · {user.department}</span>
            </div>
            <span className="priority stable">{user.role}</span>
            <button className="row-action danger" onClick={() => refreshAfter(() => request(`/users/${user.id}`, { method: "DELETE" }))}>
              Delete
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function PatientIntake({ data, refreshAfter, request }) {
  const [form, setForm] = useState({ name: "", age: "", condition: "", priority: "Stable", ward: "General", doctor: "Dr. Meera Sen" });

  async function addPatient(event) {
    event.preventDefault();
    await refreshAfter(() => request("/patients", { method: "POST", body: JSON.stringify(form) }));
    setForm({ name: "", age: "", condition: "", priority: "Stable", ward: "General", doctor: "Dr. Meera Sen" });
  }

  return (
    <form className="panel" onSubmit={addPatient}>
      <p className="eyebrow">Nurse intake</p>
      <h3>Add patient</h3>
      <input placeholder="Patient name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <input placeholder="Age" type="number" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
      <input placeholder="Condition" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} />
      <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
        <option>Stable</option>
        <option>Watch</option>
        <option>Critical</option>
      </select>
      <select value={form.ward} onChange={(event) => setForm({ ...form, ward: event.target.value })}>
        {data.beds.map((bed) => <option key={bed.ward}>{bed.ward}</option>)}
      </select>
      <button type="submit">Create intake record</button>
    </form>
  );
}

function AppointmentManager({ data, refreshAfter, request, canDelete = false }) {
  const [form, setForm] = useState({ patient: "", doctor: "Dr. Meera Sen", date: "2026-06-18", time: "", type: "Consultation", notes: "" });

  async function addAppointment(event) {
    event.preventDefault();
    await refreshAfter(() => request("/appointments", { method: "POST", body: JSON.stringify(form) }));
    setForm({ patient: "", doctor: "Dr. Meera Sen", date: "2026-06-18", time: "", type: "Consultation", notes: "" });
  }

  return (
    <div className="panel">
      <p className="eyebrow">Appointments</p>
      <h3>Book appointment</h3>
      <form className="stack-form" onSubmit={addAppointment}>
        <input placeholder="Patient name" value={form.patient} onChange={(event) => setForm({ ...form, patient: event.target.value })} />
        <input placeholder="Doctor name" value={form.doctor} onChange={(event) => setForm({ ...form, doctor: event.target.value })} />
        <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
        <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
          <option>Consultation</option>
          <option>Emergency</option>
          <option>X-Ray</option>
          <option>Follow-up</option>
          <option>Surgery Review</option>
        </select>
        <input placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        <button type="submit">Book appointment</button>
      </form>
      <AppointmentList appointments={data.appointments} canDelete={canDelete} refreshAfter={refreshAfter} request={request} title="All appointments" />
    </div>
  );
}

function AppointmentList({ appointments, canDelete = false, refreshAfter, request, title }) {
  async function setStatus(id, status) {
    await refreshAfter(() => request(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }));
  }

  return (
    <div className="list-section">
      <p className="eyebrow">{title}</p>
      {appointments.map((appointment) => (
        <article className="appointment-row" key={appointment.id}>
          <div>
            <strong>{appointment.date || "Today"} · {appointment.time}</strong>
            <span>{appointment.patient} with {appointment.doctor}</span>
            <small>{appointment.type} · {appointment.notes || "No notes"}</small>
          </div>
          <select value={appointment.status} onChange={(event) => setStatus(appointment.id, event.target.value)}>
            <option>Booked</option>
            <option>Queued</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
          {canDelete && (
            <button className="row-action danger" onClick={() => refreshAfter(() => request(`/appointments/${appointment.id}`, { method: "DELETE" }))}>
              Delete
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function PatientQueue({ embedded = false, patients, refreshAfter, request }) {
  async function dischargePatient(patientId) {
    await refreshAfter(() => request(`/patients/${patientId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Discharged" }),
    }));
  }

  const body = (
    <div className="table">
      {patients.map((patient) => (
        <article className="row" key={patient.id}>
          <div>
            <strong>{patient.name}</strong>
            <span>{patient.id} · {patient.condition}</span>
          </div>
          <div>{patient.doctor}</div>
          <div>{patient.ward}</div>
          <div className={`priority ${patient.priority.toLowerCase()}`}>{patient.priority}</div>
          <button className="row-action" onClick={() => dischargePatient(patient.id)} disabled={patient.status === "Discharged"}>
            {patient.status === "Discharged" ? "Discharged" : "Discharge"}
          </button>
        </article>
      ))}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="panel wide">
      <p className="eyebrow">Smart queue</p>
      <h3>Patient triage</h3>
      {body}
    </div>
  );
}

function BedPanel({ beds }) {
  return (
    <div className="panel">
      <p className="eyebrow">Bed management</p>
      <h3>Ward pressure</h3>
      {beds.map((bed) => (
        <div className="bed-line" key={bed.ward}>
          <span>{bed.ward}</span>
          <div><span style={{ width: `${(bed.occupied / bed.total) * 100}%` }} /></div>
          <strong>{bed.occupied}/{bed.total}</strong>
        </div>
      ))}
    </div>
  );
}

function AmbulancePanel({ ambulances }) {
  return (
    <div className="panel">
      <p className="eyebrow">Emergency desk</p>
      <h3>Ambulances</h3>
      {ambulances.map((ambulance) => (
        <article className="mini-row" key={ambulance.id}>
          <strong>{ambulance.id}</strong>
          <span>{ambulance.driver}</span>
          <em>{ambulance.status}{ambulance.eta ? ` · ${ambulance.eta} min` : ""}</em>
        </article>
      ))}
    </div>
  );
}

function ReportPanel({ patients }) {
  return (
    <div className="panel">
      <p className="eyebrow">Doctor review</p>
      <h3>Patient reports</h3>
      {patients.map((patient) => (
        <article className="mini-row report" key={patient.id}>
          <strong>{patient.vitals?.spo2 || 0}%</strong>
          <span>{patient.name} · BP {patient.vitals?.bp}</span>
          <em>{patient.status}</em>
        </article>
      ))}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
