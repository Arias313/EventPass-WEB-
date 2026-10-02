/* EPStore: capa de datos. Hoy usa localStorage + BroadcastChannel; la interfaz es la que consumirá la app móvil. */
(function(){
  const C=window.EP_CONFIG,K=C.STORAGE_KEY;
  const bc="BroadcastChannel" in window?new BroadcastChannel(C.CHANNEL):null;
  const uid=p=>p+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3);
  const read=()=>{try{return JSON.parse(localStorage.getItem(K))||{eventos:[],asistentes:[]}}catch(e){return{eventos:[],asistentes:[]}}};
  const subs=new Set();const fire=()=>subs.forEach(f=>f());
  const write=db=>{localStorage.setItem(K,JSON.stringify(db));bc&&bc.postMessage("change");fire()};
  bc&&(bc.onmessage=fire);
  window.addEventListener("storage",e=>{if(e.key===K)fire()});
  window.EPStore={
    listarEventos:()=>read().eventos,
    getEvento:id=>read().eventos.find(e=>e.id===id)||null,
    crearEvento({nombre,fecha,lugar,aforo}){
      const db=read(),ev={id:uid("ev"),nombre,fecha,lugar,aforo:Math.max(1,+aforo||1),creado:Date.now()};
      db.eventos.unshift(ev);write(db);return ev;
    },
    eliminarEvento(id){const db=read();db.eventos=db.eventos.filter(e=>e.id!==id);db.asistentes=db.asistentes.filter(a=>a.eventoId!==id);write(db)},
    getAsistentes:id=>read().asistentes.filter(a=>a.eventoId===id).sort((a,b)=>b.ts-a.ts),
    getAsistente:id=>read().asistentes.find(a=>a.id===id)||null,
    registrar(eventoId,{nombre,cedula,correo}){
      const db=read(),ev=db.eventos.find(e=>e.id===eventoId);
      if(!ev)throw new Error("El evento no existe o fue eliminado.");
      const lista=db.asistentes.filter(a=>a.eventoId===eventoId);
      const dup=lista.find(a=>a.cedula===cedula);
      if(dup)return dup;
      if(lista.length>=ev.aforo)throw new Error("El evento alcanzó su aforo máximo.");
      const a={id:uid("as"),eventoId,nombre,cedula,correo,ts:Date.now(),checkin:false};
      db.asistentes.push(a);write(db);return a;
    },
    stats(){
      const db=read(),aforo=db.eventos.reduce((s,e)=>s+e.aforo,0),reg=db.asistentes.length;
      return{eventos:db.eventos.length,registrados:reg,aforo,ocupacion:aforo?Math.round(reg/aforo*100):0};
    },
    ocupacion(id){const ev=this.getEvento(id),n=this.getAsistentes(id).length;return{n,aforo:ev?ev.aforo:0,pct:ev?Math.min(100,Math.round(n/ev.aforo*100)):0}},
    exportState:()=>read(),
    subscribe(f){subs.add(f);return()=>subs.delete(f)},
    qrPayload:a=>`EP|${a.eventoId}|${a.id}|${a.cedula}`
  };
})();
