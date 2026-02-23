// 1. GLOBAL KONFIGURATSIYA
let products = [], categories = [], cart = {}, editingFbKey = null, selectedImageBase64 = "";
const ADMIN_ID = 7577685281;
const BOT_TOKEN = "8597493525:AAH8Y8vsUB10zjJkJGcxDqiqp7eyWzDSb-k";

const firebaseConfig = {
    apiKey: "AIzaSyAwMERQQ9dzxrcrmsFTA7BI2Ow7SwegTL4",
    authDomain: "tg-dokon.firebaseapp.com",
    databaseURL: "https://tg-dokon-default-rtdb.firebaseio.com",
    projectId: "tg-dokon",
    storageBucket: "tg-dokon.firebasestorage.app",
    messagingSenderId: "611375396358",
    appId: "1:611375396358:web:12c2b67ad65395ad7ef587"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const tg = window.Telegram.WebApp;
tg.expand();

// 2. INITIALIZATION
function init() {
    database.ref('products').on('value', (s) => {
        const data = s.val();
        products = data ? Object.keys(data).map(k => ({...data[k], fbKey: k})) : [];
        renderProducts(products);
        updateAdminLists();
    });

    database.ref('categories').on('value', (s) => {
        categories = s.val() ? Object.values(s.val()) : ["Barchasi"];
        renderCategories();
    });

    document.getElementById('username').innerText = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.first_name : "Mijoz";
    checkOrderStatus();
}

// 3. UI RENDERING
function renderProducts(list) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = "";
    list.forEach(p => {
        grid.innerHTML += `
        <div class="item">
            <img src="${p.img}" class="img" onclick="openQuickView('${p.fbKey}')">
            <p class="name">${p.name}</p>
            <p class="price">${p.price.toLocaleString()} so'm</p>
            <div class="stepper">
                <button onclick="changeQty('${p.fbKey}', -1)">-</button>
                <span>${cart[p.fbKey] ? cart[p.fbKey].qty : 0}</span>
                <button onclick="changeQty('${p.fbKey}', 1)">+</button>
            </div>
        </div>`;
    });
}

function searchProducts(q) {
    const filtered = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    renderProducts(filtered);
}

// 4. QUICK VIEW
function openQuickView(key) {
    const p = products.find(x => x.fbKey === key);
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = p.price.toLocaleString() + " so'm";
    document.getElementById('qv-desc').innerText = p.desc || "Tavsif mavjud emas.";
    document.getElementById('qv-add-btn').onclick = () => { changeQty(key, 1); closeQuickView(); };
    document.getElementById('quick-view-modal').style.display = 'block';
}
function closeQuickView() { document.getElementById('quick-view-modal').style.display = 'none'; }

// 5. CART LOGIC
function changeQty(key, d) {
    const p = products.find(x => x.fbKey === key);
    if (!cart[key]) cart[key] = { name: p.name, price: p.price, qty: 0 };
    cart[key].qty += d;
    if (cart[key].qty <= 0) delete cart[key];
    updateCartUI();
    renderProducts(products);
}

function updateCartUI() {
    let c = 0, t = 0, list = document.getElementById('cart-items');
    list.innerHTML = "";
    for (let k in cart) {
        c += cart[k].qty; t += cart[k].qty * cart[k].price;
        list.innerHTML += `<li>${cart[k].name} x${cart[k].qty} <span>${(cart[k].qty*cart[k].price).toLocaleString()}</span></li>`;
    }
    document.getElementById('cart-count').innerText = c;
    document.getElementById('cart-total-info').innerText = t.toLocaleString() + " so'm";
    document.getElementById('total-price-display').innerText = t.toLocaleString();
}

// 6. CHECKOUT & STATUS
function checkout() {
    if (Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");
    const comment = document.getElementById('order-comment').value;
    const userId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : 999;
    
    const orderData = { userId, items: cart, status: "Qabul qilindi", time: Date.now() };
    database.ref('orders').push(orderData).then((ref) => {
        sendTelegramMsg(orderData, comment);
        tg.showAlert("Buyurtma qabul qilindi! ✅");
        cart = {}; updateCartUI(); toggleCart(); renderProducts(products);
    });
}

function checkOrderStatus() {
    const uId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
    if(!uId) return;
    database.ref('orders').orderByChild('userId').equalTo(uId).limitToLast(1).on('value', s => {
        const val = s.val();
        if(val) {
            const order = Object.values(val)[0];
            document.getElementById('status-bar').style.display = 'flex';
            document.getElementById('order-status-text').innerText = order.status;
            updateStatusDots(order.status);
        }
    });
}

function updateStatusDots(s) {
    const d1 = document.getElementById('dot-1'), d2 = document.getElementById('dot-2'), d3 = document.getElementById('dot-3');
    d1.className = 'dot active'; d2.className = 'dot'; d3.className = 'dot';
    if(s === "Yo'lda") d2.className = 'dot active';
    if(s === "Yetkazildi") { d2.className = 'dot active'; d3.className = 'dot active'; }
}

function sendTelegramMsg(order, comment) {
    let text = `🛍 Yangi buyurtma!\n\n`;
    for(let k in order.items) text += `• ${order.items[k].name} x${order.items[k].qty}\n`;
    text += `\n💬 Izoh: ${comment}\n👤 Mijoz: ${tg.initDataUnsafe.user?.first_name}`;
    
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            chat_id: ADMIN_ID, text: text, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{text:"✅ Qabul", callback_data:"done"}]]}
        })
    });
}

// 7. ADMIN FUNCTIONS
function openAdmin() {
    if(tg.initDataUnsafe.user?.id === ADMIN_ID) document.getElementById('admin-modal').style.display='block';
    else tg.showAlert("Faqat admin uchun! ⛔");
}

function addNewProduct() {
    const name = document.getElementById('p-name').value, price = parseInt(document.getElementById('p-price').value), 
          cat = document.getElementById('p-cat-select').value, desc = document.getElementById('p-desc').value;
    if(!name || !price || !selectedImageBase64) return tg.showAlert("Ma'lumot yetarli emas!");

    const data = { name, price, cat, desc, img: selectedImageBase64 };
    const ref = editingFbKey ? database.ref('products/' + editingFbKey) : database.ref('products').push();
    ref.set(data).then(() => {
        tg.showAlert("Saqlandi! ✨");
        resetAdminForm();
    });
}

function editProduct(key) {
    const p = products.find(x => x.fbKey === key);
    editingFbKey = key;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-desc').value = p.desc || "";
    selectedImageBase64 = p.img;
    document.getElementById('image-preview').style.display='block';
    document.getElementById('image-preview').style.backgroundImage=`url(${p.img})`;
    document.getElementById('main-admin-btn').innerText = "Yangilash";
}

function resetAdminForm() {
    editingFbKey = null;
    document.getElementById('p-name').value = "";
    document.getElementById('p-price').value = "";
    document.getElementById('p-desc').value = "";
    document.getElementById('image-preview').style.display='none';
    document.getElementById('main-admin-btn').innerText = "Onlayn saqlash";
}

// Helper Functions
function showTab(id, btn) {
    document.querySelectorAll('.tab-body').forEach(b => b.style.display='none');
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.getElementById(id).style.display='block';
    btn.classList.add('active');
}
function deleteProduct(k) { if(confirm("O'chirilsinmi?")) database.ref('products/'+k).remove(); }
function closeAdmin() { document.getElementById('admin-modal').style.display='none'; }
function toggleCart() { 
    let m = document.getElementById('cart-modal');
    m.style.display = m.style.display==='block' ? 'none' : 'block';
}

document.getElementById('p-image-input').addEventListener('change', function(e) {
    const r = new FileReader();
    r.onload = () => {
        selectedImageBase64 = r.result;
        document.getElementById('image-preview').style.display='block';
        document.getElementById('image-preview').style.backgroundImage=`url(${r.result})`;
    };
    r.readAsDataURL(e.target.files[0]);
});

function updateAdminLists() {
    let l = document.getElementById('admin-prod-list');
    l.innerHTML = "";
    products.forEach(p => {
        l.innerHTML += `<div class="admin-item"><span>${p.name}</span><div><button onclick="editProduct('${p.fbKey}')">✏️</button><button onclick="deleteProduct('${p.fbKey}')">🗑</button></div></div>`;
    });
}

function renderCategories() {
    const list = document.getElementById('category-list'), select = document.getElementById('p-cat-select');
    list.innerHTML = `<button class="cat-btn active" onclick="renderProducts(products)">Barchasi</button>`;
    select.innerHTML = "";
    categories.forEach(c => {
        list.innerHTML += `<button class="cat-btn" onclick="filterCat('${c}')">${c}</button>`;
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}
function filterCat(c) { renderProducts(products.filter(p => p.cat === c)); }

init();
