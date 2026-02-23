// 1. O'zgaruvchilarni eng tepada e'lon qilamiz (Xatoni oldini olish uchun)
let selectedImageBase64 = ""; 
let products = [];
let categories = [];
let cart = {};

// 2. Firebase Sozlamalari
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

// 3. Telegram WebApp xavfsiz chaqirish
let tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
    tg.expand();
}

// 4. ONLAYN MA'LUMOTLARNI YUKLASH
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
}

// 5. MAHSULOT QO'SHISH
function addNewProduct() {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const cat = document.getElementById('p-cat-select').value;

    if(name && price && selectedImageBase64) {
        database.ref('products').push({
            id: Date.now(),
            name: name,
            price: parseInt(price),
            cat: cat,
            img: selectedImageBase64
        }).then(() => {
            document.getElementById('p-name').value = "";
            document.getElementById('p-price').value = "";
            document.getElementById('image-preview').style.display = "none";
            selectedImageBase64 = "";
            alert("Mahsulot qo'shildi!");
        }).catch(err => alert("Xato: " + err.message));
    } else {
        alert("Rasm tanlang va barcha maydonlarni to'ldiring!");
    }
}

// 6. TOIFA QO'SHISH
function addNewCategory() {
    const cat = document.getElementById('new-cat-input').value;
    if(cat && !categories.includes(cat)) {
        categories.push(cat);
        database.ref('categories').set(categories);
        document.getElementById('new-cat-input').value = "";
    }
}

// Rasm o'quvchi (Tepadagi o'zgaruvchidan foydalanadi)
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
    init(); // Hamma narsa tayyor bo'lgach bazani yuklash
});

// Qolgan UI funksiyalari (Admin Panel ochish, o'chirish va h.k.)
function openAdmin() { document.getElementById('admin-modal').style.display = 'block'; }
function closeAdmin() { document.getElementById('admin-modal').style.display = 'none'; }
function showTab(id) {
    document.querySelectorAll('.tab-body').forEach(b => b.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function renderProducts() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = "";
    products.forEach(p => {
        grid.innerHTML += `
        <div class="item">
            <img src="${p.img}" class="img">
            <p class="name">${p.name}</p>
            <p class="price">${p.price.toLocaleString()} so'm</p>
        </div>`;
    });
}

function renderCategories() {
    const select = document.getElementById('p-cat-select');
    if (!select) return;
    select.innerHTML = "";
    categories.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

function updateAdminLists() {
    const pList = document.getElementById('admin-prod-list');
    if (!pList) return;
    pList.innerHTML = "";
    products.forEach(p => {
        pList.innerHTML += `<div class="admin-item"><span>${p.name}</span> <button onclick="deleteProduct('${p.fbKey}')" style="color:red; background:none; border:none;">🗑</button></div>`;
    });
}

function deleteProduct(fbKey) {
    if(confirm("O'chirilsinmi?")) database.ref('products/' + fbKey).remove();
}
