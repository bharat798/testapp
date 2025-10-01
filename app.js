//
// ===================================
//  STEP 1: FIREBASE CONFIGURATION
// ===================================
//
const firebaseConfig = {
    apiKey: "AIzaSyDIXwI85CH-uXrsPmXTCsX2cEzKPtPxcP8",
    authDomain: "employeeattendanceapp-387e2.firebaseapp.com",
    projectId: "employeeattendanceapp-387e2",
    storageBucket: "employeeattendanceapp-387e2.appspot.com",
    messagingSenderId: "1023846201615",
    appId: "1:1023846201615:web:040da8523772ac8275267a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

//
// ========================================
//  STEP 2: ELEMENT REFERENCES & CONSTANTS
// ========================================
//
// Screens & Cards
const authScreen = document.getElementById('auth-screen');
const adminDashboard = document.getElementById('admin-dashboard');
const employeeDashboard = document.getElementById('employee-dashboard');
const attendanceListCard = document.getElementById('attendance-list-card');

// Auth View Toggle & Forms
const showLoginLink = document.getElementById('show-login');
const showSignupLink = document.getElementById('show-signup');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupBtn = document.getElementById('signup-btn');

// Admin Dashboard
const companyLatInput = document.getElementById('company-lat');
const companyLonInput = document.getElementById('company-lon');
const saveLocationBtn = document.getElementById('save-location-btn');
const logoutBtnAdmin = document.getElementById('logout-btn-admin');

// Employee Dashboard
const employeeEmailSpan = document.getElementById('employee-email');
const registerFpBtn = document.getElementById('register-fp-btn');
const fpStatus = document.getElementById('fp-status');
const markAttendanceBtn = document.getElementById('mark-attendance-btn');
const attendanceStatus = document.getElementById('attendance-status');
const logoutBtnEmployee = document.getElementById('logout-btn-employee');
const attendanceList = document.getElementById('attendance-list');

// Constants
const browser = window.SimpleWebAuthnBrowser;
const ADMIN_EMAIL = "admin@company.com";
// LOCATION FIX: Increased radius to 250 meters for better accuracy indoors.
const ALLOWED_RADIUS_METERS = 250;

//
// ========================================
//  STEP 3: UI & AUTHENTICATION LOGIC
// ========================================
//
function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenElement.classList.add('active');
}

showSignupLink.addEventListener('click', (e) => { e.preventDefault(); loginView.style.display = 'none'; signupView.style.display = 'block'; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); signupView.style.display = 'none'; loginView.style.display = 'block'; });

signupBtn.addEventListener('click', () => { auth.createUserWithEmailAndPassword(signupEmail.value, signupPassword.value).then(() => alert('Signup successful! Please log in.')).catch(error => alert(error.message)); });
loginBtn.addEventListener('click', () => { auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value).catch(error => alert(error.message)); });
logoutBtnAdmin.addEventListener('click', () => auth.signOut());
logoutBtnEmployee.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
    if (user) {
        if (user.email === ADMIN_EMAIL) {
            showScreen(adminDashboard);
            loadCompanyLocation();
        } else {
            showScreen(employeeDashboard);
            employeeEmailSpan.textContent = user.email;
            checkFingerprintRegistration(user.uid);
            // NEW: Start listening for attendance updates
            listenForAttendance();
        }
    } else {
        showScreen(authScreen);
    }
});

//
// ========================================
//  STEP 4: ADMIN DASHBOARD LOGIC
// ========================================
//
saveLocationBtn.addEventListener('click', () => {
    const lat = parseFloat(companyLatInput.value);
    const lon = parseFloat(companyLonInput.value);
    if (isNaN(lat) || isNaN(lon)) return alert('Please enter valid coordinates.');
    db.collection('company').doc('location').set({ latitude: lat, longitude: lon }).then(() => alert('Location saved!')).catch(e => alert(e.message));
});

async function loadCompanyLocation() {
    const doc = await db.collection('company').doc('location').get();
    if (doc.exists) {
        companyLatInput.value = doc.data().latitude;
        companyLonInput.value = doc.data().longitude;
    }
}

//
// ========================================
//  STEP 5: HELPER FUNCTION FOR WEBAUTHN
// ========================================
//
function bufferToBase64URL(buffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

//
// ========================================
//  STEP 6: EMPLOYEE PASSKEY (WEBAUTHN) LOGIC
// ========================================
//
registerFpBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const rpId = window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname;
    const challengeBuffer = crypto.getRandomValues(new Uint8Array(32));
    const challenge = bufferToBase64URL(challengeBuffer);
    const registrationOptions = {
        rp: { name: 'Attendance App', id: rpId },
        user: { id: bufferToBase64URL(new TextEncoder().encode(user.uid)), name: user.email, displayName: user.email },
        challenge,
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { userVerification: 'required' },
        timeout: 60000,
        attestation: 'direct'
    };
    try {
        const registrationCredential = await browser.startRegistration(registrationOptions);
        await db.collection('users').doc(user.uid).set({ fingerprintCredential: { id: registrationCredential.id } }, { merge: true });
        fpStatus.textContent = 'Passkey registered successfully!';
        fpStatus.className = 'status-message success';
        registerFpBtn.disabled = true;
    } catch (error) {
        console.error(error);
        fpStatus.textContent = 'Registration failed. Check console.';
        fpStatus.className = 'status-message error';
    }
});

async function checkFingerprintRegistration(uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data().fingerprintCredential) {
        fpStatus.textContent = 'Passkey is already registered.';
        fpStatus.className = 'status-message success';
        registerFpBtn.disabled = true;
    } else {
        fpStatus.textContent = 'Please register your passkey.';
        fpStatus.className = 'status-message';
        registerFpBtn.disabled = false;
    }
}

//
// ========================================
//  STEP 7: EMPLOYEE ATTENDANCE LOGIC
// ========================================
//
markAttendanceBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    attendanceStatus.textContent = 'Please verify with your passkey...';
    attendanceStatus.className = 'status-message';
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists || !userDoc.data().fingerprintCredential) return alert('No passkey registered.');
        const credentialId = userDoc.data().fingerprintCredential.id;
        const challengeBuffer = crypto.getRandomValues(new Uint8Array(32));
        const challenge = bufferToBase64URL(challengeBuffer);
        const authenticationOptions = {
            challenge,
            allowCredentials: [{ id: credentialId, type: 'public-key' }],
            userVerification: 'required',
        };
        await browser.startAuthentication(authenticationOptions);
        attendanceStatus.textContent = 'Verification successful! Checking location...';
        attendanceStatus.className = 'status-message success';
        // LOCATION FIX: Enable high accuracy mode
        navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
    } catch (error) {
        console.error(error);
        attendanceStatus.textContent = 'Verification failed.';
        attendanceStatus.className = 'status-message error';
    }
});

async function positionSuccess(position) {
    const userCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    const companyLocDoc = await db.collection('company').doc('location').get();
    if (!companyLocDoc.exists) {
        attendanceStatus.textContent = 'Company location not set by admin.';
        return;
    }
    const companyCoords = companyLocDoc.data();
    const distance = haversineDistance(userCoords, companyCoords);
    if (distance <= ALLOWED_RADIUS_METERS) {
        attendanceStatus.textContent = `Success! Attendance marked.`;
        const user = auth.currentUser;
        await db.collection('attendance').add({
            userId: user.uid,
            email: user.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
        markAttendanceBtn.disabled = true;
    } else {
        attendanceStatus.textContent = `Failed: You are ${Math.round(distance)}m away. You must be within ${ALLOWED_RADIUS_METERS}m.`;
        attendanceStatus.className = 'status-message error';
    }
}

function positionError(error) { attendanceStatus.textContent = `Error getting location: ${error.message}`; attendanceStatus.className = 'status-message error'; }

function haversineDistance(coords1, coords2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371e3;
    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coords1.latitude)) * Math.cos(toRad(coords2.latitude)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

//
// ========================================
//  NEW: STEP 8: REAL-TIME ATTENDANCE LIST
// ========================================
//
function listenForAttendance() {
    // Get the start of today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    db.collection('attendance')
      .where('timestamp', '>=', today)
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
          if (snapshot.empty) {
              attendanceList.innerHTML = '<li>No one has marked attendance yet today.</li>';
              return;
          }
          
          attendanceList.innerHTML = ''; // Clear the list
          snapshot.forEach(doc => {
              const record = doc.data();
              const timestamp = record.timestamp.toDate();
              const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const listItem = document.createElement('li');
              listItem.innerHTML = `
                  <span class="employee-name">${record.email}</span>
                  <span class="timestamp">${formattedTime}</span>
              `;
              attendanceList.appendChild(listItem);
          });
      }, error => {
          console.error("Error listening for attendance:", error);
          attendanceList.innerHTML = '<li>Error loading attendance data.</li>';
      });
}
