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

const palette = ["#124537", "#256f5b", "#de5f42", "#c58b22", "#376f84", "#17211c"];
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const wordsRef = collection(db, "wordcloud_words");

const form = document.querySelector("#wordForm");
const input = document.querySelector("#wordInput");
const canvas = document.querySelector("#wordCloud");
const emptyState = document.querySelector("#emptyState");
const rankingList = document.querySelector("#rankingList");
const latestList = document.querySelector("#latestList");
const totalCount = document.querySelector("#totalCount");
const uniqueCount = document.querySelector("#uniqueCount");
const statusPill = document.querySelector("#statusPill");
const statusText = document.querySelector("#statusText");
const copyLink = document.querySelector("#copyLink");
const ctx = canvas.getContext("2d");

let words = [];
let animationFrame = 0;

function normalizeWord(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 18);
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

function getWordStats(items) {
  const counts = new Map();
  for (const item of items) {
    const word = normalizeWord(item.word || "");
    if (!word) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "zh-Hant"));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawBackground(width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 250, 240, 0.42)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(23, 33, 28, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 24; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - width * 0.22, height);
    ctx.stroke();
  }
}

function buildLayout(stats, width, height) {
  if (!stats.length) return [];

  const maxCount = Math.max(...stats.map((item) => item.count));
  const centerX = width / 2;
  const centerY = height / 2;

  return stats.slice(0, 48).map((item, index) => {
    const weight = item.count / maxCount;
    const angle = index * 2.3999632297;
    const radius = Math.sqrt(index) * Math.min(width, height) * 0.062;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const size = 18 + weight * Math.min(70, width * 0.085);

    return {
      ...item,
      x,
      y,
      size,
      rotate: index % 5 === 0 ? -0.1 : index % 4 === 0 ? 0.1 : 0,
      color: palette[index % palette.length],
      delay: index * 0.035
    };
  });
}

function drawCloud() {
  cancelAnimationFrame(animationFrame);
  const started = performance.now();

  function draw(now) {
    resizeCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const stats = getWordStats(words);
    const layout = buildLayout(stats, width, height);
    const progress = Math.min(1, (now - started) / 650);

    drawBackground(width, height);
    emptyState.classList.toggle("is-hidden", layout.length > 0);

    for (const item of layout) {
      const localProgress = Math.max(0, Math.min(1, progress - item.delay));
      if (localProgress <= 0) continue;

      const ease = 1 - Math.pow(1 - localProgress, 3);
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotate);
      ctx.globalAlpha = ease;
      ctx.fillStyle = item.color;
      ctx.font = `900 ${item.size * (0.72 + ease * 0.28)}px "Noto Serif TC", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(23, 33, 28, 0.14)";
      ctx.shadowBlur = 12;
      ctx.fillText(item.word, 0, 0);
      ctx.restore();
    }

    if (progress < 1) {
      animationFrame = requestAnimationFrame(draw);
    }
  }

  animationFrame = requestAnimationFrame(draw);
}

function renderLists() {
  const stats = getWordStats(words);
  totalCount.textContent = String(words.length);
  uniqueCount.textContent = String(stats.length);

  rankingList.innerHTML = stats.slice(0, 8).map((item, index) => `
    <li class="rank-item">
      <span class="rank-number">${index + 1}</span>
      <span class="rank-word">${escapeHtml(item.word)}</span>
      <span class="rank-count">${item.count}</span>
    </li>
  `).join("");

  latestList.innerHTML = words.slice(0, 18).map((item) => `
    <span class="latest-chip">${escapeHtml(item.word)}</span>
  `).join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const word = normalizeWord(input.value);
  if (!word) {
    input.focus();
    return;
  }

  const submitButton = form.querySelector("button");
  submitButton.disabled = true;
  try {
    await addDoc(wordsRef, {
      word,
      createdAt: serverTimestamp(),
      source: "firebase-wordcloud"
    });
    input.value = "";
    showToast("已送出");
  } catch (error) {
    console.error(error);
    showToast("送出失敗，請檢查規則");
  } finally {
    submitButton.disabled = false;
    input.focus();
  }
});

copyLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("連結已複製");
  } catch {
    showToast("請從網址列複製連結");
  }
});

window.addEventListener("resize", drawCloud);

onSnapshot(
  query(wordsRef, orderBy("createdAt", "desc"), limit(240)),
  (snapshot) => {
    words = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderLists();
    drawCloud();
    setStatus("即時連線");
  },
  (error) => {
    console.error(error);
    setStatus("連線失敗", true);
  }
);
