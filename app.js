let chars=[], current=null, lastReply="";
const $=id=>document.getElementById(id);
async function api(url, opts){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});const d=await r.json();if(!r.ok)throw Error(d.error||"Error");return d}
async function load(){chars=await api("/api/characters");renderChars()}
function renderChars(){
  $("characters").innerHTML=chars.map(c=>`<div class="char" data-id="${c.id}">
    <div class="avatar">${(c.name||"?")[0]}</div><div><h3>${esc(c.name)}</h3><div class="muted">${esc(c.personality||"Compañero virtual")}</div></div>
  </div>`).join("") || `<div class="empty">Crea tu primer personaje.</div>`;
  document.querySelectorAll(".char").forEach(x=>x.onclick=()=>openChat(Number(x.dataset.id)));
}
async function openChat(id){
 current=chars.find(c=>c.id===id); $("characters").classList.add("hidden");$("chat").classList.remove("hidden");$("back").classList.remove("hidden");$("subtitle").textContent=current.name;
 const history=await api("/api/history/"+id); $("messages").innerHTML=""; history.forEach(addMsg);
}
function addMsg(m){const d=document.createElement("div");d.className="msg "+(m.role==="user"?"user":"assistant");d.textContent=m.content;$("messages").appendChild(d);$("messages").scrollTop=$("messages").scrollHeight}
async function send(){
 const v=$("text").value.trim();if(!v||!current)return;$("text").value="";addMsg({role:"user",content:v});
 try{const d=await api("/api/chat",{method:"POST",body:JSON.stringify({characterId:current.id,message:v})});lastReply=d.reply;addMsg({role:"assistant",content:d.reply})}
 catch(e){addMsg({role:"assistant",content:"⚠️ "+e.message})}
}
$("send").onclick=send;$("text").onkeydown=e=>{if(e.key==="Enter")send()};
$("back").onclick=()=>{$("chat").classList.add("hidden");$("characters").classList.remove("hidden");$("back").classList.add("hidden");$("subtitle").textContent="Tus compañeros virtuales"};
$("newChar").onclick=()=>$("modal").classList.remove("hidden");$("close").onclick=()=>$("modal").classList.add("hidden");
$("create").onclick=async()=>{try{const c=await api("/api/characters",{method:"POST",body:JSON.stringify({name:$("cname").value,personality:$("cpersonality").value,appearance:$("cappearance").value})});chars.push(c);$("modal").classList.add("hidden");$("cname").value="";$("cpersonality").value="";$("cappearance").value="";renderChars()}catch(e){alert(e.message)}};
$("imageBtn").onclick=()=>$("imageModal").classList.remove("hidden");$("closeImage").onclick=()=>$("imageModal").classList.add("hidden");
$("generate").onclick=async()=>{const p=$("imagePrompt").value.trim();if(!p)return; $("generate").textContent="Generando…";$("generate").disabled=true;
 try{const d=await api("/api/image",{method:"POST",body:JSON.stringify({characterId:current.id,prompt:p})});addMsg({role:"assistant",content:"🖼️ Imagen generada:"});const img=document.createElement("img");img.className="photo";img.src=d.url;img.alt=p;$("messages").appendChild(img);$("imageModal").classList.add("hidden");$("imagePrompt").value=""}
 catch(e){alert(e.message)}finally{$("generate").textContent="Generar";$("generate").disabled=false}};
$("speak").onclick=()=>{if(lastReply && "speechSynthesis" in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(lastReply))}};
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
load();