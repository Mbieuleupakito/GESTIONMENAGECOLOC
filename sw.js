/* ================================================================
   SERVICE WORKER — GTM Coloc
   Gère les notifications push VAPID natives
================================================================ */

var CACHE_NAME = 'gtm-coloc-v6';
var SUPABASE_URL = 'https://avpxzwjxmytdcmlxtixh.supabase.co';
var SUPABASE_KEY = 'sb_publishable_CoTpQtG8306po9DCFDRyrg_4-nC16vM';
var HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
};
var VAPID_PUBLIC_KEY = 'BO9fd3R7mU3GdU4ExabEU1PO3k9wmp1NLQMAvk7JVuLrq8znQQAUkQ5sUaf8FZUoBUYr-jcDmQDrAJORbOPf2Yg';

self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()); });

/* ── RÉCEPTION NOTIFICATION PUSH ── */
self.addEventListener('push', function(event) {
    if (!event.data) return;
    var data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'GTM Coloc', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: data.urgent ? [500,200,500,200,500] : [100,50,100],
            requireInteraction: data.urgent || false,
            tag: data.tag || 'gtm-coloc-' + Date.now(),
            data: { url: '/' }
        })
    );
});

/* ── CLIC SUR NOTIFICATION ── */
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(function(list) {
            for (var i = 0; i < list.length; i++) {
                if ('focus' in list[i]) return list[i].focus();
            }
            return clients.openWindow('/');
        })
    );
});

/* ── MESSAGES DEPUIS L'APP ── */
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SCHEDULE_CHECKS') {
        startCheckLoop();
    }
});

/* ── ALERTES AUTOMATIQUES DIMANCHE ── */
function startCheckLoop() {
    checkAndAct();
    setInterval(checkAndAct, 60 * 1000);
}

function checkAndAct() {
    var now = new Date();
    var day = now.getDay();
    var hour = now.getHours();
    var min = now.getMinutes();
    if (day !== 0) return;
    if (hour === 15 && min === 0) sendLocalAlert('alert15');
    if (hour === 20 && min === 0) sendLocalAlert('alert20');
    if (hour === 23 && min === 30) sendLocalAlert('alert2330');
    if (hour === 23 && min === 59) handleAutoMalus(now);
}

function sendLocalAlert(key) {
    caches.open(CACHE_NAME).then(function(cache) {
        cache.match(key).then(function(already) {
            if (already) return;
            cache.put(key, new Response('sent'));
            getUnvalidated().then(function(names) {
                if (!names.length) return;
                var msgs = {
                    alert15: ['Rappel 15h !', names.join(', ') + ' n ont pas valide !'],
                    alert20: ['Rappel 20h !', 'Plus que quelques heures — ' + names.join(', ')],
                    alert2330: ['DERNIERE CHANCE 23h30 !', names.join(', ') + ' — Validez avant minuit !']
                };
                self.registration.showNotification(msgs[key][0], {
                    body: msgs[key][1], icon: '/icon-192.png',
                    vibrate: [300,100,300], requireInteraction: true, tag: key
                });
            });
        });
    });
}

function handleAutoMalus(now) {
    var wn = getWeekNumber();
    var key = 'malus_' + wn;
    caches.open(CACHE_NAME).then(function(cache) {
        cache.match(key).then(function(already) {
            if (already) return;
            cache.put(key, new Response('done'));
            fetch(SUPABASE_URL + '/rest/v1/scores?select=id,name,points,last_week_validated,tache_en_retard', {headers: HEADERS})
            .then(function(r) { return r.json(); })
            .then(function(users) {
                var nv = users.filter(function(u) { return u.last_week_validated !== wn && !u.tache_en_retard; });
                nv.forEach(function(user) {
                    fetch(SUPABASE_URL + '/rest/v1/scores?id=eq.' + user.id, {
                        method: 'PATCH',
                        headers: Object.assign({}, HEADERS, {'Prefer':'return=minimal'}),
                        body: JSON.stringify({points: Math.max(0, user.points-2), tache_en_retard: wn, retard_valide: false})
                    });
                    fetch(SUPABASE_URL + '/rest/v1/logs', {
                        method: 'POST',
                        headers: Object.assign({}, HEADERS, {'Prefer':'return=minimal'}),
                        body: JSON.stringify({name: user.name, points_gagnes: -2, type: 'malus_auto'})
                    });
                });
            });
        });
    });
}

function getUnvalidated() {
    var wn = getWeekNumber();
    return fetch(SUPABASE_URL + '/rest/v1/scores?select=name,last_week_validated', {headers: HEADERS})
        .then(function(r) { return r.json(); })
        .then(function(u) { return u.filter(function(x){return x.last_week_validated!==wn;}).map(function(x){return x.name;}); })
        .catch(function() { return []; });
}

function getWeekNumber() {
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var day = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return Math.floor(Math.floor((monday - startOfYear) / 86400000) / 7) + 1;
}
