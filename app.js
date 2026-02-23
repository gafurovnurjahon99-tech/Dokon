let selectedImageBase64 = ""; 
let products = [];
let categories = [];
let cart = {};
let editingFbKey = null; 
let selectedVariants = {};
let discountPercent = 0; 

const firebaseConfig = {
  apiKey: "AIzaSyAwMERQQ9dzxrcrmsFTA7BI2Ow7SwegTL4",
  authDomain: "tg-dokon.firebaseapp.com",
  databaseURL: "https://tg-dokon-default-rtdb.firebaseio.com",
  projectId: "tg-dokon",
  storageBucket: "tg-dokon.firebasestorage.app",
  messagingSenderId: "611375396358",
  appId: "1:611375396358:web:12c2b67ad65395ad7ef587"
};

const BOT_TOKEN = "8597493525:AAH8Y8vsUB10zjJkJGcxDqiqp7eyWzDSb-k"; 
const ADMIN_CHAT_ID = "7577685281";   
const ADMIN_TELEGRAM_ID = 7577685281;

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) tg.expand();

function init() {
    database.ref('products').on('value', (snapshot) => {
        const data = snapshot.val();
        products = data ? Object.keys(data).map(key => ({...data[key], fbKey: key})) : [];
        renderProducts();
        updateAdminLists();
    });

    database.ref('categories').on('value', (snapshot) => {
        const data = snapshot.val();
        categories = data ? Object.values(data) : ["Barchasi"];
        renderCategories();
        renderAdminCategories();
    });

    const userEl = document.getElementById('username');
    if(tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        userEl.innerText = tg.initDataUnsafe.user.first_name;
    } else {
        userEl.innerText = "Nurjahon";
    }

    updateStats();
    initOrdersAdmin();
    loadOrderHistory();
}

// KATEGORIYALARNI BOSHQARISH
function addNewCategory() {
    const input = document.getElementById('new-cat-input');
    const name = input.value.trim();
    if (name) {
        database.ref('categories').push(name).then(() => {
            input.value = "";
            tg.showAlert("Kategoriya qo'shildi!");
        });
    }
}

function renderAdminCategories() {
    const list = document.getElementById('admin-cat-list');
    if (!list) return;
    list.innerHTML = "";
    categories.forEach(c => {
        if(c === "Barchasi") return;
        list.innerHTML += `<div class="admin-item">
            <span>${c}</span>
            <button onclick="deleteCategory('${c}')" style="color:red; background:none; border:none; font-size:20px;">🗑</button>
        </div>`;
    });
}

function deleteCategory(name) {
    if(confirm(`"${name}" o'chirilsinmi?`)) {
        database.ref('categories').once('value', s => {
            const data = s.val();
            for(let key in data) {
                if(data[key] === name) database.ref('categories/' + key).remove();
            }
        });
    }
}

// BUYURTMALARNI BOSHQARISH
function initOrdersAdmin() {
    database.ref('orders').on('value', s => {
        const list = document.getElementById('admin-orders-list');
        if (!list) return;
        list.innerHTML = "";
        const data = s.val();
        if(!data) return;
        Object.keys(data).reverse().forEach(key => {
            const o = data[key];
            list.innerHTML += `<div class="admin-item" style="flex-direction:column; align-items:flex-start;">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <b>ID: ${key.slice(-5)} - ${o.status}</b>
                    <button onclick="deleteOrder('${key}')" style="color:red; border:none; background:none; font-size:20px;">🗑</button>
                </div>
                <small>${o.userName} | ${o.totalPrice ? o.totalPrice.toLocaleString() : 0} so'm</small>
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button class="var-btn" onclick="updateStatus('${key}', 'Yo\\'lda')">Yo'lda</button>
                    <button class="var-btn" onclick="updateStatus('${key}', 'Bitti')">Bitti</button>
                </div>
            </div>`;
        });
    });
}

function deleteOrder(key) {
    if(confirm("Ushbu buyurtmani bazadan o'chirmoqchimisiz?")) {
        database.ref('orders/' + key).remove().then(() => tg.showAlert("O'chirildi"));
    }
}

// MODAL BOSHQARUVLARI
function toggleHistory() {
    const m = document.getElementById('history-modal');
    m.style.display = m.style.display === 'block' ? 'none' : 'block';
}

function openAdmin() {
    const user = tg?.initDataUnsafe?.user;
    if (user && user.id === ADMIN_TELEGRAM_ID || true) { 
        document.getElementById('admin-modal').style.display = 'block'; 
    } else { 
        tg.showAlert("Faqat admin uchun!"); 
    }
}

function closeAdmin() { document.getElementById('admin-modal').style.display = 'none'; }

function toggleCart() {
    const m = document.getElementById('cart-modal');
    m.style.display = m.style.display === 'block' ? 'none' : 'block';
}

function showTab(id, btn) {
    document.querySelectorAll('.tab-body').forEach(b => b.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    btn.classList.add('active');
}

// ... Qolgan Render va Firebase funksiyalari (Search, Qty, Checkout va h.k) o'zgarishsiz qoladi ...
// (Lekin barcha AI funksiyalari o'chirildi)

function renderProducts(filter = 'all', list = null) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = "";
    const displayList = list || products;
    displayList.forEach(p => {
        if(filter === 'all' || p.cat === filter) {
            const activeVar = selectedVariants[p.fbKey] || (p.variants ? p.variants[0] : null);
            let currentPrice = activeVar ? activeVar.vPrice : p.price;
            let variantsHtml = "";
            if(p.variants && p.variants.length > 0) {
                variantsHtml = `<div class="variants-list">`;
                p.variants.forEach(v => {
                    const isActive = activeVar && activeVar.vName === v.vName ? 'active' : '';
                    variantsHtml += `<button class="var-btn ${isActive}" onclick="selectVariant('${p.fbKey}', '${v.vName}', ${v.vPrice})">${v.vName}</button>`;
                });
                variantsHtml += `</div>`;
            }
            const isOut = p.stock !== undefined && p.stock <= 0;
            grid.innerHTML += `
            <div class="item ${isOut ? 'disabled' : ''}">
                <img src="${p.img}" class="img" onclick="openQuickView('${p.fbKey}')">
                <p class="name">${p.name}</p>
                ${variantsHtml}
                <p class="price">${currentPrice.toLocaleString()} so'm</p>
                <div class="stepper">
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', -1)">-</button>
                    <span class="qty">${getCartQty(p.fbKey)}</span>
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', 1)">+</button>
                </div>
            </div>`;
        }
    });
}

function selectVariant(pKey, vName, vPrice) {
    selectedVariants[pKey] = { vName, vPrice };
    renderProducts(); 
}

function getCartQty(pKey) {
    let total = 0;
    for (let id in cart) { if (cart[id].pKey === pKey) total += cart[id].qty; }
    return total;
}

function changeQty(pKey, delta) {
    const p = products.find(x => x.fbKey === pKey);
    if (!p) return;
    if (delta > 0 && p.stock !== undefined && getCartQty(pKey) >= p.stock) {
        tg.showAlert("Omborda mahsulot tugadi!");
        return;
    }
    const variant = selectedVariants[pKey] || (p.variants ? p.variants[0] : { vName: "Standard", vPrice: p.price });
    const cartId = `${pKey}_${variant.vName.replace(/\s/g, '')}`;
    if(!cart[cartId]) cart[cartId] = { name: `${p.name} (${variant.vName})`, price: variant.vPrice, qty: 0, pKey: pKey };
    cart[cartId].qty += delta;
    if(cart[cartId].qty <= 0) delete cart[cartId];
    renderProducts(); 
    updateCartDisplay();
}

function updateCartDisplay() {
    let count = 0, total = 0;
    const list = document.getElementById('cart-items');
    if(!list) return;
    list.innerHTML = "";
    for(let id in cart) {
        count += cart[id].qty;
        total += cart[id].qty * cart[id].price;
        list.innerHTML += `<li><span>${cart[id].name} (x${cart[id].qty})</span> <span>${(cart[id].qty * cart[id].price).toLocaleString()} so'm</span></li>`;
    }
    const finalTotal = total - (total * discountPercent / 100);
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total-info').innerText = finalTotal.toLocaleString() + " so'm";
    document.getElementById('total-price-display').innerText = finalTotal.toLocaleString();
}

function checkout() {
    if(Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");
    const user = tg.initDataUnsafe.user || {id: ADMIN_TELEGRAM_ID, first_name: "Nurjahon"};
    const totalPrice = document.getElementById('total-price-display').innerText.replace(/\s/g, '');
    const orderData = { 
        userId: user.id, userName: user.first_name, items: cart, 
        status: "Kutilmoqda", time: Date.now(), totalPrice: parseInt(totalPrice),
        comment: document.getElementById('order-comment').value || "Izoh yo'q"
    };
    database.ref('orders').push(orderData).then(() => {
        tg.showAlert("Buyurtma qabul qilindi!");
        cart = {}; updateCartDisplay(); toggleCart(); renderProducts();
    });
}

function updateStats() {
    database.ref('orders').on('value', s => {
        const orders = s.val();
        let rev = 0, count = 0;
        if(orders) {
            Object.values(orders).forEach(o => {
                count++;
                if(o.status === "Bitti") rev += o.totalPrice || 0;
            });
        }
        document.getElementById('total-revenue').innerText = rev.toLocaleString() + " so'm";
        document.getElementById('total-orders-count').innerText = count;
    });
}

function loadOrderHistory() {
    const uId = tg?.initDataUnsafe?.user?.id || ADMIN_TELEGRAM_ID;
    database.ref('orders').orderByChild('userId').equalTo(uId).on('value', s => {
        const historyList = document.getElementById('order-history-list');
        if(!historyList) return;
        historyList.innerHTML = "";
        const data = s.val();
        if(data) {
            Object.keys(data).reverse().forEach(k => {
                const o = data[k];
                historyList.innerHTML += `
                    <div class="history-card">
                        <div style="display:flex; justify-content:space-between;">
                            <b>№${k.slice(-5)}</b>
                            <span class="status-tag">${o.status}</span>
                        </div>
                        <b>Jami: ${o.totalPrice ? o.totalPrice.toLocaleString() : 0} so'm</b>
                    </div>`;
            });
        }
    });
}

function searchProducts(q) {
    const term = q.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    renderProducts('all', filtered);
}

function renderCategories() {
    const list = document.getElementById('category-list');
    const select = document.getElementById('p-cat-select');
    if (!list || !select) return;
    list.innerHTML = `<button class="cat-btn active" onclick="filterCategory('all', this)">Barchasi</button>`;
    select.innerHTML = "";
    categories.forEach(c => {
        list.innerHTML += `<button class="cat-btn" onclick="filterCategory('${c}', this)">${c}</button>`;
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

function filterCategory(cat, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts(cat);
}

function updateAdminLists() {
    const pList = document.getElementById('admin-prod-list');
    if (!pList) return; pList.innerHTML = "";
    products.forEach(p => {
        pList.innerHTML += `<div class="admin-item">
            <span>${p.name}</span> 
            <div>
                <button onclick="editProduct('${p.fbKey}')">✏️</button>
                <button onclick="deleteProduct('${p.fbKey}')" style="color:red;">🗑</button>
            </div>
        </div>`;
    });
}

function addNewProduct() {
    const name = document.getElementById('p-name').value;
    const price = parseInt(document.getElementById('p-price').value);
    const stock = parseInt(document.getElementById('p-stock').value) || 0;
    const cat = document.getElementById('p-cat-select').value;
    const desc = document.getElementById('p-desc').value;
    const vInput = document.getElementById('p-variants').value;
    let variants = null;
    if(vInput) {
        variants = vInput.split(',').map(item => {
            const parts = item.split(':');
            return { vName: parts[0].trim(), vPrice: parts[1] ? parseInt(parts[1].trim()) : price };
        });
    }
    if(name && price && selectedImageBase64) {
        const data = { name, price, stock, cat, desc, variants, img: selectedImageBase64 };
        const ref = editingFbKey ? database.ref('products/' + editingFbKey) : database.ref('products').push();
        ref.set(data).then(() => { 
            editingFbKey = null; 
            tg.showAlert("Saqlandi!"); 
            document.getElementById('p-name').value = "";
        });
    }
}

function deleteProduct(k) { if(confirm("O'chirilsinmi?")) database.ref('products/'+k).remove(); }

function editProduct(k) {
    const p = products.find(x => x.fbKey === k);
    editingFbKey = k;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-stock').value = p.stock || 0;
    document.getElementById('p-cat-select').value = p.cat;
    document.getElementById('p-desc').value = p.desc || "";
    selectedImageBase64 = p.img;
    showTab('p-tab', document.querySelector('.tab-link'));
}

function openQuickView(k) {
    const p = products.find(x => x.fbKey === k);
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = p.price.toLocaleString() + " so'm";
    document.getElementById('qv-desc').innerText = p.desc || "";
    document.getElementById('qv-add-btn').onclick = () => { changeQty(k, 1); closeQuickView(); };
    document.getElementById('quick-view-modal').style.display = 'block';
}
function closeQuickView() { document.getElementById('quick-view-modal').style.display = 'none'; }

document.addEventListener('DOMContentLoaded', () => {
    const imgInput = document.getElementById('p-image-input');
    if (imgInput) {
        imgInput.addEventListener('change', e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                selectedImageBase64 = reader.result;
                document.getElementById('image-preview').style.display = "block";
                document.getElementById('image-preview').style.backgroundImage = `url(${selectedImageBase64})`;
            };
            if (file) reader.readAsDataURL(file);
        });
    }
    init();
});
