document.addEventListener('DOMContentLoaded', () => {

    const loginModal = document.getElementById('admin-login-modal');
    const loginBtn = document.getElementById('admin-login-btn');
    const passInput = document.getElementById('admin-pass-input');
    const errorMsg = document.getElementById('admin-error-msg');
    const appsContainer = document.getElementById('applications-container');
    const searchInput = document.getElementById('search-input');

    let allApplications = [];

    // Simple Authentication
    loginBtn.addEventListener('click', () => {
        const pass = passInput.value;
        if (pass === 'electro2006') { // Hardcoded password as per plan
            loginModal.style.display = 'none';
            loadApplications();
        } else {
            errorMsg.style.display = 'block';
        }
    });

    passInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    // Fetch and display applications
    async function loadApplications() {
        try {
            const res = await fetch('/api/applications');
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            allApplications = data;

            renderApplications(allApplications);

        } catch (err) {
            appsContainer.innerHTML = '<p style="text-align: center; color: #ff4757; font-size: 1.2rem;">حدث خطأ في تحميل الطلبات. تواصل مع الدعم الفني أو تأكد من تشغيل الخادم.</p>';
        }
    }

    function renderApplications(data) {
        if (data.length === 0) {
            appsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 1.2rem;">لا توجد أي طلبات متطابقة.</p>';
            return;
        }

        appsContainer.innerHTML = '';
        data.forEach(app => {
            const date = new Date(app.created_at).toLocaleString('ar-EG');

            let translateExp = app.experience;
            if (app.experience === 'beginner') translateExp = 'مبتدئ';
            if (app.experience === 'intermediate') translateExp = 'متوسط';
            if (app.experience === 'advanced') translateExp = 'خبير';

            const card = document.createElement('div');
            card.className = 'app-card';
            card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
                        <div>
                            <h3>الاسم: ${app.name}</h3>
                            <p><strong>حساب الديسكورد:</strong> ${app.discordUsername || 'غير معروف'} (${app.discordId})</p>
                            <p><strong>العمر:</strong> ${app.age}</p>
                            <p><strong>الخبرة:</strong> ${translateExp}</p>
                            <p><strong>تاريخ التقديم:</strong> <span dir="ltr">${date}</span></p>
                        </div>
                        <div>
                            <span class="status-badge status-${app.status}" id="status-badge-${app.id}">
                                ${app.status === 'pending' ? 'في الانتظار' : (app.status === 'approved' ? 'مقبول' : (app.status === 'banned' ? 'محظور' : 'مرفوض'))}
                            </span>
                        </div>
                    </div>
                    <hr style="border-color: var(--border-color); margin: 15px 0;">
                    <p><strong>سبب الانضمام:</strong></p>
                    <p style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">${app.reason}</p>
                    <p><strong>قصة الشخصية:</strong></p>
                    <p style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; white-space: pre-wrap;">${app.story}</p>
                    
                    <div class="admin-buttons">
                        <button class="btn btn-primary btn-sm update-status-btn" data-id="${app.id}" data-status="approved" style="background-color: #2ed573;">قبول</button>
                        <button class="btn btn-primary btn-sm update-status-btn" data-id="${app.id}" data-status="rejected" style="background-color: #ff4757;">رفض</button>
                        <button class="btn btn-primary btn-sm update-status-btn" data-id="${app.id}" data-status="banned" style="background-color: #576574;">حظر</button>
                    </div>
                `;
            appsContainer.appendChild(card);
        });

        // Add event listeners for status buttons
        document.querySelectorAll('.update-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const status = e.target.getAttribute('data-status');

                const statusText = status === 'approved' ? 'قبول' : (status === 'banned' ? 'حظر' : 'رفض');
                const confirmed = confirm(`هل أنت متأكد أنك تريد ${statusText} هذا الطلب؟`);
                if (confirmed) {
                    try {
                        const updateRes = await fetch(`/api/applications/${id}/status`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status })
                        });

                        if (updateRes.ok) {
                            const badge = document.getElementById(`status-badge-${id}`);
                            badge.className = `status-badge status-${status}`;
                            badge.innerText = status === 'approved' ? 'مقبول' : (status === 'banned' ? 'محظور' : 'مرفوض');
                        } else {
                            alert('حدث خطأ أثناء تحديث الحالة.');
                        }
                    } catch (err) {
                        alert('فعل الاتصال بالخادم.');
                    }
                }
            });
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderApplications(allApplications);
            } else {
                const filtered = allApplications.filter(app =>
                    (app.discordUsername && app.discordUsername.toLowerCase().includes(query)) ||
                    (app.discordId && app.discordId.includes(query)) ||
                    (app.name && app.name.toLowerCase().includes(query))
                );
                renderApplications(filtered);
            }
        });
    }
});
