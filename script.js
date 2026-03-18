const WA_NUMBER = "919423458579";
const INDIA_PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9][0-9]{9}$/;
const DEFAULT_FLAVOURS = ["Methi Khakhara", "Plain Khakhara", "Garlic Khakhara"];
const FLAVOURS_STORAGE_KEY = "hm_live_flavours";
const ADMIN_MODE_KEY = "hm_live_admin_mode";

const cart = new Map();
let flavours = [];

const els = {
  cartItems: document.getElementById("cartItems"),
  totalQty: document.getElementById("totalQty"),
  formMessage: document.getElementById("formMessage"),
  flavour: document.getElementById("flavour"),
  packetSize: document.getElementById("packetSize"),
  qty: document.getElementById("qty"),
  customFlavour: document.getElementById("customFlavour"),
  addItemBtn: document.getElementById("addItemBtn"),
  addCustomItemBtn: document.getElementById("addCustomItemBtn"),
  productGrid: document.getElementById("productGrid"),
  adminPanel: document.getElementById("adminPanel"),
  newFlavour: document.getElementById("newFlavour"),
  addFlavourBtn: document.getElementById("addFlavourBtn"),
  flavourList: document.getElementById("flavourList"),
  orderForm: document.getElementById("orderForm"),
  siteNav: document.getElementById("siteNav"),
  navToggle: document.getElementById("navToggle"),
  jumpTop: document.getElementById("jumpTop"),
  jumpBottom: document.getElementById("jumpBottom"),
  name: document.getElementById("name"),
  phone: document.getElementById("phone"),
  deliveryDate: document.getElementById("deliveryDate"),
  note: document.getElementById("note"),
  orderSection: document.getElementById("order")
};

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayValue() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return toDateInputValue(now);
}

function getComingSundayValue() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  now.setDate(now.getDate() + daysUntilSunday);
  return toDateInputValue(now);
}

function formatDeliveryDate(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function sanitizeQty(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function setMessage(text, type = "") {
  if (!els.formMessage) return;
  els.formMessage.textContent = text;
  els.formMessage.className = "form-message";
  if (type) els.formMessage.classList.add(type);
}

function getItemKey(flavour, packetSize) {
  return `${flavour}::${packetSize}`;
}

function getTotalQty() {
  let total = 0;
  for (const item of cart.values()) total += item.qty;
  return total;
}

function getSelectedPacketSize() {
  return (els.packetSize?.value || "200g").trim();
}

function renderCart() {
  if (!els.cartItems || !els.totalQty) return;
  els.cartItems.innerHTML = "";

  if (cart.size === 0) {
    const empty = document.createElement("li");
    empty.className = "cart-item";
    empty.textContent = "No items yet.";
    els.cartItems.appendChild(empty);
  } else {
    for (const [key, item] of cart.entries()) {
      const li = document.createElement("li");
      li.className = "cart-item";

      const top = document.createElement("div");
      top.className = "cart-item-top";

      const name = document.createElement("strong");
      name.textContent = `${item.flavour} (${item.packetSize})`;

      const qtyLabel = document.createElement("span");
      qtyLabel.textContent = `${item.qty} pack(s)`;
      top.append(name, qtyLabel);

      const controls = document.createElement("div");
      controls.className = "cart-controls";

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "qty-btn";
      minusBtn.textContent = "-";
      minusBtn.addEventListener("click", () => updateQty(key, -1));

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "qty-btn";
      plusBtn.textContent = "+";
      plusBtn.addEventListener("click", () => updateQty(key, 1));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeItem(key));

      controls.append(minusBtn, plusBtn, removeBtn);
      li.append(top, controls);
      els.cartItems.appendChild(li);
    }
  }

  els.totalQty.textContent = String(getTotalQty());
}

function addToCart(flavour, qty, packetSize = getSelectedPacketSize()) {
  if (!flavour) return;
  const safeQty = sanitizeQty(qty);
  const key = getItemKey(flavour, packetSize);
  const current = cart.get(key);
  if (current) {
    current.qty += safeQty;
  } else {
    cart.set(key, { flavour, packetSize, qty: safeQty });
  }
  renderCart();
}

function updateQty(key, delta) {
  const item = cart.get(key);
  if (!item) return;
  const next = item.qty + delta;
  if (next <= 0) {
    cart.delete(key);
  } else {
    item.qty = next;
  }
  renderCart();
}

function removeItem(key) {
  cart.delete(key);
  renderCart();
}

function loadFlavours() {
  try {
    const raw = localStorage.getItem(FLAVOURS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_FLAVOURS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_FLAVOURS];
    const cleaned = [...new Set(parsed.map((v) => String(v).trim()).filter(Boolean))];
    return cleaned.length ? cleaned : [...DEFAULT_FLAVOURS];
  } catch {
    return [...DEFAULT_FLAVOURS];
  }
}

function saveFlavours() {
  localStorage.setItem(FLAVOURS_STORAGE_KEY, JSON.stringify(flavours));
}

function isAdminMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === "1") {
    localStorage.setItem(ADMIN_MODE_KEY, "1");
    return true;
  }
  return localStorage.getItem(ADMIN_MODE_KEY) === "1";
}

function renderFlavourSelect() {
  if (!els.flavour) return;
  const current = els.flavour.value;
  els.flavour.innerHTML = "";
  for (const flavour of flavours) {
    const option = document.createElement("option");
    option.value = flavour;
    option.textContent = flavour;
    els.flavour.appendChild(option);
  }
  if (current && flavours.includes(current)) {
    els.flavour.value = current;
  }
}

function renderProductGrid() {
  if (!els.productGrid) return;
  els.productGrid.innerHTML = "";
  for (const flavour of flavours) {
    const card = document.createElement("article");
    card.className = "card product-card";

    const title = document.createElement("h3");
    title.textContent = flavour;

    const desc = document.createElement("p");
    desc.textContent = "Freshly roasted with consistent quality.";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-btn";
    btn.textContent = "Add to Cart";
    btn.addEventListener("click", () => quickAdd(flavour));

    card.append(title, desc, btn);
    els.productGrid.appendChild(card);
  }
}

function renderAdminFlavourList() {
  if (!els.flavourList) return;
  els.flavourList.innerHTML = "";
  for (const flavour of flavours) {
    const li = document.createElement("li");
    li.className = "admin-item";

    const name = document.createElement("span");
    name.textContent = flavour;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-flavour";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      flavours = flavours.filter((f) => f !== flavour);
      if (!flavours.length) flavours = [...DEFAULT_FLAVOURS];
      saveFlavours();
      pruneCartForFlavours();
      renderFlavours();
      setMessage(`Removed flavour: ${flavour}`, "success");
    });

    li.append(name, remove);
    els.flavourList.appendChild(li);
  }
}

function pruneCartForFlavours() {
  for (const [key, item] of cart.entries()) {
    if (!item.flavour.startsWith("Custom Flavour:") && !flavours.includes(item.flavour)) {
      cart.delete(key);
    }
  }
  renderCart();
}

function renderFlavours() {
  renderFlavourSelect();
  renderProductGrid();
  renderAdminFlavourList();
}

function addFlavourByAdmin() {
  const value = (els.newFlavour?.value || "").trim();
  if (!value) {
    setMessage("Please enter flavour name.", "error");
    return;
  }
  const exists = flavours.some((f) => f.toLowerCase() === value.toLowerCase());
  if (exists) {
    setMessage("This flavour already exists.", "error");
    return;
  }
  flavours.push(value);
  saveFlavours();
  renderFlavours();
  if (els.flavour) els.flavour.value = value;
  if (els.newFlavour) els.newFlavour.value = "";
  setMessage(`Added flavour: ${value}`, "success");
}

function initializeFlavours() {
  flavours = loadFlavours();
  if (isAdminMode() && els.adminPanel) {
    els.adminPanel.hidden = false;
  }
  renderFlavours();
}

function buildMessage() {
  const name = (els.name?.value || "").trim();
  const phone = (els.phone?.value || "").trim();
  const deliveryDate = (els.deliveryDate?.value || "").trim();
  const note = (els.note?.value || "").trim();
  const today = getTodayValue();

  if (!name) {
    setMessage("Please enter your name.", "error");
    return null;
  }
  if (cart.size === 0) {
    setMessage("Please add at least one item to cart.", "error");
    return null;
  }
  if (phone && !INDIA_PHONE_REGEX.test(phone)) {
    setMessage("Please enter a valid Indian phone number.", "error");
    return null;
  }
  if (!deliveryDate) {
    setMessage("Please select expected delivery date.", "error");
    return null;
  }
  if (deliveryDate < today) {
    setMessage("Back date is not allowed. Please pick today or a future date.", "error");
    return null;
  }

  const lines = [
    "Hi HM Live Khakhara, I want to place an order.",
    `Name: ${name}`,
    `Expected Delivery: ${formatDeliveryDate(deliveryDate)}`
  ];
  if (phone) {
    lines.push(`Alternate Phone: ${phone}`);
  } else {
    lines.push("Contact: Please use this WhatsApp chat number.");
  }
  lines.push("", "Order Items:");

  for (const item of cart.values()) {
    lines.push(`- ${item.flavour} (${item.packetSize}): ${item.qty} pack(s)`);
  }

  lines.push(`Total Packs: ${getTotalQty()}`);
  if (note) lines.push("", `Note: ${note}`);
  return lines.join("\n");
}

function sendOrder(event) {
  if (event) event.preventDefault();
  if (els.orderForm && !els.orderForm.checkValidity()) {
    els.orderForm.reportValidity();
    setMessage("Please complete all required fields correctly.", "error");
    return false;
  }
  const msg = buildMessage();
  if (!msg) return false;

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  setMessage("Opening WhatsApp with your order...", "success");
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
  return false;
}

function addCurrentItem() {
  if (!els.flavour || !els.qty) return false;
  const flavour = els.flavour.value;
  if (!flavour) {
    setMessage("Please select a flavour first.", "error");
    return false;
  }
  const qty = sanitizeQty(els.qty.value);
  const packetSize = getSelectedPacketSize();
  addToCart(flavour, qty, packetSize);
  els.qty.value = "1";
  setMessage(`${flavour} (${packetSize}) added to cart.`, "success");
  return false;
}

function addCustomItem() {
  const customRaw = (els.customFlavour?.value || "").trim();
  if (!customRaw) {
    setMessage("Please enter a custom flavour request.", "error");
    return false;
  }

  const customFlavours = [...new Set(
    customRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )];

  if (!customFlavours.length) {
    setMessage("Please enter at least one valid custom flavour.", "error");
    return false;
  }

  const qty = sanitizeQty(els.qty?.value || "1");
  const packetSize = "200g";

  for (const customName of customFlavours) {
    const flavour = `Custom Flavour: ${customName}`;
    addToCart(flavour, qty, packetSize);
  }

  if (els.customFlavour) els.customFlavour.value = "";
  if (els.qty) els.qty.value = "1";
  setMessage(`Added custom flavour(s): ${customFlavours.join(", ")} (${packetSize})`, "success");
  return false;
}

function quickAdd(flavour) {
  const packetSize = getSelectedPacketSize();
  addToCart(flavour, 1, packetSize);
  setMessage(`${flavour} (${packetSize}) added to cart.`, "success");
  if (els.orderSection) {
    els.orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return false;
}

function initializeDeliveryDate() {
  if (!els.deliveryDate) return;
  const today = getTodayValue();
  els.deliveryDate.min = today;
  els.deliveryDate.value = getComingSundayValue();
}

function updateJumpButtons() {
  if (!els.jumpTop || !els.jumpBottom) return;
  const docEl = document.documentElement;
  const body = document.body;
  const scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop || 0;
  const viewportHeight = window.visualViewport?.height || window.innerHeight || docEl.clientHeight || 0;
  const docHeight = Math.max(docEl.scrollHeight, body.scrollHeight, docEl.offsetHeight, body.offsetHeight);
  const maxScrollTop = Math.max(0, docHeight - viewportHeight);
  const threshold = 16;

  if (maxScrollTop <= threshold) {
    els.jumpTop.classList.add("is-hidden");
    els.jumpBottom.classList.add("is-hidden");
    return;
  }

  const showTop = scrollTop > threshold;
  const showBottom = scrollTop < maxScrollTop - threshold;

  els.jumpTop.classList.toggle("is-hidden", !showTop);
  els.jumpBottom.classList.toggle("is-hidden", !showBottom);
}

window.sendOrder = sendOrder;
window.addCurrentItem = addCurrentItem;
window.addCustomItem = addCustomItem;
window.quickAdd = quickAdd;

if (els.navToggle && els.siteNav) {
  els.navToggle.addEventListener("click", () => {
    const isOpen = els.siteNav.classList.toggle("open");
    els.navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  for (const link of els.siteNav.querySelectorAll("a")) {
    link.addEventListener("click", () => {
      els.siteNav.classList.remove("open");
      els.navToggle.setAttribute("aria-expanded", "false");
    });
  }
}

if (els.orderForm) {
  els.orderForm.addEventListener("submit", sendOrder);
}

if (els.addFlavourBtn) {
  els.addFlavourBtn.addEventListener("click", addFlavourByAdmin);
}

if (els.newFlavour) {
  els.newFlavour.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addFlavourByAdmin();
    }
  });
}

if (els.jumpTop) {
  els.jumpTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (els.jumpBottom) {
  els.jumpBottom.addEventListener("click", () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });
}

window.addEventListener("scroll", updateJumpButtons, { passive: true });
window.addEventListener("resize", updateJumpButtons);
window.addEventListener("orientationchange", updateJumpButtons);
window.addEventListener("load", updateJumpButtons);
window.addEventListener("pageshow", updateJumpButtons);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateJumpButtons);
  window.visualViewport.addEventListener("scroll", updateJumpButtons);
}

initializeFlavours();
initializeDeliveryDate();
renderCart();
updateJumpButtons();
