// 1. GLOBAL O'ZGARUVCHILAR
let selectedImageBase64 = ""; 
let products = [];
let categories = [];
let cart = {};
let editingFbKey = null; 
let selectedVariants = {};
let discountPercent = 0; 

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
const ADMIN_CHAT_ID = "7577685281";   
const ADMIN_TELEGRAM_ID = 7577685281;
const GEMINI_API_KEY = "AIzaSyA4CmdyPPiGfEFqOmJVb1y8t9p9HxtLSTQ";

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
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

    updateStats();
    initOrdersAdmin();
    loadOrderHistory();
}

// 4. QIDIRUV
function searchProducts(query) {
    const term = query.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    renderProducts('all', filtered);
}

// 5. MAHSULOTLARNI CHIQARISH (Xatolar tuzatildi)
function renderProducts(filter = 'all', list = null) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = "";
    
    const displayList = list || products;

    displayList.forEach(p => {
        if(filter === 'all' || p.cat === filter) {
            // Variant tanlash mantiqi
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
            const saleBadge = p.oldPrice ? `<span class="sale-badge">Aksiya!</span>` : "";

            grid.innerHTML += `
            <div class="item ${isOut ? 'disabled' : ''}">
                ${saleBadge}
                <img src="${p.img}" class="img" onclick="openQuickView('${p.fbKey}')">
                <p class="name">${p.name}</p>
                ${variantsHtml}
                <p class="price">${currentPrice.toLocaleString()} so'm</p>
                <div class="stock-badge">${isOut ? 'TUGADI' : 'Zaxira: '+ (p.stock || 0) +' ta'}</div>
                <div class="stepper">
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', -1)" ${isOut ? 'disabled' : ''}>-</button>
                    <span class="qty">${getCartQty(p.fbKey)}</span>
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', 1)" ${isOut ? 'disabled' : ''}>+</button>
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

// 6. SAVATCHA MANTIQI (Skladni hisobga oladi)
function changeQty(pKey, delta) {
    const p = products.find(x => x.fbKey === pKey);
    if (!p) return;

    // Sklad tekshiruvi (faqat qo'shishda)
    if (delta > 0 && p.stock !== undefined && getCartQty(pKey) >= p.stock) {
        tg.showAlert("Omborda yetarli mahsulot yo'q!");
        return;
    }

    const variant = selectedVariants[pKey] || (p.variants ? p.variants[0] : { vName: "Standard", vPrice: p.price });
    const cartId = `${pKey}_${variant.vName.replace(/\s/g, '')}`;

    if(!cart[cartId]) {
        cart[cartId] = { name: `${p.name} (${variant.vName})`, price: variant.vPrice, qty: 0, pKey: pKey };
    }

    cart[cartId].qty += delta;
    if(cart[cartId].qty <= 0) delete cart[cartId];
    
    renderProducts(); 
    updateCartDisplay();
}

// 7. PROMOKOD VA HISOB-KITOB
function applyPromo() {
    const codeInput = document.getElementById('promo-input');
    const code = codeInput.value.trim().toUpperCase();
    if(!code) return;

    database.ref('promos/' + code).once('value', s => {
        const p = s.val();
        if(p && p.active) {
            discountPercent = p.percent;
            tg.showAlert(`Tabriklaymiz! ${p.percent}% chegirma qo'llanildi.`);
            updateCartDisplay();
        } else {
            tg.showAlert("Promokod xato yoki muddati o'tgan!");
        }
    });
}

function calculateTotal() {
    let sub = 0;
    for(let id in cart) sub += cart[id].qty * cart[id].price;
    return sub - (sub * discountPercent / 100);
}

function updateCartDisplay() {
    let count = 0, total = calculateTotal();
    const list = document.getElementById('cart-items');
    if(!list) return;
    list.innerHTML = "";
    
    for(let id in cart) {
        count += cart[id].qty;
        list.innerHTML += `<li><span>${cart[id].name} (x${cart[id].qty})</span> <span>${(cart[id].qty * cart[id].price).toLocaleString()} so'm</span></li>`;
    }
    
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total-info').innerText = total.toLocaleString() + " so'm";
    document.getElementById('total-price-display').innerText = total.toLocaleString();
}

// 8. BUYURTMA VA SKLAD YANGILASH
function checkout() {
    if(Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");
    
    tg.showConfirm("Buyurtmani tasdiqlaysizmi?", (ok) => {
        if (ok) {
            const user = tg.initDataUnsafe.user || {id: 7577685281, first_name: "Nurjahon"};
            const totalPrice = calculateTotal();
            
            const orderData = { 
                userId: user.id, 
                userName: user.first_name,
                items: cart, 
                status: "Kutilmoqda", 
                time: Date.now(), 
                totalPrice,
                comment: document.getElementById('order-comment').value || "Izoh yo'q"
            };
            
            database.ref('orders').push(orderData).then(() => { 
                updateStockAfterOrder();
                sendOrderToTelegram(orderData);
            });
        }
    });
}

function updateStockAfterOrder() {
    for (let id in cart) {
        const pKey = cart[id].pKey;
        const qty = cart[id].qty;
        database.ref('products/' + pKey + '/stock').transaction(current => {
            return (current || 0) - qty;
        });
    }
}

// 9. TELEGRAM BILAN ISHLASH (Push & Admin Message)
function sendOrderToTelegram(order) {
    let message = `🛍 **YANGI BUYURTMA!**\n👤 Mijoz: ${order.userName}\n━━━━━━━━━━━━━━━━━━\n`;
    Object.values(order.items).forEach(itm => {
        message += `🔸 **${itm.name}**\n   ${itm.qty} x ${itm.price.toLocaleString()} = ${(itm.qty*itm.price).toLocaleString()}\n`;
    });
    message += `━━━━━━━━━━━━━━━━━━\n💰 **JAMI: ${order.totalPrice.toLocaleString()} so'm**\n✍️ **Izoh:** ${order.comment}`;
    
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID, text: message, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "📞 Bog'lanish", url: `tg://user?id=${order.userId}` }]] }
        })
    });

    tg.showAlert("✅ Buyurtmangiz qabul qilindi!");
    cart = {}; discountPercent = 0;
    updateCartDisplay(); toggleCart(); renderProducts();
}

function updateStatus(key, status) {
    database.ref('orders/'+key).update({status}).then(() => {
        database.ref('orders/'+key).once('value', s => {
            const o = s.val();
            const msg = `Sizning №${key.slice(-5)} buyurtmangiz holati: **${status}** 🚚`;
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ chat_id: o.userId, text: msg, parse_mode: "Markdown" })
            });
        });
    });
}

// 10. BUYURTMA TARIXI (Mijoz uchun)
function loadOrderHistory() {
    const uId = tg?.initDataUnsafe?.user?.id || 7577685281;
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
                        <small>${new Date(o.time).toLocaleDateString()} ${new Date(o.time).toLocaleTimeString()}</small><br>
                        <b>Jami: ${o.totalPrice ? o.totalPrice.toLocaleString() : '---'} so'm</b>
                    </div>`;
            });
        }
    });
}

// 11. SUPER AI AGENT (O'chirilmagan)
async function askAI() {
    const promptInput = document.getElementById('ai-prompt');
    const prompt = promptInput.value;
    if(!prompt) return;

    const aiStatus = document.getElementById('ai-status');
    aiStatus.innerText = "O'ylamoqdaman... 🧠";

    const context = `Siz do'kon adminisiz. Mahsulotlar: ${JSON.stringify(products.map(p => ({name: p.name, price: p.price, key: p.fbKey})))}. Buyruq: ${prompt}.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] })
        });
        const data = await response.json();
        aiStatus.innerText = data.candidates[0].content.parts[0].text;
        promptInput.value = "";
    } catch (e) {
        aiStatus.innerText = "AI ulana olmadi.";
    }
}

// 12. ADMIN VA BOSHQA YORDAMCHI FUNKSIYALAR
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
        const data = {
            id: editingFbKey ? products.find(x => x.fbKey === editingFbKey).id : Date.now(),
            name, price, stock, cat, desc, variants, img: selectedImageBase64
        };
        const ref = editingFbKey ? database.ref('products/' + editingFbKey) : database.ref('products').push();
        ref.set(data).then(() => { resetAdminForm(); tg.showAlert("Muvaffaqiyatli saqlandi!"); });
    } else { tg.showAlert("Barcha maydonlarni to'ldiring!"); }
}

function toggleCart() {
    const m = document.getElementById('cart-modal');
    m.style.display = m.style.display === 'block' ? 'none' : 'block';
}

function openAdmin() {
    const user = tg?.initDataUnsafe?.user;
    if (user && user.id === ADMIN_TELEGRAM_ID) { 
        document.getElementById('admin-modal').style.display = 'block'; 
    } else { 
        tg.showAlert("Faqat admin uchun! ⛔"); 
    }
}

function closeAdmin() { document.getElementById('admin-modal').style.display = 'none'; }

function showTab(id, btn) {
    document.querySelectorAll('.tab-body').forEach(b => b.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    btn.classList.add('active');
}

function updateStats() {
    database.ref('orders').on('value', s => {
        const orders = s.val();
        let rev = 0, count = 0;
        if(orders) {
            Object.values(orders).forEach(o => {
                count++;
                if(o.status === "Yetkazildi" || o.status === "Bitti") {
                    rev += o.totalPrice || 0;
                }
            });
        }
        document.getElementById('total-revenue').innerText = rev.toLocaleString() + " so'm";
        document.getElementById('total-orders-count').innerText = count;
    });
}

function initOrdersAdmin() {
    database.ref('orders').on('value', s => {
        const list = document.getElementById('admin-orders-list');
        if (!list) return;
        list.innerHTML = "";
        const data = s.val();
        if(!data) return;
        Object.keys(data).reverse().forEach(key => {
            const o = data[key];
            list.innerHTML += `<div class="admin-item">
                <div><b>ID: ${key.slice(-5)}</b> - ${o.status}<br><small>${o.userName}</small></div>
                <div>
                    <button onclick="updateStatus('${key}', 'Yo\\'lda')">Yo'lda</button>
                    <button onclick="updateStatus('${key}', 'Bitti')">Bitti</button>
                </div>
            </div>`;
        });
    });
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
        pList.innerHTML += `<div class="admin-item">
            <span>${p.name} (Sklad: ${p.stock || 0})</span> 
            <div>
                <button onclick="editProduct('${p.fbKey}')">✏️</button>
                <button onclick="deleteProduct('${p.fbKey}')" style="color:red;">🗑</button>
            </div>
        </div>`;
    });
}

function deleteProduct(fbKey) { if(confirm("O'chirilsinmi?")) database.ref('products/' + fbKey).remove(); }

function editProduct(key) {
    const p = products.find(x => x.fbKey === key);
    editingFbKey = key;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-stock').value = p.stock || 0;
    document.getElementById('p-cat-select').value = p.cat;
    document.getElementById('p-desc').value = p.desc || "";
    document.getElementById('p-variants').value = p.variants ? p.variants.map(v => `${v.vName}:${v.vPrice}`).join(', ') : "";
    selectedImageBase64 = p.img;
    const preview = document.getElementById('image-preview');
    preview.style.display = "block"; preview.style.backgroundImage = `url(${p.img})`;
    document.getElementById('main-admin-btn').innerText = "Yangilash";
    showTab('p-tab', document.querySelector('.tab-link'));
}

function resetAdminForm() {
    editingFbKey = null;
    document.getElementById('p-name').value = "";
    document.getElementById('p-price').value = "";
    document.getElementById('p-stock').value = "";
    document.getElementById('p-desc').value = "";
    document.getElementById('p-variants').value = "";
    document.getElementById('image-preview').style.display = "none";
    document.getElementById('main-admin-btn').innerText = "Saqlash";
    selectedImageBase64 = "";
}

// 13. QUICK VIEW
function openQuickView(key) {
    const p = products.find(x => x.fbKey === key);
    if(!p) return;
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = (selectedVariants[key]?.vPrice || p.price).toLocaleString() + " so'm";
    document.getElementById('qv-desc').innerText = p.desc || "Tavsif berilmagan.";
    document.getElementById('qv-add-btn').onclick = () => { changeQty(key, 1); closeQuickView(); };
    document.getElementById('quick-view-modal').style.display = 'block';
}
function closeQuickView() { document.getElementById('quick-view-modal').style.display = 'none'; }

document.addEventListener('DOMContentLoaded', () => {
    const imgInput = document.getElementById('p-image-input');
    if (imgInput) {
        imgInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                selectedImageBase64 = reader.result;
                const preview = document.getElementById('image-preview');
                preview.style.display = "block";
                preview.style.backgroundImage = `url(${selectedImageBase64})`;
            };
            if (file) reader.readAsDataURL(file);
        });
    }
    init();
});
