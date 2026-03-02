// ==UserScript==
// @name         WhatsApp Web Lock & Privacy Shield (v7.0)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Password Lock + Aggressive Privacy Blur. Forces messages to blur.
// @author       Randun Labs
// @license      MIT
// @match        https://web.whatsapp.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=whatsapp.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. BLOCK WHATSAPP IMMEDIATELY (Security)
    const styleBlock = document.createElement('style');
    styleBlock.id = 'tm-block-style';
    styleBlock.innerHTML = `
        #app, ._1XkO3, body > div:not(#tm-lock-screen) {
            filter: blur(20px) !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        body { background-color: #111b21 !important; overflow: hidden !important; }
    `;
    (document.head || document.documentElement).appendChild(styleBlock);

    // ==========================================
    // CONFIGURATION
    // ==========================================
    const CONFIG = {
        password: GM_getValue('wa_password', null),
        // We use new keys (v7) to FORCE reset your settings to TRUE
        enabled: GM_getValue('enabled_v7', true),
        blurMessages: GM_getValue('blurMessages_v7', true), 
        blurNames: GM_getValue('blurNames_v7', true),
        blurImages: GM_getValue('blurImages_v7', true),
        blurIntensity: GM_getValue('blurIntensity', 8),
        opacity: GM_getValue('opacity', 0.5)
    };

    // ==========================================
    // 🔒 LOCK SCREEN
    // ==========================================
    function showLockScreen() {
        if (document.getElementById('tm-lock-screen')) return;

        const container = document.createElement('div');
        container.id = 'tm-lock-screen';
        container.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: #111b21; z-index: 9999999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: white; font-family: Segoe UI, sans-serif;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #202c33; padding: 40px; border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; width: 300px;
        `;

        const title = document.createElement('h2');
        title.innerText = CONFIG.password ? "WhatsApp Locked" : "Set Password";
        title.style.margin = "0 0 20px 0";

        const input = document.createElement('input');
        input.type = "password";
        input.placeholder = "Enter Password";
        input.style.cssText = `
            width: 100%; padding: 10px; margin-bottom: 20px;
            border-radius: 5px; border: 1px solid #555;
            background: #111b21; color: white; text-align: center; font-size: 16px;
        `;

        const btn = document.createElement('button');
        btn.innerText = CONFIG.password ? "UNLOCK" : "SAVE PASSWORD";
        btn.style.cssText = `
            width: 100%; padding: 10px; border: none; border-radius: 5px;
            background: #00a884; color: black; font-weight: bold; cursor: pointer;
        `;

        const error = document.createElement('div');
        error.style.cssText = "color: #f15c6d; margin-top: 10px; display: none;";
        error.innerText = "Incorrect Password";

        // UNLOCK LOGIC
        const unlock = () => {
            const val = input.value;
            if (!CONFIG.password) {
                if(val.length > 0) {
                    GM_setValue('wa_password', val);
                    CONFIG.password = val;
                    title.innerText = "WhatsApp Locked";
                    alert("Password Saved! Please unlock now.");
                    input.value = "";
                }
                return;
            }

            if (val === CONFIG.password) {
                container.remove();
                // Remove blocking style
                const blocker = document.getElementById('tm-block-style');
                if(blocker) blocker.remove();
                // Start Blur
                startPrivacyEngine();
            } else {
                error.style.display = "block";
                input.value = "";
            }
        };

        btn.onclick = unlock;
        input.onkeydown = (e) => { if(e.key === 'Enter') unlock(); };

        box.appendChild(title);
        box.appendChild(input);
        box.appendChild(btn);
        box.appendChild(error);
        container.appendChild(box);
        document.body.appendChild(container);
        setTimeout(() => input.focus(), 100);
    }

    // ==========================================
    // 🛡️ PRIVACY ENGINE
    // ==========================================
    function startPrivacyEngine() {
        console.log("Randun Labs: Privacy Engine Active");

        // 1. DYNAMIC CSS
        function updateCSS() {
            const commonTransition = `transition: filter 150ms ease, opacity 150ms ease; will-change: filter, opacity;`;
            const blurRule = `filter: blur(${CONFIG.blurIntensity}px) !important; opacity: ${CONFIG.opacity} !important;`;
            
            let css = `
                .tm-blur-msg, .tm-blur-name, .tm-blur-img { ${commonTransition} }
                /* Hover Reveal */
                .tm-blur-msg:hover, .tm-blur-name:hover, .tm-blur-img:hover { filter: none !important; opacity: 1 !important; cursor: default; }
                /* No Blur on Inputs */
                div[contenteditable="true"] * { filter: none !important; opacity: 1 !important; }
            `;

            if (CONFIG.enabled) {
                if (CONFIG.blurMessages) css += `body.tm-privacy-on .tm-blur-msg:not(:hover) { ${blurRule} }`;
                if (CONFIG.blurNames) css += `body.tm-privacy-on .tm-blur-name:not(:hover) { ${blurRule} }`;
                if (CONFIG.blurImages) css += `body.tm-privacy-on .tm-blur-img:not(:hover) { ${blurRule} }`;
            }

            const styleId = 'tm-privacy-css';
            let styleEl = document.getElementById(styleId);
            if (styleEl) styleEl.innerHTML = css;
            else {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                styleEl.innerHTML = css;
                document.head.appendChild(styleEl);
            }
            document.body.classList.add('tm-privacy-on');
        }

        // 2. SCANNER LOGIC
        function processNode(node) {
            if (!node || node.nodeType !== 1) return;

            // IMAGES
            if (node.tagName === 'IMG' && !node.classList.contains('tm-blur-img')) {
                if (!node.src.includes('emoji') && !node.classList.contains('emoji')) node.classList.add('tm-blur-img');
                return;
            }

            // TEXT (Messages & Names)
            // We verify if it is NOT the input box
            if (node.closest('div[contenteditable="true"]')) return;

            // Header / Name
            const isTitle = node.hasAttribute('title') || node.closest('header') || node.closest('._21S-L'); // Common header class
            
            if (isTitle) {
                 if (!node.classList.contains('tm-blur-name')) node.classList.add('tm-blur-name');
            } else {
                // Message Detection (Broad & Aggressive)
                // Any span with dir="auto" or class "selectable-text" is likely a message
                const isMsg = node.getAttribute('dir') === 'auto' || node.classList.contains('selectable-text') || node.getAttribute('dir') === 'ltr';
                
                if (isMsg && !node.classList.contains('tm-blur-msg')) {
                     node.classList.add('tm-blur-msg');
                }
            }
        }

        function scan() {
            // Select all potential text/images
            const items = document.querySelectorAll('img[src], span[dir="auto"], span.selectable-text, span[dir="ltr"]');
            items.forEach(processNode);
        }

        // 3. OBSERVER
        let timer = null;
        const observer = new MutationObserver(() => {
            if (timer) return;
            timer = setTimeout(() => { scan(); timer = null; }, 50); // Fast 50ms check
        });
        const app = document.getElementById('app') || document.body;
        observer.observe(app, { childList: true, subtree: true });

        // Click Listener (Instant Update on Chat Switch)
        document.addEventListener('mousedown', () => { 
            setTimeout(scan, 10); 
            setTimeout(scan, 200); 
        });

        // Initialize
        updateCSS();
        scan();
        registerMenus(updateCSS);
    }

    // ==========================================
    // MENUS
    // ==========================================
    function registerMenus(updateCallback) {
        function toggle(key, name) {
            CONFIG[key] = !CONFIG[key];
            // Update V7 keys
            GM_setValue(key + '_v7', CONFIG[key]); 
            updateCallback();
            alert(`${name}: ${CONFIG[key] ? "BLURRED" : "VISIBLE"}`);
        }
        
        // Clear old menus to prevent duplicates if reloaded
        // (Tampermonkey handles this, but good practice)
        
        GM_registerMenuCommand("⚡ Toggle Global Blur", () => toggle('enabled', 'Global'));
        GM_registerMenuCommand("💬 Toggle Messages", () => toggle('blurMessages', 'Messages'));
        GM_registerMenuCommand("👤 Toggle Names", () => toggle('blurNames', 'Names'));
        GM_registerMenuCommand("🖼️ Toggle Images", () => toggle('blurImages', 'Images'));
        GM_registerMenuCommand("🔒 Change Password", () => {
             const p = prompt("New Password:"); 
             if(p) { GM_setValue('wa_password', p); CONFIG.password = p; alert("Password Saved"); }
        });
    }

    // ==========================================
    // STARTUP
    // ==========================================
    const checkReady = setInterval(() => {
        if (document.body) {
            clearInterval(checkReady);
            showLockScreen();
        }
    }, 10);

})();
