const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 4000);
const DATA_FILE = path.join(__dirname, "data.json");
const SEED_FILE = path.join(__dirname, "seed.json");
const priorityScore = { Critical: 3, Watch: 2, Stable: 1 };
const allowedRoles = ["Admin", "Doctor", "Nurse", "Emergency"];

async function readData() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  send(res, 404, { error: "Route not found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getInsights(data) {
  const admitted = data.patients.filter((patient) => patient.status !== "Discharged").length;
  const critical = data.patients.filter((patient) => patient.priority === "Critical").length;
  const revenue = data.patients.reduce((sum, patient) => sum + Number(patient.bill || 0), 0);
  const totalBeds = data.beds.reduce((sum, bed) => sum + bed.total, 0);
  const occupiedBeds = data.beds.reduce((sum, bed) => sum + bed.occupied, 0);
  const highRisk = [...data.patients].sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority])[0] || null;

  return {
    admitted,
    critical,
    revenue,
    bedUse: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    highRisk
  };
}

function createPatient(payload) {
  const name = String(payload.name || "").trim();
  const condition = String(payload.condition || "").trim();
  if (!name || !condition) {
    return { error: "Patient name and condition are required" };
  }

  return {
    id: `P-${Date.now().toString().slice(-6)}`,
    name,
    age: Number(payload.age || 0),
    gender: payload.gender || "Not set",
    condition,
    priority: payload.priority || "Stable",
    ward: payload.ward || "General",
    doctor: payload.doctor || "Unassigned",
    vitals: payload.vitals || { bp: "Pending", spo2: 0, temp: 0, pulse: 0 },
    bill: Number(payload.bill || 0),
    status: payload.status || "New",
    createdAt: new Date().toISOString()
  };
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function createUser(payload) {
  const name = String(payload.name || "").trim();
  const username = String(payload.username || "").trim().toLowerCase();
  const role = payload.role;
  if (!name || !username || !allowedRoles.includes(role)) {
    return { error: "Name, username, and a valid role are required" };
  }

  return {
    id: `U-${Date.now().toString().slice(-6)}`,
    name,
    username,
    password: String(payload.password || "care123"),
    role,
    department: payload.department || role,
    status: payload.status || "Active",
    createdAt: new Date().toISOString()
  };
}

function createAppointment(payload) {
  const patient = String(payload.patient || "").trim();
  const doctor = String(payload.doctor || "").trim();
  const date = String(payload.date || "").trim();
  const time = String(payload.time || "").trim();
  if (!patient || !doctor || !date || !time) {
    return { error: "Patient, doctor, date, and time are required" };
  }

  return {
    id: `A-${Date.now().toString().slice(-6)}`,
    patient,
    doctor,
    date,
    time,
    type: payload.type || "Consultation",
    status: payload.status || "Booked",
    notes: payload.notes || "",
    createdAt: new Date().toISOString()
  };
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host}`);
  const data = await readData();

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { ok: true, service: "CareFlow HMS API" });
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    return send(res, 200, { ...data, users: (data.users || []).map(publicUser), insights: getInsights(data) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const payload = await readBody(req);
    const username = String(payload.username || "").trim().toLowerCase();
    const role = payload.role;
    const user = (data.users || []).find((item) => item.username === username && item.role === role);
    if (!user || user.password !== String(payload.password || "")) {
      return send(res, 401, { error: "Invalid role, username, or password" });
    }

    return send(res, 200, { user: publicUser(user), token: `demo-${user.id}-${Date.now()}` });
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    return send(res, 200, (data.users || []).map(publicUser));
  }

  if (req.method === "POST" && url.pathname === "/api/users") {
    const payload = await readBody(req);
    const user = createUser(payload);
    if (user.error) return send(res, 400, user);
    if ((data.users || []).some((item) => item.username === user.username)) {
      return send(res, 409, { error: "Username already exists" });
    }

    data.users = data.users || [];
    data.users.unshift(user);
    await writeData(data);
    return send(res, 201, publicUser(user));
  }

  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (req.method === "DELETE" && userMatch) {
    const before = (data.users || []).length;
    data.users = (data.users || []).filter((user) => user.id !== userMatch[1]);
    if (data.users.length === before) return send(res, 404, { error: "User not found" });

    await writeData(data);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/patients") {
    return send(res, 200, data.patients);
  }

  if (req.method === "POST" && url.pathname === "/api/patients") {
    const payload = await readBody(req);
    const patient = createPatient(payload);
    if (patient.error) return send(res, 400, patient);

    data.patients.unshift(patient);
    const bed = data.beds.find((item) => item.ward === patient.ward);
    if (bed && bed.occupied < bed.total) bed.occupied += 1;

    await writeData(data);
    return send(res, 201, patient);
  }

  const patientStatusMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/status$/);
  if (req.method === "PATCH" && patientStatusMatch) {
    const payload = await readBody(req);
    const patient = data.patients.find((item) => item.id === patientStatusMatch[1]);
    if (!patient) return send(res, 404, { error: "Patient not found" });

    const previousStatus = patient.status;
    patient.status = payload.status || patient.status;

    if (previousStatus !== "Discharged" && patient.status === "Discharged") {
      const bed = data.beds.find((item) => item.ward === patient.ward);
      if (bed && bed.occupied > 0) bed.occupied -= 1;
    }

    await writeData(data);
    return send(res, 200, patient);
  }

  if (req.method === "GET" && url.pathname === "/api/appointments") {
    return send(res, 200, data.appointments);
  }

  if (req.method === "POST" && url.pathname === "/api/appointments") {
    const payload = await readBody(req);
    const appointment = createAppointment(payload);
    if (appointment.error) return send(res, 400, appointment);

    data.appointments.unshift(appointment);
    await writeData(data);
    return send(res, 201, appointment);
  }

  const appointmentMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)$/);
  if (req.method === "PATCH" && appointmentMatch) {
    const payload = await readBody(req);
    const appointment = data.appointments.find((item) => item.id === appointmentMatch[1]);
    if (!appointment) return send(res, 404, { error: "Appointment not found" });

    Object.assign(appointment, {
      patient: payload.patient ?? appointment.patient,
      doctor: payload.doctor ?? appointment.doctor,
      date: payload.date ?? appointment.date,
      time: payload.time ?? appointment.time,
      type: payload.type ?? appointment.type,
      status: payload.status ?? appointment.status,
      notes: payload.notes ?? appointment.notes
    });

    await writeData(data);
    return send(res, 200, appointment);
  }

  if (req.method === "DELETE" && appointmentMatch) {
    const before = data.appointments.length;
    data.appointments = data.appointments.filter((appointment) => appointment.id !== appointmentMatch[1]);
    if (data.appointments.length === before) return send(res, 404, { error: "Appointment not found" });

    await writeData(data);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/beds") {
    return send(res, 200, data.beds);
  }

  if (req.method === "GET" && url.pathname === "/api/ambulances") {
    return send(res, 200, data.ambulances);
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    const seed = JSON.parse(await fs.readFile(SEED_FILE, "utf8"));
    await writeData(seed);
    return send(res, 200, { ...seed, insights: getInsights(seed) });
  }

  notFound(res);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    send(res, 500, { error: error.message || "Internal server error" });
  });
});

server.listen(PORT, () => {
  console.log(`CareFlow HMS API running at http://localhost:${PORT}`);
});
