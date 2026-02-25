// ... Firebase Config va Global o'zgaruvchilar o'zgarishsiz qoladi ...

// KATEGORIYANI Firebase-ga QO'SHISH
function addNewCategory() {
    const input = document.getElementById('new-cat-input');
    const name = input.value.trim();
    if (name) {
        database.ref('categories').push(name).then(() => {
            input.value = "";
            tg.showAlert("Qo'shildi!");
        });
    }
}

// ADMIN PANELDA KATEGORIYALAR RO'YXATINI CHIQARISH
function renderAdminCategories() {
    const list = document.getElementById('admin-cat-list');
    if (!list) return;
    list.innerHTML = "";
    categories.forEach((c) => {
        if(c === "Barchasi") return;
        list.innerHTML += `
            <div class="admin-item">
                <span>${c}</span>
                <button onclick="deleteCategory('${c}')" style="color:red; border:none; background:none; font-size:18px;">🗑</button>
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

// TARIX OYNASINI BOSHQARISH
function toggleHistory() {
    const m = document.getElementById('history-modal');
    m.style.display = (m.style.display === 'block') ? 'none' : 'block';
    if(m.style.display === 'block') loadOrderHistory();
}

// FIREBASE LISTENERS YANGILANDI
function init() {
    database.ref('products').on('value', (s) => {
        const data = s.val();
        products = data ? Object.keys(data).map(k => ({...data[k], fbKey: k})) : [];
        renderProducts();
        updateAdminLists();
    });

    database.ref('categories').on('value', (s) => {
        const data = s.val();
        categories = data ? Object.values(data) : ["Barchasi"];
        if(!categories.includes("Barchasi")) categories.unshift("Barchasi");
        renderCategories();
        renderAdminCategories(); // Yangi ro'yxatni yangilash
    });
    
    // ... stats va boshqa init funksiyalari ...
}

// BARCHA MODALLARNI YOPISH FUNKSIYALARI (Xatolik bo'lmasligi uchun)
function closeAdmin() { document.getElementById('admin-modal').style.display = 'none'; }
function toggleCart() { 
    const c = document.getElementById('cart-modal');
    c.style.display = (c.style.display === 'block') ? 'none' : 'block';
}

// ... Qolgan AI, Checkout va Sklad funksiyalari yuqoridagi app.js bilan bir xil ...
