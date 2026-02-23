// 1. GLOBAL O'ZGARUVCHILAR
let selectedImageBase64 = ""; 
let products = [];
let categories = [];
let cart = {};

// 2. SOZLAMALAR (Sizning ma'lumotlaringiz)
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
const ADMIN_TELEGRAM_ID = 7577685281; // Sizning IDingiz (Admin panelga kirish uchun)
const ADMIN_CHAT_ID = "7577685281";   // Buyurtma boradigan chat ID

// Firebase-ni ishga tushirish
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Telegram WebApp sozlamalari
let tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
    tg.expand();
}

// 3. ILOVANI ISHGA TUSHIRISH
function init() {
    // Mahsulotlarni yuklash
    database.ref('products').on('value', (snapshot) => {
        const data = snapshot.val();
        products = data ? Object.keys(data).map(key => ({...data[key], fbKey: key})) : [];
        renderProducts();
        updateAdminLists();
    });

    // Toifalarni yuklash
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
}

// 4. ADMIN PANELNI HIMOYA QILISH
function openAdmin() {
    let user = tg ? tg.initDataUnsafe.user : null;
    // Faqat sizning IDngiz bo'lsa ochadi
    if (user && user.id === ADMIN_TELEGRAM_ID) {
        document.getElementById('admin-modal').style.display = 'block';
    } else {
        tg.showAlert("Kechirasiz, bu bo'limga faqat do'kon egasi kira oladi! ⛔");
    }
}

// 5. BUYURTMA BERISH (TELEGRAMGA YUBORISH)
function checkout() {
    if(Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");

    tg.showConfirm("Buyurtmani tasdiqlaysizmi?", (ok) => {
        if (ok) {
            sendOrderToTelegram();
        }
    });
}

function sendOrderToTelegram() {
    const comment = document.getElementById('order-comment').value || "Izoh yo'q";
    let message = "🛍 **YANGI BUYURTMA!**\n";
    message += "━━━━━━━━━━━━━━━━━━\n";
    
    let total = 0;
    for(let id in cart) {
        let itemTotal = cart[id].qty * cart[id].price;
        message += `🔸 **${cart[id].name}**\n   ${cart[id].qty} x ${cart[id].price.toLocaleString()} = ${itemTotal.toLocaleString()} so'm\n`;
        total += itemTotal;
    }

    message += "━━━━━━━━━━━━━━━━━━\n";
    message += `💰 **JAMI: ${total.toLocaleString()} so'm**\n`;
    message += `✍️ **Izoh:** ${comment}\n\n`;
    
    let user = tg ? tg.initDataUnsafe.user : null;
    message += `👤 **Mijoz:** ${user ? user.first_name : "Noma'lum"}\n`;
    if(user && user.username) message += `🔗 **Username:** @${user.username}\n`;
    if(user && user.id) message += `🆔 **Mijoz ID:** ${user.id}\n`;

    // Google Script "done" callback-ni kutadi
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "💬 Mijozga yozish", url: `tg://user?id=${user ? user.id : ''}` },
                        { text: "✅ Qabul qilish", callback_data: "done" }
                    ]
                ]
            }
        })
    }).then(res => {
        if(res.ok) {
            tg.showAlert("Rahmat! Buyurtmangiz adminga yuborildi.");
            cart = {};
            document.getElementById('order-comment').value = "";
            updateCartDisplay();
            toggleCart();
            renderProducts();
        } else {
            tg.showAlert("Xatolik! Bot admin bilan bog'lana olmadi.");
        }
    });
}

// 6. UI VA SAVATCHA FUNKSIYALARI
function changeQty(id, delta) {
    let p = products.find(x => x.id === id);
    if(!cart[id]) cart[id] = { name: p.name, price: p.price, qty: 0 };
    cart[id].qty += delta;
    if(cart[id].qty <= 0) delete cart[id];
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
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total-info').innerText = total.toLocaleString() + " so'm";
    document.getElementById('total-price-display').innerText = total.toLocaleString();
}

function renderProducts(filter = 'all') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = "";
    products.forEach(p => {
        if(filter === 'all' || p.cat === filter) {
            grid.innerHTML += `
            <div class="item">
                <img src="${p.img}" class="img">
                <p class="name">${p.name}</p>
                <p class="price">${p.price.toLocaleString()} so'm</p>
                <div class="stepper">
                    <button class="step-btn" onclick="changeQty(${p.id}, -1)">-</button>
                    <span class="qty">${cart[p.id] ? cart[p.id].qty : 0}</span>
                    <button class="step-btn" onclick="changeQty(${p.id}, 1)">+</button>
                </div>
            </div>`;
        }
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

// 7. ADMIN PANEL LOGIKASI
function addNewProduct() {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const cat = document.getElementById('p-cat-select').value;
    if(name && price && selectedImageBase64) {
        database.ref('products').push({
            id: Date.now(), name, price: parseInt(price), cat, img: selectedImageBase64
        }).then(() => {
            document.getElementById('p-name').value = "";
            document.getElementById('p-price').value = "";
            document.getElementById('image-preview').style.display = "none";
            selectedImageBase64 = "";
            alert("Mahsulot qo'shildi!");
        });
    } else { alert("Ma'lumotlar to'liq emas!"); }
}

function deleteProduct(fbKey) {
    if(confirm("Ushbu mahsulot o'chirilsinmi?")) database.ref('products/' + fbKey).remove();
}

function addNewCategory() {
    const cat = document.getElementById('new-cat-input').value;
    if(cat && !categories.includes(cat)) {
        categories.push(cat);
        database.ref('categories').set(categories);
        document.getElementById('new-cat-input').value = "";
    }
}

function closeAdmin() { document.getElementById('admin-modal').style.display = 'none'; }
function toggleCart() {
    const m = document.getElementById('cart-modal');
    m.style.display = m.style.display === 'block' ? 'none' : 'block';
}

function updateAdminLists() {
    const pList = document.getElementById('admin-prod-list');
    if (!pList) return;
    pList.innerHTML = "";
    products.forEach(p => {
        pList.innerHTML += `<div class="admin-item"><span>${p.name}</span> <button onclick="deleteProduct('${p.fbKey}')" style="color:red; background:none; border:none;">🗑</button></div>`;
    });
}

function showTab(id) {
    document.querySelectorAll('.tab-body').forEach(b => b.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// Rasm yuklash va ishga tushirish
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
