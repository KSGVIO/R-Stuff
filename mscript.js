const DEFAULTS = { owner: "KSGVIO", repo: "R-Stuff", branch: "brenciu" };

document.addEventListener("DOMContentLoaded", () => {
  // --- Mobile redirect ---

  const els = {
    breadcrumbs: document.getElementById("breadcrumbs"),
    tbody: document.getElementById("tbody"),
    status: document.getElementById("status"),
    notice: document.getElementById("notice"),
    search: document.getElementById("search"),
    preview: document.getElementById("preview"),
    githubLink: document.getElementById("githubLink"),
    // login
    loginPanel: document.getElementById("loginPanel"),
    loginUser: document.getElementById("loginUser"),
    loginPwd: document.getElementById("loginPwd"),
    loginBtn: document.getElementById("loginBtn"),
    loginMsg: document.getElementById("loginMsg"),
  };

  /// add close button
  const closeBtn = document.createElement("button");
  closeBtn.id = "closePreviewBtn";
  closeBtn.className = "close-preview hidden";
  closeBtn.textContent = "✕ Close";
  els.preview.prepend(closeBtn);
  els.closePreviewBtn = closeBtn;

  const state = {
    path: decodeURIComponent(location.hash.replace(/^#/, "")) || "",
    entries: [],
    filter: "",
  };

  const api = (o, r, p, b) =>
    `https://api.github.com/repos/${o}/${r}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(b)}`;
  const rawUrl = (o, r, fp, b) =>
    `https://raw.githubusercontent.com/${o}/${r}/${encodeURIComponent(b)}/${fp}`;
  const repoUrl = (o, r) => `https://github.com/${o}/${r}`;

  function setStatus(kind, msg) {
    els.status.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "dot " + (kind || "warn");
    els.status.appendChild(dot);
    els.status.appendChild(document.createTextNode(" " + msg));
  }
  function setNotice(t) {
    els.notice.textContent = t || "";
    els.notice.classList.toggle("hidden", !t);
  }

  function updateBreadcrumbs(owner, repo) {
    const parts = state.path.split("/").filter(Boolean);
    const frag = document.createDocumentFragment();
    let acc = "";
    parts.forEach((part, i) => {
      if (i > 0) frag.appendChild(spanSep());
      const a = document.createElement("a");
      acc += (i ? "/" : "") + part;
      a.href = "#" + acc;
      a.textContent = part;
      a.onclick = (e) => { e.preventDefault(); navigate(acc); };
      frag.appendChild(a);
    });
    els.breadcrumbs.innerHTML = "";
    els.breadcrumbs.appendChild(frag);
    els.githubLink.href = repoUrl(owner, repo);
  }
  const spanSep = () => Object.assign(document.createElement("span"), { className: "sep", textContent: " / " });
  const fmtSize = (bytes) => {
    if (bytes == null) return "";
    const u = ["B","KB","MB","GB"];
    let i=0,n=bytes;
    while(n>=1024 && i<u.length-1){ n/=1024; i++; }
    return (Math.round(n*10)/10)+" "+u[i];
  };
  function icon(kind) {
    const svg = kind==="dir"
      ? `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" stroke="currentColor" stroke-width="1.5"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5"/></svg>`;
    const span=document.createElement("span"); span.innerHTML=svg; return span.firstChild;
  }

  function renderTable(owner, repo, branch) {
    updateBreadcrumbs(owner, repo, branch);
    let rows = state.entries.slice();
    if (state.filter) {
      const q = state.filter.toLowerCase();
      rows = rows.filter(x => x.name.toLowerCase().includes(q));
    }
    rows.sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name):a.type==="dir"?-1:1);
    els.tbody.innerHTML = "";
    for(const it of rows){
      const tr=document.createElement("tr");
      const nameTd=document.createElement("td");
      const typeTd=document.createElement("td");
      const sizeTd=document.createElement("td");
      const rowDiv=document.createElement("div");
      rowDiv.className="row";
      rowDiv.onclick=(e)=>{ e.preventDefault(); it.type==="dir"?navigate(joinPath(state.path,it.name)):showPreview(owner,repo,branch,joinPath(state.path,it.name)); };
      rowDiv.appendChild(icon(it.type==="dir"?"dir":"file"));
      const text=document.createElement("span"); text.textContent=it.name;
      rowDiv.appendChild(text);
      nameTd.appendChild(rowDiv);
      typeTd.textContent=it.type;
      sizeTd.textContent=it.type==="file"?fmtSize(it.size):"";
      tr.append(nameTd,typeTd,sizeTd);
      els.tbody.appendChild(tr);
    }
  }

  const joinPath = (a,b)=>[a,b].filter(Boolean).join("/");

  async function fetchContents(o,r,p,b){
    setStatus("warn","Loading "+(p||"/")+" …"); setNotice("");
    try {
      const res=await fetch(api(o,r,p,b));
      if(!res.ok){ setNotice("Error "+res.status+" "+res.statusText); setStatus("err","Error"); state.entries=[]; renderTable(o,r,b); return; }
      const data=await res.json();
      if(!Array.isArray(data)){ setNotice("This path is a file."); state.entries=[]; renderTable(o,r,b); return; }
      state.entries=data.map(x=>({name:x.name,path:x.path,type:x.type,size:x.size??null}));
      renderTable(o,r,b); setStatus("ok","Loaded "+(p||"/"));
    } catch(err){ console.error(err); setNotice("Network error: "+err.message); setStatus("err","Network error"); }
  }

  function navigate(path){ state.path=path||""; location.hash=encodeURIComponent(state.path); doLoad(); }
  function doLoad(){ const {owner,repo,branch}=DEFAULTS; fetchContents(owner,repo,state.path,branch); }

  function showPreview(o,r,b,fp){
    const url=rawUrl(o,r,fp,b);
    const ext=fp.split(".").pop().toLowerCase();
    els.preview.innerHTML="";
    els.preview.appendChild(els.closePreviewBtn);
    els.closePreviewBtn.classList.remove("hidden");

    // filename label
    const label=document.createElement("div");
    label.className="preview-filename";
    label.textContent=fp.split("/").pop();
    els.preview.appendChild(label);

    let el=null;
    const setLabelWidth=w=>{ label.style.maxWidth=(w+40)+"px"; };

    if(["png","jpg","jpeg","gif","webp"].includes(ext)){
      el=document.createElement("img"); el.src=url;
      el.onload=()=>{ setLabelWidth(el.naturalWidth>400?400:el.naturalWidth); };
      els.preview.appendChild(el);
    } else if(["mp4","webm"].includes(ext)){
      el=document.createElement("video"); el.src=url; el.controls=true;
      el.onloadedmetadata=()=>{ setLabelWidth(el.videoWidth>400?400:el.videoWidth); };
      els.preview.appendChild(el);
    } else if(["mp3","wav","ogg"].includes(ext)){
      el=document.createElement("audio"); el.src=url; el.controls=true;
      setLabelWidth(400); els.preview.appendChild(el);
    } else {
      els.preview.textContent="No preview available for this file.";
    }

    if(el){
      const dl=document.createElement("a");
      dl.href=url; dl.download=fp.split("/").pop();
      dl.className="download-btn"; dl.textContent="Download";
      dl.onclick=(e)=>{ e.preventDefault();
        fetch(url).then(res=>res.blob()).then(blob=>{
          const a=document.createElement("a");
          a.href=URL.createObjectURL(blob);
          a.download=fp.split("/").pop(); a.click();
          URL.revokeObjectURL(a.href);
        });
      };
      els.preview.appendChild(dl);
    }
  }

  // Events
  window.addEventListener("hashchange",()=>{ state.path=decodeURIComponent(location.hash.replace(/^#/,"")); doLoad(); });
  els.search.addEventListener("input",e=>{ state.filter=e.target.value; const {owner,repo,branch}=DEFAULTS; renderTable(owner,repo,branch); });
  els.closePreviewBtn.addEventListener("click",()=>{ els.preview.innerHTML="Select a file to preview"; });

  // login
  function tryLogin(){
    const u=(els.loginUser.value||"").trim(), p=(els.loginPwd.value||"").trim();
    if(u==="bunica"&&p==="babacloanta"){ els.loginMsg.style.display="none"; els.loginPanel.style.display="none"; doLoad(); }
    else { els.loginMsg.style.display="block"; els.loginMsg.textContent="Invalid credentials"; }
  }
  els.loginBtn.addEventListener("click",tryLogin);
  els.loginUser.addEventListener("keydown",e=>{ if(e.key==="Enter") tryLogin(); });
  els.loginPwd.addEventListener("keydown",e=>{ if(e.key==="Enter") tryLogin(); });
  els.loginUser.focus();
});
