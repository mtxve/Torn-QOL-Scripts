// ==UserScript==
// @name         Torn Multi Float Viewer
// @namespace    https://torn.com/
// @version      1.0
// @description  I was told I couldn't add loadout switching to the attack loader, so I brought the items page to the attack loader.... And everywhere else. (Not going on Github)
// @author       Asemov/mtxve
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  if (window.self !== window.top) return;

  const STORAGE_KEY = "tmfv_windows_v1";
  const MIN_W = 220;
  const MIN_H = 200;
  const HDR_H = 32;
  const PAD = 8;

  const style = document.createElement("style");
  style.textContent = `
  .tmfv-popout-btn {
    position: fixed; top: 10px; right: 10px; z-index: 2147483647;
    background: rgba(0,0,0,0.7); color: #fff; font-size: 12px;
    padding: 6px 8px; border-radius: 4px; cursor: pointer; user-select: none;
  }
  .tmfv-popout-btn:hover { background: rgba(0,0,0,0.85); }
  .tmfv-window {
    position: fixed; width: 360px; height: 640px;
    min-width: ${MIN_W}px; min-height: ${HDR_H}px;
    top: 80px; left: 80px; background: #111; color: #fff;
    border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.8);
    display: flex; flex-direction: column; resize: both; overflow: hidden;
    font-family: system-ui, sans-serif; box-sizing: border-box;
  }
  .tmfv-window.tmfv-minimized { height: ${HDR_H}px !important; resize: none !important; }
  .tmfv-header {
    display: flex; align-items: center; background: rgba(0,0,0,0.8);
    border-bottom: 1px solid rgba(255,255,255,0.15);
    padding: 4px 8px; cursor: move; user-select: none; gap: 6px; min-height: ${HDR_H - 8}px;
  }
  .tmfv-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tmfv-controls { display: flex; gap: 4px; }
  .tmfv-control-btn {
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 3px; padding: 2px 5px; font-size: 11px; cursor: pointer; color: #fff;
  }
  .tmfv-control-btn:hover { background: rgba(255,255,255,0.15); }
  .tmfv-iframe { flex: 1; border: 0; width: 100%; height: 100%; background: #000; }
  .tmfv-hidden { display: none !important; }
  `;
  document.head.appendChild(style);

  const loadRaw = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } };
  const cleanAndLoad = () => {
    let a = loadRaw().filter(w => w && w.id && typeof w.src === "string" && /^https?:\/\//.test(w.src));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    return a;
  };
  const saveAll = (a) => localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  const upsert = (id, data) => {
    const a = cleanAndLoad();
    const i = a.findIndex(w => w.id === id);
    if (i === -1) {
      if (!data.src || !/^https?:\/\//.test(data.src)) return;
      a.push({ id, ...data });
    } else {
      a[i] = { ...a[i], ...data };
    }
    saveAll(a);
  };
  const removeOne = (id) => saveAll(cleanAndLoad().filter(w => w.id !== id));
  const makeId = () => "w_" + Math.random().toString(36).slice(2, 9);

  let zTop = 100000;
  const front = (el, id) => { zTop += 1; el.style.zIndex = zTop; upsert(id, { zIndex: zTop }); };

  const vw = () => Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = () => Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  function clampGeom(g) {
    const maxW = Math.max(MIN_W, vw() - PAD * 2);
    const maxH = Math.max(HDR_H, vh() - PAD * 2);
    const width = Math.max(MIN_W, Math.min(g.width ?? 360, maxW));
    const height = Math.max(HDR_H, Math.min(g.height ?? 640, maxH));
    let left = Math.max(PAD, Math.min((g.left ?? 80), vw() - PAD - 40));
    let top = Math.max(PAD, Math.min((g.top ?? 80), vh() - PAD - HDR_H));
    if (left + width > vw() - PAD) left = Math.max(PAD, vw() - PAD - width);
    if (top + height > vh() - PAD) top = Math.max(PAD, vh() - PAD - height);
    return { left, top, width, height };
  }

  const setSuppressRO = (el, v) => el.dataset.suppressRo = v ? "1" : "";

  function makeDraggable(winEl, headerEl, id) {
    let dragging=false,sx=0,sy=0,sl=0,st=0,pid=null;
    function onDown(e){if(e.target.closest(".tmfv-control-btn"))return;front(winEl,id);
      dragging=true;pid=e.pointerId;const r=winEl.getBoundingClientRect();
      sx=e.clientX;sy=e.clientY;sl=r.left;st=r.top;
      headerEl.setPointerCapture(pid);e.preventDefault();}
    function onMove(e){if(!dragging||e.pointerId!==pid)return;
      let left=sl+(e.clientX-sx);let top=st+(e.clientY-sy);
      const {width,height}=winEl.getBoundingClientRect();
      const geom=clampGeom({left,top,width,height});
      winEl.style.left=geom.left+"px";winEl.style.top=geom.top+"px";}
    function onUp(e){if(e.pointerId!==pid)return;dragging=false;
      headerEl.releasePointerCapture(pid);
      const r=winEl.getBoundingClientRect();upsert(id,{left:r.left,top:r.top});}
    headerEl.addEventListener("pointerdown",onDown);
    headerEl.addEventListener("pointermove",onMove);
    headerEl.addEventListener("pointerup",onUp);
    winEl.addEventListener("pointerdown",()=>front(winEl,id));
  }

  function trackResize(winEl,id){
    const ro=new ResizeObserver(()=>{if(winEl.classList.contains("tmfv-minimized"))return;
      if(winEl.dataset.suppressRo==="1")return;
      const r=winEl.getBoundingClientRect();const geom=clampGeom(r);
      setSuppressRO(winEl,true);
      winEl.style.width=geom.width+"px";winEl.style.height=geom.height+"px";
      winEl.style.left=geom.left+"px";winEl.style.top=geom.top+"px";
      setSuppressRO(winEl,false);
      upsert(id,{width:geom.width,height:geom.height,left:geom.left,top:geom.top});});
    ro.observe(winEl);
  }

  function hookIframe(iframe,id,titleEl){
    iframe.addEventListener("load",()=>{try{
      const href=iframe.contentWindow.location.href;
      if(href&&/^https?:\/\//.test(href))upsert(id,{src:href});
      const inner=iframe.contentDocument?.title;
      if(inner){titleEl.textContent=inner;upsert(id,{titleText:inner});}}catch{}});
  }

  function applyMin(winEl,iframeEl,id,min){
    if(min){
      const r=winEl.getBoundingClientRect();upsert(id,{lastWidth:r.width,lastHeight:r.height});
      winEl.classList.add("tmfv-minimized");iframeEl.classList.add("tmfv-hidden");
      setSuppressRO(winEl,true);winEl.style.height=HDR_H+"px";winEl.style.resize="none";setSuppressRO(winEl,false);
      upsert(id,{minimized:true});
    }else{
      const s=cleanAndLoad().find(w=>w.id===id)||{};
      const geom=clampGeom({left:parseFloat(winEl.style.left)||0,top:parseFloat(winEl.style.top)||0,
                             width:s.lastWidth||360,height:s.lastHeight||640});
      winEl.classList.remove("tmfv-minimized");iframeEl.classList.remove("tmfv-hidden");
      setSuppressRO(winEl,true);
      winEl.style.width=geom.width+"px";winEl.style.height=geom.height+"px";winEl.style.resize="both";
      setSuppressRO(winEl,false);
      upsert(id,{minimized:false,width:geom.width,height:geom.height,left:geom.left,top:geom.top});
    }
  }

  const btn=(txt,title)=>{const b=document.createElement("button");
    b.className="tmfv-control-btn";b.textContent=txt;b.title=title;return b;};

  function createWindow(o){
    const{id,src}=o;if(document.querySelector(`.tmfv-window[data-tmfv-id="${id}"]`))return;
    if(!src||!/^https?:\/\//.test(src))return;
    const wrap=document.createElement("div");wrap.className="tmfv-window";wrap.dataset.tmfvId=id;
    const g=clampGeom(o);wrap.style.left=g.left+"px";wrap.style.top=g.top+"px";
    wrap.style.width=g.width+"px";wrap.style.height=g.height+"px";
    if(o.zIndex!=null){wrap.style.zIndex=o.zIndex;if(o.zIndex>zTop)zTop=o.zIndex;}else front(wrap,id);
    const hdr=document.createElement("div");hdr.className="tmfv-header";
    const ttl=document.createElement("div");ttl.className="tmfv-title";ttl.textContent=o.titleText||"Torn";
    const ctr=document.createElement("div");ctr.className="tmfv-controls";
    const bMin=btn("▁","Minimize / Restore"),bRef=btn("↻","Reload frame"),
          bOp=btn("↗","Open in new tab"),bCl=btn("✕","Close");
    [bMin,bRef,bOp,bCl].forEach(b=>ctr.appendChild(b));
    hdr.appendChild(ttl);hdr.appendChild(ctr);
    const ifr=document.createElement("iframe");ifr.className="tmfv-iframe";ifr.src=src;
    bMin.addEventListener("click",()=>applyMin(wrap,ifr,id,!wrap.classList.contains("tmfv-minimized")));
    bRef.addEventListener("click",()=>{ifr.src=ifr.src;});
    bOp.addEventListener("click",()=>{window.open(ifr.src,"_blank");});
    bCl.addEventListener("click",()=>{wrap.remove();removeOne(id);});
    wrap.append(hdr,ifr);document.body.appendChild(wrap);
    makeDraggable(wrap,hdr,id);trackResize(wrap,id);hookIframe(ifr,id,ttl);
    upsert(id,{id,src,titleText:ttl.textContent,left:g.left,top:g.top,width:g.width,height:g.height,
               zIndex:parseInt(wrap.style.zIndex||zTop,10)||zTop,minimized:!!o.minimized,
               lastWidth:o.lastWidth||g.width,lastHeight:o.lastHeight||g.height});
    if(o.minimized)applyMin(wrap,ifr,id,true);
  }

  const spawn=()=>{
    const u=new URL(window.location.href);u.searchParams.set("XDEBUG_LAYOUT","mobile");
    const id=makeId();createWindow({id,src:u.toString(),titleText:document.title||"Torn"});
  };

  const restoreAll=()=>cleanAndLoad().forEach(createWindow);

  const ensurePopout=()=>{
    if(!document.querySelector(".tmfv-popout-btn")){
      const b=document.createElement("div");
      b.className="tmfv-popout-btn";b.textContent="📱 Popout";
      b.title="Open this page in a floating mini window (mobile mode)";
      b.addEventListener("click",spawn);
      document.body.appendChild(b);
    }
  };

  restoreAll();
  ensurePopout();
})();
