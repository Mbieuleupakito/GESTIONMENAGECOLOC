/* ================================================================
   UI.JS — Toasts, sons, theme, menage general, statut notifications
================================================================ */

        function showToast(msg, duration) {
            duration = duration || 3000;
            var t = document.getElementById('toast');
            t.textContent = msg;
            t.classList.remove('hidden');
            t.style.opacity = '1';
            t.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(function(){
                t.style.opacity = '0';
                t.style.transform = 'translateX(-50%) translateY(20px)';
                setTimeout(function(){ t.classList.add('hidden'); }, 300);
            }, duration);
        }


        /* ── NOTIF STATUS ── */
        function updateNotifStatusUI() {
            var icon=document.getElementById('notif-status');
            if (!icon) return;
            icon.classList.remove('hidden');
            icon.textContent='🔔';
            var nom=localStorage.getItem('gtm-coloc-identity');
            icon.title='Canal Ntfy : '+getNtfyChannel(nom);
        }
        function showNotifInfo() {
            closeMenu();
            var nom=localStorage.getItem('gtm-coloc-identity');
            showToast('Canal Ntfy : '+getNtfyChannel(nom));
        }

        /* ── SONS ── */
        function playAlarmSound() {
            try { var ctx=new(window.AudioContext||window.webkitAudioContext)();
                [0,.3,.6,.9,1.2,1.5,1.8].forEach(function(t){ var o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination); o.frequency.value=880;o.type='square'; g.gain.setValueAtTime(.4,ctx.currentTime+t); g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+.25); o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+.25); }); } catch(e){}
        }
        function playValidationSound() {
            try { var ctx=new(window.AudioContext||window.webkitAudioContext)();
                [523,659,784].forEach(function(freq,i){ var o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination); o.frequency.value=freq;o.type='sine'; g.gain.setValueAtTime(.25,ctx.currentTime+i*.15); g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.15+.3); o.start(ctx.currentTime+i*.15);o.stop(ctx.currentTime+i*.15+.3); }); } catch(e){}
        }
        function playRappelSound() {
            try { var ctx=new(window.AudioContext||window.webkitAudioContext)();
                [0,.4].forEach(function(t){ var o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination); o.frequency.value=660;o.type='sine'; g.gain.setValueAtTime(.3,ctx.currentTime+t); g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+.3); o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+.3); }); } catch(e){}
        }

        /* ── MODE SOMBRE ── */
        function toggleDarkMode() {
            var html=document.documentElement,icon=document.getElementById('theme-icon');
            if(html.classList.contains('dark')){html.classList.remove('dark');localStorage.setItem('theme','light');icon.innerText='🌞';}
            else{html.classList.add('dark');localStorage.setItem('theme','dark');icon.innerText='🌙';}
            if(myChart) renderChart([]);
        }


        /* ── MÉNAGE GÉNÉRAL ── */
        function checkMenageGeneral() {
            var now=new Date(), day=now.getDate(), month=now.getMonth(), year=now.getFullYear();
            var key='menage-general-'+year+'-'+month;
            if (day<=3 && !localStorage.getItem(key)) document.getElementById('menage-general-banner').classList.remove('hidden');
        }
        function validerMenageGeneral() {
            var now=new Date();
            localStorage.setItem('menage-general-'+now.getFullYear()+'-'+now.getMonth(), 'done');
            document.getElementById('menage-general-banner').classList.add('hidden');
            showToast('Menage general valide ! Bravo a tous !');
        }

