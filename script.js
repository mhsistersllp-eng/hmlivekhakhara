const WA_NUMBER = "919423458579";
const cart = new Map();

const cartItemsEl = document.getElementById("cartItems");
const totalQtyEl = document.getElementById("totalQty");
const formMessageEl = document.getElementById("formMessage");
const flavourEl = document.getElementById("flavour");
const qtyEl = document.getElementById("qty");
const addItemBtn = document.getElementById("addItemBtn");
const orderForm = document.getElementById("orderForm");

function sanitizeQty(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function setMessage(text, type = "") {
  formMessageEl.textContent = text;
  formMessageEl.className = "form-message";
  if (type) {
    formMessageEl.classList.add(type);
  }
}

function addToCart(flavour, qty) {
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

function getTotalQty() {
  let total = 0;
  for (const qty of cart.values()) total += qty;
  return total;
}

function renderCart() {
  cartItemsEl.innerHTML = "";

  if (cart.size === 0) {
    const empty = document.createElement("li");
    empty.className = "cart-item";
    empty.textContent = "No items yet.";
    cartItemsEl.appendChild(empty);
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
      minusBtn.setAttribute("aria-label", `Decrease ${flavour}`);
      minusBtn.addEventListener("click", () => updateQty(flavour, -1));

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "qty-btn";
      plusBtn.textContent = "+";
      plusBtn.setAttribute("aria-label", `Increase ${flavour}`);
      plusBtn.addEventListener("click", () => updateQty(flavour, 1));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeItem(flavour));

      controls.append(minusBtn, plusBtn, removeBtn);
      li.append(top, controls);
      cartItemsEl.appendChild(li);
    }
  }

  totalQtyEl.textContent = String(getTotalQty());
}

function buildMessage() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const note = document.getElementById("note").value.trim();

  if (!name) {
    setMessage("Please enter your name.", "error");
    return null;
  }

  if (cart.size === 0) {
    setMessage("Please add at least one item to cart.", "error");
    return null;
  }

  const lines = [];
  lines.push("Hi HM Live Khakhara, I want to place an order.");
  lines.push(`Name: ${name}`);
  if (phone) lines.push(`Phone: ${phone}`);
  lines.push("");
  lines.push("Order Items:");

  for (const [flavour, qty] of cart.entries()) {
    lines.push(`- ${flavour}: ${qty} pack(s)`);
  }

  lines.push(`Total Packs: ${getTotalQty()}`);
  if (note) {
    lines.push("");
    lines.push(`Note: ${note}`);
  }

  return lines.join("\n");
}

function sendOrder(event) {
  event.preventDefault();
  const msg = buildMessage();
  if (!msg) return;

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  setMessage("Opening WhatsApp with your consolidated order...", "success");
  window.open(url, "_blank", "noopener,noreferrer");
}

addItemBtn.addEventListener("click", () => {
  const flavour = flavourEl.value;
  const qty = sanitizeQty(qtyEl.value);
  addToCart(flavour, qty);
  qtyEl.value = "1";
  setMessage(`${flavour} added to cart.`, "success");
});

orderForm.addEventListener("submit", sendOrder);

for (const btn of document.querySelectorAll(".add-btn")) {
  btn.addEventListener("click", () => {
    const flavour = btn.getAttribute("data-flavour");
    addToCart(flavour, 1);
    setMessage(`${flavour} added to cart.`, "success");
    document.getElementById("order").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

renderCart();