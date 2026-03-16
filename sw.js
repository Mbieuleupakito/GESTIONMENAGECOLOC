/* ================================================================
   SERVICE WORKER — Gestion Coloc (Appart 48)
   ================================================================
   CE FICHIER EST LE CERVEAU DES ALERTES AUTOMATIQUES.
   Il tourne EN ARRIÈRE-PLAN sur l'appareil de chaque colocataire
   qui a accepté les notifications.

   CE QU'IL FAIT :
   ┌─────────────────────────────────────────────────────────────┐
   │ Chaque dimanche :                                           │
   │  • 15h00 → Notification rappel (1er avertissement)         │
   │  • 20h00 → Notification rappel (2ème avertissement)        │
   │  • 23h30 → Notification dernière chance avant malus        │
   │  • 23h59 → Malus -2pts automatique dans Supabase           │
   │            + enregistre la semaine comme "tâche en retard" │
   └─────────────────────────────────────────────────────────────┘

   IMPORTANT : Ce fichier doit être à la RACINE du site Vercel
   (même niveau que index.html), sinon les notifications
   ne fonctionneront pas.
================================================================ */

const CACHE_NAME = 'gestion-coloc-v1';

/* Identifiants Supabase pour accéder à la base de données
   directement depuis le Service Worker (sans l'app ouverte) */
const SUPABASE_URL = 'https://avpxzwjxmytdcmlxtixh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CoTpQtG8306po9DCFDRyrg_4-nC16vM';

/* ── CYCLE DE VIE DU SERVICE WORKER ─────────────────────────────
   install  : s'active immédiatement sans attendre la fermeture
              des onglets existants
   activate : prend le contrôle de toutes les pages ouvertes     */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

/* ── RÉCEPTION DE MESSAGE DEPUIS L'APP ──────────────────────────
   L'app envoie 'SCHEDULE_CHECKS' au démarrage pour lancer
   la boucle de vérification toutes les minutes               */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SCHEDULE_CHECKS') {
        startCheckLoop();
    }
});

/* ── BOUCLE PRINCIPALE ───────────────────────────────────────────
   Vérifie chaque minute si on est dimanche et si une action
   (alerte ou malus) doit être déclenchée                      */
function startCheckLoop() {
    /* Première vérif immédiate au démarrage */
    checkAndAct();
    /* Puis toutes les 60 secondes */
    setInterval(checkAndAct, 60 * 1000);
}

async function checkAndAct() {
    const now    = new Date();
    const day    = now.getDay();    // 0=dimanche, 1=lundi ... 6=samedi
    const hour   = now.getHours();
    const minute = now.getMinutes();

    /* On n'agit QUE le dimanche */
    if (day !== 0) return;

    /* Détection des créneaux horaires */
    const isAlert1    = hour === 15 && minute === 0;   // 15h00
    const isAlert2    = hour === 20 && minute === 0;   // 20h00
    const isAlert3    = hour === 23 && minute === 30;  // 23h30
    const isMalusTime = hour === 23 && minute === 59;  // 23h59

    if (isAlert1 || isAlert2 || isAlert3) {
        await handleAlert(isAlert1, isAlert2, isAlert3, now);
    }

    if (isMalusTime) {
        await handleAutoMalus(now);
    }
}

/* ── ENVOI DES NOTIFICATIONS D'ALERTE ───────────────────────────
   Envoie une notification push aux colocataires qui n'ont pas
   encore validé leur mission pour la semaine en cours.

   Un système de cache empêche d'envoyer la même alerte
   deux fois dans la même minute.                              */
async function handleAlert(isAlert1, isAlert2, isAlert3, now) {
    /* Clé unique pour cette alerte (ex: "alert_2026-03-15T15:0") */
    const alertKey = `alert_${now.toISOString().slice(0, 15)}`;
    const cache    = await caches.open(CACHE_NAME);

    /* Si déjà envoyée → on sort */
    if (await cache.match(alertKey)) return;
    await cache.put(alertKey, new Response('sent'));

    /* Récupère la liste des non-validés */
    const unvalidated = await getUnvalidatedColocs();
    if (unvalidated.length === 0) return; // Tout le monde a validé, rien à faire

    /* Message adapté selon l'heure */
    let title, body;
    if (isAlert1) {
        title = "⚠️ Rappel 15h — Mission non faite !";
        body  = `${unvalidated.join(', ')} ${unvalidated.length > 1 ? "n'ont" : "n'a"} pas encore validé leur mission !`;
    } else if (isAlert2) {
        title = "🔔 Rappel 20h — Plus que quelques heures !";
        body  = `${unvalidated.join(', ')} — Validez votre tâche avant ce soir.`;
    } else {
        title = "🚨 23h30 — DERNIÈRE CHANCE avant malus !";
        body  = `⏰ ${unvalidated.join(', ')} — Validez avant minuit ou perdez 2 points !`;
    }

    /* Affiche la notification sur l'écran */
    self.registration.showNotification(title, {
        body,
        icon            : '/icon-192.png',
        badge           : '/icon-192.png',
        vibrate         : [200, 100, 200],
        tag             : alertKey,       // évite les doublons visuels
        requireInteraction: true,         // reste visible jusqu'à interaction
        actions: [
            { action: 'open',    title: '📱 Valider maintenant' },
            { action: 'dismiss', title: 'Ignorer' }
        ]
    });
}

/* ── MALUS AUTOMATIQUE À 23h59 ───────────────────────────────────
   Pour chaque colocataire qui n'a PAS validé sa mission :
   1. Retire 2 points (minimum 0, jamais négatif)
   2. Enregistre la semaine comme "tache_en_retard" dans Supabase
   3. Insère une ligne dans les logs (type: malus_auto)
   4. Envoie une notification récapitulative

   Ce malus ne s'applique QU'UNE SEULE FOIS par semaine
   grâce à la clé de cache "malus_week_XX"                    */
async function handleAutoMalus(now) {
    const weekNum  = getWeekNumber();
    const malusKey = `malus_week_${weekNum}`;
    const cache    = await caches.open(CACHE_NAME);

    /* Vérifie si le malus de cette semaine a déjà été appliqué */
    if (await cache.match(malusKey)) return;
    await cache.put(malusKey, new Response('done'));

    try {
        /* Récupère tous les utilisateurs avec leurs infos */
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/scores?select=id,name,points,last_week_validated,tache_en_retard,retard_valide`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const users = await res.json();

        /* Filtre : non-validés ET sans retard déjà en cours */
        const nonValides = users.filter(u =>
            u.last_week_validated !== weekNum &&
            !u.tache_en_retard
        );

        if (nonValides.length === 0) return;

        /* Applique le malus à chaque non-validé */
        for (const user of nonValides) {
            const newPoints = Math.max(0, user.points - 2); // Jamais en dessous de 0

            /* Met à jour le score ET enregistre la semaine en retard */
            await fetch(`${SUPABASE_URL}/rest/v1/scores?id=eq.${user.id}`, {
                method : 'PATCH',
                headers: {
                    'apikey'      : SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer'      : 'return=minimal'
                },
                body: JSON.stringify({
                    points          : newPoints,
                    tache_en_retard : weekNum, // numéro de la semaine non faite
                    retard_valide   : false    // pas encore rattrapé
                })
            });

            /* Ajoute une entrée dans le journal d'activité */
            await fetch(`${SUPABASE_URL}/rest/v1/logs`, {
                method : 'POST',
                headers: {
                    'apikey'      : SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer'      : 'return=minimal'
                },
                body: JSON.stringify({
                    name          : user.name,
                    points_gagnes : -2,
                    type          : 'malus_auto' // distingue du malus manuel admin
                })
            });
        }

        /* Notification récapitulative après application des malus */
        const names = nonValides.map(u => u.name).join(', ');
        self.registration.showNotification('🚨 Malus automatique appliqué !', {
            body   : `${names} ${nonValides.length > 1 ? 'ont' : 'a'} perdu 2 points — tâche non validée. Rattrapage obligatoire la semaine prochaine.`,
            icon   : '/icon-192.png',
            vibrate: [300, 100, 300],
            tag    : malusKey,
        });

    } catch (e) {
        console.error('[SW] Erreur malus auto :', e);
    }
}

/* ── HELPER : LISTE DES NON-VALIDÉS ─────────────────────────────
   Interroge Supabase et retourne les noms des colocataires
   qui n'ont pas encore validé leur mission cette semaine      */
async function getUnvalidatedColocs() {
    try {
        const weekNum = getWeekNumber();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/scores?select=name,last_week_validated`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const users = await res.json();
        return users
            .filter(u => u.last_week_validated !== weekNum)
            .map(u => u.name);
    } catch (e) {
        return [];
    }
}

/* ── HELPER : NUMÉRO DE SEMAINE ─────────────────────────────
   Calcule le numéro de semaine basé sur le LUNDI.
   Chaque lundi à 00h00 → nouvelle semaine → nouvelles missions.
   Dimanche soir ≠ lundi matin (semaines différentes).        */
function getWeekNumber() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const days = Math.floor((monday - startOfYear) / 86400000);
    return Math.floor(days / 7) + 1;
}

/* ── GESTION DU CLIC SUR UNE NOTIFICATION ───────────────────────
   Quand l'utilisateur clique sur la notif :
   - "Valider maintenant" → ouvre ou focus l'app
   - "Ignorer" → ferme juste la notification                   */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                /* Si l'app est déjà ouverte → met le focus dessus */
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                /* Sinon → ouvre une nouvelle fenêtre */
                return clients.openWindow('/');
            })
    );
});
