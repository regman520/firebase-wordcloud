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
const exerciseList = document.querySelector("#exerciseList");
const exerciseTemplate = document.querySelector("#exerciseTemplate");
const setTemplate = document.querySelector("#setTemplate");
const historyList = document.querySelector("#historyList");
const exportText = document.querySelector("#exportText");
const statusPill = document.querySelector("#statusPill");
const statusText = document.querySelector("#statusText");
const sessionCount = document.querySelector("#sessionCount");
const totalVolume = document.querySelector("#totalVolume");

let workouts = [];
let selectedWorkoutId = "";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value, max = 80) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== "" ? parsed : null;
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

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line) continue;

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
      currentExercise = {
        name: clean(headingMatch[1].replace(/[（(].*?[）)]/g, ""), 32),
        bodyPart: clean(headingMatch[1].match(/[（(](.*?)[）)]/)?.[1] || "", 16),
        sets: []
      };
      workout.exercises.push(currentExercise);
      continue;
    }

    const inlineExerciseMatch = line.match(/^(?:[-*]\s*)?([^:：-]{2,32})\s*[:：-]\s*(.+)$/);
    if (inlineExerciseMatch && !/^第\s*\d+\s*組/.test(inlineExerciseMatch[1])) {
      currentExercise = {
        name: clean(inlineExerciseMatch[1].replace(/^\d+[.)、]\s*/, ""), 32),
        bodyPart: "",
        sets: []
      };
      workout.exercises.push(currentExercise);
      const prescription = parseSetPrescription(inlineExerciseMatch[2]);
      if (prescription) currentExercise.sets.push(...expandSetPrescription(prescription));
      continue;
    }

    const prescription = parseSetPrescription(line);
    if (prescription && currentExercise) {
      currentExercise.sets.push(...expandSetPrescription(prescription));
    }
  }

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

function refreshExport() {
  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId);
  exportText.value = formatMarkdown(selectedWorkout || readWorkoutFromForm());
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
    showToast("讀不到動作，請用動作標題加組數格式");
    return;
  }
  fillWorkoutForm(workout);
  showToast(`已帶入 ${workout.exercises.length} 個動作`);
});
document.querySelector("#loadSelected").addEventListener("click", () => {
  loadWorkoutToForm(workouts.find((workout) => workout.id === selectedWorkoutId));
});
form.addEventListener("input", () => {
  selectedWorkoutId = "";
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
