import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const seed = {
  patients: [
    {
      id: "P-1021",
      name: "Amina Paul",
      age: 42,
      gender: "Female",
      condition: "Chest pain",
      priority: "Critical",
      ward: "ICU",
      doctor: "Dr. Meera Sen",
      vitals: { bp: "150/95", spo2: 90, temp: 100.8, pulse: 118 },
      bill: 18400,
      status: "Admitted",
    },
    {
      id: "P-1022",
      name: "Rahul Kumar",
      age: 29,
      gender: "Male",
      condition: "Fracture",
      priority: "Stable",
      ward: "Ortho",
      doctor: "Dr. Arjun Rao",
      vitals: { bp: "121/80", spo2: 98, temp: 98.4, pulse: 82 },
      bill: 7200,
      status: "Observation",
    },
    {
      id: "P-1023",
      name: "Sofia James",
      age: 66,
      gender: "Female",
      condition: "Diabetes review",
      priority: "Watch",
      ward: "General",
      doctor: "Dr. Nisha Roy",
      vitals: { bp: "135/88", spo2: 95, temp: 99.2, pulse: 96 },
      bill: 4300,
      status: "Admitted",
    },
  ],
  appointments: [
    { id: "A-501", patient: "Amina Paul", doctor: "Dr. Meera Sen", time: "09:30", type: "Emergency", status: "Queued" },
    { id: "A-502", patient: "Rahul Kumar", doctor: "Dr. Arjun Rao", time: "11:15", type: "X-Ray", status: "Confirmed" },
    { id: "A-503", patient: "Sofia James", doctor: "Dr. Nisha Roy", time: "14:00", type: "Follow-up", status: "Confirmed" },
  ],
  beds: [
    { ward: "ICU", total: 12, occupied: 10 },
    { ward: "General", total: 48, occupied: 31 },
    { ward: "Ortho", total: 18, occupied: 13 },
    { ward: "Pediatrics", total: 16, occupied: 8 },
  ],
  ambulances: [
    { id: "AMB-01", driver: "K. Das", status: "On route", eta: 8 },
    { id: "AMB-02", driver: "M. Ali", status: "Available", eta: 0 },
    { id: "AMB-03", driver: "R. Soren", status: "Maintenance", eta: null },
  ],
};

const priorityScore = { Critical: 3, Watch: 2, Stable: 1 };

function loadData() {
  try {
    return JSON.parse(localStorage.getItem("careflow-data")) || seed;
  } catch {
    return seed;
  }
}

function App() {
  const [data, setData] = useState(loadData);
  const [activeRole, setActiveRole] = useState("Admin");
  const [patientForm, setPatientForm] = useState({
    name: "",
    age: "",
    condition: "",
    priority: "Stable",
    ward: "General",
    doctor: "Dr. Meera Sen",
  });

  function persist(next) {
    setData(next);
    localStorage.setItem("careflow-data", JSON.stringify(next));
  }

  function addPatient(event) {
    event.preventDefault();
    if (!patientForm.name.trim() || !patientForm.condition.trim()) return;

    const nextPatient = {
      id: `P-${Math.floor(1000 + Math.random() * 9000)}`,
      name: patientForm.name.trim(),
      age: Number(patientForm.age || 0),
      gender: "Not set",
      condition: patientForm.condition.trim(),
      priority: patientForm.priority,
      ward: patientForm.ward,
      doctor: patientForm.doctor,
      vitals: { bp: "Pending", spo2: 0, temp: 0, pulse: 0 },
      bill: 0,
      status: "New",
    };

    persist({ ...data, patients: [nextPatient, ...data.patients] });
    setPatientForm({ name: "", age: "", condition: "", priority: "Stable", ward: "General", doctor: "Dr. Meera Sen" });
  }

  const insights = useMemo(() => {
    const admitted = data.patients.filter((patient) => patient.status !== "Discharged").length;
    const critical = data.patients.filter((patient) => patient.priority === "Critical").length;
    const revenue = data.patients.reduce((sum, patient) => sum + patient.bill, 0);
    const totalBeds = data.beds.reduce((sum, bed) => sum + bed.total, 0);
    const occupiedBeds = data.beds.reduce((sum, bed) => sum + bed.occupied, 0);
    const highRisk = [...data.patients].sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority])[0];

    return {
      admitted,
      critical,
      revenue,
      bedUse: Math.round((occupiedBeds / totalBeds) * 100),
      highRisk,
    };
  }, [data]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">CareFlow HMS</p>
          <h1>Hospital command center</h1>
        </div>
        <nav>
          {["Admin", "Doctor", "Nurse", "Emergency"].map((role) => (
            <button className={activeRole === role ? "active" : ""} key={role} onClick={() => setActiveRole(role)}>
              {role}
            </button>
          ))}
        </nav>
        <div className="innovation-note">
          <strong>Innovation layer</strong>
          <span>Live triage scoring, bed pressure, ambulance ETA, and local-first records.</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeRole} workspace</p>
            <h2>Today&apos;s hospital operations</h2>
          </div>
          <button className="ghost" onClick={() => persist(seed)}>Reset demo data</button>
        </header>

        <section className="stats-grid">
          <Metric label="Admitted patients" value={insights.admitted} tone="blue" />
          <Metric label="Critical cases" value={insights.critical} tone="red" />
          <Metric label="Bed occupancy" value={`${insights.bedUse}%`} tone="green" />
          <Metric label="Billing tracked" value={`₹${insights.revenue.toLocaleString("en-IN")}`} tone="gold" />
        </section>

        <section className="main-grid">
          <div className="panel wide">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Smart queue</p>
                <h3>Patient triage</h3>
              </div>
              <span className="pill">{insights.highRisk?.name} needs first review</span>
            </div>
            <div className="table">
              {data.patients.map((patient) => (
                <article className="row" key={patient.id}>
                  <div>
                    <strong>{patient.name}</strong>
                    <span>{patient.id} · {patient.condition}</span>
                  </div>
                  <div>{patient.doctor}</div>
                  <div>{patient.ward}</div>
                  <div className={`priority ${patient.priority.toLowerCase()}`}>{patient.priority}</div>
                </article>
              ))}
            </div>
          </div>

          <form className="panel" onSubmit={addPatient}>
            <p className="eyebrow">Nurse intake</p>
            <h3>Add patient</h3>
            <input placeholder="Patient name" value={patientForm.name} onChange={(event) => setPatientForm({ ...patientForm, name: event.target.value })} />
            <input placeholder="Age" type="number" value={patientForm.age} onChange={(event) => setPatientForm({ ...patientForm, age: event.target.value })} />
            <input placeholder="Condition" value={patientForm.condition} onChange={(event) => setPatientForm({ ...patientForm, condition: event.target.value })} />
            <select value={patientForm.priority} onChange={(event) => setPatientForm({ ...patientForm, priority: event.target.value })}>
              <option>Stable</option>
              <option>Watch</option>
              <option>Critical</option>
            </select>
            <select value={patientForm.ward} onChange={(event) => setPatientForm({ ...patientForm, ward: event.target.value })}>
              {data.beds.map((bed) => <option key={bed.ward}>{bed.ward}</option>)}
            </select>
            <button type="submit">Create intake record</button>
          </form>
        </section>

        <section className="lower-grid">
          <div className="panel">
            <p className="eyebrow">Bed management</p>
            <h3>Ward pressure</h3>
            {data.beds.map((bed) => (
              <div className="bed-line" key={bed.ward}>
                <span>{bed.ward}</span>
                <div><span style={{ width: `${(bed.occupied / bed.total) * 100}%` }} /></div>
                <strong>{bed.occupied}/{bed.total}</strong>
              </div>
            ))}
          </div>

          <div className="panel">
            <p className="eyebrow">Doctor schedule</p>
            <h3>Appointments</h3>
            {data.appointments.map((appointment) => (
              <article className="mini-row" key={appointment.id}>
                <strong>{appointment.time}</strong>
                <span>{appointment.patient} · {appointment.type}</span>
                <em>{appointment.status}</em>
              </article>
            ))}
          </div>

          <div className="panel">
            <p className="eyebrow">Emergency desk</p>
            <h3>Ambulances</h3>
            {data.ambulances.map((ambulance) => (
              <article className="mini-row" key={ambulance.id}>
                <strong>{ambulance.id}</strong>
                <span>{ambulance.driver}</span>
                <em>{ambulance.status}{ambulance.eta ? ` · ${ambulance.eta} min` : ""}</em>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
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
