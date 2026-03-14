const WA_NUMBER = "919423458579";
const INDIA_PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9][0-9]{9}$/;
const cart = new Map();

const els = {
  cartItems: document.getElementById("cartItems"),
  totalQty: document.getElementById("totalQty"),
  formMessage: document.getElementById("formMessage"),
  flavour: document.getElementById("flavour"),
  qty: document.getElementById("qty"),
  addItemBtn: document.getElementById("addItemBtn"),
  orderForm: document.getElementById("orderForm"),
  name: document.getElementById("name"),
  phone: document.getElementById("phone"),
  note: document.getElementById("note"),
  orderSection: document.getElementById("order")
};

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

function getTotalQty() {
  let total = 0;
  for (const qty of cart.values()) total += qty;
  return total;
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
    for (const [flavour, qty] of cart.entries()) {
      const li = document.createElement("li");
      li.className = "cart-item";

      const top = document.createElement("div");
      top.className = "cart-item-top";

      const name = document.createElement("strong");
      name.textContent = flavour;

      const qtyLabel = document.createElement("span");
      qtyLabel.textContent = `${qty} pack(s)`;
      top.append(name, qtyLabel);

      const controls = document.createElement("div");
      controls.className = "cart-controls";

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "qty-btn";
      minusBtn.textContent = "-";
      minusBtn.addEventListener("click", () => updateQty(flavour, -1));

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "qty-btn";
      plusBtn.textContent = "+";
      plusBtn.addEventListener("click", () => updateQty(flavour, 1));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeItem(flavour));

      controls.append(minusBtn, plusBtn, removeBtn);
      li.append(top, controls);
      els.cartItems.appendChild(li);
    }
  }

  els.totalQty.textContent = String(getTotalQty());
}

function addToCart(flavour, qty) {
  if (!flavour) return;
  const safeQty = sanitizeQty(qty);
  const current = cart.get(flavour) || 0;
  cart.set(flavour, current + safeQty);
  renderCart();
}

function updateQty(flavour, delta) {
  const current = cart.get(flavour) || 0;
  const next = current + delta;
  if (next <= 0) {
    cart.delete(flavour);
  } else {
    cart.set(flavour, next);
  }
  renderCart();
}

function removeItem(flavour) {
  cart.delete(flavour);
  renderCart();
}

function buildMessage() {
  const name = (els.name?.value || "").trim();
  const phone = (els.phone?.value || "").trim();
  const note = (els.note?.value || "").trim();

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

  const lines = [
    "Hi HM Live Khakhara, I want to place an order.",
    `Name: ${name}`
  ];
  if (phone) {
    lines.push(`Alternate Phone: ${phone}`);
  } else {
    lines.push("Contact: Please use this WhatsApp chat number.");
  }
  lines.push("", "Order Items:");

  for (const [flavour, qty] of cart.entries()) {
    lines.push(`- ${flavour}: ${qty} pack(s)`);
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
  const qty = sanitizeQty(els.qty.value);
  addToCart(flavour, qty);
  els.qty.value = "1";
  setMessage(`${flavour} added to cart.`, "success");
  return false;
}

function quickAdd(flavour) {
  addToCart(flavour, 1);
  setMessage(`${flavour} added to cart.`, "success");
  if (els.orderSection) {
    els.orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return false;
}

window.sendOrder = sendOrder;
window.addCurrentItem = addCurrentItem;
window.quickAdd = quickAdd;

if (els.orderForm) {
  els.orderForm.addEventListener("submit", sendOrder);
}

renderCart();
