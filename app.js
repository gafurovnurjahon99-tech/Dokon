// GLOBAL O'ZGARUVCHILAR (Qo'shimcha yangilar bilan)
let selectedImageBase64 = ""; 
let products = [];
let categories = [];
let cart = {};
let editingFbKey = null; 
let selectedVariants = {};
let discountPercent = 0; // Yangi: Chegirma foizi

// ... Firebase Config o'zgarishsiz qoladi ...

// 3. ILOVANI ISHGA TUSHIRISH (Tarix yuklash qo'shildi)
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
    }

    updateStats();
    initOrdersAdmin();
    loadOrderHistory(); // Yangi: Buyurtmalar tarixini yuklash
}

// 5. MAHSULOTLARNI CHIQARISH (Sklad va Dizayn bilan)
function renderProducts(filter = 'all', list = null) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = "";
    const displayList = list || products;

    displayList.forEach(p => {
        if(filter === 'all' || p.cat === filter) {
            const activeVar = selectedVariants[p.fbKey] || (p.variants ? p.variants[0] : null);
            let currentPrice = activeVar ? activeVar.vPrice : p.price;
            
            // Sklad tekshiruvi
            const isOut = p.stock !== undefined && p.stock <= 0;

            grid.innerHTML += `
            <div class="item ${isOut ? 'disabled' : ''}">
                ${p.oldPrice ? '<span class="sale-badge">Aksiya</span>' : ''}
                <img src="${p.img}" class="img" onclick="openQuickView('${p.fbKey}')">
                <p class="name">${p.name}</p>
                <p class="price">${currentPrice.toLocaleString()} so'm</p>
                <div class="stock-badge">${isOut ? 'TUGADI' : 'Zaxira: '+ (p.stock || 0) +' ta'}</div>
                <div class="stepper">
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', -1)">-</button>
                    <span class="qty">${getCartQty(p.fbKey)}</span>
                    <button class="step-btn" onclick="changeQty('${p.fbKey}', 1)">+</button>
                </div>
            </div>`;
        }
    });
}

// YANGI: PROMOKOD TIZIMI
function applyPromo() {
    const code = document.getElementById('promo-input').value.toUpperCase();
    database.ref('promos/' + code).once('value', s => {
        const p = s.val();
        if(p && p.active) {
            discountPercent = p.percent;
            tg.showAlert(`Tabriklaymiz! ${p.percent}% chegirma!`);
            updateCartDisplay();
        } else {
            tg.showAlert("Noto'g'ri promokod!");
        }
    });
}

// YANGI: BUYURTMA TARIXI (Mijoz uchun)
function loadOrderHistory() {
    const uId = tg?.initDataUnsafe?.user?.id || 999;
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
                        <b>№${k.slice(-5)}</b> - <span class="status-tag">${o.status}</span><br>
                        <small>${new Date(o.time).toLocaleString()}</small><br>
                        <b>Jami: ${o.totalPrice ? o.totalPrice.toLocaleString() : '---'} so'm</b>
                    </div>`;
            });
        }
    });
}

// YANGI: SKLADNI YANGILASH (Checkout ichida chaqiriladi)
function updateStockAfterOrder() {
    for (let id in cart) {
        const pKey = cart[id].pKey;
        const qty = cart[id].qty;
        database.ref('products/' + pKey + '/stock').transaction(current => {
            return (current || 0) - qty;
        });
    }
}

// YANGI: PUSH-XABARNOMA (Admin statusni o'zgartirganda)
function updateStatus(key, status) {
    database.ref('orders/'+key).update({status}).then(() => {
        database.ref('orders/'+key).once('value', s => {
            const o = s.val();
            const msg = `Sizning №${key.slice(-5)} buyurtmangiz: ${status} ✅`;
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ chat_id: o.userId, text: msg })
            });
        });
    });
}

// BUYURTMA BERISH (Yangilangan)
function checkout() {
    if(Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");
    tg.showConfirm("Buyurtmani tasdiqlaysizmi?", (ok) => {
        if (ok) {
            const user = tg.initDataUnsafe.user || {id: 999, first_name: "User"};
            const totalPrice = calculateTotal();
            const orderData = { 
                userId: user.id, userName: user.first_name,
                items: cart, status: "Kutilmoqda", 
                time: Date.now(), totalPrice,
                comment: document.getElementById('order-comment').value || ""
            };
            
            database.ref('orders').push(orderData).then(() => { 
                updateStockAfterOrder(); // Skladni kamaytirish
                sendOrderToTelegram(orderData); 
            });
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
    for(let id in cart) count += cart[id].qty;
    
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total-info').innerText = total.toLocaleString() + " so'm";
    // Chegirma bo'lsa ko'rsatish
    if(discountPercent > 0) {
        document.getElementById('total-price-display').innerHTML = `<s>${(total / (1 - discountPercent/100)).toLocaleString()}</s> ${total.toLocaleString()}`;
    } else {
        document.getElementById('total-price-display').innerText = total.toLocaleString();
    }
}

// ... Qolgan admin funksiyalari (resetAdminForm, editProduct va h.k.) o'zgarishsiz qoladi ...
