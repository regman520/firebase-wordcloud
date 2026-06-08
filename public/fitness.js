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
