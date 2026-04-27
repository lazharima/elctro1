document.addEventListener('DOMContentLoaded', () => {
    
    // --- Loader ---
    const loader = document.getElementById('loader');
    if (loader) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500);
            }, 500); // 0.5s delay to assure visual impression
        });
    }

    // --- Navbar Sticky & Mobile Menu ---
    const navbar = document.querySelector('.navbar');
    const menuBtn = document.querySelector('.menu-btn');
    const navMenu = document.querySelector('.nav-menu');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    if (menuBtn && navMenu) {
        menuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            let icon = menuBtn.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // --- Scroll Reveal Animations ---
    const reveals = document.querySelectorAll('.reveal');
    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100;

        reveals.forEach(reveal => {
            const elementTop = reveal.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };
    
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger initially

    // --- Accordion for Rules ---
    const ruleHeaders = document.querySelectorAll('.rule-header');
    if (ruleHeaders.length > 0) {
        ruleHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                
                // Toggle open class
                const isOpen = item.classList.contains('open');
                
                // Close all other rule items
                document.querySelectorAll('.rule-item').forEach(otherItem => {
                    otherItem.classList.remove('open');
                });

                // If it wasn't open, activate it
                if (!isOpen) {
                    item.classList.add('open');
                }
            });
        });
    }

    // --- Real Authentication Check (Discord OAuth) ---
    const userArea = document.getElementById('user-area');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const whitelistForm = document.getElementById('whitelist-form');
    const notLoggedInMsg = document.getElementById('not-logged-in-msg');
    
    let currentUser = null;

    async function checkAuth() {
        try {
            const response = await fetch('/api/user');
            const data = await response.json();
            
            if (data.loggedIn) {
                currentUser = data.user;
                updateUIForLoggedInUser(data.user);
            } else {
                updateUIForLoggedOutUser();
            }
        } catch (err) {
            console.error('Auth Check Error:', err);
            updateUIForLoggedOutUser();
        }
    }

    function updateUIForLoggedInUser(user) {
        // Update Nav
        if (navLoginBtn && userArea) {
            navLoginBtn.style.display = 'none';
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
                : `https://ui-avatars.com/api/?name=${user.username}&background=39b6ff&color=fff`;
            
            userArea.innerHTML = `
                <div class="user-profile" style="display: flex; align-items: center; background: rgba(255,255,255,0.05); padding: 5px 15px; border-radius: 50px; border: 1px solid rgba(57,182,255,0.2);">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--primary);">
                    <span style="font-weight: bold; font-size: 14px; padding-right: 10px; color: #fff;">${user.global_name || user.username}</span>
                    <a href="/auth/logout" class="logout-link" title="تسجيل الخروج" style="margin-right: 10px; color: #ff4757; font-size: 14px;"><i class="fas fa-sign-out-alt"></i></a>
                </div>
            `;
        }

        // Update Whitelist Page if present - auto-fill discord fields
        if (document.getElementById('whitelist-page-marker')) {
            const discordUsernameField = document.getElementById('discord-username-field');
            const discordIdField = document.getElementById('discord-id-field');
            if (discordUsernameField) discordUsernameField.value = user.username;
            if (discordIdField) discordIdField.value = user.id;
        }
    }

    function updateUIForLoggedOutUser() {
        if (navLoginBtn) navLoginBtn.style.display = 'inline-block';
        if (userArea) userArea.innerHTML = '';


    }

    checkAuth();

    // Login Action (Redirect to server auth)
    const loginBtn = document.getElementById('discord-login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            loginBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جاري الاتصال...';
            // Browser will naturally redirect based on href in HTML
        });
    }



    if (whitelistForm) {
        whitelistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = whitelistForm.querySelector('button[type="submit"]');
            
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
            btn.disabled = true;

            const discordId = document.getElementById('discord-id-field')?.value || 'unknown';
            const discordUsername = document.getElementById('discord-username-field')?.value || 'unknown';
            const name = document.getElementById('wl-name')?.value || '';
            const age = document.getElementById('wl-age')?.value || '';
            const experience = document.getElementById('wl-experience')?.value || '';
            const reason = document.getElementById('wl-reason')?.value || '';
            const story = document.getElementById('wl-story')?.value || '';

            try {
                const response = await fetch('/api/submit-application', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discordId, discordUsername, name, age, experience, reason, story })
                });

                if (response.ok) {
                    whitelistForm.innerHTML = `
                        <div style="text-align: center; padding: 40px 0;">
                            <i class="fas fa-check-circle" style="font-size: 60px; color: #2ed573; margin-bottom: 20px;"></i>
                            <h2 style="color: #2ed573; margin-bottom: 10px;">تم إرسال طلبك بنجاح!</h2>
                            <p style="color: var(--text-muted);">سيتم مراجعة طلبك من قبل الإدارة، يرجى متابعة حالة طلبك في سيرفر الديسكورد.</p>
                            <a href="index.html" class="btn btn-primary" style="margin-top: 30px;">العودة للرئيسية</a>
                        </div>
                    `;
                } else {
                    alert('حدث خطأ أثناء إرسال الطلب، الرجاء المحاولة لاحقاً.');
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الطلب';
                    btn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                alert('فشل الاتصال بالخادم. يبدو أن الخادم لا يعمل.');
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الطلب';
                btn.disabled = false;
            }
        });
    }

    // --- Real-time Stats Integration Placeholder ---
    // If you have a specific FiveM API, we can fetch stats here
    /*
    const onlineCountEle = document.getElementById('stat-online-value');
    if (onlineCountEle) {
        fetch('https://servers-frontend.fivem.net/api/servers/single/YOUR_SERVER_ID')
          .then(res => res.json())
          .then(data => {
              onlineCountEle.innerText = data.Data.clients;
          })
          .catch(err => console.log('Error fetching stats:', err));
    }
    */
});
