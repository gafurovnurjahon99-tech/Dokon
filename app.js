// Firebase Sozlamalari
const firebaseConfig = {
  apiKey: "AIzaSyAwMERQQ9dzxrcrmsFTA7BI2Ow7SwegTL4",
  authDomain: "tg-dokon.firebaseapp.com",
  databaseURL: "https://tg-dokon-default-rtdb.firebaseio.com",
  projectId: "tg-dokon",
  storageBucket: "tg-dokon.firebasestorage.app",
  messagingSenderId: "611375396358",
  appId: "1:611375396358:web:12c2b67ad65395ad7ef587"
};

// Firebase-ni ishga tushirish
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let tg = window.Telegram.WebApp;
tg.expand();

let products = [];
let categories = [];
let cart = {};
let selectedImageBase64 = "";

// 1. ONLAYN MA'LUMOTLARNI YUKLASH
function init() {
    // Mahsulotlarni eshitish
    database.ref('products').on('value', (snapshot) => {
        const data = snapshot.val();
        products = data ? Object.keys(data).map(key => ({...data[key], fbKey: key})) : [];
        renderProducts();
        updateAdminLists();
    });

    // Toifalarni eshitish
    database.ref('categories').on('value', (snapshot) => {
        const data = snapshot.val();
        categories = data ? Object.values(data) : ["Barchasi"];
        renderCategories();
    });

    if(tg.initDataUnsafe.user) {
        document.getElementById('username').innerText = tg.initDataUnsafe.user.first_name;
    } else {
        document.getElementById('username').innerText = "Nurjahon";
    }
}

// 2. MAHSULOT QO'SHISH (FIREBASE)
function addNewProduct() {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const cat = document.getElementById('p-cat-select').value;

    if(name && price && selectedImageBase64) {
        database.ref('products').push({
            id: Date.now(),
            name,
            price: parseInt(price),
            cat,
            img: selectedImageBase64
        }).then(() => {
            document.getElementById('p-name').value = "";
            document.getElementById('p-price').value = "";
            document.getElementById('image-preview').style.display = "none";
            selectedImageBase64 = "";
            tg.showAlert("Mahsulot onlayn qo'shildi!");
        });
    } else {
        tg.showAlert("Barcha maydonlarni to'ldiring va rasm tanlang!");
    }
}

// 3. TOIFA QO'SHISH
function addNewCategory() {
    const cat = document.getElementById('new-cat-input').value;
    if(cat && !categories.includes(cat)) {
        categories.push(cat);
        database.ref('categories').set(categories);
        document.getElementById('new-cat-input').value = "";
    }
}

// 4. O'CHIRISH (FIREBASE)
function deleteProduct(fbKey) {
    if(confirm("Mahsulotni o'chirasizmi?")) {
        database.ref('products/' + fbKey).remove();
    }
}

function deleteCategory(cat) {
    if(confirm("Toifani o'chirasizmi?")) {
        let newCats = categories.filter(c => c !== cat);
        database.ref('categories').set(newCats);
    }
}

// --- UI FUNKSIYALARI ---
function renderProducts(filter = 'all') {
    const grid = document.getElementById('product-grid');
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
                    <span class="qty" id="qty-${p.id}">${cart[p.id] ? cart[p.id].qty : 0}</span>
                    <button class="step-btn" onclick="changeQty(${p.id}, 1)">+</button>
                </div>
            </div>`;
        }
    });
}

function renderCategories() {
    const list = document.getElementById('category-list');
    const select = document.getElementById('p-cat-select');
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
    const cList = document.getElementById('admin-cat-list');
    pList.innerHTML = ""; cList.innerHTML = "";
    products.forEach(p => pList.innerHTML += `<div class="admin-item"><span>${p.name}</span> <button onclick="deleteProduct('${p.fbKey}')" class="del-btn">🗑</button></div>`);
    categories.forEach(c => cList.innerHTML += `<div class="admin-item"><span>${c}</span> <button onclick="deleteCategory('${c}')" class="del-btn">🗑</button></div>`);
}

// Rasm o'quvchi
document.getElementById('p-image-input').addEventListener('change', function(e) {
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

// Admin Panel ochish/yopish
function openAdmin() { document.getElementById('admin-modal').style.display = 'block'; }
function closeAdmin() { document.getElementById('admin-modal').style.display = 'none'; }
function showTab(id) {
    document.querySelectorAll('.tab-body').forEach(b => b.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// Savat
function changeQty(id, delta) {
    let p = products.find(x => x.id === id);
    if(!cart[id]) cart[id] = { name: p.name, price: p.price, qty: 0 };
    cart[id].qty += delta;
    if(cart[id].qty <= 0) delete cart[id];
    renderProducts(); // UI-ni yangilash
    updateCartDisplay();
}

function updateCartDisplay() {
    let count = 0, total = 0;
    const list = document.getElementById('cart-items');
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

function toggleCart() {
    const m = document.getElementById('cart-modal');
    m.style.display = m.style.display === 'block' ? 'none' : 'block';
}

function checkout() {
    if(Object.keys(cart).length === 0) return tg.showAlert("Savat bo'sh!");
    tg.sendData(JSON.stringify(cart));
}

init();
