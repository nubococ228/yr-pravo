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

// Инициализация
try {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.database();
} catch (e) {
    console.error("Firebase не подключен!");
}

const TARGET_COORDS = { lat: 42.83761, lon: 74.59635 }; 
const MAX_DIST = 500; 

const _0x_ap = "Lalka5467"; 

let GROUPS_DATA = {}; 
let SCHEDULE_DATA = {}; 
let currentUser = localStorage.getItem('user_id');
let currentGroup = localStorage.getItem('user_group');

function getFormattedDate(dateObj = new Date()) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}_${m}_${y}`;
}

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

function setupNavigation() {
    const burger = document.getElementById('burger-menu');
    const sidebar = document.getElementById('sidebar');
    if (burger) burger.onclick = () => sidebar.classList.toggle('active');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            if (targetId === 'admin') {
                const p = prompt("Ключ доступа:");
                if (p !== _0x_ap) return alert("Доступ ограничен");
                renderAdminPanel(); 
            }

            document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
            const targetElement = document.getElementById(targetId);
            if(targetElement) targetElement.classList.add('active');
            if (sidebar) sidebar.classList.remove('active');
        };
    });
}

// ФУНКЦИЯ БЛОКИРОВКИ ЗАНЯТЫХ ДНЕЙ
function lockUsedDays() {
    const group = document.getElementById('schedule-group-select')?.value;
    const checkboxes = document.querySelectorAll('.day-check');
    const labels = document.querySelectorAll('.day-label');
    
    // Сброс состояния
    checkboxes.forEach(cb => {
        cb.disabled = false;
        cb.checked = false;
    });
    labels.forEach(l => {
        l.style.opacity = "1";
        l.style.pointerEvents = "auto";
        l.style.textDecoration = "none";
    });

    if (!group || !SCHEDULE_DATA[group]) return;

    // Собираем все дни, которые уже есть в расписании для этой группы
    let takenDays = [];
    SCHEDULE_DATA[group].forEach(rule => {
        if (Array.isArray(rule.days)) {
            takenDays = takenDays.concat(rule.days.map(String));
        } else {
            takenDays.push(String(rule.days));
        }
    });

    // Блокируем занятые
    checkboxes.forEach((cb, index) => {
        if (takenDays.includes(String(cb.value))) {
            cb.disabled = true;
            labels[index].style.opacity = "0.3";
            labels[index].style.pointerEvents = "none";
            labels[index].style.textDecoration = "line-through";
        }
    });
}

function renderAdminPanel() {
    const container = document.getElementById('admin-container');
    if (!container) return;

    container.innerHTML = `
        <section id="admin" class="tab-content active">
            <div class="card">
                <h2>📅 Расписание занятий</h2>
                <div id="schedule-setup" style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; margin-bottom: 25px; border: 1px solid rgba(184, 134, 11, 0.3);">
                    <label style="color:var(--gold); display:block; margin-bottom:5px;">Группа:</label>
                    <select id="schedule-group-select" onchange="lockUsedDays()" style="width: 100%; margin-bottom: 15px;"></select>
                    
                    <label style="color:var(--gold); display:block; margin-bottom:5px;">Дни недели (занятые дни зачеркнуты):</label>
                    <div id="days-container" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;">
                        <label class="day-label"><input type="checkbox" class="day-check" value="1"> Пн</label>
                        <label class="day-label"><input type="checkbox" class="day-check" value="2"> Вт</label>
                        <label class="day-label"><input type="checkbox" class="day-check" value="3"> Ср</label>
                        <label class="day-label"><input type="checkbox" class="day-check" value="4"> Чт</label>
                        <label class="day-label"><input type="checkbox" class="day-check" value="5"> Пт</label>
                        <label class="day-label"><input type="checkbox" class="day-check" value="6"> Сб</label>
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <div style="flex:1">
                            <label style="font-size:0.8rem">Начало:</label>
                            <input type="time" id="sched-start" value="09:00">
                        </div>
                        <div style="flex:1">
                            <label style="font-size:0.8rem">Конец:</label>
                            <input type="time" id="sched-end" value="10:30">
                        </div>
                    </div>
                    <button onclick="addScheduleRule()" style="width: 100%;">Добавить окно в базу</button>
                </div>
                <div id="current-schedule-list"></div>
                <hr style="margin: 30px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">
                <h2>👥 Состав групп</h2>
                <textarea id="raw-data-input" style="width: 100%; height: 200px; background:#000; color:#27ae60; font-family: monospace;"></textarea>
                <button onclick="saveGroupsOnly()" style="margin-top: 15px; width: 100%; background: #27ae60;">💾 Сохранить студентов</button>
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
            lockUsedDays(); // Перепроверяем блокировку при обновлении данных
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

function addScheduleRule() {
    const group = document.getElementById('schedule-group-select').value;
    const start = document.getElementById('sched-start').value;
    const end = document.getElementById('sched-end').value;
    const days = Array.from(document.querySelectorAll('.day-check:checked')).map(c => c.value);

    if (!group || days.length === 0) return alert("Заполните группу и выберите дни!");

    if (!SCHEDULE_DATA[group]) SCHEDULE_DATA[group] = [];
    SCHEDULE_DATA[group].push({ days, start, end });

    db.ref('schedule_config').set(SCHEDULE_DATA).then(() => {
        alert("Расписание обновлено!");
        lockUsedDays(); // Сбрасываем и блокируем заново
        renderScheduleList();
    }).catch(e => alert("Ошибка сохранения: " + e.message));
}

function renderScheduleList() {
    const list = document.getElementById('current-schedule-list');
    if (!list) return;
    list.innerHTML = "<h3 style='color:var(--gold); font-size:1.1rem;'>Текущие правила:</h3>";
    
    const dayNames = { "1":"Пн", "2":"Вт", "3":"Ср", "4":"Чт", "5":"Пт", "6":"Сб", "7":"Вс" };

    for (let group in SCHEDULE_DATA) {
        SCHEDULE_DATA[group].forEach((rule, index) => {
            const daysTxt = rule.days.map(d => dayNames[d] || d).join(', ');
            list.innerHTML += `
                <div style="background: rgba(255,255,255,0.05); margin: 8px 0; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                    <span><b>${group}</b>: ${daysTxt} <br><small>${rule.start} - ${rule.end}</small></span>
                    <button onclick="deleteRule('${group}', ${index})" style="background:#e74c3c; padding: 5px 10px; height:auto; min-width:auto; border:none; border-radius:5px; color:white;">Удалить</button>
                </div>`;
        });
    }
}

function deleteRule(group, index) {
    if(!confirm("Удалить это правило?")) return;
    SCHEDULE_DATA[group].splice(index, 1);
    if (SCHEDULE_DATA[group].length === 0) delete SCHEDULE_DATA[group];
    db.ref('schedule_config').set(SCHEDULE_DATA).then(() => {
        lockUsedDays();
    });
}

function checkLocation() {
    const status = document.getElementById('gps-status');
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const myGroupRules = SCHEDULE_DATA[currentGroup] || [];
    let isTimeOk = false;

    myGroupRules.forEach(rule => {
        const [sH, sM] = rule.start.split(':').map(Number);
        const [eH, eM] = rule.end.split(':').map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;
        if (rule.days.includes(String(currentDay)) && currentMin >= startMin && currentMin <= endMin) isTimeOk = true;
    });

    if (!isTimeOk) {
        status.innerHTML = `<span style="color:orange">⌛ По расписанию у группы ${currentGroup} сейчас нет занятий.</span>`;
        return;
    }

    status.innerText = "Сверка GPS...";
    navigator.geolocation.getCurrentPosition((pos) => {
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, TARGET_COORDS.lat, TARGET_COORDS.lon);
        if (dist <= MAX_DIST) {
            const dateKey = getFormattedDate();
            db.ref(`attendance/${dateKey}/${currentUser}`).set({ 
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
            }).then(() => {
                status.innerHTML = "<span style='color:green'>✅ Успешно!</span>";
                renderTable();
            });
        } else {
            status.innerHTML = `❌ Вы слишком далеко (${Math.round(dist)}м)`;
        }
    }, (err) => alert("Включите геолокацию!"), { enableHighAccuracy: true });
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
            <select id="setup-group" onchange="updateStudentList()" style="width:100%; padding:10px;">
                <option value="">-- Группа --</option>
                ${Object.keys(GROUPS_DATA).map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
            <select id="setup-student" disabled style="width:100%; padding:10px; margin-top:10px;">
                <option value="">-- Имя --</option>
            </select>
            <button onclick="saveUser()" style="margin-top:15px; width:100%;">Привязать устройство</button>
        `;
    } else {
        container.innerHTML = `
            <p>Студент: <b>${currentUser}</b></p>
            <button onclick="checkLocation()" style="width:100%; padding:15px; background:linear-gradient(45deg, #b8860b, #8b6508); color:white; border-radius:8px; border:none; font-weight:bold;">ОТМЕТИТЬСЯ</button>
            <p id="gps-status" style="margin-top:10px; text-align:center; font-weight:bold;"></p>
            <button onclick="logout()" style="background:none; border:none; color:#666; font-size:10px; cursor:pointer; margin-top:10px;">Сбросить профиль</button>
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
    }
}

function logout() { localStorage.clear(); location.reload(); }

function saveGroupsOnly() {
    const input = document.getElementById('raw-data-input')?.value;
    if (!input) return;
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
    db.ref('groups_config').set(newData).then(() => alert("Сохранено!"));
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}