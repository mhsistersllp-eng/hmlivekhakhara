const WA_NUMBER = "919423458579";
const INDIA_PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9][0-9]{9}$/;
const DEFAULT_CATALOG = {
  packetSize: "200g",
  products: [
    { name: "Methi Khakhara", description: "Classic savoury flavour", active: true },
    { name: "Plain Khakhara", description: "Light and crisp everyday option", active: true },
    { name: "Garlic Khakhara", description: "Bold garlic taste", active: true }
  ]
};

const cart = new Map();
let catalog = { ...DEFAULT_CATALOG };

const els = {
  cartItems: document.getElementById("cartItems"),
  totalQty: document.getElementById("totalQty"),
  formMessage: document.getElementById("formMessage"),
  flavour: document.getElementById("flavour"),
  packetSize: document.getElementById("packetSize"),
  qty: document.getElementById("qty"),
  customFlavour: document.getElementById("customFlavour"),
  productGrid: document.getElementById("productGrid"),
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

function getPacketSize() {
  return (catalog.packetSize || "200g").trim();
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

function addToCart(flavour, qty, packetSize = getPacketSize()) {
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

function normalizeCatalog(data) {
  const packetSize = typeof data?.packetSize === "string" && data.packetSize.trim()
    ? data.packetSize.trim()
    : DEFAULT_CATALOG.packetSize;

  const products = Array.isArray(data?.products)
    ? data.products
      .map((product) => ({
        name: String(product?.name || "").trim(),
        description: String(product?.description || "Freshly roasted with consistent quality.").trim(),
        active: product?.active !== false
      }))
      .filter((product) => product.name && product.active)
    : [];

  if (!products.length) {
    return { ...DEFAULT_CATALOG };
  }
  return { packetSize, products };
}

async function loadCatalog() {
  try {
    const response = await fetch("catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    catalog = normalizeCatalog(data);
  } catch {
    catalog = { ...DEFAULT_CATALOG };
    setMessage("Using fallback catalogue. Please check catalog.json.", "error");
  }
  renderCatalogUI();
}

function renderFlavourSelect() {
  if (!els.flavour) return;
  const current = els.flavour.value;
  els.flavour.innerHTML = "";
  for (const product of catalog.products) {
    const option = document.createElement("option");
    option.value = product.name;
    option.textContent = product.name;
    els.flavour.appendChild(option);
  }
  if (current && catalog.products.some((p) => p.name === current)) {
    els.flavour.value = current;
  }
}

function renderProductGrid() {
  if (!els.productGrid) return;
  els.productGrid.innerHTML = "";
  for (const product of catalog.products) {
    const card = document.createElement("article");
    card.className = "card product-card";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const desc = document.createElement("p");
    desc.textContent = product.description || "Freshly roasted with consistent quality.";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-btn";
    btn.textContent = "Add to Cart";
    btn.addEventListener("click", () => quickAdd(product.name));

    card.append(title, desc, btn);
    els.productGrid.appendChild(card);
  }
}

function renderPacketSize() {
  if (!els.packetSize) return;
  const size = getPacketSize();
  els.packetSize.innerHTML = `<option value="${size}" selected>${size}</option>`;
  els.packetSize.disabled = true;
}

function renderCatalogUI() {
  renderFlavourSelect();
  renderProductGrid();
  renderPacketSize();
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
  const packetSize = getPacketSize();
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
  const packetSize = getPacketSize();

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
  const packetSize = getPacketSize();
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

loadCatalog();
initializeDeliveryDate();
renderCart();
updateJumpButtons();
