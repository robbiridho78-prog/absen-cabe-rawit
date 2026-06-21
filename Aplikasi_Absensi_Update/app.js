// STATE MANAGEMENT
let state = {
    students: [],
    classrooms: [
        { id: 'lambatan', name: 'Kelas Lambatan', materi: 'Tajwid dasar, bacaan tartil perlahan, makhorijul huruf.', guru: '' },
        { id: 'pramaja', name: 'Kelas Pramaja', materi: 'Hafalan surat-surat Juz 30, fiqih ibadah dasar, aqidah akhlak.', guru: '' },
        { id: 'paud', name: 'Kelas Paud', materi: 'Pengenalan huruf hijaiyah, mewarnai gambar islami, doa harian pendek.', guru: '' },
        { id: 'caberawit', name: 'Kelas Cabe Rawit', materi: 'Bacaan jilid Iqro, adab harian, hapalan doa sholat.', guru: '' },
        { id: 'dewasa', name: 'Kelas Dewasa', materi: 'Kajian tafsir Al-Qur\'an, fiqih muamalah, tajwid lanjutan.', guru: '' }
    ],
    attendance: {}, // format: { 'YYYY-MM-DD': { studentId: 'H'|'S'|'I'|'A' } }
    theme: 'light',
    currentTab: 'dashboard',
    selectedDate: new Date().toISOString().split('T')[0],
    storageMode: 'local', // 'local' or 'supabase'
    supabaseUrl: '',
    supabaseKey: '',
    userRole: '' // 'admin', 'guru', 'santri'
};

let supabaseClient = null;

// CREDENTIALS DATABASE
const USERS = {
    'admin': { password: '354', role: 'admin', label: 'Admin Utama' },
    'guru': { password: '313', role: 'guru', label: 'Ustadz/Ustadzah' },
    'santri': { password: '123', role: 'santri', label: 'Wali Santri' }
};

// DEFAULT SEED DATA (With classroom fields)
const sampleStudents = [
    { id: '1', name: 'Muhammad Al-Fatih', nickname: 'Fatih', class: 'Kelas Cabe Rawit', gender: 'Laki-laki', parentName: 'Ahmad', phone: '081234567890', stars: 12, iqroProgress: 'Iqro 3 Hal. 10', hafalanProgress: 'An-Nas & Al-Falaq' },
    { id: '2', name: 'Aisyah Humaira', nickname: 'Aisyah', class: 'Kelas Paud', gender: 'Perempuan', parentName: 'Siti', phone: '081234567891', stars: 15, iqroProgress: 'Iqro 4 Hal. 5', hafalanProgress: 'Al-Ikhlas (Lancar)' },
    { id: '3', name: 'Ali bin Abi Thalib', nickname: 'Ali', class: 'Kelas Lambatan', gender: 'Laki-laki', parentName: 'Fatimah', phone: '081234567892', stars: 9, iqroProgress: 'Iqro 2 Hal. 15', hafalanProgress: 'Al-Lahab' },
    { id: '4', name: 'Khadijah Al-Kubra', nickname: 'Dija', class: 'Kelas Pramaja', gender: 'Perempuan', parentName: 'Aminah', phone: '081234567893', stars: 18, iqroProgress: 'Al-Baqarah Ayat 1-10', hafalanProgress: 'Al-Kafirun' },
    { id: '5', name: 'Zaid bin Haritsah', nickname: 'Zaid', class: 'Kelas Dewasa', gender: 'Laki-laki', parentName: 'Usamah', phone: '081234567894', stars: 10, iqroProgress: 'Iqro 5 Hal. 20', hafalanProgress: 'Al-Maun' }
];

// Initialize LocalStorage Database & Supabase connection
async function initStorage() {
    const localStudents = localStorage.getItem('caberawit_students');
    const localClassrooms = localStorage.getItem('caberawit_classrooms');
    const localAttendance = localStorage.getItem('caberawit_attendance');
    const localTheme = localStorage.getItem('caberawit_theme');
    
    // Load Supabase Settings
    state.storageMode = localStorage.getItem('caberawit_storage_mode') || 'local';
    state.supabaseUrl = localStorage.getItem('caberawit_supabase_url') || '';
    state.supabaseKey = localStorage.getItem('caberawit_supabase_key') || '';

    // Load theme
    if (localTheme) {
        state.theme = localTheme;
    }
    document.body.setAttribute('data-theme', state.theme);

    // Initial load local fallbacks
    if (localStudents) {
        state.students = JSON.parse(localStudents);
    } else {
        state.students = sampleStudents;
        localStorage.setItem('caberawit_students', JSON.stringify(sampleStudents));
    }

    if (localClassrooms) {
        state.classrooms = JSON.parse(localClassrooms);
    } else {
        localStorage.setItem('caberawit_classrooms', JSON.stringify(state.classrooms));
    }

    if (localAttendance) {
        state.attendance = JSON.parse(localAttendance);
    } else {
        state.attendance = {};
        localStorage.setItem('caberawit_attendance', JSON.stringify({}));
    }

    // Check session
    const savedRole = sessionStorage.getItem('caberawit_role');
    if (savedRole) {
        state.userRole = savedRole;
        document.getElementById('login-screen').style.display = 'none';
        applyRolePermissions();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }

    // Try to connect to Supabase if mode is set to supabase
    await connectSupabase();
    await loadAllData();
}

// APPLY ROLE-BASED ACCESS CONTROLS
function applyRolePermissions() {
    const roleLabel = USERS[state.userRole]?.label || 'Tamu';
    document.getElementById('role-indicator').innerText = `Role: ${roleLabel}`;

    const dbBtn = document.getElementById('db-settings-btn');
    const navPresensi = document.getElementById('nav-presensi');
    const navSantri = document.getElementById('nav-santri');

    // Default reset
    dbBtn.style.display = 'flex';
    navPresensi.style.display = 'flex';
    navSantri.style.display = 'flex';

    if (state.userRole === 'santri') {
        // Wali/Santri (Read-Only)
        dbBtn.style.display = 'none';
        navPresensi.style.display = 'none';
        navSantri.style.display = 'none';
        switchTab('dashboard');
    } else if (state.userRole === 'guru') {
        // Guru (Can take attendance, but cannot edit settings or edit student list details)
        dbBtn.style.display = 'none';
        const addBtn = document.getElementById('btn-add-santri-modal');
        if (addBtn) addBtn.style.display = 'none';
    } else if (state.userRole === 'admin') {
        // Admin has access to everything
        const addBtn = document.getElementById('btn-add-santri-modal');
        if (addBtn) addBtn.style.display = 'block';
    }
}

function switchTab(targetTab) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const tab = item.getAttribute('data-tab');
        if (tab === targetTab) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${targetTab}`).classList.add('active');
    state.currentTab = targetTab;
    renderView(targetTab);
}

async function connectSupabase() {
    const indicator = document.getElementById('connection-indicator');
    
    if (state.storageMode === 'supabase' && state.supabaseUrl && state.supabaseKey) {
        try {
            if (typeof supabase !== 'undefined') {
                supabaseClient = supabase.createClient(state.supabaseUrl, state.supabaseKey);
                
                // Test connection by doing a fast select
                const { data, error } = await supabaseClient.from('students').select('id').limit(1);
                if (error) throw error;

                indicator.innerHTML = '<i class="fa-solid fa-cloud"></i> Supabase Terhubung';
                indicator.style.backgroundColor = 'rgba(46, 196, 182, 0.15)';
                indicator.style.color = 'var(--success)';
                return true;
            } else {
                throw new Error("Pustaka Supabase tidak terdeteksi.");
            }
        } catch (err) {
            console.error("Gagal terhubung ke Supabase:", err);
            indicator.innerHTML = `<i class="fa-solid fa-cloud-slash"></i> Mode Offline (Supabase Error)`;
            indicator.style.backgroundColor = 'rgba(255, 159, 28, 0.15)';
            indicator.style.color = 'var(--danger)';
            supabaseClient = null;
            return false;
        }
    } else {
        indicator.innerHTML = '<i class="fa-solid fa-laptop"></i> Penyimpanan Lokal Offline';
        indicator.style.backgroundColor = 'rgba(78, 168, 222, 0.15)';
        indicator.style.color = 'var(--secondary)';
        supabaseClient = null;
        return false;
    }
}

// LOAD ALL DATA (LOCAL OR SUPABASE)
async function loadAllData() {
    if (supabaseClient) {
        try {
            // Load students
            const { data: studentsData, error: studentErr } = await supabaseClient
                .from('students')
                .select('*')
                .order('name', { ascending: true });
            
            if (studentErr) throw studentErr;
            state.students = studentsData.map(s => ({
                id: s.id,
                name: s.name,
                nickname: s.nickname,
                class: s.class || 'Kelas Cabe Rawit',
                gender: s.gender,
                parentName: s.parent_name,
                phone: s.phone,
                stars: s.stars,
                iqroProgress: s.iqro_progress,
                hafalanProgress: s.hafalan_progress
            }));

            // Sync to local storage
            localStorage.setItem('caberawit_students', JSON.stringify(state.students));

            // Load classrooms
            const { data: classroomsData, error: classErr } = await supabaseClient
                .from('classrooms')
                .select('*');
            
            if (!classErr && classroomsData.length > 0) {
                state.classrooms = classroomsData;
                localStorage.setItem('caberawit_classrooms', JSON.stringify(state.classrooms));
            }

            // Load attendance
            const { data: attendData, error: attendErr } = await supabaseClient
                .from('attendance')
                .select('*');
            if (attendErr) throw attendErr;

            state.attendance = {};
            attendData.forEach(row => {
                if (!state.attendance[row.date]) {
                    state.attendance[row.date] = {};
                }
                state.attendance[row.date][row.student_id] = row.status;
            });
            localStorage.setItem('caberawit_attendance', JSON.stringify(state.attendance));

        } catch (err) {
            console.error("Gagal menyinkronkan data dari Supabase:", err);
            showToast("Memakai data offline lokal...");
        }
    }
}

// SAVE STATE LOCALSTORAGE HELPERS
function saveLocalStudents() {
    localStorage.setItem('caberawit_students', JSON.stringify(state.students));
}

function saveLocalClassrooms() {
    localStorage.setItem('caberawit_classrooms', JSON.stringify(state.classrooms));
}

function saveLocalAttendance() {
    localStorage.setItem('caberawit_attendance', JSON.stringify(state.attendance));
}

// TOAST NOTIFICATION UTILITY
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// PARTICLE EFFECT FOR STARS
function createStarExplosion(e) {
    const numStars = 6;
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('i');
        star.className = 'fa-solid fa-star star-particle';
        star.style.left = `${e.clientX}px`;
        star.style.top = `${e.clientY}px`;
        const angle = Math.random() * Math.PI * 2;
        const Math_vel = 50 + Math.random() * 80;
        const dx = Math.cos(angle) * Math_vel;
        const dy = Math.sin(angle) * Math_vel - 100;
        star.style.setProperty('--dx', `${dx}px`);
        star.style.setProperty('--dy', `${dy}px`);
        document.body.appendChild(star);
        setTimeout(() => star.remove(), 800);
    }
}

// CORE FUNCTIONS: NAVIGATION
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', async () => {
            const targetTab = item.getAttribute('data-tab');
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            
            state.currentTab = targetTab;
            
            if (supabaseClient) {
                await loadAllData();
            }
            renderView(targetTab);
        });
    });
}

// CORE FUNCTIONS: THEME
function setupTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', state.theme);
        localStorage.setItem('caberawit_theme', state.theme);
        
        const icon = themeBtn.querySelector('i');
        icon.className = state.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        showToast(`Tema diubah ke mode ${state.theme === 'light' ? 'Terang' : 'Gelap'}`);
    });
    
    const icon = themeBtn.querySelector('i');
    icon.className = state.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// LOGIN & LOGOUT HANDLERS
function setupAuth() {
    document.getElementById('btn-submit-login').addEventListener('click', () => {
        const usernameInput = document.getElementById('login-username').value.trim();
        const passwordInput = document.getElementById('login-password').value.trim();

        if (USERS[usernameInput] && USERS[usernameInput].password === passwordInput) {
            const user = USERS[usernameInput];
            state.userRole = user.role;
            sessionStorage.setItem('caberawit_role', user.role);
            
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            document.getElementById('login-screen').style.display = 'none';
            
            applyRolePermissions();
            renderView('dashboard');
            showToast(`Selamat datang, ${user.label}! 👋`);
        } else {
            alert('Username atau password salah. Silakan coba lagi!');
        }
    });

    document.getElementById('login-password').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('btn-submit-login').click();
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
            sessionStorage.removeItem('caberawit_role');
            state.userRole = '';
            document.getElementById('login-screen').style.display = 'flex';
            showToast('Anda berhasil keluar');
        }
    });
}

// RENDERING SYSTEM
function renderView(tabName) {
    updateDashboardStats();
    if (tabName === 'dashboard') {
        renderLeaderboard();
    } else if (tabName === 'presensi') {
        renderPresensiList();
    } else if (tabName === 'kelas') {
        renderClassroomList();
    } else if (tabName === 'santri') {
        renderSantriList();
    } else if (tabName === 'history') {
        renderHistoryReport();
    }
}

// VIEW 1: DASHBOARD
function updateDashboardStats() {
    document.getElementById('stats-total-students').innerText = state.students.length;
    const todayData = state.attendance[state.selectedDate] || {};
    const presentToday = Object.values(todayData).filter(status => status === 'H').length;
    document.getElementById('stats-today-present').innerText = presentToday;
}

function renderLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '';
    
    const sorted = [...state.students].sort((a, b) => b.stars - a.stars);
    if (sorted.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-face-smile"></i><p>Belum ada santri terdaftar.</p></div>`;
        return;
    }

    sorted.forEach((student, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="leaderboard-info">
                <div class="rank-badge">${index + 1}</div>
                <div>
                    <div style="font-weight:600;">${student.name}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${student.class} • ${student.iqroProgress || 'Belum mencatat Iqro'}</div>
                </div>
            </div>
            <div class="star-count">
                <i class="fa-solid fa-star"></i>
                <span>${student.stars}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// VIEW 2: PRESENSI
function renderPresensiList() {
    const container = document.getElementById('presensi-list-container');
    container.innerHTML = '';
    
    const currentDate = state.selectedDate;
    const dateAttendance = state.attendance[currentDate] || {};
    const filterClass = document.getElementById('filter-presensi-class').value;

    const filteredStudents = state.students.filter(student => {
        if (filterClass === 'all') return true;
        return student.class === filterClass;
    });
    
    if (filteredStudents.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>Tidak ada santri di kelas ini.</p></div>`;
        return;
    }

    filteredStudents.forEach(student => {
        const studentStatus = dateAttendance[student.id] || '';
        
        const card = document.createElement('div');
        card.className = 'student-row-card';
        card.innerHTML = `
            <div class="student-row-header">
                <div class="student-identity">
                    <span class="student-name">${student.name}</span>
                    <span class="student-meta">${student.class} • ${student.nickname}</span>
                </div>
                <div class="star-count" style="font-size: 14px;">
                    <i class="fa-solid fa-star"></i> <span id="star-val-${student.id}">${student.stars}</span>
                </div>
            </div>
            
            <div class="attendance-options">
                <label class="attendance-option">
                    <input type="radio" name="att-${student.id}" value="H" ${studentStatus === 'H' ? 'checked' : ''} onclick="toggleAttendance(this, '${student.id}', 'H')">
                    <span class="attendance-label label-h">Hadir</span>
                </label>
                <label class="attendance-option">
                    <input type="radio" name="att-${student.id}" value="S" ${studentStatus === 'S' ? 'checked' : ''} onclick="toggleAttendance(this, '${student.id}', 'S')">
                    <span class="attendance-label label-s">Sakit</span>
                </label>
                <label class="attendance-option">
                    <input type="radio" name="att-${student.id}" value="I" ${studentStatus === 'I' ? 'checked' : ''} onclick="toggleAttendance(this, '${student.id}', 'I')">
                    <span class="attendance-label label-i">Izin</span>
                </label>
                <label class="attendance-option">
                    <input type="radio" name="att-${student.id}" value="A" ${studentStatus === 'A' ? 'checked' : ''} onclick="toggleAttendance(this, '${student.id}', 'A')">
                    <span class="attendance-label label-a">Alfa</span>
                </label>
            </div>
            
            <div class="quick-action-row">
                <div class="progress-section">
                    <div class="progress-badge" onclick="openProgressModal('${student.id}')" title="Klik untuk edit progress">
                        📖 ${student.iqroProgress || 'Catat Iqro'}
                    </div>
                    <div class="progress-badge" onclick="openProgressModal('${student.id}')" title="Klik untuk edit hafalan">
                        ⭐ ${student.hafalanProgress || 'Catat Hafalan'}
                    </div>
                </div>
                <button class="quick-star-btn" onclick="addStarInstant(event, '${student.id}')">
                    <i class="fa-solid fa-plus"></i> <i class="fa-solid fa-star"></i> Bintang
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function toggleAttendance(radioInput, studentId, status) {
    const date = state.selectedDate;
    if (!state.attendance[date]) {
        state.attendance[date] = {};
    }
    
    const previousStatus = state.attendance[date][studentId];
    const isRemove = previousStatus === status;

    if (isRemove) {
        radioInput.checked = false;
        delete state.attendance[date][studentId];
    } else {
        state.attendance[date][studentId] = status;
    }

    saveLocalAttendance();
    updateDashboardStats();

    if (supabaseClient) {
        try {
            if (isRemove) {
                await supabaseClient.from('attendance').delete().match({ date: date, student_id: studentId });
                showToast(`Presensi dibatalkan`);
            } else {
                await supabaseClient.from('attendance').upsert({ date: date, student_id: studentId, status: status });
                showToast(`Presensi berhasil disimpan`);
            }
        } catch (err) {
            console.error(err);
        }
    } else {
        showToast(isRemove ? `Presensi dibatalkan` : `Presensi berhasil disimpan`);
    }
}

async function addStarInstant(event, studentId) {
    const idx = state.students.findIndex(s => s.id === studentId);
    if (idx !== -1) {
        state.students[idx].stars += 1;
        saveLocalStudents();
        
        const element = document.getElementById(`star-val-${studentId}`);
        if (element) element.innerText = state.students[idx].stars;
        
        createStarExplosion(event);
        showToast(`Apresiasi 1 Bintang untuk ${state.students[idx].nickname}! 🌟`);

        if (supabaseClient) {
            try {
                await supabaseClient.from('students').update({ stars: state.students[idx].stars }).eq('id', studentId);
            } catch (err) {
                console.error(err);
            }
        }
    }
}

// VIEW 3: RUANG KELAS & MATERI
function renderClassroomList() {
    const container = document.getElementById('class-list-container');
    container.innerHTML = '';

    state.classrooms.forEach(classroom => {
        // Count kids in this class
        const studentCount = state.students.filter(s => s.class === classroom.name).length;
        
        const card = document.createElement('div');
        card.className = 'class-card';
        
        // Show edit button for admin only
        const editBtnHtml = state.userRole === 'admin' ? `
            <button class="btn btn-secondary btn-small" onclick="openEditMateriModal('${classroom.id}')">
                <i class="fa-solid fa-pen"></i> Edit Materi
            </button>
        ` : '';

        card.innerHTML = `
            <div class="class-card-header">
                <span class="class-name">${classroom.name} <span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">(${studentCount} Santri)</span></span>
                ${editBtnHtml}
            </div>
            <div class="class-materi-box">
                ${classroom.materi || 'Belum ada materi terdaftar.'}
                <div style="margin-top: 10px; font-weight: bold; color: var(--primary);">
                    <i class="fa-solid fa-user-tie"></i> Guru: ${classroom.guru || '<span style="color:var(--text-muted); font-weight:normal;">Belum ditentukan</span>'}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function openEditMateriModal(classId) {
    if (state.userRole !== 'admin') return;
    const classroom = state.classrooms.find(c => c.id === classId);
    if (!classroom) return;

    document.getElementById('edit-class-id').value = classroom.id;
    document.getElementById('edit-class-name').innerText = `✏️ Edit Materi: ${classroom.name}`;
    document.getElementById('edit-class-materi').value = classroom.materi || '';
    document.getElementById('edit-class-guru').value = classroom.guru || '';
    
    document.getElementById('modal-edit-materi').classList.add('active');
}

// VIEW 4: DATA SANTRI CRUD
function renderSantriList() {
    const container = document.getElementById('santri-list-container');
    container.innerHTML = '';
    const query = document.getElementById('search-santri').value.toLowerCase();
    const filterClass = document.getElementById('filter-santri-class').value;
    
    const filtered = state.students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(query) || 
                              s.nickname.toLowerCase().includes(query) ||
                              s.parentName.toLowerCase().includes(query);
        const matchesClass = filterClass === 'all' || s.class === filterClass;
        return matchesSearch && matchesClass;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>Santri tidak ditemukan.</p></div>`;
        return;
    }

    filtered.forEach(student => {
        const div = document.createElement('div');
        div.className = 'santri-item';
        
        const actionHtml = state.userRole === 'admin' ? `
            <div class="santri-actions">
                <button class="icon-btn" onclick="openEditSantriModal('${student.id}')" style="background:var(--secondary); width:36px; height:36px; font-size:14px;">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="icon-btn" onclick="deleteSantri('${student.id}')" style="background:var(--primary); width:36px; height:36px; font-size:14px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>` : '';
            
        div.innerHTML = `
            <div>
                <strong style="font-size:16px;">${student.name} (${student.nickname})</strong>
                <div style="font-size:12px; color:var(--text-muted); margin-top: 4px;">
                    <div>Kelas: <b>${student.class}</b></div>
                    <div>Gender: ${student.gender} | Ortu: ${student.parentName} (${student.phone || '-'})</div>
                </div>
            </div>
            ${actionHtml}
        `;
        container.appendChild(div);
    });
}

function openEditSantriModal(studentId) {
    if (state.userRole !== 'admin') return;

    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('modal-santri-title').innerText = 'Edit Data Santri';
    document.getElementById('santri-id-edit').value = student.id;
    document.getElementById('santri-name').value = student.name;
    document.getElementById('santri-nickname').value = student.nickname;
    document.getElementById('santri-class').value = student.class || 'Kelas Cabe Rawit';
    document.getElementById('santri-gender').value = student.gender;
    document.getElementById('santri-parent').value = student.parentName;
    document.getElementById('santri-phone').value = student.phone || '';
    
    document.getElementById('modal-santri').classList.add('active');
}

async function deleteSantri(studentId) {
    if (state.userRole !== 'admin') return;

    const student = state.students.find(s => s.id === studentId);
    if (!student) return;
    
    if (confirm(`Apakah Anda yakin ingin menghapus data ${student.name}? Semua riwayat absensinya juga akan dihapus.`)) {
        state.students = state.students.filter(s => s.id !== studentId);
        saveLocalStudents();
        renderSantriList();
        showToast('Data santri berhasil dihapus');

        if (supabaseClient) {
            try {
                await supabaseClient.from('students').delete().eq('id', studentId);
            } catch (err) {
                console.error(err);
            }
        }
    }
}

// VIEW 5: REKAP & LAPORAN
function renderHistoryReport() {
    const reportMonth = document.getElementById('report-month').value;
    const tbody = document.getElementById('history-report-body');
    tbody.innerHTML = '';
    
    if (!reportMonth) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Silakan pilih bulan laporan terlebih dahulu.</td></tr>`;
        return;
    }
    
    if (state.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Tidak ada data santri.</td></tr>`;
        return;
    }

    state.students.forEach(student => {
        let presentCount = 0;
        let sickCount = 0;
        let leaveCount = 0;
        let absentCount = 0;
        let totalLoggedDays = 0;
        
        Object.keys(state.attendance).forEach(dateStr => {
            if (dateStr.startsWith(reportMonth)) {
                const status = state.attendance[dateStr][student.id];
                if (status) {
                    totalLoggedDays++;
                    if (status === 'H') presentCount++;
                    else if (status === 'S') sickCount++;
                    else if (status === 'I') leaveCount++;
                    else if (status === 'A') absentCount++;
                }
            }
        });
        
        const attendanceRate = totalLoggedDays > 0 ? Math.round((presentCount / totalLoggedDays) * 100) : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${student.name}</strong></td>
            <td><span class="badge-present">${presentCount}</span></td>
            <td><span class="badge-sick">${sickCount}</span></td>
            <td><span class="badge-leave">${leaveCount}</span></td>
            <td><span class="badge-absent">${absentCount}</span></td>
            <td><strong>${attendanceRate}%</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

function exportCSV() {
    const reportMonth = document.getElementById('report-month').value;
    if (!reportMonth) {
        alert('Pilih bulan rekap terlebih dahulu.');
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Lengkap,Nama Panggilan,Kelas,Hadir,Sakit,Izin,Alfa,Persentase Kehadiran\n";
    
    state.students.forEach(student => {
        let presentCount = 0;
        let sickCount = 0;
        let leaveCount = 0;
        let absentCount = 0;
        let totalLoggedDays = 0;
        
        Object.keys(state.attendance).forEach(dateStr => {
            if (dateStr.startsWith(reportMonth)) {
                const status = state.attendance[dateStr][student.id];
                if (status) {
                    totalLoggedDays++;
                    if (status === 'H') presentCount++;
                    else if (status === 'S') sickCount++;
                    else if (status === 'I') leaveCount++;
                    else if (status === 'A') absentCount++;
                }
            }
        });
        
        const attendanceRate = totalLoggedDays > 0 ? Math.round((presentCount / totalLoggedDays) * 100) : 0;
        csvContent += `"${student.name}","${student.nickname}","${student.class}",${presentCount},${sickCount},${leaveCount},${absentCount},${attendanceRate}%\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Absensi_CabeRawit_${reportMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV berhasil diunduh');
}

// PROGRESS MODAL CONTROL
function openProgressModal(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;
    
    document.getElementById('progress-student-id').value = studentId;
    document.getElementById('progress-student-name').innerText = `✏️ Edit Perkembangan: ${student.name}`;
    document.getElementById('progress-iqro').value = student.iqroProgress || '';
    document.getElementById('progress-hafalan').value = student.hafalanProgress || '';
    
    document.getElementById('modal-progress').classList.add('active');
}

// MODALS EVENT LISTENERS & SETTINGS
function setupModals() {
    // Open Add Student Modal
    document.getElementById('btn-add-santri-modal').addEventListener('click', () => {
        if (state.userRole !== 'admin') return;
        document.getElementById('modal-santri-title').innerText = 'Tambah Santri Baru';
        document.getElementById('santri-id-edit').value = '';
        document.getElementById('santri-name').value = '';
        document.getElementById('santri-nickname').value = '';
        document.getElementById('santri-class').value = 'Kelas Cabe Rawit';
        document.getElementById('santri-gender').value = 'Laki-laki';
        document.getElementById('santri-parent').value = '';
        document.getElementById('santri-phone').value = '';
        document.getElementById('modal-santri').classList.add('active');
    });

    // DB Settings Modal Open
    document.getElementById('db-settings-btn').addEventListener('click', () => {
        if (state.userRole !== 'admin') return;
        document.getElementById('storage-mode').value = state.storageMode;
        document.getElementById('supabase-url').value = state.supabaseUrl;
        document.getElementById('supabase-key').value = state.supabaseKey;
        document.getElementById('modal-db-settings').classList.add('active');
    });

    // Close Modals
    const closeButtons = [
        { btn: 'modal-santri-close', modal: 'modal-santri' },
        { btn: 'modal-santri-cancel', modal: 'modal-santri' },
        { btn: 'modal-progress-close', modal: 'modal-progress' },
        { btn: 'modal-progress-cancel', modal: 'modal-progress' },
        { btn: 'modal-db-close', modal: 'modal-db-settings' },
        { btn: 'modal-db-close-btn', modal: 'modal-db-settings' },
        { btn: 'modal-materi-close', modal: 'modal-edit-materi' },
        { btn: 'modal-materi-cancel', modal: 'modal-edit-materi' }
    ];

    closeButtons.forEach(cfg => {
        const btnEl = document.getElementById(cfg.btn);
        if (btnEl) {
            btnEl.addEventListener('click', () => {
                document.getElementById(cfg.modal).classList.remove('active');
            });
        }
    });

    // Save Classroom Materi
    document.getElementById('modal-materi-save').addEventListener('click', async () => {
        if (state.userRole !== 'admin') return;
        const id = document.getElementById('edit-class-id').value;
        const materi = document.getElementById('edit-class-materi').value.trim();
        const guru = document.getElementById('edit-class-guru').value.trim();
        
        const idx = state.classrooms.findIndex(c => c.id === id);
        if (idx !== -1) {
            state.classrooms[idx].materi = materi;
            state.classrooms[idx].guru = guru;
            saveLocalClassrooms();
            showToast(`Materi ${state.classrooms[idx].name} berhasil diperbarui!`);
            
            // Sync with Supabase
            if (supabaseClient) {
                try {
                    await supabaseClient
                        .from('classrooms')
                        .upsert({
                            id: state.classrooms[idx].id,
                            name: state.classrooms[idx].name,
                            materi: state.classrooms[idx].materi,
                            guru: state.classrooms[idx].guru
                        });
                } catch (err) {
                    console.error("Gagal sinkron materi ke Supabase:", err);
                }
            }
        }
        document.getElementById('modal-edit-materi').classList.remove('active');
        renderView(state.currentTab);
    });

    // Save Supabase Settings
    document.getElementById('btn-save-supabase').addEventListener('click', async () => {
        if (state.userRole !== 'admin') return;
        const mode = document.getElementById('storage-mode').value;
        const url = document.getElementById('supabase-url').value.trim();
        const key = document.getElementById('supabase-key').value.trim();
        
        localStorage.setItem('caberawit_storage_mode', mode);
        localStorage.setItem('caberawit_supabase_url', url);
        localStorage.setItem('caberawit_supabase_key', key);
        
        state.storageMode = mode;
        state.supabaseUrl = url;
        state.supabaseKey = key;
        
        showToast("Menyimpan konfigurasi...");
        const connected = await connectSupabase();
        
        if (connected) {
            await loadAllData();
            showToast("Database Supabase Berhasil Terhubung! 🎉");
        } else if (mode === 'supabase') {
            alert("Gagal terhubung ke Supabase. Periksa kembali URL dan API Key Anda.");
        } else {
            showToast("Kembali ke mode penyimpanan lokal offline.");
        }
        
        renderView(state.currentTab);
        document.getElementById('modal-db-settings').classList.remove('active');
    });

    // Save Student (Add or Edit)
    document.getElementById('modal-santri-save').addEventListener('click', async () => {
        if (state.userRole !== 'admin') return;
        const id = document.getElementById('santri-id-edit').value;
        const name = document.getElementById('santri-name').value.trim();
        const nickname = document.getElementById('santri-nickname').value.trim();
        const studentClass = document.getElementById('santri-class').value;
        const gender = document.getElementById('santri-gender').value;
        const parentName = document.getElementById('santri-parent').value.trim();
        const phone = document.getElementById('santri-phone').value.trim();
        
        if (!name || !nickname || !parentName) {
            alert('Harap isi Nama Lengkap, Panggilan, dan Nama Orang Tua!');
            return;
        }

        let studentObj = {};

        if (id) {
            const idx = state.students.findIndex(s => s.id === id);
            if (idx !== -1) {
                state.students[idx] = { ...state.students[idx], name, nickname, class: studentClass, gender, parentName, phone };
                studentObj = state.students[idx];
            }
            showToast('Data santri berhasil diubah');
        } else {
            studentObj = {
                id: Date.now().toString(),
                name,
                nickname,
                class: studentClass,
                gender,
                parentName,
                phone,
                stars: 0,
                iqroProgress: '',
                hafalanProgress: ''
            };
            state.students.push(studentObj);
            showToast('Santri baru berhasil didaftarkan');
        }
        
        saveLocalStudents();
        document.getElementById('modal-santri').classList.remove('active');

        // Sync to Supabase
        if (supabaseClient) {
            try {
                await supabaseClient
                    .from('students')
                    .upsert({
                        id: studentObj.id,
                        name: studentObj.name,
                        nickname: studentObj.nickname,
                        class: studentObj.class,
                        gender: studentObj.gender,
                        parent_name: studentObj.parentName,
                        phone: studentObj.phone,
                        stars: studentObj.stars,
                        iqro_progress: studentObj.iqroProgress,
                        hafalan_progress: studentObj.hafalanProgress
                    });
            } catch (err) {
                console.error("Gagal sinkron data santri ke Supabase:", err);
            }
        }

        renderView(state.currentTab);
    });

    // Save Progress (Iqro/Hafalan)
    document.getElementById('modal-progress-save').addEventListener('click', async () => {
        const id = document.getElementById('progress-student-id').value;
        const iqro = document.getElementById('progress-iqro').value.trim();
        const hafalan = document.getElementById('progress-hafalan').value.trim();
        
        const idx = state.students.findIndex(s => s.id === id);
        if (idx !== -1) {
            state.students[idx].iqroProgress = iqro;
            state.students[idx].hafalanProgress = hafalan;
            saveLocalStudents();
            showToast(`Progress ${state.students[idx].nickname} diperbarui! 📖`);

            if (supabaseClient) {
                try {
                    await supabaseClient
                        .from('students')
                        .update({
                            iqro_progress: iqro,
                            hafalan_progress: hafalan
                        })
                        .eq('id', id);
                } catch (err) {
                    console.error("Gagal sinkron progress ke Supabase:", err);
                }
            }
        }
        document.getElementById('modal-progress').classList.remove('active');
        renderView(state.currentTab);
    });

    // Export Backup JSON
    document.getElementById('btn-export-backup').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `backup_absen_caberawit_${new Date().toISOString().split('T')[0]}.json`);
        dlAnchorElem.click();
        showToast('File backup data berhasil diunduh');
    });

    // Import Backup JSON
    document.getElementById('import-backup-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.students && parsed.attendance) {
                    state.students = parsed.students;
                    state.attendance = parsed.attendance;
                    if (parsed.classrooms) state.classrooms = parsed.classrooms;
                    
                    saveLocalStudents();
                    saveLocalClassrooms();
                    saveLocalAttendance();
                    renderView(state.currentTab);
                    document.getElementById('modal-db-settings').classList.remove('active');
                    showToast('Data lokal berhasil dipulihkan! 🎉');
                } else {
                    alert('Format file cadangan tidak valid.');
                }
            } catch (err) {
                alert('Gagal membaca file cadangan: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
}

// SETUP EVENT LISTENERS FOR FILTERS & INPUTS
function setupInputListeners() {
    const dateInput = document.getElementById('presensi-date');
    dateInput.value = state.selectedDate;
    dateInput.addEventListener('change', (e) => {
        state.selectedDate = e.target.value;
        updateDashboardStats();
        if (state.currentTab === 'presensi') {
            renderPresensiList();
        }
    });

    // Listeners for class filter on Presensi Tab
    document.getElementById('filter-presensi-class').addEventListener('change', () => {
        if (state.currentTab === 'presensi') {
            renderPresensiList();
        }
    });

    // Listeners for class filter on Santri Tab
    document.getElementById('filter-santri-class').addEventListener('change', () => {
        if (state.currentTab === 'santri') {
            renderSantriList();
        }
    });

    document.getElementById('search-santri').addEventListener('input', () => {
        if (state.currentTab === 'santri') {
            renderSantriList();
        }
    });

    const reportMonthInput = document.getElementById('report-month');
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    reportMonthInput.value = currentMonthStr;
    reportMonthInput.addEventListener('change', () => {
        if (state.currentTab === 'history') {
            renderHistoryReport();
        }
    });

    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
}

// APP ENTRY POINT
window.addEventListener('DOMContentLoaded', async () => {
    await initStorage();
    setupNavigation();
    setupTheme();
    setupModals();
    setupInputListeners();
    setupAuth();
    renderView('dashboard');
});
