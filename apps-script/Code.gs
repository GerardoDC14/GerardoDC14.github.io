const SPREADSHEET_ID = "1lqJ1MtkgVoC-e4hjU-SPqeUIGplV_4NemF8dXv5uk_s";
const SHEETS = {
  tasks: "Tasks",
  people: "People",
  config: "Config",
  changelog: "Changelog",
};
const TASK_HEADERS = [
  "id", "task", "area", "type", "owner", "collaborators", "status", "priority",
  "start_date", "due_date", "work_mode", "blocker", "notes", "evidence_url",
  "last_updated", "updated_by", "archived",
];

function doGet(e) {
  const action = (e.parameter.action || "bootstrap").trim();
  if (action === "tasks") return json_({ tasks: getTasks_() });
  if (action === "config") return json_({ config: getConfig_() });
  return json_({ tasks: getTasks_(), config: getConfig_(), people: getPeople_() });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    verifyTeamCode_(payload.team_code);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (payload.action === "createTask") return json_(createTask_(payload.task));
      if (payload.action === "updateTask") return json_(updateTask_(payload.task));
      if (payload.action === "archiveTask") return json_(archiveTask_(payload));
      throw new Error("Accion no soportada");
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function createTask_(task) {
  const sheet = getSheet_(SHEETS.tasks);
  const id = nextTaskId_();
  const now = today_();
  const rowObject = normalizeTask_({ ...task, id, last_updated: now, archived: false });
  sheet.appendRow(TASK_HEADERS.map((header) => rowObject[header] ?? ""));
  appendChange_(now, id, "created", "", rowObject.task, rowObject.updated_by);
  return { ok: true, id };
}

function updateTask_(task) {
  if (!task.id) throw new Error("Falta id");
  const sheet = getSheet_(SHEETS.tasks);
  const table = readTable_(sheet);
  const index = table.rows.findIndex((row) => row.id === task.id);
  if (index < 0) throw new Error("Tarea no encontrada");
  const current = table.rows[index];
  const next = normalizeTask_({ ...current, ...task, last_updated: today_(), archived: current.archived });
  const rowNumber = index + 2;
  TASK_HEADERS.forEach((header, columnIndex) => {
    const oldValue = String(current[header] ?? "");
    const newValue = String(next[header] ?? "");
    if (oldValue !== newValue) {
      sheet.getRange(rowNumber, columnIndex + 1).setValue(next[header] ?? "");
      if (!["last_updated"].includes(header)) {
        appendChange_(next.last_updated, next.id, header, oldValue, newValue, next.updated_by);
      }
    }
  });
  return { ok: true, id: next.id };
}

function archiveTask_(payload) {
  const id = payload.id;
  if (!id) throw new Error("Falta id");
  const sheet = getSheet_(SHEETS.tasks);
  const table = readTable_(sheet);
  const index = table.rows.findIndex((row) => row.id === id);
  if (index < 0) throw new Error("Tarea no encontrada");
  const rowNumber = index + 2;
  const archivedColumn = TASK_HEADERS.indexOf("archived") + 1;
  const lastUpdatedColumn = TASK_HEADERS.indexOf("last_updated") + 1;
  const updatedByColumn = TASK_HEADERS.indexOf("updated_by") + 1;
  sheet.getRange(rowNumber, archivedColumn).setValue(true);
  sheet.getRange(rowNumber, lastUpdatedColumn).setValue(today_());
  sheet.getRange(rowNumber, updatedByColumn).setValue(payload.updated_by || "");
  appendChange_(today_(), id, "archived", "false", "true", payload.updated_by || "");
  return { ok: true, id };
}

function getTasks_() {
  return readTable_(getSheet_(SHEETS.tasks)).rows.filter((row) => row.id);
}

function getPeople_() {
  return readTable_(getSheet_(SHEETS.people)).rows.filter((row) => row.name);
}

function getConfig_() {
  const rows = readTable_(getSheet_(SHEETS.config)).rows;
  return rows.reduce((acc, row) => {
    if (!row.config_type || !row.value) return acc;
    if (!acc[row.config_type]) acc[row.config_type] = [];
    acc[row.config_type].push(row.value);
    return acc;
  }, {});
}

function normalizeTask_(task) {
  const normalized = {};
  TASK_HEADERS.forEach((header) => normalized[header] = task[header] ?? "");
  normalized.type = normalized.type || "Tarea";
  normalized.status = normalized.status || "Pendiente";
  normalized.priority = normalized.priority || "Media";
  normalized.archived = normalized.archived === true || String(normalized.archived).toLowerCase() === "true";
  normalized.updated_by = normalized.updated_by || "Equipo RoboTec";
  normalized.last_updated = normalized.last_updated || today_();
  return normalized;
}

function readTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  const rows = values.map((row) => headers.reduce((object, header, index) => {
    object[header] = row[index] instanceof Date ? dateString_(row[index]) : row[index];
    return object;
  }, {}));
  return { headers, rows };
}

function nextTaskId_() {
  const max = getTasks_().reduce((highest, task) => {
    const number = Number(String(task.id || "").replace("TASK-", ""));
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `TASK-${String(max + 1).padStart(3, "0")}`;
}

function appendChange_(timestamp, taskId, field, oldValue, newValue, updatedBy) {
  getSheet_(SHEETS.changelog).appendRow([timestamp, taskId, field, oldValue, newValue, updatedBy || ""]);
}

function verifyTeamCode_(code) {
  const expected = PropertiesService.getScriptProperties().getProperty("TEAM_CODE") || "robotec2026";
  if (!code || code !== expected) throw new Error("Codigo de equipo invalido");
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error(`No existe la hoja ${name}`);
  return sheet;
}

function today_() {
  return Utilities.formatDate(new Date(), "America/Mexico_City", "yyyy-MM-dd");
}

function dateString_(date) {
  return Utilities.formatDate(date, "America/Mexico_City", "yyyy-MM-dd");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
