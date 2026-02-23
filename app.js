// 1. GLOBAL O'ZGARUVCHILAR
let selectedImageBase64 = ""; 
let products = [];
let categories = [];
let cart = {};
let editingFbKey = null; // YANGI: Tahrirlash uchun

// 2. SOZLAMALAR
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
const ADMIN_TELEGRAM_ID = 7577685281; 
const ADMIN_CHAT_ID = "7577685281";   

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) tg.expand();

// 3. ILOVANI ISHGA TUSHIRISH
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
    });

    const userEl = document.getElementById('username');
    if(tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        userEl.innerText = tg.initDataUnsafe.user.first_name;
    } else {
        userEl.innerText = "Nurjahon";
    }

    // YANGI: Statistika va Statuslarni yuklash
    updateStats();
    initOrdersAdmin();
    checkOrderStatus();
}

// 4. AQLLI QIDIRUV
function searchProducts(query) {
    const term = query.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    renderProducts('all', filtered);
}

// 5. MAHSULOTLARNI CHIQARISH (Chegirma va Quick View bilan)
function renderProducts(filter = 'all', list = null) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = "";
    
    const displayList = list || products;

    displayList.forEach(p => {
        if(filter === 'all' || p.cat === filter) {
            const saleBadge = p.oldPrice ? `<span style="position:absolute; background:red; color:white; padding:2px 5px; border-radius:5px; font-size:10px; top:5px; left:5px;">Aksiya!</span>` : "";
            const priceHtml = p.oldPrice 
                ? `<p class="price" style="color:red;">${p.price.toLocaleString()} so'm <small style="text-decoration:line-through; color:gray; font-size:0.7em;">${p.oldPrice.toLocaleString()}</small></p>`
                : `<p class="price">${p.price.toLocaleString()} so'm</p>`;

            grid.innerHTML += `
            <div class="item" style="position:relative;">
                ${saleBadge}
                <img src="${p.img}" class="img" onclick="openQuickView('${p.fbKey}')">
                <p class="name">${p.name}</p>
                ${priceHtml}
                <div class="stepper">
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', -1)">-</button>
                    <span class="qty">${cart[p.fbKey] ? cart[p.fbKey].qty : 0}</span>
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', 1)">+</button>
                </div>
            </div>`;
        }
    });
}

// 6. QUICK VIEW (Tezkor ko'rish)
function openQuickView(key) {
    const p = products.find(x => x.fbKey === key);
    if(!p) return;
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = p.price.toLocaleString() + " so'm";
    document.getElementById('qv-desc').innerText = p.desc || "Tavsif berilmagan.";
    document.getElementById('qv-add-btn').onclick = () => { changeQty(key, 1); closeQuickView(); };
    document.getElementById('quick-view-modal').style.display = 'block';
}
function closeQuickView() { document.getElementById('quick-view-modal').style.display = 'none'; }

// 7. BUYURTMA BERISH VA STATUSNI SAQLASH
function checkout() {
    if(Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");
    tg.showConfirm("Buyurtmani tasdiqlaysizmi?", (ok) => {
        if (ok) {
            const userId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : 999;
            const comment = document.getElementById('order-comment').value || "Izoh yo'q";
            
            // Firebase-ga saqlash
            const orderData = {
                userId, items: cart, status: "Kutilmoqda", time: Date.now(), comment
            };
            database.ref('orders').push(orderData).then(() => {
                sendOrderToTelegram(orderData);
            });
        }
    });
}

function sendOrderToTelegram(order) {
    let message = "🛍 **YANGI BUYURTMA!**\n━━━━━━━━━━━━━━━━━━\n";
    let total = 0;
    for(let key in order.items) {
        let itm = order.items[key];
        message += `🔸 **${itm.name}**\n   ${itm.qty} x ${itm.price.toLocaleString()} so'm\n`;
        total += itm.qty * itm.price;
    }
    message += `━━━━━━━━━━━━━━━━━━\n💰 **JAMI: ${total.toLocaleString()} so'm**\n✍️ **Izoh:** ${order.comment}\n`;
    
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "📞 Bog'lanish", url: `tg://user?id=${order.userId}` }]]
            }
        })
    }).then(() => {
        tg.showAlert("Buyurtmangiz yuborildi!");
        cart = {}; updateCartDisplay(); toggleCart(); renderProducts();
    });
}

// 8. STATUSNI KUZATISH (Mijoz uchun)
function checkOrderStatus() {
    const uId = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
    if(!uId) return;
    database.ref('orders').orderByChild('userId').equalTo(uId).limitToLast(1).on('value', s => {
        const val = s.val();
        if(val) {
            const o = Object.values(val)[0];
            document.getElementById('status-bar').style.display = 'flex';
            document.getElementById('order-status-text').innerText = o.status;
            document.getElementById('dot-1').style.background = "#0088cc";
            document.getElementById('dot-2').style.background = (o.status === "Yo'lda" || o.status === "Yetkazildi") ? "#0088cc" : "#ccc";
            document.getElementById('dot-3').style.background = (o.status === "Yetkazildi") ? "#0088cc" : "#ccc";
        }
    });
}

// 9. ADMIN: MAHSULOT TAHRIRLASH VA QO'SHISH
function addNewProduct() {
    const name = document.getElementById('p-name').value;
    const price = parseInt(document.getElementById('p-price').value);
    const salePrice = parseInt(document.getElementById('p-sale-price').value) || null;
    const cat = document.getElementById('p-cat-select').value;
    const desc = document.getElementById('p-desc').value;

    if(name && price && selectedImageBase64) {
        const data = {
            id: editingFbKey ? products.find(x => x.fbKey === editingFbKey).id : Date.now(),
            name, 
            price: salePrice || price,
            oldPrice: salePrice ? price : null,
            cat, desc, img: selectedImageBase64
        };

        const ref = editingFbKey ? database.ref('products/' + editingFbKey) : database.ref('products').push();
        ref.set(data).then(() => {
            resetAdminForm();
            tg.showAlert("Saqlandi!");
        });
    } else { tg.showAlert("Ma'lumot kam!"); }
}

function editProduct(key) {
    const p = products.find(x => x.fbKey === key);
    editingFbKey = key;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.oldPrice || p.price;
    document.getElementById('p-sale-price').value = p.oldPrice ? p.price : "";
    document.getElementById('p-cat-select').value = p.cat;
    document.getElementById('p-desc').value = p.desc || "";
    selectedImageBase64 = p.img;
    const preview = document.getElementById('image-preview');
    preview.style.display = "block";
    preview.style.backgroundImage = `url(${p.img})`;
    document.getElementById('main-admin-btn').innerText = "Yangilash";
    showTab('p-tab', document.querySelector('.tab-link'));
}

function resetAdminForm() {
    editingFbKey = null;
    document.getElementById('p-name').value = "";
    document.getElementById('p-price').value = "";
    document.getElementById('p-sale-price').value = "";
    document.getElementById('p-desc').value = "";
    document.getElementById('image-preview').style.display = "none";
    document.getElementById('main-admin-btn').innerText = "Onlayn saqlash";
    selectedImageBase64 = "";
}

// 10. ADMIN: BUYURTMALAR VA STATISTIKA
function initOrdersAdmin() {
    database.ref('orders').on('value', s => {
        const list = document.getElementById('admin-orders-list');
        list.innerHTML = "";
        const data = s.val();
        if(!data) return list.innerHTML = "Buyurtmalar yo'q";
        Object.keys(data).reverse().forEach(key => {
            const o = data[key];
            list.innerHTML += `
            <div style="background:#fff; padding:10px; margin-bottom:10px; border-radius:10px; border:1px solid #ddd;">
                <b>Status: ${o.status}</b><br>
                <button onclick="updateStatus('${key}', 'Yo\\'lda')" style="font-size:10px;">Yo'lda</button>
                <button onclick="updateStatus('${key}', 'Yetkazildi')" style="font-size:10px;">Bitti</button>
                <button onclick="deleteOrder('${key}')" style="font-size:10px; background:red; color:white;">🗑</button>
            </div>`;
        });
    });
}

function updateStatus(key, status) { database.ref('orders/'+key).update({status}); }
function deleteOrder(key) { if(confirm("O'chirilsinmi?")) database.ref('orders/'+key).remove(); }

function updateStats() {
    database.ref('orders').on('value', s => {
        const orders = s.val();
        let rev = 0, count = 0;
        if(orders) {
            Object.values(orders).forEach(o => {
                count++;
                if(o.status === "Yetkazildi") {
                    for(let k in o.items) rev += o.items[k].price * o.items[k].qty;
                }
            });
        }
        document.getElementById('total-revenue').innerText = rev.toLocaleString() + " so'm";
        document.getElementById('total-orders-count').innerText = count;
    });
}

// --- YORDAMCHI FUNKSIYALAR (Sizning kodingiz saqlandi) ---
function changeQty(key, delta) {
    let p = products.find(x => x.fbKey === key);
    if(!cart[key]) cart[key] = { name: p.name, price: p.price, qty: 0 };
    cart[key].qty += delta;
    if(cart[key].qty <= 0) delete cart[key];
    renderProducts(); 
    updateCartDisplay();
}

function updateCartDisplay() {
    let count = 0, total = 0;
    const list = document.getElementById('cart-items');
    if(!list) return;
    list.innerHTML = "";
    for(let key in cart) {
        count += cart[key].qty;
        total += cart[key].qty * cart[key].price;
        list.innerHTML += `<li><span>${cart[key].name} (x${cart[key].qty})</span> <span>${(cart[key].qty * cart[key].price).toLocaleString()} so'm</span></li>`;
    }
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total-info').innerText = total.toLocaleString() + " so'm";
    document.getElementById('total-price-display').innerText = total.toLocaleString();
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
    if (!pList) return;
    pList.innerHTML = "";
    products.forEach(p => {
        pList.innerHTML += `
        <div class="admin-item" style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee;">
            <span>${p.name}</span> 
            <div>
                <button onclick="editProduct('${p.fbKey}')" style="color:blue;">✏️</button>
                <button onclick="deleteProduct('${p.fbKey}')" style="color:red;">🗑</button>
            </div>
        </div>`;
    });
}

function deleteProduct(fbKey) { if(confirm("O'chirilsinmi?")) database.ref('products/' + fbKey).remove(); }
function openAdmin() {
    let user = tg ? tg.initDataUnsafe.user : null;
    if (user && user.id === ADMIN_TELEGRAM_ID) {
        document.getElementById('admin-modal').style.display = 'block';
    } else {
        tg.showAlert("Faqat admin uchun! ⛔");
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

function addNewCategory() {
    const cat = document.getElementById('new-cat-input').value;
    if(cat && !categories.includes(cat)) {
        categories.push(cat);
        database.ref('categories').set(categories);
        document.getElementById('new-cat-input').value = "";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const imgInput = document.getElementById('p-image-input');
    if (imgInput) {
        imgInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = function() {
                selectedImageBase64 = reader.result;
                const preview = document.getElementById('image-preview');
                preview.style.display = "block";
                preview.style.backgroundImage = `url(${selectedImageBase64})`;
            }
            if (file) reader.readAsDataURL(file);
        });
    }
    init();
});
