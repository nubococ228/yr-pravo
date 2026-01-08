// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDcG4kW07VYyAXTCcQzl4VpO3RpYDXD-DY",
    authDomain: "yr-pravo.firebaseapp.com",
    databaseURL: "https://yr-pravo-default-rtdb.firebaseio.com",
    projectId: "yr-pravo",
    storageBucket: "yr-pravo.firebasestorage.app",
    messagingSenderId: "753874874006",
    appId: "1:753874874006:web:1f74173ba7cf10e66c9cb7",
    measurementId: "G-VM3HFN2LNL"
};

// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.database();
} catch (e) {
    console.error("Firebase не подключен!", e);
}

const TARGET_COORDS = { lat: 42.8349, lon: 74.5520 };
const MAX_DIST = 500; 
const _0x_ap = "Lalka5467"; 

let GROUPS_DATA = {}; 
let SCHEDULE_DATA = {}; 
let currentUser = localStorage.getItem('user_id');
let currentGroup = localStorage.getItem('user_group');

// Вспомогательная функция для даты
function getFormattedDate(dateObj = new Date()) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}_${m}_${y}`;
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    
    const dateInput = document.getElementById('view-date-select');
    if (dateInput) {
        const now = new Date();
        dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    renderAuthBlock();
    loadCloudData();
});

// --- НАВИГАЦИЯ (LUMA STYLE) ---
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Защита админки
            if (targetId === 'admin') {
                const p = prompt("Ключ доступа:");
                if (p !== _0x_ap) return alert("Доступ ограничен");
                renderAdminPanel(); 
            }

            // Если выбран профиль — обновляем информацию в нем
            if (targetId === 'profile') {
                renderProfileInfo();
            }

            // Переключение вкладок
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });

            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.classList.add('active');
            }

            // Подсветка иконок в меню
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            window.scrollTo(0, 0);
        };
    });
}

// --- РАБОТА С ДАННЫМИ ---
function loadCloudData() {
    if (!db) return;
    db.ref('groups_config').on('value', (snapshot) => {
        GROUPS_DATA = snapshot.val() || {};
        initGroupSelectors();
        renderAuthBlock();
        renderTable();
    });
    db.ref('schedule_config').on('value', (snapshot) => {
        SCHEDULE_DATA = snapshot.val() || {};
        if (document.getElementById('admin')) {
            renderScheduleList();
            lockUsedDays();
        }
    });
}

function initGroupSelectors() {
    const viewSelect = document.getElementById('view-group-select');
    const adminSelect = document.getElementById('schedule-group-select');
    const options = '<option value="">-- Выберите группу --</option>' + 
        Object.keys(GROUPS_DATA).map(g => `<option value="${g}">${g}</option>`).join('');
    
    if (viewSelect) viewSelect.innerHTML = options;
    if (adminSelect) adminSelect.innerHTML = options;
    if (currentGroup && viewSelect) viewSelect.value = currentGroup;
}

// --- ГЕОЛОКАЦИЯ ---
function checkLocation() {
    const status = document.getElementById('gps-status');
    if (!currentGroup) return alert("Сначала привяжите профиль в Журнале или Профиле");
    
    const now = new Date();
    let currentDay = now.getDay();
    if (currentDay === 0) currentDay = 7; 
    
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const myGroupRules = SCHEDULE_DATA[currentGroup] || [];
    let isTimeOk = false;

    myGroupRules.forEach(rule => {
        const [sH, sM] = rule.start.split(':').map(Number);
        const [eH, eM] = rule.end.split(':').map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;
        const ruleDays = rule.days.map(Number);

        if (ruleDays.includes(currentDay) && currentMin >= startMin && currentMin <= endMin) {
            isTimeOk = true;
        }
    });

    if (!isTimeOk) {
        status.innerHTML = `<span style="color:orange">⌛ Нет занятий по расписанию.</span>`;
        return;
    }

    status.innerHTML = "🛰️ <span>Связь со спутниками...</span>";

    const geoOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition((pos) => {
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, TARGET_COORDS.lat, TARGET_COORDS.lon);
        
        if (dist <= MAX_DIST) {
            const dateKey = getFormattedDate();
            db.ref(`attendance/${dateKey}/${currentUser}`).set({ 
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
            }).then(() => {
                status.innerHTML = "<span style='color:#27ae60'>✅ Успешно отмечен!</span>";
                renderTable();
                if(document.getElementById('profile').classList.contains('active')) renderProfileInfo();
            });
        } else {
            status.innerHTML = `<span style="color:#e74c3c">❌ Слишком далеко: ${Math.round(dist)}м</span>`;
        }
    }, (err) => {
        status.innerHTML = `<span style="color:red">⚠️ Ошибка GPS: ${err.message}</span>`;
    }, geoOptions);
}

// --- РЕНДЕРИНГ КОМПОНЕНТОВ ---

// НОВАЯ ФУНКЦИЯ ПРОФИЛЯ
function renderProfileInfo() {
    const container = document.getElementById('profile-info');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <p style="color:var(--text-dim); margin-bottom:20px;">Профиль не настроен</p>
                <button onclick="document.querySelector('[data-target=\\'grades\\']').click()">Перейти к настройке</button>
            </div>
        `;
        return;
    }

    // Считаем общее количество посещений в базе для этого юзера
    db.ref('attendance').once('value', (snapshot) => {
        const data = snapshot.val() || {};
        let visitCount = 0;
        Object.keys(data).forEach(date => {
            if (data[date][currentUser]) visitCount++;
        });

        container.innerHTML = `
            <div class="profile-header" style="text-align:center; margin-bottom:30px;">
                <h2 style="margin-bottom:5px; font-size: 1.8rem;">${currentUser}</h2>
                <p style="color:var(--gold); font-size:0.75rem; letter-spacing:2px; text-transform:uppercase;">Студент Юридического Факультета</p>
            </div>

            <div class="stats-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:30px;">
                <div class="card" style="margin-bottom:0; text-align:center; padding:20px; background: rgba(255,255,255,0.03);">
                    <span style="display:block; font-size:1.4rem; font-weight:700; color:var(--accent);">${currentGroup}</span>
                    <span style="font-size:0.65rem; color:var(--text-dim); letter-spacing:1px;">ГРУППА</span>
                </div>
                <div class="card" style="margin-bottom:0; text-align:center; padding:20px; background: rgba(255,255,255,0.03);">
                    <span style="display:block; font-size:1.4rem; font-weight:700; color:#27ae60;">${visitCount}</span>
                    <span style="font-size:0.65rem; color:var(--text-dim); letter-spacing:1px;">ВИЗИТОВ</span>
                </div>
            </div>

            <div class="info-list" style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 10px 20px;">
                <div style="display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px solid var(--border);">
                    <span style="color:var(--text-dim); font-size:0.9rem;">Статус допуска</span>
                    <span style="color:#27ae60; font-size:0.9rem; font-weight:600;">Подтвержден</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:15px 0;">
                    <span style="color:var(--text-dim); font-size:0.9rem;">Системный ID</span>
                    <span style="font-family:monospace; font-size:0.9rem;">#${currentUser.charCodeAt(0)}${currentUser.length}</span>
                </div>
            </div>

            <button onclick="logout()" style="margin-top:40px; background:rgba(255, 68, 68, 0.1); color:#ff4444; border:1px solid rgba(255, 68, 68, 0.2); height: 50px; font-size: 14px;">
                ВЫЙТИ ИЗ СИСТЕМЫ
            </button>
        `;
    });
}

function renderTable() {
    const group = document.getElementById('view-group-select')?.value;
    const dateVal = document.getElementById('view-date-select')?.value;
    const body = document.getElementById('table-body');
    if (!body || !group || !dateVal) return;

    const [y, m, d] = dateVal.split('-');
    const dateKey = `${d}_${m}_${y}`;

    db.ref(`attendance/${dateKey}`).on('value', (snapshot) => {
        const att = snapshot.val() || {};
        body.innerHTML = "";
        if (GROUPS_DATA[group]) {
            GROUPS_DATA[group].forEach(s => {
                const present = att[s];
                body.innerHTML += `
                    <tr>
                        <td>${s}</td>
                        <td style="color:${present ? '#27ae60' : '#e74c3c'}; font-weight:bold;">
                            ${present ? '✅ ' + present.time : '❌'}
                        </td>
                    </tr>`;
            });
        }
    });
}

function renderAuthBlock() {
    const container = document.getElementById('auth-block');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = `
            <select id="setup-group" onchange="updateStudentList()" style="margin-bottom:10px;">
                <option value="">-- Выберите группу --</option>
                ${Object.keys(GROUPS_DATA).map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
            <select id="setup-student" disabled style="margin-bottom:15px;">
                <option value="">-- Сначала выберите группу --</option>
            </select>
            <button onclick="saveUser()">Привязать это устройство</button>
            <p style="font-size:11px; color:var(--text-dim); margin-top:10px; text-align:center;">Привязка необходима для автоматического учета посещаемости.</p>
        `;
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding: 10px 0;">
                <p style="margin-bottom:20px; font-size: 1.1rem;">Студент: <b>${currentUser}</b></p>
                <button onclick="checkLocation()" style="box-shadow: 0 4px 15px rgba(255,255,255,0.1);">ОТМЕТИТЬСЯ НА ЗАНЯТИИ</button>
                <p id="gps-status" style="margin-top:20px; min-height: 24px; font-size: 0.9rem;"></p>
            </div>
        `;
    }
}

function updateStudentList() {
    const group = document.getElementById('setup-group').value;
    const sSelect = document.getElementById('setup-student');
    if (!sSelect) return;
    sSelect.innerHTML = '<option value="">-- Кто вы? --</option>';
    if (group && GROUPS_DATA[group]) {
        GROUPS_DATA[group].forEach(s => sSelect.innerHTML += `<option value="${s}">${s}</option>`);
        sSelect.disabled = false;
    }
}

function saveUser() {
    const g = document.getElementById('setup-group').value;
    const s = document.getElementById('setup-student').value;
    if (g && s) {
        localStorage.setItem('user_id', s);
        localStorage.setItem('user_group', g);
        location.reload();
    } else {
        alert("Выберите группу и имя!");
    }
}

function logout() { 
    if(confirm("Вы уверены, что хотите сбросить профиль?")) {
        localStorage.clear(); 
        location.reload(); 
    }
}

// --- АДМИН-ПАНЕЛЬ ---
function renderAdminPanel() {
    const container = document.getElementById('admin-container');
    if (!container) return;

    container.innerHTML = `
        <section id="admin" class="tab-content">
            <div class="card">
                <h2>Настройка расписания</h2>
                <select id="schedule-group-select" onchange="lockUsedDays()"></select>
                <div id="days-container" style="display:flex; gap:8px; flex-wrap:wrap; margin:15px 0;">
                    ${[1,2,3,4,5,6].map(d => `<label class="day-label" style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; cursor:pointer;"><input type="checkbox" class="day-check" value="${d}"> ${['Пн','Вт','Ср','Чт','Пт','Сб'][d-1]}</label>`).join('')}
                </div>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="flex:1"><small>Начало</small><input type="time" id="sched-start" value="09:00"></div>
                    <div style="flex:1"><small>Конец</small><input type="time" id="sched-end" value="10:30"></div>
                </div>
                <button onclick="addScheduleRule()">Добавить правило</button>
                <div id="current-schedule-list" style="margin-top:20px;"></div>
                <hr style="border:0; border-top:1px solid var(--border); margin:25px 0;">
                <h2>Редактор групп</h2>
                <textarea id="raw-data-input" style="height:150px; font-family:monospace; font-size:12px;" placeholder="# Группа\\nИмя1\\nИмя2"></textarea>
                <button onclick="saveGroupsOnly()" style="background:var(--gold); color:#000;">Сохранить список групп</button>
            </div>
        </section>
    `;
    
    initGroupSelectors();
    renderScheduleList();
    
    const adminInput = document.getElementById('raw-data-input');
    if (adminInput && Object.keys(GROUPS_DATA).length > 0) {
        let text = "";
        for (let g in GROUPS_DATA) text += `# ${g}\n${GROUPS_DATA[g].join('\n')}\n\n`;
        adminInput.value = text.trim();
    }
}

function addScheduleRule() {
    const group = document.getElementById('schedule-group-select').value;
    const start = document.getElementById('sched-start').value;
    const end = document.getElementById('sched-end').value;
    const days = Array.from(document.querySelectorAll('.day-check:checked')).map(c => c.value);

    if (!group || days.length === 0) return alert("Выберите группу и дни!");

    if (!SCHEDULE_DATA[group]) SCHEDULE_DATA[group] = [];
    SCHEDULE_DATA[group].push({ days, start, end });

    db.ref('schedule_config').set(SCHEDULE_DATA).then(() => {
        alert("Правило добавлено");
        renderScheduleList();
    });
}

function renderScheduleList() {
    const list = document.getElementById('current-schedule-list');
    if (!list) return;
    list.innerHTML = "<h4>Текущие правила:</h4>";
    for (let group in SCHEDULE_DATA) {
        SCHEDULE_DATA[group].forEach((rule, index) => {
            list.innerHTML += `<div style="font-size:12px; border:1px solid var(--border); padding:12px; margin-top:8px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b>${group}</b>: ${rule.days.map(d => ['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d]).join(', ')}<br>
                    <span style="color:var(--text-dim)">${rule.start} — ${rule.end}</span>
                </div>
                <button onclick="deleteRule('${group}', ${index})" style="width:auto; height:30px; padding:0 10px; background:#ff4444; color:white; font-size:10px;">Удалить</button>
            </div>`;
        });
    }
}

function deleteRule(group, index) {
    SCHEDULE_DATA[group].splice(index, 1);
    if (SCHEDULE_DATA[group].length === 0) delete SCHEDULE_DATA[group];
    db.ref('schedule_config').set(SCHEDULE_DATA);
}

function saveGroupsOnly() {
    const input = document.getElementById('raw-data-input').value;
    const newData = {};
    let activeG = "";
    input.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('#')) {
            activeG = line.replace('#', '').trim();
            newData[activeG] = [];
        } else if (activeG && line) {
            newData[activeG].push(line);
        }
    });
    db.ref('groups_config').set(newData).then(() => alert("Список групп обновлен!"));
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function lockUsedDays() {} // Заглушка
