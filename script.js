document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------
    // DOM Helpers
    // ------------------------------
    const $ = id => document.getElementById(id);

    // Views
    const formView = $('form-view');
    const preservedView = $('preserved-view');
    const unlockedView = $('unlocked-view');
    const allViews = [formView, preservedView, unlockedView];

    // Navbar
    const hamburgerBtn = $('hamburger-btn');
    const navbarMenu = $('navbar-menu');
    const addNewCapsuleBtn = $('add-new-capsule-btn');
    const preservedCapsulesBtn = $('preserved-capsules-btn');
    const backToListBtn = $('back-to-list-btn');

    // Live Info
    const weatherInfoEl = $('weather-info');
    const currentDateEl = $('current-date');
    const currentTimeEl = $('current-time');

    // Form Elements
    const capsuleForm = $('capsule-form');
    const formTitle = $('form-title');
    const formSubmitBtn = $('form-submit-btn');
    const capsuleIdInput = $('capsule-id');
    const capsuleTitleInput = $('capsule-title');
    const messageInput = $('message');
    const unlockDateInput = $('unlock-date');

    // List & Unlocked View
    const capsuleList = $('capsule-list');
    const emptyVaultMessage = $('empty-vault-message');
    const createFirstCapsuleBtn = $('create-first-capsule-btn');
    const unlockedTitleDisplay = $('capsule-title-display');
    const unlockedMessageDisplay = $('unlocked-message');
    const sealedDateDisplay = $('sealed-date-display');
    const sealedLocationDisplay = $('sealed-location-display');
    
    const toast = $('toast-notification');

    // Canvas
    const canvas = $('particle-canvas');
    const ctx = canvas.getContext('2d');

    // State
    const CAPSULES_KEY = 'chronoVaultCapsules';
    let masterCountdown = null;
    let particles = [];
    // UPDATED PARTICLE COLORS to match the new Nebula Glow theme
    const COLORS = ['#f72585', '#4cc9f0', '#ffd60a'];

    // ------------------------------
    // Mobile Menu Logic
    // ------------------------------
    function toggleMenu() {
        const isExpanded = navbarMenu.classList.toggle('active');
        hamburgerBtn.setAttribute('aria-expanded', isExpanded);
        const icon = hamburgerBtn.querySelector('i');
        icon.classList.toggle('fa-bars', !isExpanded);
        icon.classList.toggle('fa-xmark', isExpanded);
    }
    function closeMenu() {
        if (navbarMenu.classList.contains('active')) toggleMenu();
    }

    // ------------------------------
    // Init
    // ------------------------------
    function init() {
        hamburgerBtn.addEventListener('click', toggleMenu);
        addNewCapsuleBtn.addEventListener('click', () => { showFormView(); closeMenu(); });
        preservedCapsulesBtn.addEventListener('click', () => { showPreservedView(); closeMenu(); });
        backToListBtn.addEventListener('click', showPreservedView);
        capsuleForm.addEventListener('submit', handleFormSubmit);
        capsuleList.addEventListener('click', handleListClick);
        createFirstCapsuleBtn.addEventListener('click', () => showFormView());
        window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });

        resizeCanvas();
        initParticles();
        animateCanvas();
        updateDateTime();
        setInterval(updateDateTime, 1000);
        displayWeather();

        showPreservedView();
    }

    // ------------------------------
    // Date & Time
    // ------------------------------
    function updateDateTime() {
        const now = new Date();
        currentDateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        currentTimeEl.textContent = now.toLocaleTimeString();
    }

    // ------------------------------
    // Weather
    // ------------------------------
    function getWeatherDescription(code) {
        const map = {
            0: { description: "Clear sky", icon: "fa-sun" },
            1: { description: "Mainly clear", icon: "fa-cloud-sun" },
            2: { description: "Partly cloudy", icon: "fa-cloud-sun" },
            3: { description: "Overcast", icon: "fa-cloud" },
            45: { description: "Fog", icon: "fa-smog" },
            48: { description: "Rime fog", icon: "fa-smog" },
            51: { description: "Light drizzle", icon: "fa-cloud-rain" },
            61: { description: "Slight rain", icon: "fa-cloud-showers-heavy" },
            95: { description: "Thunderstorm", icon: "fa-cloud-bolt" }
        };
        return map[code] || { description: "Weather unavailable", icon: "fa-question-circle" };
    }
    async function displayWeather() {
        try {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
            const { latitude, longitude } = pos.coords;
            const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            if (!resp.ok) throw new Error('Weather fetch failed');
            const data = await resp.json();
            const { temperature, weathercode } = data.current_weather;
            const { icon } = getWeatherDescription(weathercode);
            weatherInfoEl.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${Math.round(temperature)}°C</span>`;
        } catch {
            weatherInfoEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Weather N/A</span>`;
        }
    }

    // ------------------------------
    // Local Storage Helpers
    // ------------------------------
    const getCapsules = () => JSON.parse(localStorage.getItem(CAPSULES_KEY)) || [];
    const saveCapsules = capsules => localStorage.setItem(CAPSULES_KEY, JSON.stringify(capsules));

    // ------------------------------
    // Views
    // ------------------------------
    function showView(view) { allViews.forEach(v => v.classList.add('hidden')); view.classList.remove('hidden'); }
    function showPreservedView() { renderCapsules(); showView(preservedView); }
    function showFormView(capsule = null) {
        capsuleForm.reset();
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 1);
        unlockDateInput.min = now.toISOString().slice(0, 16);

        if (capsule) {
            formTitle.textContent = 'Edit Time Capsule ✏️';
            formSubmitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Update Capsule';
            capsuleIdInput.value = capsule.id;
            capsuleTitleInput.value = capsule.title;
            messageInput.value = capsule.message;
            unlockDateInput.value = new Date(capsule.unlockTime).toISOString().slice(0, 16);
        } else {
            formTitle.textContent = 'Seal a New Time Capsule 🔐';
            formSubmitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Seal Capsule';
            capsuleIdInput.value = '';
        }
        showView(formView);
    }

    // ------------------------------
    // Capsule List & CRUD
    // ------------------------------
    function renderCapsules() {
        const capsules = getCapsules();
        capsuleList.innerHTML = ''; // Always clear the list

        if (capsules.length === 0) {
            emptyVaultMessage.classList.remove('hidden');
        } else {
            emptyVaultMessage.classList.add('hidden');
            capsules.sort((a, b) => a.unlockTime - b.unlockTime).forEach(capsule => {
                const isUnlocked = Date.now() >= capsule.unlockTime;
                const card = document.createElement('div');
                card.className = 'capsule-card';
                card.dataset.id = capsule.id;
                card.dataset.unlockTime = capsule.unlockTime;
                card.innerHTML = `
                    <div class="card-header">
                        <h3>${capsule.title}</h3>
                        <i class="fa-solid ${isUnlocked ? 'fa-lock-open' : 'fa-lock'}" title="${isUnlocked ? 'Ready' : 'Sealed'}"></i>
                    </div>
                    <p class="unlock-info">Unlocks: ${new Date(capsule.unlockTime).toLocaleString()}</p>
                    ${!isUnlocked ? `<div class="countdown-timer"><span class="days">00</span>d <span class="hours">00</span>h <span class="minutes">00</span>m <span class="seconds">00</span>s</div>` : '<p class="unlocked-note">Memory ready to revisit</p>'}
                    <div class="card-footer">
                        ${isUnlocked ? `<button class="btn open-btn" data-action="open"><i class="fa-solid fa-book-open"></i> Read</button>` : `<button class="card-btn edit-btn" data-action="edit" title="Edit"><i class="fa-solid fa-pencil"></i></button>`}
                        <button class="card-btn delete-btn" data-action="delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
                capsuleList.appendChild(card);
            });
        }
        startMasterCountdown();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const id = capsuleIdInput.value;
        const title = capsuleTitleInput.value.trim();
        const message = messageInput.value.trim();
        const unlockTime = new Date(unlockDateInput.value).getTime();

        if (!title || !message || isNaN(unlockTime) || unlockTime <= Date.now()) {
            showToast("Please complete all fields with a valid future date.", "error");
            return;
        }

        let capsules = getCapsules();
        if (id) {
            const idx = capsules.findIndex(c => c.id === id);
            if (idx > -1) Object.assign(capsules[idx], { title, message, unlockTime });
            showToast("Capsule updated successfully!");
        } else {
            const newCapsule = {
                id: `cap_${Date.now()}`,
                title,
                message,
                unlockTime,
                sealedTime: Date.now(),
                location: await getGeolocation()
            };
            capsules.push(newCapsule);
            showToast("Capsule sealed and sent to the future!");
        }
        saveCapsules(capsules);
        showPreservedView();
    }

    function handleListClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const card = btn.closest('.capsule-card');
        const id = card.dataset.id;
        const capsules = getCapsules();
        const capsule = capsules.find(c => c.id === id);
        if (!capsule) return;

        if (action === 'edit') showFormView(capsule);
        else if (action === 'delete') {
            if (confirm(`Delete "${capsule.title}" permanently?`)) {
                saveCapsules(capsules.filter(c => c.id !== id));
                renderCapsules();
                showToast("Capsule deleted.", "error");
            }
        } else if (action === 'open') {
            unlockedTitleDisplay.textContent = capsule.title;
            unlockedMessageDisplay.textContent = capsule.message;
            sealedDateDisplay.textContent = new Date(capsule.sealedTime).toLocaleString();
            sealedLocationDisplay.textContent = capsule.location || 'Unknown';
            showView(unlockedView);
        }
    }

    function startMasterCountdown() {
        if (masterCountdown) clearInterval(masterCountdown);
        masterCountdown = setInterval(updateCountdowns, 1000);
    }
    function updateCountdowns() {
        document.querySelectorAll('.capsule-card[data-unlock-time]').forEach(card => {
            const unlockTime = parseInt(card.dataset.unlockTime, 10);
            const now = Date.now();
            if (now >= unlockTime) { renderCapsules(); return; }
            const dist = unlockTime - now;
            const days = Math.floor(dist / (1000 * 60 * 60 * 24));
            const hours = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((dist % (1000 * 60)) / 1000);
            card.querySelector('.days').textContent = String(days).padStart(2,'0');
            card.querySelector('.hours').textContent = String(hours).padStart(2,'0');
            card.querySelector('.minutes').textContent = String(minutes).padStart(2,'0');
            card.querySelector('.seconds').textContent = String(seconds).padStart(2,'0');
        });
    }

    function showToast(msg, type='success') {
        toast.textContent = msg;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    async function getGeolocation() {
        return new Promise(res => {
            if (!navigator.geolocation) return res('Unknown');
            navigator.geolocation.getCurrentPosition(pos => {
                res(`[${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}]`);
            }, () => res('Denied'), { timeout: 5000 });
        });
    }

    // ------------------------------
    // Particle Background - NEW Constellation Effect
    // ------------------------------
    let mouse = {
        x: undefined,
        y: undefined,
    };

    window.addEventListener('mousemove', (event) => {
        mouse.x = event.x;
        mouse.y = event.y;
    });
    
    window.addEventListener('mouseout', () => {
        mouse.x = undefined;
        mouse.y = undefined;
    });

    function resizeCanvas() { 
        canvas.width = window.innerWidth; 
        canvas.height = window.innerHeight; 
    }

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2.5 + 1;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        }
        update() {
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            this.x += this.speedX;
            this.y += this.speedY;

            // Interaction with mouse
            if (mouse.x !== undefined) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 100) { // push away
                    this.x += dx / 20;
                    this.y += dy / 20;
                }
            }
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function initParticles() {
        particles = [];
        const count = Math.floor((canvas.width * canvas.height) / 18000);
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function connectParticles() {
        const maxDistance = 130;
        for (let a = 0; a < particles.length; a++) {
            for (let b = a; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x;
                const dy = particles[a].y - particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = 1 - (distance / maxDistance);
                    ctx.strokeStyle = `rgba(139, 148, 158, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animateCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        connectParticles();
        requestAnimationFrame(animateCanvas);
    }

    init();
});

