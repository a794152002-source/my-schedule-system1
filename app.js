// 這裡貼上你的 Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbxL2gJ6_StoDWd3GrOy_z07VfCkyNR_j0KH8-VeBcX3n2wv0SwzDSaPq0NpsWRDLn8/exec";

let currentDeviceId = "";
let scanner = null;

document.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("fireInspectorName") || "";
  document.getElementById("inspector").value = savedName;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (id) loadDevice(id);

  loadDashboard();
  loadAdminDevices();
});

async function api(action, data = {}) {
  if (!API_URL || API_URL.includes("請貼上")) {
    throw new Error("尚未設定 API_URL，請先到 app.js 貼上 Apps Script 部署網址");
  }

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...data })
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.message || "操作失敗");
  return json;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2600);
}

function showPage(page) {
  document.getElementById("checkPage").classList.toggle("hidden", page !== "check");
  document.getElementById("dashboardPage").classList.toggle("hidden", page !== "dashboard");
  document.getElementById("adminPage").classList.toggle("hidden", page !== "admin");

  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  if (page === "check") document.querySelectorAll(".tab")[0].classList.add("active");
  if (page === "dashboard") {
    document.querySelectorAll(".tab")[1].classList.add("active");
    loadDashboard();
  }
  if (page === "admin") {
    document.querySelectorAll(".tab")[2].classList.add("active");
    loadAdminDevices();
  }
}

function loadManualDevice() {
  const id = document.getElementById("manualId").value.trim();
  if (!id) return toast("請輸入設備編號");
  loadDevice(id);
}

async function loadDevice(id) {
  try {
    currentDeviceId = id;
    document.getElementById("deviceId").textContent = id;
    document.getElementById("deviceType").textContent = "讀取中";
    document.getElementById("deviceLocation").textContent = "雲端位置讀取中...";
    document.getElementById("deviceExpire").textContent = "雲端效期讀取中...";
    document.getElementById("deviceArea").textContent = "--";

    const json = await api("getDevice", { id });
    const d = json.device;

    document.getElementById("deviceType").textContent = d.type || "未分類";
    document.getElementById("deviceLocation").textContent = d.location || "未設定";
    document.getElementById("deviceExpire").textContent = d.expire || "未設定";
    document.getElementById("deviceArea").textContent = d.area || "--";
  } catch (e) {
    document.getElementById("deviceType").textContent = "未建檔";
    document.getElementById("deviceLocation").textContent = "查無雲端位置";
    document.getElementById("deviceExpire").textContent = "查無效期資料";
    toast(e.message);
  }
}

async function submitCheck(status) {
  try {
    const inspector = document.getElementById("inspector").value.trim();
    if (!inspector) return toast("請先輸入點檢執行人姓名");
    if (!currentDeviceId) return toast("請先掃描或輸入設備編號");

    localStorage.setItem("fireInspectorName", inspector);

    const checked = [...document.querySelectorAll(".checkInput")]
      .filter(x => x.checked).map(x => x.value);

    const unchecked = [...document.querySelectorAll(".checkInput")]
      .filter(x => !x.checked).map(x => x.value);

    const finalStatus = unchecked.length > 0 ? "異常" : status;

    await api("submitCheck", {
      inspector,
      deviceId: currentDeviceId,
      status: finalStatus,
      checkedItems: checked.join("、"),
      abnormalItems: unchecked.join("、"),
      remark: document.getElementById("remark").value.trim(),
      userAgent: navigator.userAgent
    });

    toast("✅ 點檢資料已送出");
    document.getElementById("remark").value = "";
    loadDashboard();
  } catch (e) {
    toast(e.message);
  }
}

async function loadDashboard() {
  try {
    const json = await api("dashboard");
    document.getElementById("totalDevices").textContent = json.total || 0;
    document.getElementById("doneDevices").textContent = json.done || 0;
    document.getElementById("pendingDevices").textContent = json.pending || 0;
    document.getElementById("abnormalDevices").textContent = json.abnormal || 0;

    document.getElementById("expireList").innerHTML = (json.expiring || []).map(d => `
      <div class="list-item">
        ${d.id}　${d.type || ""}<br>
        <span class="small">位置：${d.location || ""}｜效期：${d.expire || ""}</span>
      </div>
    `).join("") || `<div class="list-item">目前沒有即將到期設備</div>`;

    document.getElementById("abnormalList").innerHTML = (json.abnormalRows || []).map(r => `
      <div class="list-item">
        ${r.date}　${r.deviceId}　${r.inspector}<br>
        <span class="small">異常：${r.abnormalItems || "未填"}｜備註：${r.remark || ""}</span>
      </div>
    `).join("") || `<div class="list-item">目前沒有異常回報</div>`;
  } catch (e) {
    console.warn(e);
  }
}

async function saveDevice() {
  try {
    const id = document.getElementById("adminId").value.trim();
    if (!id) return toast("請輸入設備編號");

    await api("saveDevice", {
      id,
      type: document.getElementById("adminType").value.trim(),
      location: document.getElementById("adminLocation").value.trim(),
      area: document.getElementById("adminArea").value.trim(),
      expire: document.getElementById("adminExpire").value.trim()
    });

    toast("✅ 設備已儲存");
    ["adminId","adminType","adminLocation","adminArea","adminExpire"].forEach(x => document.getElementById(x).value = "");
    loadAdminDevices();
  } catch (e) {
    toast(e.message);
  }
}

async function loadAdminDevices() {
  try {
    const json = await api("listDevices");
    document.getElementById("deviceList").innerHTML = (json.devices || []).map(d => `
      <div class="list-item" onclick="fillAdmin('${escapeHtml(d.id)}','${escapeHtml(d.type)}','${escapeHtml(d.location)}','${escapeHtml(d.area)}','${escapeHtml(d.expire)}')">
        ${d.id}　${d.type || ""}<br>
        <span class="small">${d.area || ""}｜${d.location || ""}｜效期：${d.expire || ""}</span>
      </div>
    `).join("") || `<div class="list-item">尚未建立設備</div>`;
  } catch (e) {
    console.warn(e);
  }
}

function fillAdmin(id,type,location,area,expire) {
  document.getElementById("adminId").value = id;
  document.getElementById("adminType").value = type;
  document.getElementById("adminLocation").value = location;
  document.getElementById("adminArea").value = area;
  document.getElementById("adminExpire").value = expire;
  toast("已帶入設備資料，可修改後儲存");
}

function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}

function openScanner() {
  document.getElementById("scannerBox").classList.remove("hidden");

  if (!window.Html5Qrcode) {
    toast("掃描套件載入中，請稍後再試");
    return;
  }

  scanner = new Html5Qrcode("reader");
  scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    decodedText => {
      let deviceId = decodedText;
      try {
        const url = new URL(decodedText);
        deviceId = url.searchParams.get("id") || decodedText;
      } catch(e) {}
      closeScanner();
      loadDevice(deviceId);
    }
  ).catch(err => toast("無法開啟相機，請確認瀏覽器權限"));
}

function closeScanner() {
  document.getElementById("scannerBox").classList.add("hidden");
  if (scanner) {
    scanner.stop().catch(()=>{});
    scanner = null;
  }
}
