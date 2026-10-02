// ============================================================
// app.js — Núcleo PWA, Estado de Red, Instalación y Sincronización
// ============================================================
(function(){
  const st=document.getElementById("connection-status");
  function net(){if(!st)return;const on=navigator.onLine;st.className=on?"status-online":"status-offline";st.textContent=on?"● En línea":"● Sin conexión"}
  addEventListener("online",net);addEventListener("offline",net);net();
  let dp;const btn=document.getElementById("btn-instalar");
  addEventListener("beforeinstallprompt",e=>{e.preventDefault();dp=e;if(btn)btn.style.display="inline-flex"});
  btn&&btn.addEventListener("click",async()=>{if(!dp)return;dp.prompt();await dp.userChoice;dp=null;btn.style.display="none"});
  window.EPUtil={
    esc:s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
    pin:id=>{const code=String(id).replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,8);return code.length>4?code.slice(0,4)+"-"+code.slice(4):code},
    renderQr(canvas,payload){
      const context=canvas.getContext("2d");if(context)context.clearRect(0,0,canvas.width,canvas.height);
      if(typeof payload!=="string"||!payload.trim()||!window.QRCode||typeof window.QRCode.toCanvas!=="function"){this.toast("No se pudo cargar el QR; usa el PIN de entrada");return false}
      try{window.QRCode.toCanvas(canvas,payload,{width:240,margin:1,color:{dark:"#020618",light:"#ffffff"}},err=>{if(err)this.toast("No se pudo generar el QR; usa el PIN de entrada")});return true}
      catch(e){this.toast("No se pudo generar el QR; usa el PIN de entrada");return false}
    },
    toast(m){const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)},
    param:k=>new URLSearchParams(location.search).get(k)
  };
})();
