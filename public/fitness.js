import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  addDoc,
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  projectId: "fir-1-b887a",
  appId: "1:484552761154:web:1f97a59d52eb37991172db",
  storageBucket: "fir-1-b887a.firebasestorage.app",
  apiKey: "AIzaSyB0xmKQAkhpxuXZYuEFnBznYK0v2UGvUAg",
  authDomain: "fir-1-b887a.firebaseapp.com",
  messagingSenderId: "484552761154"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const workoutsRef = collection(db, "fitness_workouts");

const form = document.querySelector("#workoutForm");
const dateInput = document.querySelector("#workoutDate");
const nameInput = document.querySelector("#workoutName");
const bodyWeightInput = document.querySelector("#bodyWeight");
const fatigueInput = document.querySelector("#fatigue");
const notesInput = document.querySelector("#workoutNotes");
const planInput = document.querySelector("#planInput");
const importStatus = document.querySelector("#importStatus");
const exerciseList = document.querySelector("#exerciseList");
const exerciseTemplate = document.querySelector("#exerciseTemplate");
const setTemplate = document.querySelector("#setTemplate");
const historyList = document.querySelector("#historyList");
const exportText = document.querySelector("#exportText");
const statusPill = document.querySelector("#statusPill");
const statusText = document.querySelector("#statusText");
const sessionCount = document.querySelector("#sessionCount");
const totalVolume = document.querySelector("#totalVolume");
const exportCurrent = document.querySelector("#exportCurrent");
const exportHistory = document.querySelector("#exportHistory");
const copyPlanPrompt = document.querySelector("#copyPlanPrompt");

let workouts = [];
let selectedWorkoutId = "";
let exportMode = "current";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value, max = 80) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value, min, max) {
  if (value === null) return null;
  return Math.min(max, Math.max(min, value));
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusPill.classList.toggle("is-error", isError);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function addExercise(data = {}) {
  const node = exerciseTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".exercise-name").value = data.name || "";
  node.querySelector(".exercise-part").value = data.bodyPart || "";

  const setList = node.querySelector(".set-list");
  const sets = data.sets?.length ? data.sets : [{}, {}, {}];
  sets.forEach((set) => addSet(setList, set));

  node.querySelector(".add-set").addEventListener("click", () => addSet(setList));
  node.querySelector(".remove-exercise").addEventListener("click", () => {
    if (exerciseList.children.length > 1) {
      node.remove();
      renumberAllSets();
    }
  });

  exerciseList.append(node);
  renumberAllSets();
}

function addSet(setList, data = {}) {
  const row = setTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".set-weight").value = data.weight ?? "";
  row.querySelector(".set-reps").value = data.reps ?? "";
  row.querySelector(".set-rpe").value = data.rpe ?? "";
  row.querySelector(".remove-set").addEventListener("click", () => {
    if (setList.children.length > 1) {
      row.remove();
      renumberAllSets();
    }
  });
  setList.append(row);
  renumberAllSets();
}

function renumberAllSets() {
  document.querySelectorAll(".exercise-card").forEach((card) => {
    card.querySelectorAll(".set-row").forEach((row, index) => {
      row.querySelector(".set-number").textContent = String(index + 1);
    });
  });
}

function readWorkoutFromForm() {
  const exercises = [...exerciseList.querySelectorAll(".exercise-card")]
    .map((card) => {
      const sets = [...card.querySelectorAll(".set-row")]
        .map((row) => ({
          weight: numberOrNull(row.querySelector(".set-weight").value),
          reps: numberOrNull(row.querySelector(".set-reps").value),
          rpe: numberOrNull(row.querySelector(".set-rpe").value)
        }))
        .filter((set) => set.weight !== null || set.reps !== null || set.rpe !== null);

      return {
        name: clean(card.querySelector(".exercise-name").value, 32),
        bodyPart: clean(card.querySelector(".exercise-part").value, 16),
        sets
      };
    })
    .filter((exercise) => exercise.name && exercise.sets.length);

  return {
    date: dateInput.value,
    workoutName: clean(nameInput.value, 32),
    bodyWeight: numberOrNull(bodyWeightInput.value),
    fatigue: numberOrNull(fatigueInput.value),
    notes: clean(notesInput.value, 300),
    exercises
  };
}

function normalizeImportedWorkout(data) {
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  return {
    date: clean(data.date || dateInput.value || today(), 10),
    workoutName: clean(data.workoutName || data.name || data.title || nameInput.value || "ChatGPT 課表", 32),
    bodyWeight: numberOrNull(data.bodyWeight),
    fatigue: clampNumber(numberOrNull(data.fatigue), 1, 5),
    notes: clean(data.notes || "", 300),
    exercises: exercises.map((exercise) => ({
      name: clean(exercise.name || exercise.exerciseName || "", 32),
      bodyPart: clean(exercise.bodyPart || exercise.part || "", 16),
      sets: Array.isArray(exercise.sets) ? exercise.sets.map((set) => ({
        weight: numberOrNull(set.weight),
        reps: numberOrNull(set.reps),
        rpe: clampNumber(numberOrNull(set.rpe), 1, 10)
      })).filter((set) => set.weight !== null || set.reps !== null || set.rpe !== null) : []
    })).filter((exercise) => exercise.name && exercise.sets.length)
  };
}

function parsePlanJson(raw) {
  try {
    return normalizeImportedWorkout(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseSetPrescription(text) {
  const normalized = text
    .replace(/[＊×]/g, "x")
    .replace(/公斤/g, "kg")
    .replace(/次/g, "下")
    .replace(/ reps?/gi, "下");
  const groupMatch = normalized.match(/(\d+)\s*(?:組|sets?)/i);
  const rpeMatch = normalized.match(/rpe\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
  const weightMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kg/i);
  let repsMatch = normalized.match(/x\s*(\d+)(?:\s*[-~到]\s*\d+)?\s*下?/i);

  if (!repsMatch) {
    repsMatch = normalized.match(/(\d+)(?:\s*[-~到]\s*\d+)?\s*下/);
  }

  if (!repsMatch) {
    const compactMatch = normalized.match(/(?:^|\s)(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+(?:\.\d+)?)\s*kg)?/i);
    if (compactMatch) {
      return {
        count: Number(compactMatch[1]),
        reps: Number(compactMatch[2]),
        weight: compactMatch[3] ? Number(compactMatch[3]) : null,
        rpe: rpeMatch ? Number(rpeMatch[1]) : null
      };
    }
  }

  const count = groupMatch ? Number(groupMatch[1]) : 1;
  const reps = repsMatch ? Number(repsMatch[1]) : null;
  const weight = weightMatch ? Number(weightMatch[1]) : null;
  const rpe = rpeMatch ? Number(rpeMatch[1]) : null;

  if (weight === null && reps === null && rpe === null) return null;
  return { count, weight, reps, rpe };
}

function cleanPlanLine(line) {
  return line
    .replace(/^```(?:markdown|md|text)?\s*$/i, "")
    .replace(/^```\s*$/i, "")
    .replace(/^\s*>+\s*/, "")
    .trim();
}

function stripListMarker(line) {
  return line.replace(/^(?:[-*]\s*)?(?:\d+[.)、]\s*)?/, "").trim();
}

function parseTextNumber(text) {
  const match = String(text || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseTableExercise(line) {
  if (!line.includes("|") || /^[:|\-\s]+$/.test(line)) return null;

  const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
  if (cells.length < 3) return null;
  if (cells.some((cell) => /動作|組數|次數|重量/i.test(cell)) && !cells.some((cell) => /\d/.test(cell))) return null;

  const [nameCell, groupCell, repsCell, weightCell, rpeCell] = cells;
  const name = clean(nameCell.replace(/[（(].*?[）)]/g, ""), 32);
  if (!name || /動作|exercise/i.test(name)) return null;

  const count = parseTextNumber(groupCell) || 1;
  const reps = parseTextNumber(repsCell);
  const weight = parseTextNumber(weightCell);
  const rpe = parseTextNumber(rpeCell);
  if (reps === null && weight === null) return null;

  return {
    name,
    bodyPart: clean(nameCell.match(/[（(](.*?)[）)]/)?.[1] || "", 16),
    sets: expandSetPrescription({ count, reps, weight, rpe })
  };
}

function splitExerciseAndPrescription(line) {
  const cleaned = stripListMarker(line);
  const setStart = cleaned.search(/\d+(?:\.\d+)?\s*(?:組|sets?|kg|公斤|x|×|＊|下|次)/i);
  if (setStart <= 0) return null;

  const name = cleaned.slice(0, setStart)
    .replace(/[：:\-–—，,、]+$/, "")
    .trim();
  const prescription = cleaned.slice(setStart).trim();
  if (!name || !prescription) return null;

  return { name, prescription };
}

function readFieldValue(line, names) {
  const pattern = new RegExp(`(?:${names.join("|")})\\s*[:：]?\\s*(.+)$`, "i");
  return line.match(pattern)?.[1] || "";
}

function parseDetailField(line) {
  const cleaned = stripListMarker(line);
  const countValue = readFieldValue(cleaned, ["組數", "sets?", "set"]);
  if (countValue) return { count: parseTextNumber(countValue) };

  const repsValue = readFieldValue(cleaned, ["次數", "反覆", "reps?", "rep"]);
  if (repsValue) return { reps: parseTextNumber(repsValue) };

  const weightValue = readFieldValue(cleaned, ["重量", "建議重量", "負重", "weight"]);
  if (weightValue) return { weight: parseTextNumber(weightValue) };

  const rpeValue = readFieldValue(cleaned, ["RPE", "強度"]);
  if (rpeValue) return { rpe: parseTextNumber(rpeValue) };

  return null;
}

function expandSetPrescription(prescription) {
  const count = Math.max(1, Math.min(12, Number(prescription.count) || 1));
  return Array.from({ length: count }, () => ({
    weight: prescription.weight,
    reps: prescription.reps,
    rpe: prescription.rpe
  }));
}

function parsePlanMarkdown(raw) {
  const workout = {
    date: dateInput.value || today(),
    workoutName: nameInput.value || "ChatGPT 課表",
    exercises: []
  };
  let currentExercise = null;
  let pendingSet = null;

  function commitPendingSet() {
    if (!currentExercise || !pendingSet) return;
    if (pendingSet.weight !== null || pendingSet.reps !== null || pendingSet.rpe !== null) {
      currentExercise.sets.push(...expandSetPrescription(pendingSet));
    }
    pendingSet = null;
  }

  function startExercise(nameText) {
    commitPendingSet();
    currentExercise = {
      name: clean(nameText.replace(/[（(].*?[）)]/g, ""), 32),
      bodyPart: clean(nameText.match(/[（(](.*?)[）)]/)?.[1] || "", 16),
      sets: []
    };
    workout.exercises.push(currentExercise);
    return currentExercise;
  }

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = cleanPlanLine(originalLine);
    if (!line) continue;

    const tableExercise = parseTableExercise(line);
    if (tableExercise) {
      commitPendingSet();
      workout.exercises.push(tableExercise);
      currentExercise = tableExercise;
      continue;
    }

    const titleMatch = line.match(/^#\s+(.+)/);
    if (titleMatch && !line.startsWith("##")) {
      workout.workoutName = clean(titleMatch[1].replace(/健身紀錄|課表/g, ""), 32) || workout.workoutName;
      continue;
    }

    const courseMatch = line.match(/^(?:課程|訓練|Workout)\s*[:：]\s*(.+)$/i);
    if (courseMatch) {
      workout.workoutName = clean(courseMatch[1], 32);
      continue;
    }

    const headingMatch = line.match(/^#{2,4}\s+(.+)/);
    if (headingMatch) {
      startExercise(headingMatch[1]);
      continue;
    }

    const detail = parseDetailField(line);
    if (detail && currentExercise) {
      pendingSet = { count: 1, weight: null, reps: null, rpe: null, ...pendingSet, ...detail };
      continue;
    }

    const inlineExerciseMatch = line.match(/^(?:[-*]\s*)?(?:\d+[.)、]\s*)?([^:：-]{2,32})\s*[:：-]\s*(.+)$/);
    if (inlineExerciseMatch && !/^第\s*\d+\s*組/.test(inlineExerciseMatch[1])) {
      startExercise(inlineExerciseMatch[1]);
      const prescription = parseSetPrescription(inlineExerciseMatch[2]);
      if (prescription) currentExercise.sets.push(...expandSetPrescription(prescription));
      continue;
    }

    const looseMatch = splitExerciseAndPrescription(line);
    if (looseMatch) {
      startExercise(looseMatch.name);
      const prescription = parseSetPrescription(looseMatch.prescription);
      if (prescription) currentExercise.sets.push(...expandSetPrescription(prescription));
      continue;
    }

    const prescription = parseSetPrescription(line);
    if (prescription && currentExercise) {
      commitPendingSet();
      currentExercise.sets.push(...expandSetPrescription(prescription));
    }
  }

  commitPendingSet();

  return normalizeImportedWorkout(workout);
}

function parsePlan(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parsePlanJson(trimmed) || parsePlanMarkdown(trimmed);
}

function fillWorkoutForm(workout) {
  dateInput.value = workout.date || today();
  nameInput.value = workout.workoutName || "";
  bodyWeightInput.value = workout.bodyWeight ?? "";
  fatigueInput.value = workout.fatigue ?? "";
  notesInput.value = workout.notes || notesInput.value;
  exerciseList.innerHTML = "";
  workout.exercises.forEach((exercise) => addExercise(exercise));
  selectedWorkoutId = "";
  refreshExport();
  document.querySelector(".exercise-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function workoutVolume(workout) {
  return workout.exercises.reduce((total, exercise) => {
    return total + exercise.sets.reduce((sum, set) => {
      return sum + (Number(set.weight) || 0) * (Number(set.reps) || 0);
    }, 0);
  }, 0);
}

function formatMarkdown(workout) {
  if (!workout || !workout.workoutName || !workout.exercises.length) {
    return "請先填寫課程名稱、動作與組數，這裡會即時產生給 ChatGPT 的 Markdown。";
  }

  const lines = [
    `# ${workout.date} 健身紀錄`,
    "",
    `課程：${workout.workoutName}`,
    workout.bodyWeight ? `體重：${workout.bodyWeight} kg` : "",
    workout.fatigue ? `疲勞：${workout.fatigue}/5` : "",
    `總訓練量：${Math.round(workoutVolume(workout))} kg`,
    ""
  ].filter(Boolean);

  for (const exercise of workout.exercises) {
    lines.push(`## ${exercise.name}${exercise.bodyPart ? `（${exercise.bodyPart}）` : ""}`);
    exercise.sets.forEach((set, index) => {
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      const rpe = set.rpe ? `，RPE ${set.rpe}` : "";
      lines.push(`- 第 ${index + 1} 組：${weight}kg x ${reps}${rpe}`);
    });
    lines.push("");
  }

  if (workout.notes) {
    lines.push("備註：", workout.notes, "");
  }

  lines.push("請根據這份紀錄分析訓練量、恢復狀態，並建議下次重量與次數。");
  return lines.join("\n").trim();
}

function exerciseBestStats(items) {
  const stats = new Map();

  for (const workout of items) {
    for (const exercise of workout.exercises || []) {
      const name = clean(exercise.name, 32);
      if (!name) continue;

      const current = stats.get(name) || {
        name,
        bodyPart: exercise.bodyPart || "",
        sessions: 0,
        totalSets: 0,
        bestWeight: 0,
        bestSetVolume: 0,
        bestRepsAtBestWeight: 0
      };

      current.sessions += 1;
      for (const set of exercise.sets || []) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        const setVolume = weight * reps;
        current.totalSets += 1;
        if (weight > current.bestWeight) {
          current.bestWeight = weight;
          current.bestRepsAtBestWeight = reps;
        }
        current.bestSetVolume = Math.max(current.bestSetVolume, setVolume);
      }

      stats.set(name, current);
    }
  }

  return [...stats.values()]
    .sort((a, b) => b.sessions - a.sessions || b.bestWeight - a.bestWeight || a.name.localeCompare(b.name, "zh-Hant"));
}

function formatHistoryMarkdown(items) {
  if (!items.length) {
    return "目前還沒有已儲存的長期訓練紀錄。請先儲存幾次訓練，再匯出給 ChatGPT 作為排課參考。";
  }

  const sorted = [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const totalWorkoutVolume = sorted.reduce((sum, workout) => sum + workoutVolume(workout), 0);
  const exerciseStats = exerciseBestStats(sorted);
  const dateRange = `${sorted[sorted.length - 1].date || "未填日期"} 到 ${sorted[0].date || "未填日期"}`;

  const lines = [
    "# 長期健身紀錄摘要",
    "",
    `紀錄區間：${dateRange}`,
    `訓練次數：${sorted.length}`,
    `累積訓練量：${Math.round(totalWorkoutVolume)} kg`,
    "",
    "## 最近訓練",
    ""
  ];

  sorted.slice(0, 12).forEach((workout) => {
    const exerciseNames = (workout.exercises || []).map((exercise) => exercise.name).filter(Boolean).join("、");
    const fatigue = workout.fatigue ? `，疲勞 ${workout.fatigue}/5` : "";
    lines.push(`- ${workout.date}｜${workout.workoutName}｜${Math.round(workoutVolume(workout))} kg${fatigue}｜${exerciseNames}`);
  });

  lines.push("", "## 動作表現摘要", "");
  exerciseStats.slice(0, 20).forEach((item) => {
    const bodyPart = item.bodyPart ? `（${item.bodyPart}）` : "";
    lines.push(`- ${item.name}${bodyPart}：出現 ${item.sessions} 次，總組數 ${item.totalSets}，最高重量 ${item.bestWeight}kg x ${item.bestRepsAtBestWeight}，最佳單組容量 ${Math.round(item.bestSetVolume)} kg`);
  });

  const recentNotes = sorted
    .filter((workout) => workout.notes)
    .slice(0, 6)
    .map((workout) => `- ${workout.date}：${workout.notes}`);

  if (recentNotes.length) {
    lines.push("", "## 近期備註", "", ...recentNotes);
  }

  lines.push(
    "",
    "請根據以上長期紀錄，安排下一次訓練課表。請考慮漸進超負荷、疲勞管理、弱項補強與恢復狀態，並用可匯入 App 的格式輸出：",
    "",
    "# 課程名稱",
    "",
    "## 動作名稱（部位）",
    "- 幾組 x 幾下 x 幾kg，RPE 數字"
  );

  return lines.join("\n").trim();
}

function formatPlanPrompt() {
  const historyBlock = workouts.length
    ? formatHistoryMarkdown(workouts)
    : "目前尚無長期紀錄，請先安排一份適合一般訓練者的入門課表。";

  return [
    "請根據以下健身紀錄與需求，安排下一次訓練課表。",
    "",
    "請務必遵守輸出規則：",
    "1. 只輸出課表，不要加說明文字。",
    "2. 課程名稱用 #。",
    "3. 每個動作用 ##。",
    "4. 每組使用「幾組 x 幾下 x 幾kg，RPE 數字」格式。",
    "5. 如果重量不確定，可以省略 kg，但仍保留組數與次數。",
    "",
    "請輸出成以下格式：",
    "",
    "# 課程名稱",
    "",
    "## 動作名稱（部位）",
    "- 幾組 x 幾下 x 幾kg，RPE 數字",
    "",
    "我的訓練紀錄參考：",
    "",
    historyBlock
  ].join("\n").trim();
}

function refreshExport() {
  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId);
  exportText.value = exportMode === "history"
    ? formatHistoryMarkdown(workouts)
    : formatMarkdown(selectedWorkout || readWorkoutFromForm());
  exportCurrent.classList.toggle("is-active", exportMode === "current");
  exportHistory.classList.toggle("is-active", exportMode === "history");
}

function renderHistory() {
  sessionCount.textContent = String(workouts.length);
  totalVolume.textContent = String(Math.round(workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0)));

  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId) || workouts[0];
  selectedWorkoutId = selectedWorkout?.id || "";
  refreshExport();

  historyList.innerHTML = workouts.map((workout) => {
    const active = workout.id === selectedWorkoutId ? " is-active" : "";
    const sets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    return `
      <button class="history-item${active}" type="button" data-id="${escapeHtml(workout.id)}">
        <span>
          <strong>${escapeHtml(workout.workoutName)}</strong>
          <small>${escapeHtml(workout.date)} · ${workout.exercises.length} 動作 · ${sets} 組</small>
        </span>
        <b>${Math.round(workoutVolume(workout))} kg</b>
      </button>
    `;
  }).join("");

  historyList.querySelectorAll(".history-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectedWorkoutId = button.dataset.id;
      renderHistory();
    });
  });
}

function loadWorkoutToForm(workout) {
  if (!workout) return;
  dateInput.value = workout.date || today();
  nameInput.value = workout.workoutName || "";
  bodyWeightInput.value = workout.bodyWeight ?? "";
  fatigueInput.value = workout.fatigue ?? "";
  notesInput.value = workout.notes || "";
  exerciseList.innerHTML = "";
  workout.exercises.forEach((exercise) => addExercise(exercise));
}

function resetForm() {
  dateInput.value = today();
  nameInput.value = "";
  bodyWeightInput.value = "";
  fatigueInput.value = "";
  notesInput.value = "";
  exerciseList.innerHTML = "";
  addExercise();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

document.querySelector("#addExercise").addEventListener("click", () => addExercise());
document.querySelector("#resetForm").addEventListener("click", resetForm);
document.querySelector("#importPlan").addEventListener("click", () => {
  const workout = parsePlan(planInput.value);
  if (!workout || !workout.exercises.length) {
    importStatus.textContent = "讀不到動作。請貼上例如：臥推 3組 x 8下 x 40kg，或用 ## 動作名稱 加組數。";
    importStatus.classList.add("is-error");
    showToast("課表格式還讀不到");
    return;
  }
  fillWorkoutForm(workout);
  const setCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  importStatus.textContent = `已帶入 ${workout.exercises.length} 個動作、${setCount} 組，可在下方微調。`;
  importStatus.classList.remove("is-error");
  showToast(`已帶入 ${workout.exercises.length} 個動作`);
});
copyPlanPrompt.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(formatPlanPrompt());
    showToast("排課指令已複製");
  } catch {
    showToast("請改用長期匯出複製");
  }
});
document.querySelector("#loadSelected").addEventListener("click", () => {
  loadWorkoutToForm(workouts.find((workout) => workout.id === selectedWorkoutId));
});
exportCurrent.addEventListener("click", () => {
  exportMode = "current";
  refreshExport();
});
exportHistory.addEventListener("click", () => {
  exportMode = "history";
  refreshExport();
});
form.addEventListener("input", () => {
  selectedWorkoutId = "";
  exportMode = "current";
  refreshExport();
});
document.querySelector("#copyExport").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(exportText.value);
    showToast("Markdown 已複製");
  } catch {
    showToast("請手動選取複製");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const workout = readWorkoutFromForm();
  if (!workout.workoutName || !workout.exercises.length) {
    showToast("請至少填寫課程名稱與一個動作");
    return;
  }

  const submitButton = form.querySelector("[type='submit']");
  submitButton.disabled = true;
  try {
    await addDoc(workoutsRef, {
      ...workout,
      source: "fitness-log",
      createdAt: serverTimestamp()
    });
    showToast("訓練已儲存");
    resetForm();
  } catch (error) {
    console.error(error);
    showToast("儲存失敗，請檢查 Firestore rules");
  } finally {
    submitButton.disabled = false;
  }
});

resetForm();
refreshExport();

onSnapshot(
  query(workoutsRef, orderBy("createdAt", "desc"), limit(80)),
  (snapshot) => {
    workouts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderHistory();
    setStatus("即時同步");
  },
  (error) => {
    console.error(error);
    setStatus("連線失敗", true);
  }
);
