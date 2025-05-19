let map;
let currentMarker;
let username = '';
const socket = io();
const userMarkers = new Map();
const userDistances = new Map();

// Initialize theme
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function startTracking() {
    username = document.getElementById('username').value.trim();
    if (username) {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('loading-overlay').classList.add('visible');
        initMap();
        socket.emit('user-joined', { username });
    } else {
        showError('Please enter your name');
    }
}

function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                updateMarker(latitude, longitude);
                document.getElementById('loading-overlay').classList.remove('visible');
            },
            (error) => {
                document.getElementById('loading-overlay').classList.remove('visible');
                showError('Error getting location: ' + error.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    } else {
        showError('Geolocation is not supported by your browser');
    }
}

function createLabeledMarker(lat, lon, username, isCurrentUser) {
    // Custom marker with a label for the username
    const markerHtml = `
        <div class="marker-label-container">
            <div class="marker-pin"></div>
            <div class="marker-label">${username}</div>
        </div>
    `;
    return L.marker([lat, lon], {
        icon: L.divIcon({
            className: isCurrentUser ? 'custom-marker' : 'custom-marker other-user',
            html: markerHtml,
            iconSize: [80, 32],
            iconAnchor: [10, 20]
        })
    });
}

function updateMarker(latitude, longitude) {
    if (currentMarker) {
        currentMarker.setLatLng([latitude, longitude]);
        currentMarker.getPopup().setContent(`User: ${username}`);
        currentMarker.openPopup();
    } else {
        currentMarker = L.marker([latitude, longitude]).addTo(map);
        currentMarker.bindPopup(`User: ${username}`).openPopup();
    }
    map.setView([latitude, longitude], 13);
    socket.emit('send-location', { latitude, longitude, username });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, 5000);
}

socket.on('recive-location', (data) => {
    if (data.username !== username) {
        if (userMarkers.has(data.username)) {
            const marker = userMarkers.get(data.username);
            marker.setLatLng([data.latitude, data.longitude]);
            marker.getPopup().setContent(`User: ${data.username}`);
            marker.openPopup();
            
            // Update distance if we have our location
            if (currentMarker) {
                const ourPos = currentMarker.getLatLng();
                const distance = calculateDistance(
                    ourPos.lat, ourPos.lng,
                    data.latitude, data.longitude
                );
                userDistances.set(data.username, distance);
                updateUserList();
            }
        } else {
            const marker = L.marker([data.latitude, data.longitude]).addTo(map);
            marker.bindPopup(`User: ${data.username}`).openPopup();
            userMarkers.set(data.username, marker);
        }
    }
});

socket.on('user-joined', (users) => {
    updateUserList(users);
});

socket.on('user-left', (users) => {
    const leftUser = Array.from(userMarkers.keys()).find(user => !users.includes(user));
    if (leftUser) {
        map.removeLayer(userMarkers.get(leftUser));
        userMarkers.delete(leftUser);
        userDistances.delete(leftUser);
    }
    updateUserList(users);
});

function updateUserList(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        
        const name = document.createElement('span');
        name.textContent = user.username;
        
        div.appendChild(name);
        
        if (userDistances.has(user.username)) {
            const distance = document.createElement('span');
            distance.textContent = ` (${userDistances.get(user.username).toFixed(1)} km)`;
            div.appendChild(distance);
        }
        
        userList.appendChild(div);
    });
}

socket.on('connect', () => {
    document.getElementById('connection-status').className = 'connected';
    document.getElementById('status-text').textContent = 'Connected';
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').className = 'disconnected';
    document.getElementById('status-text').textContent = 'Disconnected';
});

// Initialize theme on load
initTheme();

// Add event listener for theme toggle
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);


