/* ================================================================
   TASKS.JS — Missions, rotation dynamique, validation, historique
   GTM Coloc
================================================================ */

        /* ── REPARTITION DYNAMIQUE DES TACHES ──────────────────────────
           Il y a 5 "espaces" fixes dans l'appart (2 douches, 2 WC,
           cuisine+salon) — peu importe le nombre de colocataires.
           Si moins de 5 personnes restent, elles se repartissent
           plusieurs taches chacune cette semaine-la. Si plus de 5,
           certains ont une semaine "off" a tour de role.
        ──────────────────────────────────────────────────────── */
        function getAssignedMissions(colocIdx, weekNum) {
            var nom = colocs[colocIdx];
            var n = colocs.length;
            if (n === 0) return [];

            /* Un override manuel admin remplace tout pour cette semaine */
            if (weekNum === getWeekNumber() && taskOverridesCache[nom]) {
                return [taskOverridesCache[nom]];
            }

            /* Repartition equitable : chaque tache (parmi les 5 fixes)
               est assignee a la personne (semaine + indexTache) % nbPersonnes.
               Cela fait tourner equitablement qui fait plusieurs taches
               et qui en fait une seule (ou aucune si N > 5). */
            var assigned = [];
            for (var mIdx = 0; mIdx < missions.length; mIdx++) {
                if (((weekNum + mIdx) % n) === (colocIdx % n)) {
                    assigned.push(missions[mIdx]);
                }
            }
            return assigned;
        }

        function getWeekNumber() {
            var now = new Date();
            var startOfYear = new Date(now.getFullYear(), 0, 1);
            var day = now.getDay();
            var monday = new Date(now);
            monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            monday.setHours(0,0,0,0);
            return Math.floor(Math.floor((monday - startOfYear) / 86400000) / 7) + 1;
        }

        /* Renvoie la 1ere tache assignee — utilise pour l'historique
           et l'affichage compact (retro-compatibilite). */
        function getMissionRaw(colocIdx, weekNum) {
            var arr = getAssignedMissions(colocIdx, weekNum);
            return arr.length ? arr[0] : '— Repos cette semaine —';
        }


        /* ── RENDU CARTES ── */
        function escAttr(s) {
            return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        function renderTasks(users) {
            var week = getWeekNumber();
            var c = document.getElementById('tasks-container');
            c.innerHTML = '';
            colocs.forEach(function(nom, i) {
                var user = users.find(function(u){return u.name===nom;});
                if (!user) return;
                var aRetard = user.tache_en_retard && !user.retard_valide;
                var rattrapé = user.tache_en_retard && user.retard_valide;
                var extraM = taskOverridesCache[nom + '_extra'] || '';
                var extraHtml = extraM ? '<p class="text-[8px] text-purple-500 font-bold mt-1">➕ Bonus : ' + extraM + '</p>' : '';

                /* ── CARTE RETARD (tache non faite la semaine precedente) ── */
                if (aRetard) {
                    var mr = getMissionRaw(i, user.tache_en_retard);
                    var okRetard = user.retard_valide === true;
                    c.innerHTML +=
                        '<div class="mission-card mission-retard p-3 lg:p-4 rounded-3xl border-2 flex justify-between items-center">' +
                        '<div class="leading-tight"><div class="flex items-center gap-2 mb-1">' +
                        '<p class="text-[8px] font-black text-red-500 uppercase">' + nom + '</p>' +
                        '<span class="bg-red-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full">RETARD S' + user.tache_en_retard + '</span></div>' +
                        '<p class="font-bold text-xs lg:text-base text-red-700 dark:text-red-300">' + mr + '</p>' +
                        '<p class="text-[8px] text-red-400 font-bold">A faire en priorite</p></div>' +
                        (okRetard ? '<span class="bg-green-500/20 text-green-600 px-4 py-2 rounded-xl text-[9px] font-bold">✅ Rattrape</span>' :
                            '<button onclick="validerRetard(\'' + nom + '\')" class="bg-red-500 text-white px-4 py-2 rounded-xl font-black text-[9px] shadow-lg active:scale-95">RATTRAPER</button>') +
                        '</div>';
                }

                /* ── TACHE(S) DE LA SEMAINE EN COURS ──────────────────────
                   Une personne peut avoir 0, 1 ou plusieurs taches cette
                   semaine selon le nombre de colocataires restants. */
                var assignedMissions = getAssignedMissions(i, week);
                var allDone = user.last_week_validated === week;
                var doneList = allDone ? assignedMissions.slice() :
                    ((user.partial_week === week && user.done_missions) ? user.done_missions.split('||').filter(Boolean) : []);

                if (assignedMissions.length === 0) {
                    /* Personne au repos cette semaine (plus de colocs que de taches) */
                    c.innerHTML +=
                        '<div class="mission-card bg-slate-50 dark:bg-slate-800/40 p-3 lg:p-4 rounded-3xl border border-slate-200 dark:border-dashed dark:border-slate-700 flex justify-between items-center opacity-70">' +
                        '<div class="leading-tight"><p class="text-[8px] font-black text-blue-500 uppercase">' + nom + '</p>' +
                        '<p class="font-bold text-xs lg:text-base dark:text-white">😌 Repos cette semaine</p>' + extraHtml + '</div></div>';
                } else {
                    assignedMissions.forEach(function(missionText, mIdx) {
                        var isDone = doneList.indexOf(missionText) !== -1;
                        var badge = assignedMissions.length > 1 ? '<span class="bg-indigo-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full ml-1">' + (mIdx+1) + '/' + assignedMissions.length + '</span>' : '';
                        var showExtra = (mIdx === 0) ? extraHtml : '';
                        var showRattrape = (mIdx === 0 && rattrapé) ? '<p class="text-[8px] text-green-500 font-bold">Retard rattrape !</p>' : '';
                        c.innerHTML +=
                            '<div class="mission-card bg-slate-50 dark:bg-slate-800/40 p-3 lg:p-4 rounded-3xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">' +
                            '<div class="leading-tight"><p class="text-[8px] font-black text-blue-500 uppercase">' + nom + badge + '</p>' +
                            '<p class="font-bold text-xs lg:text-base dark:text-white">' + missionText + '</p>' +
                            showExtra + showRattrape + '</div>' +
                            '<button onclick="addPoints(this.dataset.nom, this.dataset.mission)" data-nom="' + escAttr(nom) + '" data-mission="' + escAttr(missionText) + '" class="' +
                            (isDone?'bg-green-500/20 text-green-500 px-4 py-2 rounded-xl text-[9px] font-bold':'bg-blue-600 text-white px-4 py-2 lg:px-6 lg:py-3 rounded-xl font-black text-[9px] lg:text-xs shadow-lg') +
                            '" ' + (isDone?'disabled':'') + '>' + (isDone?'✅':'VALIDER') + '</button></div>';
                    });
                }
            });
        }


        function renderChart(users) {
            var ctx = document.getElementById('scoreChart').getContext('2d');
            var isDark = document.documentElement.classList.contains('dark');
            if (myChart) myChart.destroy();
            myChart = new Chart(ctx, {
                type:'bar',
                data:{labels:users.map(function(u){return u.name;}),datasets:[{data:users.map(function(u){return u.points;}),backgroundColor:'#3b82f6',borderRadius:6}]},
                options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{
                    y:{beginAtZero:true,grid:{color:isDark?'#1e293b':'#f1f5f9'},ticks:{color:isDark?'#64748b':'#94a3b8',font:{size:9}}},
                    x:{grid:{display:false},ticks:{color:isDark?'#64748b':'#94a3b8',font:{size:9}}}
                }}
            });
        }


        /* ── ACTIONS TACHES ── */
        /* ── ACTIONS ── */
        function validerRetard(nom) {
            dbGet('scores','*').then(function(all) {
                var user = all.find(function(u){return u.name===nom;});
                if (!user) return;
                fetch(SUPABASE_URL + '/rest/v1/scores?id=eq.' + user.id, {
                    method:'PATCH',
                    headers:Object.assign({},HEADERS,{'Prefer':'return=representation'}),
                    body:JSON.stringify({retard_valide:true, tache_en_retard:null})
                }).then(function(r){return r.json();}).then(function(){
                    dbInsert('logs',{name:nom,points_gagnes:0,type:'rattrapage'});
                    showToast(nom+' — Rattrapage valide !');
                    fetchAllData();
                });
            });
        }

        function addPoints(nom, missionText) {
            var wn = getWeekNumber();
            dbGet('scores','*').then(function(all) {
                var user = all.find(function(u){return u.name===nom;});
                if (!user || user.last_week_validated===wn) return;

                var colocIdx = colocs.indexOf(nom);
                var assigned = getAssignedMissions(colocIdx, wn);
                if (assigned.indexOf(missionText) === -1) { showToast('Cette tache n est plus assignee a '+nom+' — actualise la page.'); return; }

                /* Recupere les taches deja validees cette semaine pour cette personne */
                var doneList = (user.partial_week === wn && user.done_missions) ? user.done_missions.split('||').filter(Boolean) : [];
                if (doneList.indexOf(missionText) !== -1) { showToast('Deja valide !'); return; }
                doneList.push(missionText);
                var allDoneNow = doneList.length >= assigned.length;

                var upd = {
                    points: user.points + 1,
                    partial_week: wn,
                    done_missions: allDoneNow ? '' : doneList.join('||')
                };
                if (allDoneNow) upd.last_week_validated = wn;

                fetch(SUPABASE_URL + '/rest/v1/scores?id=eq.' + user.id, {
                    method:'PATCH',
                    headers:Object.assign({},HEADERS,{'Prefer':'return=representation'}),
                    body:JSON.stringify(upd)
                }).then(function(r){return r.json();}).then(function(data){
                    if (!data || (Array.isArray(data) && data.length===0)) { showToast('Erreur — reessaie !'); return; }
                    dbInsert('logs',{name:nom,points_gagnes:1,type:'validation'});
                    playValidationSound();
                    var suffix = allDoneNow ? ' — Toutes tes taches sont faites ! 🎉' : ' ('+doneList.length+'/'+assigned.length+')';
                    showToast(nom+' — +1 point'+suffix);
                    sendNtfyNotification(nom+' a valide une tache !', nom+' — '+missionText+' est fait !', colocs.filter(function(c){return c!==nom;}), false);
                    fetchAllData();
                }).catch(function(e){ console.error('addPoints error:', e); showToast('Erreur reseau !'); });
            });
        }

        /* ── HISTORIQUE ── */
        function buildTaskHistory() {
            var c = document.getElementById('task-history');
            if (!c) return;
            var week = getWeekNumber();
            var html = '<table style="border-collapse:collapse;width:100%"><tr><th style="padding:3px 4px;text-align:left;font-weight:900;color:#6366f1">Coloc</th>';
            for (var w=week-7; w<=week; w++) {
                html += '<th style="padding:3px 4px;text-align:center;color:#94a3b8">' + (w===week?'<b>S'+w+'★</b>':'S'+w) + '</th>';
            }
            html += '</tr>';
            colocs.forEach(function(nom,i){
                html += '<tr style="border-top:1px solid #e2e8f0"><td style="padding:3px 4px;font-weight:900;color:#1e293b">'+nom+'</td>';
                for (var w=week-7; w<=week; w++) {
                    var m = getMissionRaw(i, w);
                    var color = '#64748b';
                    if (m.indexOf('Douche')!==-1) color='#3b82f6';
                    else if (m.indexOf('WC')!==-1) color='#8b5cf6';
                    else if (m.indexOf('Cuisine')!==-1||m.indexOf('Salon')!==-1) color='#16a34a';
                    var short = m.replace(/[🚿🚽🧻🧹🪣🏠📦🧽🧊🪟🗑️🧺]/g,'').trim().slice(0,10);
                    html += '<td style="padding:3px 4px;text-align:center;color:'+color+';background:'+(w===week?'#eff6ff':'transparent')+';font-weight:700">'+short+'</td>';
                }
                html += '</tr>';
            });
            html += '</table>';
            c.innerHTML = html;
        }


        /* ── OVERRIDES ── */
        function loadTaskOverrides() {
            var wn = getWeekNumber();
            return dbGet('task_overrides','*',['semaine=eq.'+wn]).then(function(rows){
                taskOverridesCache = {};
                (rows||[]).forEach(function(r){ taskOverridesCache[r.nom] = r.mission; });
                return taskOverridesCache;
            });
        }

        function buildTaskOverrideList() {
            var c = document.getElementById('task-override-list');
            if (!c) return;
            var week = getWeekNumber();
            c.innerHTML = colocs.map(function(nom,i){
                var currentMission = taskOverridesCache[nom] || getMissionRaw(i, week);
                var extraMission = taskOverridesCache[nom+'_extra'] || '';
                var hasOverride = !!taskOverridesCache[nom];
                var hasExtra = !!extraMission;

                /* Options select tâche principale */
                var mainOptions = allTasks.map(function(m){
                    return '<option value="'+m+'"'+(m===currentMission?' selected':'')+'>'+m+'</option>';
                }).join('');

                /* Options select tâche bonus */
                var extraOptions = '<option value="">— Aucune tache bonus —</option>' +
                    allTasks.map(function(m){
                        return '<option value="'+m+'"'+(m===extraMission?' selected':'')+'>'+m+'</option>';
                    }).join('');

                return '<div class="bg-white dark:bg-slate-900 rounded-xl p-2 flex flex-col gap-2 border border-slate-100 dark:border-slate-700">' +

                    /* En-tête */
                    '<div class="flex justify-between items-center">' +
                    '<p class="text-[9px] font-black text-blue-500 uppercase">'+nom+'</p>' +
                    '<div class="flex gap-1">' +
                    (hasOverride?'<span class="text-[8px] text-orange-500 font-bold">Modifie</span>':'<span class="text-[8px] text-slate-400">Auto</span>') +
                    (hasExtra?'<span class="text-[8px] text-purple-500 font-bold ml-1">+Bonus</span>':'') +
                    '</div></div>' +

                    /* Tâche principale — menu déroulant */
                    '<div><p class="text-[8px] text-slate-400 font-bold mb-1">Tache principale :</p>' +
                    '<select onchange="overrideTask(this.dataset.nom, this.value)" data-nom="'+nom+'" class="w-full text-[10px] p-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold">'+mainOptions+'</select></div>' +

                    /* Tâche bonus — menu + saisie libre */
                    '<div><p class="text-[8px] text-purple-500 font-bold mb-1">+ Tache bonus :</p>' +
                    '<div class="flex gap-1 mb-1">' +
                    '<select onchange="overrideExtraTask(this.dataset.nom, this.value)" data-nom="'+nom+'" class="flex-1 text-[10px] p-1 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800 font-bold">'+extraOptions+'</select>' +
                    (hasExtra?'<button onclick="removeExtraTask(this.dataset.nom)" data-nom="'+nom+'" class="bg-red-500 text-white px-2 rounded-lg text-[9px] font-black">✕</button>':'') +
                    '</div>' +

                    /* Saisie libre pour tâche bonus personnalisée */
                    '<div class="flex gap-1">' +
                    '<input type="text" placeholder="Ou saisir une tache libre..." data-nom="'+nom+'" id="custom-extra-'+nom+'" ' +
                    'class="flex-1 text-[10px] p-1 rounded-lg border border-purple-100 dark:border-purple-800 bg-white dark:bg-slate-800 font-medium" />' +
                    '<button onclick="applyCustomExtra(\''+nom+'\')" class="bg-purple-600 text-white px-2 rounded-lg text-[9px] font-black">+</button>' +
                    '</div></div>' +

                    /* Bouton sauvegarder */
                    '<button onclick="saveAllForColoc(this.dataset.nom)" data-nom="'+nom+'" class="w-full bg-green-600 text-white py-1.5 rounded-xl text-[9px] font-black active:scale-95 transition-all">💾 Sauvegarder</button>' +
                    '</div>';
            }).join('');
        }

        /* Applique une tâche bonus saisie librement */
        function applyCustomExtra(nom) {
            var input = document.getElementById('custom-extra-'+nom);
            if (!input || !input.value.trim()) { showToast('Ecris une tache !'); return; }
            var mission = '✏️ ' + input.value.trim();
            taskPendingChanges[nom+'_extra'] = mission;
            /* Met à jour visuellement le select et marque sauvegarder */
            var selects = document.querySelectorAll('select[data-nom="'+nom+'"]');
            selects.forEach(function(sel){
                if (sel.options[0] && sel.options[0].value === '') {
                    /* C'est le select bonus — ajoute l'option si elle n'existe pas */
                    var exists = false;
                    for (var i=0; i<sel.options.length; i++) {
                        if (sel.options[i].value === mission) { sel.selectedIndex = i; exists = true; break; }
                    }
                    if (!exists) {
                        var opt = document.createElement('option');
                        opt.value = mission; opt.text = mission; opt.selected = true;
                        sel.appendChild(opt);
                    }
                }
            });
            input.value = '';
            /* Marque le bouton sauvegarder */
            markSaveButton(nom);
            showToast('Tache "'+mission+'" prete — clique Sauvegarder !');
        }

        function markSaveButton(nom) {
            var btns = document.querySelectorAll('button[data-nom="'+nom+'"]');
            btns.forEach(function(btn){
                if (btn.textContent.indexOf('Sauvegarder') !== -1) {
                    btn.classList.remove('bg-green-600');
                    btn.classList.add('bg-orange-500');
                    btn.textContent = '💾 Sauvegarder *';
                }
            });
        }

        function overrideTask(nom, mission) {
            taskPendingChanges[nom] = mission;
            markSaveButton(nom);
        }

        function overrideExtraTask(nom, mission) {
            if (!mission) { removeExtraTask(nom); return; }
            taskPendingChanges[nom+'_extra'] = mission;
            markSaveButton(nom);
        }

        function removeExtraTask(nom) {
            var wn = getWeekNumber();
            dbDelete('task_overrides',['nom=eq.'+nom+'_extra','semaine=eq.'+wn]).then(function(){
                delete taskOverridesCache[nom+'_extra'];
                showToast('Tache bonus supprimee');
                loadTaskOverrides().then(function(){
                    buildTaskOverrideList();
                    window._lastUsers && renderTasks(window._lastUsers);
                });
            });
        }

        function saveAllForColoc(nom) {
            var hasMain = !!taskPendingChanges[nom];
            var hasExtra = !!taskPendingChanges[nom+'_extra'];
            if (!hasMain && !hasExtra) { showToast('Aucun changement pour '+nom); return; }
            var wn = getWeekNumber();
            var promises = [];
            if (hasMain) promises.push(fetch(SUPABASE_URL+'/rest/v1/task_overrides',{
                method:'POST',
                headers:Object.assign({},HEADERS,{'Prefer':'resolution=merge-duplicates'}),
                body:JSON.stringify({nom:nom, mission:taskPendingChanges[nom], semaine:wn})
            }).then(function(){ taskOverridesCache[nom]=taskPendingChanges[nom]; delete taskPendingChanges[nom]; }));
            if (hasExtra) promises.push(fetch(SUPABASE_URL+'/rest/v1/task_overrides',{
                method:'POST',
                headers:Object.assign({},HEADERS,{'Prefer':'resolution=merge-duplicates'}),
                body:JSON.stringify({nom:nom+'_extra', mission:taskPendingChanges[nom+'_extra'], semaine:wn})
            }).then(function(){ taskOverridesCache[nom+'_extra']=taskPendingChanges[nom+'_extra']; delete taskPendingChanges[nom+'_extra']; }));
            Promise.all(promises).then(function(){
                showToast('Taches de '+nom+' sauvegardees ! ✅');
                loadTaskOverrides().then(function(){
                    buildTaskOverrideList();
                    buildTaskHistory();
                    window._lastUsers && renderTasks(window._lastUsers);
                });
            });
        }

        function resetTaskOverrides() {
            var wn = getWeekNumber();
            dbDelete('task_overrides',['semaine=eq.'+wn]).then(function(){
                taskOverridesCache = {};
                showToast('Rotation automatique retablie !');
                buildTaskOverrideList();
                buildTaskHistory();
                fetchAllData();
            });
        }

