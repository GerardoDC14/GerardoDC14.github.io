const SHEET_ID = "1lqJ1MtkgVoC-e4hjU-SPqeUIGplV_4NemF8dXv5uk_s";
const DEFAULT_API_URL = "";
const TODAY = "2026-06-16";

const state = {
  apiUrl: localStorage.getItem("robotecPlannerApiUrl") || DEFAULT_API_URL,
  tasks: [],
  config: {
    area: ["Mecánica", "Electrónica", "Programación", "Pruebas", "Logística viaje"],
    status: ["Pendiente", "En proceso", "Bloqueada", "En revisión", "Terminada"],
    priority: ["Alta", "Media", "Baja"],
    work_mode: ["Laboratorio", "Casa", "Final / empaque", "Laboratorio / Casa", "Casa / Laboratorio"],
  },
  view: "all",
  filters: {},
};

const els = {
  setupPanel: document.querySelector("#setupPanel"),
  apiUrlInput: document.querySelector("#apiUrlInput"),
  saveApiUrlBtn: document.querySelector("#saveApiUrlBtn"),
  content: document.querySelector("#content"),
  template: document.querySelector("#taskCardTemplate"),
  totalCount: document.querySelector("#totalCount"),
  blockedCount: document.querySelector("#blockedCount"),
  doneCount: document.querySelector("#doneCount"),
  dueSoonCount: document.querySelector("#dueSoonCount"),
  searchInput: document.querySelector("#searchInput"),
  areaFilter: document.querySelector("#areaFilter"),
  ownerFilter: document.querySelector("#ownerFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  priorityFilter: document.querySelector("#priorityFilter"),
  modeFilter: document.querySelector("#modeFilter"),
  dateFilter: document.querySelector("#dateFilter"),
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  newTaskBtn: document.querySelector("#newTaskBtn"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  archiveBtn: document.querySelector("#archiveBtn"),
  taskArea: document.querySelector("#taskArea"),
  taskStatus: document.querySelector("#taskStatus"),
  taskPriority: document.querySelector("#taskPriority"),
  taskMode: document.querySelector("#taskMode"),
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  els.apiUrlInput.value = state.apiUrl;
  els.setupPanel.hidden = Boolean(state.apiUrl);
  bindEvents();
  populateStaticFilters();
  if (state.apiUrl) {
    loadData();
  } else {
    render();
  }
}

function bindEvents() {
  els.saveApiUrlBtn.addEventListener("click", () => {
    state.apiUrl = els.apiUrlInput.value.trim();
    localStorage.setItem("robotecPlannerApiUrl", state.apiUrl);
    els.setupPanel.hidden = Boolean(state.apiUrl);
    loadData();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      state.view = button.dataset.view;
      render();
    });
  });

  [els.searchInput, els.areaFilter, els.ownerFilter, els.statusFilter, els.priorityFilter, els.modeFilter, els.dateFilter]
    .forEach((input) => input.addEventListener("input", updateFilters));

  els.newTaskBtn.addEventListener("click", () => openTaskDialog());
  els.closeDialogBtn.addEventListener("click", () => els.dialog.close());
  els.form.addEventListener("submit", saveTask);
  els.archiveBtn.addEventListener("click", archiveTask);
}

async function loadData() {
  try {
    const data = await apiGet("bootstrap");
    state.tasks = normalizeTasks(data.tasks || []);
    state.config = { ...state.config, ...(data.config || {}) };
    populateStaticFilters();
    render();
  } catch (error) {
    els.setupPanel.hidden = false;
    els.content.innerHTML = `<div class="empty-state">No se pudo cargar el backend. Revisa la URL de Apps Script.</div>`;
    console.error(error);
  }
}

async function apiGet(action) {
  const url = new URL(state.apiUrl);
  url.searchParams.set("action", action);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`GET ${action} failed`);
  return response.json();
}

async function apiPost(action, payload) {
  const response = await fetch(state.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!response.ok) throw new Error(`POST ${action} failed`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Backend error");
  return data;
}

function updateFilters() {
  state.filters = {
    query: els.searchInput.value.trim().toLowerCase(),
    area: els.areaFilter.value,
    owner: els.ownerFilter.value,
    status: els.statusFilter.value,
    priority: els.priorityFilter.value,
    mode: els.modeFilter.value,
    date: els.dateFilter.value,
  };
  render();
}

function populateStaticFilters() {
  setOptions(els.areaFilter, "Área", state.config.area);
  setOptions(els.statusFilter, "Estado", state.config.status);
  setOptions(els.priorityFilter, "Prioridad", state.config.priority);
  setOptions(els.modeFilter, "Modo", state.config.work_mode);
  setOptions(els.taskArea, "Área", state.config.area, false);
  setOptions(els.taskStatus, "Estado", state.config.status, false);
  setOptions(els.taskPriority, "Prioridad", state.config.priority, false);
  setOptions(els.taskMode, "Modo", state.config.work_mode, false);
  const owners = [...new Set(state.tasks.map((task) => task.owner).filter(Boolean))].sort();
  setOptions(els.ownerFilter, "Responsable", owners);
}

function setOptions(select, label, values, includeAll = true) {
  select.innerHTML = "";
  if (includeAll) {
    select.append(new Option(label, ""));
  }
  values.forEach((value) => select.append(new Option(value, value)));
}

function render() {
  const visible = applyView(applyFilters(state.tasks));
  renderStats();
  if (!visible.length) {
    els.content.innerHTML = `<div class="empty-state">No hay tareas para esta vista.</div>`;
    return;
  }
  if (state.view === "owner") {
    renderGrouped(visible, (task) => task.owner || "Sin responsable");
    return;
  }
  if (state.view === "area") {
    renderGrouped(visible, (task) => task.area || "Sin área");
    return;
  }
  renderFlat(visible);
}

function renderStats() {
  const active = state.tasks.filter((task) => !task.archived);
  els.totalCount.textContent = active.length;
  els.blockedCount.textContent = active.filter((task) => task.status === "Bloqueada").length;
  els.doneCount.textContent = active.filter((task) => task.status === "Terminada").length;
  els.dueSoonCount.textContent = active.filter((task) => isThisWeek(task, TODAY)).length;
}

function applyFilters(tasks) {
  return tasks.filter((task) => {
    if (task.archived) return false;
    if (state.filters.query && !`${task.task} ${task.notes} ${task.owner}`.toLowerCase().includes(state.filters.query)) return false;
    if (state.filters.area && task.area !== state.filters.area) return false;
    if (state.filters.owner && task.owner !== state.filters.owner) return false;
    if (state.filters.status && task.status !== state.filters.status) return false;
    if (state.filters.priority && task.priority !== state.filters.priority) return false;
    if (state.filters.mode && task.work_mode !== state.filters.mode) return false;
    if (state.filters.date && !dateOverlaps(task, state.filters.date)) return false;
    return true;
  });
}

function applyView(tasks) {
  if (state.view === "today") return tasks.filter((task) => dateOverlaps(task, TODAY));
  if (state.view === "week") return tasks.filter((task) => isThisWeek(task, TODAY));
  if (state.view === "blocked") return tasks.filter((task) => task.status === "Bloqueada");
  return tasks;
}

function renderFlat(tasks) {
  els.content.className = "content flat-list";
  const grid = document.createElement("div");
  grid.className = "task-grid";
  tasks.forEach((task) => grid.append(renderCard(task)));

  const table = document.createElement("table");
  table.className = "task-table";
  table.innerHTML = `<thead><tr><th>Tarea</th><th>Área</th><th>Responsable</th><th>Estado</th><th>Prioridad</th><th>Fechas</th><th></th></tr></thead>`;
  const tbody = document.createElement("tbody");
  tasks.forEach((task) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(task.task)}</td>
      <td>${escapeHtml(task.area)}</td>
      <td>${escapeHtml(task.owner || "Sin asignar")}</td>
      <td>${escapeHtml(task.status)}</td>
      <td>${escapeHtml(task.priority)}</td>
      <td>${formatRange(task)}</td>
      <td><button class="ghost-button" type="button">Editar</button></td>
    `;
    row.querySelector("button").addEventListener("click", () => openTaskDialog(task));
    tbody.append(row);
  });
  table.append(tbody);
  els.content.replaceChildren(grid, table);
}

function renderGrouped(tasks, getKey) {
  els.content.className = "content";
  const groups = new Map();
  tasks.forEach((task) => {
    const key = getKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  });
  els.content.replaceChildren(...[...groups.entries()].sort().map(([key, items]) => {
    const section = document.createElement("section");
    section.className = "group-section";
    section.innerHTML = `<div class="group-header"><h2>${escapeHtml(key)}</h2><span class="pill">${items.length}</span></div>`;
    const grid = document.createElement("div");
    grid.className = "task-grid";
    items.forEach((task) => grid.append(renderCard(task)));
    section.append(grid);
    return section;
  }));
}

function renderCard(task) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.querySelector("h3").textContent = task.task;
  node.querySelector(".area").textContent = task.area;
  const priority = node.querySelector(".priority");
  priority.textContent = task.priority;
  priority.dataset.priority = task.priority;
  node.querySelector(".meta").textContent = `${formatRange(task)} · ${task.work_mode} · ${task.owner || "Sin responsable"}`;
  node.querySelector(".notes").textContent = task.blocker ? `Bloqueo: ${task.blocker}` : task.notes || "";
  const status = node.querySelector(".status");
  status.textContent = task.status;
  status.dataset.status = task.status;
  node.querySelector(".edit").addEventListener("click", () => openTaskDialog(task));
  return node;
}

function openTaskDialog(task = null) {
  els.form.reset();
  els.archiveBtn.hidden = !task;
  els.dialogTitle.textContent = task ? "Editar tarea" : "Nueva tarea";
  document.querySelector("#taskId").value = task?.id || "";
  document.querySelector("#taskName").value = task?.task || "";
  document.querySelector("#taskArea").value = task?.area || state.config.area[0];
  document.querySelector("#taskStatus").value = task?.status || "Pendiente";
  document.querySelector("#taskPriority").value = task?.priority || "Media";
  document.querySelector("#taskMode").value = task?.work_mode || "Laboratorio";
  document.querySelector("#taskStart").value = task?.start_date || TODAY;
  document.querySelector("#taskDue").value = task?.due_date || TODAY;
  document.querySelector("#taskOwner").value = task?.owner || "";
  document.querySelector("#taskCollaborators").value = task?.collaborators || "";
  document.querySelector("#taskBlocker").value = task?.blocker || "";
  document.querySelector("#taskNotes").value = task?.notes || "";
  document.querySelector("#taskEvidence").value = task?.evidence_url || "";
  els.dialog.showModal();
}

async function saveTask(event) {
  event.preventDefault();
  const task = taskFromForm();
  const action = task.id ? "updateTask" : "createTask";
  await apiPost(action, { task, team_code: document.querySelector("#teamCode").value });
  els.dialog.close();
  await loadData();
}

async function archiveTask() {
  const id = document.querySelector("#taskId").value;
  await apiPost("archiveTask", {
    id,
    updated_by: document.querySelector("#updatedBy").value,
    team_code: document.querySelector("#teamCode").value,
  });
  els.dialog.close();
  await loadData();
}

function taskFromForm() {
  return {
    id: document.querySelector("#taskId").value,
    task: document.querySelector("#taskName").value.trim(),
    area: document.querySelector("#taskArea").value,
    type: "Tarea",
    owner: document.querySelector("#taskOwner").value.trim(),
    collaborators: document.querySelector("#taskCollaborators").value.trim(),
    status: document.querySelector("#taskStatus").value,
    priority: document.querySelector("#taskPriority").value,
    start_date: document.querySelector("#taskStart").value,
    due_date: document.querySelector("#taskDue").value,
    work_mode: document.querySelector("#taskMode").value,
    blocker: document.querySelector("#taskBlocker").value.trim(),
    notes: document.querySelector("#taskNotes").value.trim(),
    evidence_url: document.querySelector("#taskEvidence").value.trim(),
    updated_by: document.querySelector("#updatedBy").value.trim(),
  };
}

function normalizeTasks(tasks) {
  return tasks.map((task) => ({
    ...task,
    archived: String(task.archived).toLowerCase() === "true",
  })).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.due_date.localeCompare(b.due_date));
}

function priorityRank(priority) {
  return { Alta: 0, Media: 1, Baja: 2 }[priority] ?? 3;
}

function dateOverlaps(task, date) {
  return task.start_date <= date && task.due_date >= date;
}

function isThisWeek(task, today) {
  const start = new Date(`${today}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const due = new Date(`${task.due_date}T00:00:00`);
  const taskStart = new Date(`${task.start_date}T00:00:00`);
  return taskStart <= end && due >= start;
}

function formatRange(task) {
  return `${task.start_date} a ${task.due_date}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}
