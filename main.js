/* ================================================================
   MAIN.JS — Orchestrateur principal (fetchAllData + init)
   GTM Coloc — DOIT ETRE CHARGE EN DERNIER (apres tous les autres .js)
================================================================ */

        /* ── FETCH DATA ── */
        function fetchAllData() {
            loadTaskOverrides().then(function() {
                dbGet('scores','*',[],'points.desc').then(function(allUsers) {
                    if (!allUsers || !allUsers.length) {
                        document.getElementById('tasks-container').innerHTML =
                            '<div class="text-center p-8 text-slate-400"><p class="font-bold mb-2">Aucun colocataire enregistre</p><p class="text-xs">Demande aux colocataires de creer leur compte via l\'app !</p></div>';
                        colocs = [];
                        window._lastUsers = [];
                        buildColocManageList([]);
                        return;
                    }
                    /* Separe les comptes actifs des comptes retires */
                    var users = allUsers.filter(function(u){ return u.actif !== false; });

                    /* Met a jour la liste dynamique des colocataires ACTIFS uniquement.
                       Ordre stable par id de creation pour garder la rotation coherente. */
                    var orderedById = users.slice().sort(function(a,b){ return a.id - b.id; });
                    colocs = orderedById.map(function(u){ return u.name; });

                    if (!users.length) {
                        document.getElementById('tasks-container').innerHTML =
                            '<div class="text-center p-8 text-slate-400"><p class="font-bold mb-2">Aucun colocataire actif</p></div>';
                        buildColocManageList(allUsers);
                        window._lastUsers = [];
                        return;
                    }

                    dbGet('logs','*',[],'created_at.desc',10).then(function(logs) {
                        document.getElementById('leaderboard').innerHTML = users.map(function(u,i){
                            var r=(u.tache_en_retard&&!u.retard_valide)?'<span class="text-red-500 text-[8px] ml-1">retard</span>':'';
                            return '<div class="flex justify-between items-center py-2 lg:py-3"><span class="text-xs lg:text-sm font-bold '+(i===0?'text-blue-500':'opacity-80')+'">'+(i===0?'🥇':i+1)+'. '+u.name+r+'</span><span class="font-black text-sm lg:text-xl">'+u.points+' <small class="text-[8px] opacity-40">PTS</small></span></div>';
                        }).join('');
                        var tl={validation:'✅ Validation',malus:'⚠️ Malus',malus_auto:'🤖 Malus auto',rattrapage:'🔄 Rattrapage'};
                        document.getElementById('history-logs').innerHTML = (logs||[]).map(function(l){
                            var col=l.points_gagnes>0?'text-green-400':l.points_gagnes<0?'text-red-400':'text-slate-400';
                            return '<div class="flex justify-between items-center border-b border-white/5 pb-2"><div class="flex flex-col"><span class="font-bold text-white">'+l.name+'</span><span class="opacity-40 text-[8px] uppercase font-black">'+(tl[l.type]||l.type)+'</span></div><span class="'+col+' font-black">'+(l.points_gagnes>0?'+':'')+l.points_gagnes+' pts</span></div>';
                        }).join('');
                        document.getElementById('admin-malus-list').innerHTML = users.map(function(u){
                            var r=(u.tache_en_retard&&!u.retard_valide)?'<p class="text-red-500 text-[9px]">Retard S'+u.tache_en_retard+'</p>':'';
                            return '<div class="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-3 rounded-2xl text-xs"><div class="text-left"><span class="font-bold">'+u.name+' ('+u.points+' pts)</span>'+r+'</div><button onclick="applyMalus(\''+u.id+'\',\''+u.name+'\','+u.points+')" class="bg-orange-600 text-white px-3 py-1 rounded-lg">-2 PTS</button></div>';
                        }).join('');
                        buildNotifTargets(users);
                        buildTaskOverrideList();
                        buildTaskHistory();
                        buildMsgTargets();
                        buildColocManageList(allUsers);
                        window._lastUsers = users;
                        renderTasks(users);
                        renderChart(users);
                    });
                });
            });
        }


        /* ── INIT ── */
        var _firstLoadDone = false;
        function init() {
            if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark');document.getElementById('theme-icon').innerText='🌙';}
            document.getElementById('week-info').innerText='Semaine n°'+getWeekNumber();
            if('serviceWorker' in navigator){
                navigator.serviceWorker.register('/sw.js').then(function(reg){
                    var sw=reg.active||reg.installing||reg.waiting;
                    if(sw) sw.postMessage({type:'SCHEDULE_CHECKS'});
                });
            }
            setTimeout(updateNotifStatusUI, 2000);
            checkMenageGeneral();
            /* Charge d'abord les colocataires depuis Supabase, PUIS verifie la session */
            fetchAllData();
            var waitForColocs = setInterval(function() {
                if (!_firstLoadDone && window._lastUsers !== undefined) {
                    _firstLoadDone = true;
                    clearInterval(waitForColocs);
                    checkSession();
                }
            }, 200);
            setInterval(function(){
                if(document.getElementById('admin-panel').classList.contains('hidden')){
                    loadTaskOverrides().then(function(){ if(window._lastUsers) renderTasks(window._lastUsers); });
                }
            }, 15000);
            setInterval(function(){
                if(document.getElementById('admin-panel').classList.contains('hidden')) fetchAllData();
            }, 30000);
            /* Verifie en continu que le compte est toujours actif —
               coupe l'acces immediatement si l'admin retire la personne
               pendant qu'elle utilise l'app, sans attendre un rechargement. */
            setInterval(function(){
                if (_firstLoadDone) checkSession();
            }, 5000);
        }
        init();
