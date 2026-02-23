// Other existing code...

function sendOrderToTelegram() {
    // Other code...
    const reply_markup = {
        inline_keyboard: [
            [
                { text: "💬 Mijozga yozish", url: `tg://user?id=${user ? user.id : ''}` },
                { text: "✅ Qabul qilish", callback_data: "done" }
            ]
        ]
    };
    // Further code...
}