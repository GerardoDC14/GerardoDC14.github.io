"use strict";
(async()=>{
  const link=document.getElementById("abrir-demo"),status=document.getElementById("estado"),revision=document.getElementById("revision");
  try{
    const response=await fetch("./demo.json",{cache:"no-store"});if(!response.ok)throw new Error("config");
    const demo=await response.json(),url=new URL(demo.url);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||!url.hostname.endsWith(".trycloudflare.com")||url.pathname!=="/")throw new Error("url");
    if(!/^[a-f0-9]{40}$/.test(demo.revision))throw new Error("revision");
    link.href=url.href;link.removeAttribute("aria-disabled");link.removeAttribute("tabindex");
    const date=new Date(demo.verifiedAt);if(!Number.isFinite(date.getTime()))throw new Error("date");
    status.textContent=`Enlace temporal comprobado el ${new Intl.DateTimeFormat("es-MX",{dateStyle:"medium",timeStyle:"short"}).format(date)}. Su disponibilidad depende del equipo.`;
    revision.textContent=`Revisión de la aplicación comprobada: ${demo.revision}`;
  }catch{
    link.removeAttribute("href");link.setAttribute("aria-disabled","true");link.setAttribute("tabindex","-1");status.textContent="La dirección de la demo no está disponible en este momento. Solicita un enlace actualizado al responsable.";
  }
})();
