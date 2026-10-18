/* Firefly Café Admin — vanilla JS + Supabase */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmtNaira = n => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateOnly = d => d ? new Date(d).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"}) : "—";
const timeOnly = t => t ? String(t).slice(0,5) : "—";

let db = window.supabaseClient || null;
let currentUser = null;
let currentPage = "dashboard";
let cache = { reservations: [], orders: [], categories: [], menu: [], gallery: [] };

function toast(message, type="success"){
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toastRoot").appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}
function requireDb(){
  if(!db){ toast("Connect Supabase first in supabase-config.js.", "error"); return false; }
  return true;
}
function statusClass(v){ return String(v || "").toLowerCase().replace(/\s+/g,"-"); }
function statusBadge(v){ return `<span class="status ${statusClass(v)}">${esc(v || "—")}</span>`; }

async function init(){
  bindGlobal();
  if(!db){ showLogin(); $("#loginError").hidden=false; $("#loginError").textContent="Supabase is not connected. Add your project URL and publishable key in supabase-config.js."; return; }
  const {data:{session}} = await db.auth.getSession();
  if(session){ currentUser=session.user; await showApp(); }
  else showLogin();
  db.auth.onAuthStateChange(async (_event, session)=>{
    currentUser=session?.user || null;
    if(currentUser) await showApp(); else showLogin();
  });
}
function bindGlobal(){
  $("#loginForm").addEventListener("submit", login);
  $("#togglePassword").addEventListener("click", ()=>{
    const p=$("#loginPassword"); const on=p.type==="text"; p.type=on?"password":"text"; $("#togglePassword").textContent=on?"Show":"Hide";
  });
  $("#logoutButton").addEventListener("click", async()=>{ if(db) await db.auth.signOut(); });
  $("#refreshButton").addEventListener("click", ()=>renderPage(true));
  $("#openSidebar").addEventListener("click", ()=>{ $("#sidebar").classList.add("open"); $("#mobileScrim").hidden=false; });
  $("#closeSidebar").addEventListener("click", closeMobileNav);
  $("#mobileScrim").addEventListener("click", closeMobileNav);
  $$(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
}
function closeMobileNav(){ $("#sidebar").classList.remove("open"); $("#mobileScrim").hidden=true; }
async function login(e){
  e.preventDefault();
  if(!requireDb()) return;
  const btn=$("#loginButton"); const err=$("#loginError"); err.hidden=true; btn.disabled=true; btn.textContent="Signing in…";
  const {error}=await db.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});
  if(error){ err.hidden=false; err.textContent=error.message.includes("Invalid login credentials")?"Email or password is incorrect.":error.message; }
  btn.disabled=false; btn.textContent="Sign in";
}
function showLogin(){
  $("#loginView").hidden=false; $("#appView").hidden=true;
}
async function showApp(){
  $("#loginView").hidden=true; $("#appView").hidden=false;
  const email=currentUser?.email || "Admin";
  $("#adminName").textContent=email.split("@")[0];
  $("#adminAvatar").textContent=(email[0]||"A").toUpperCase();
  await renderPage();
}
function navigate(page){
  currentPage=page;
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  closeMobileNav();
  renderPage();
}
async function renderPage(force=false){
  if(!currentUser) return;
  const titles={dashboard:"Dashboard",reservations:"Reservations",orders:"Orders",menu:"Menu",gallery:"Gallery",settings:"Site Settings"};
  $("#pageTitle").textContent=titles[currentPage] || "Dashboard";
  const view = {dashboard:renderDashboard,reservations:renderReservations,orders:renderOrders,menu:renderMenu,gallery:renderGallery,settings:renderSettings}[currentPage];
  if(view) await view(force);
}

async function fetchTable(table, options={}){
  if(!db) return {data:[],error:null};
  let q=db.from(table).select(options.select || "*");
  if(options.order) q=q.order(options.order,{ascending:options.ascending ?? false});
  if(options.limit) q=q.limit(options.limit);
  return q;
}
async function renderDashboard(){
  const root=$("#pageContent");
  root.innerHTML=`<div class="welcome"><div><div class="eyebrow">OVERVIEW</div><h1 id="greeting">Welcome back 👋</h1><div class="date-text">${new Date().toLocaleDateString("en-NG",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div></div></div><div id="dashLoading" class="panel empty">Loading dashboard…</div>`;
  const today=new Date(); const y=today.getFullYear(),m=String(today.getMonth()+1).padStart(2,"0"),d=String(today.getDate()).padStart(2,"0"), todayStr=`${y}-${m}-${d}`;
  const [r,o,mi,act]=await Promise.all([
    fetchTable("reservations",{order:"created_at",limit:100}),
    fetchTable("orders",{order:"created_at",limit:100}),
    fetchTable("menu_items",{order:"created_at",limit:500}),
    fetchTable("reservations",{order:"created_at",limit:5})
  ]);
  const reservations=r.data||[], orders=o.data||[], menu=mi.data||[];
  cache.reservations=reservations; cache.orders=orders; cache.menu=menu;
  const todayReservations=reservations.filter(x=>x.reservation_date===todayStr);
  const pending=reservations.filter(x=>x.status==="Pending");
  const todayOrders=orders.filter(x=>String(x.created_at||"").startsWith(todayStr));
  const revenue=todayOrders.reduce((s,x)=>s+Number(x.total||0),0);
  const available=menu.filter(x=>x.available!==false).length, sold=menu.filter(x=>x.available===false).length;
  const recent=[...reservations].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const greet=new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening";
  root.innerHTML=`<div class="welcome"><div><div class="eyebrow">OVERVIEW</div><h1>${greet}, Admin 👋</h1><div class="date-text">${new Date().toLocaleDateString("en-NG",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div></div></div>
  <div class="stats">
    ${stat("Today's Reservations",todayReservations.length,"Today","▣")}
    ${stat("Pending Reservations",pending.length,"Need attention","!")}
    ${stat("Today's Orders",todayOrders.length,"Recorded today","◫")}
    ${stat("Today's Revenue",fmtNaira(revenue),"Recorded orders","₦")}
    ${stat("Available Menu",available,"Currently available","✓")}
    ${stat("Sold Out",sold,"Currently unavailable","×")}
  </div>
  <div class="grid-2">
    <section class="panel"><div class="panel-head"><h3>Needs attention</h3><small>Quick actions</small></div><div class="attention">
      ${pending.length?`<div class="attention-item"><div><strong>${pending.length} pending reservation${pending.length===1?"":"s"}</strong><span>Review customer bookings</span></div><button onclick="navigate('reservations')">Review →</button></div>`:`<div class="attention-item"><div><strong>No pending reservations</strong><span>You're all caught up.</span></div></div>`}
      ${sold?`<div class="attention-item"><div><strong>${sold} menu item${sold===1?"":"s"} sold out</strong><span>Update availability when ready.</span></div><button onclick="navigate('menu')">Menu →</button></div>`:""}
      ${todayOrders.length?`<div class="attention-item"><div><strong>${todayOrders.length} order${todayOrders.length===1?"":"s"} today</strong><span>Check current order status.</span></div><button onclick="navigate('orders')">Orders →</button></div>`:""}
    </div></section>
    <section class="panel"><div class="panel-head"><h3>Recent activity</h3><small>Latest reservations</small></div>
      ${recent.length?recent.map(x=>`<div class="activity"><i class="activity-dot"></i><div><strong>Reservation from ${esc(x.customer_name)}</strong><span>${dateOnly(x.created_at)} · ${statusBadge(x.status)}</span></div></div>`).join(""):`<div class="empty">No recent activity.</div>`}
    </section>
  </div>
  <div style="height:18px"></div>
  <section class="panel"><div class="panel-head"><h3>Today's reservations</h3><button class="mini-button accent" onclick="navigate('reservations')">View all →</button></div>
  ${tableReservations(todayReservations.slice(0,6))}</section>`;
  $("#pendingBadge").hidden=pending.length===0; $("#pendingBadge").textContent=pending.length;
}
function stat(label,value,foot,icon){return `<div class="stat-card"><div class="stat-top"><span>${label}</span><b class="stat-icon">${icon}</b></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`}
function tableReservations(rows){
  if(!rows.length)return `<div class="empty">No reservations for this view.</div>`;
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Time</th><th>Guests</th><th>Status</th><th>Phone</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.customer_name)}</strong></td><td>${timeOnly(x.reservation_time)}</td><td>${esc(x.guests)}</td><td>${statusBadge(x.status)}</td><td>${esc(x.phone)}</td><td><button class="mini-button" onclick='viewReservation(${JSON.stringify(x.id)})'>View</button></td></tr>`).join("")}</tbody></table></div>`;
}

async function renderReservations(){
  const root=$("#pageContent"); root.innerHTML=`<div class="page-header"><div><div class="eyebrow">BOOKINGS</div><h1>Reservations</h1><p>Manage customer bookings and follow-ups.</p></div><button class="primary-button" onclick="openReservationModal()">+ Add reservation</button></div>
  <div class="toolbar"><input id="reservationSearch" placeholder="Search name or phone…"><select id="reservationFilter"><option>All</option><option>Today</option><option>Upcoming</option><option>Past</option><option>Pending</option><option>Confirmed</option><option>Cancelled</option><option>No-show</option></select></div>
  <section class="panel" id="reservationPanel"><div class="empty">Loading reservations…</div></section>`;
  const {data,error}=await fetchTable("reservations",{order:"reservation_date",ascending:true,limit:500});
  if(error){ $("#reservationPanel").innerHTML=`<div class="empty">Could not load reservations.<br>${esc(error.message)}</div>`; return; }
  cache.reservations=data||[]; bindReservationFilters(); drawReservationTable();
}
function bindReservationFilters(){ $("#reservationSearch").addEventListener("input",drawReservationTable); $("#reservationFilter").addEventListener("change",drawReservationTable); }
function drawReservationTable(){
  const q=($("#reservationSearch")?.value||"").toLowerCase(), filter=$("#reservationFilter")?.value||"All"; const now=new Date(); const today=now.toISOString().slice(0,10);
  let rows=cache.reservations.filter(x=>`${x.customer_name} ${x.phone}`.toLowerCase().includes(q));
  rows=rows.filter(x=>{
    if(filter==="All")return true;if(filter==="Today")return x.reservation_date===today;if(filter==="Upcoming")return x.reservation_date>=today&&!["Cancelled","No-show"].includes(x.status);if(filter==="Past")return x.reservation_date<today;return x.status===filter;
  });
  $("#reservationPanel").innerHTML=rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Phone</th><th>Date</th><th>Time</th><th>Guests</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.customer_name)}</strong><small class="muted">${esc(x.notes||"")}</small></td><td>${esc(x.phone)}</td><td>${dateOnly(x.reservation_date)}</td><td>${timeOnly(x.reservation_time)}</td><td>${esc(x.guests)}</td><td>${statusBadge(x.status)}</td><td><div class="row-actions"><button class="mini-button" onclick='viewReservation(${JSON.stringify(x.id)})'>View</button><a class="mini-button" href="tel:${esc(x.phone)}">Call</a><a class="mini-button accent" target="_blank" href="${waLink(x)}">WhatsApp</a></div></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No reservations found.</div>`;
}
function waLink(x){ const n=String(x.phone||"").replace(/\D/g,"").replace(/^0/,"234"); const msg=encodeURIComponent(`Hello ${x.customer_name}, this is Firefly Café regarding your reservation for ${x.reservation_date} at ${timeOnly(x.reservation_time)}.`); return `https://wa.me/${n}?text=${msg}`; }
function viewReservation(id){
  const x=cache.reservations.find(r=>String(r.id)===String(id)); if(!x)return;
  openModal("Reservation details",`<div class="form-grid">
    <div><label>Customer<input value="${esc(x.customer_name)}" disabled></label></div><div><label>Phone<input value="${esc(x.phone)}" disabled></label></div>
    <div><label>Date<input value="${dateOnly(x.reservation_date)}" disabled></label></div><div><label>Time<input value="${timeOnly(x.reservation_time)}" disabled></label></div>
    <div><label>Guests<input value="${esc(x.guests)}" disabled></label></div><div><label>Status<select id="modalStatus"><option ${x.status==="Pending"?"selected":""}>Pending</option><option ${x.status==="Confirmed"?"selected":""}>Confirmed</option><option ${x.status==="Cancelled"?"selected":""}>Cancelled</option><option ${x.status==="No-show"?"selected":""}>No-show</option></select></label></div>
    <div class="full-col"><label>Internal notes<textarea id="modalNotes">${esc(x.notes||"")}</textarea></label></div>
  </div>`,[
    {text:"Close",class:"secondary-button",action:closeModal},
    {text:"Save",class:"primary-button",action:async()=>{await updateReservation(x.id,$("#modalStatus").value,$("#modalNotes").value)}}
  ]);
}
async function updateReservation(id,status,notes){
  if(!requireDb())return; const {error}=await db.from("reservations").update({status,notes,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){toast(error.message,"error");return} closeModal();toast("Reservation updated.");await renderPage(true);
}
function openReservationModal(){
  openModal("Add reservation",`<div class="form-grid">
    <div><label>Customer name<input id="rName" required></label></div><div><label>Phone<input id="rPhone" required></label></div>
    <div><label>Date<input id="rDate" type="date" required></label></div><div><label>Time<input id="rTime" type="time" required></label></div>
    <div><label>Guests<input id="rGuests" type="number" min="1" value="2" required></label></div>
    <div class="full-col"><label>Notes<textarea id="rNotes"></textarea></label></div>
  </div>`,[{text:"Cancel",class:"secondary-button",action:closeModal},{text:"Create",class:"primary-button",action:createReservation}]);
}
async function createReservation(){
  const payload={customer_name:$("#rName").value.trim(),phone:$("#rPhone").value.trim(),reservation_date:$("#rDate").value,reservation_time:$("#rTime").value,guests:Number($("#rGuests").value),status:"Pending",notes:$("#rNotes").value.trim()};
  if(!payload.customer_name||!payload.phone||!payload.reservation_date||!payload.reservation_time){toast("Please complete the required fields.","error");return}
  const {error}=await db.from("reservations").insert(payload);if(error){toast(error.message,"error");return}closeModal();toast("Reservation created.");await renderPage(true);
}

async function renderMenu(){
  const root=$("#pageContent"); root.innerHTML=`<div class="page-header"><div><div class="eyebrow">FOOD & DRINK</div><h1>Menu</h1><p>Manage prices, availability and featured dishes.</p></div><button class="primary-button" onclick="openMenuModal()">+ Add item</button></div><div class="toolbar"><input id="menuSearch" placeholder="Search menu item…"><button class="secondary-button" onclick="openCategoryModal()">+ Category</button></div><div id="menuRoot"><div class="panel empty">Loading menu…</div></div>`;
  const [c,m]=await Promise.all([fetchTable("menu_categories",{order:"display_order",ascending:true}),fetchTable("menu_items",{order:"display_order",ascending:true})]);
  if(c.error||m.error){$("#menuRoot").innerHTML=`<div class="panel empty">Could not load menu. Check your Supabase tables and policies.</div>`;return}
  cache.categories=c.data||[];cache.menu=m.data||[];$("#menuSearch").addEventListener("input",drawMenu);drawMenu();
}
function drawMenu(){
  const q=($("#menuSearch")?.value||"").toLowerCase(); const root=$("#menuRoot");
  root.innerHTML=cache.categories.map(cat=>{
    const items=cache.menu.filter(x=>String(x.category_id)===String(cat.id)&&`${x.name} ${x.description||""}`.toLowerCase().includes(q));
    return `<section class="panel menu-group"><div class="menu-group-head"><h3>${esc(cat.name)}</h3><button class="mini-button accent" onclick='openMenuModal(null,${JSON.stringify(cat.id)})'>+ Item</button></div><div class="menu-items">${items.length?items.map(item=>`<div class="menu-item"><div><strong>${esc(item.name)}</strong><small>${esc(item.description||"")}</small>${item.image_url?`<span class="status done" style="margin-top:6px">In Taste of Firefly</span>`:""}</div><div><div class="price">${fmtNaira(item.price)}</div><div style="margin-top:6px">${statusBadge(item.available===false?"Sold Out":"Available")}</div></div><div class="row-actions"><button class="toggle ${item.available!==false?"on":""}" title="Toggle availability" onclick='toggleMenu(${JSON.stringify(item.id)},${item.available!==false})'><i></i></button><button class="mini-button" onclick='openMenuModal(${JSON.stringify(item.id)})'>Edit</button></div></div>`).join(""):`<div class="empty">No items in this category.</div>`}</div></section>`;
  }).join("") || `<div class="panel empty">No categories yet. Add a category to start.</div>`;
}
async function toggleMenu(id,isAvailable){
  const {error}=await db.from("menu_items").update({available:!isAvailable,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){toast(error.message,"error");return}toast(!isAvailable?"Item marked available.":"Item marked sold out.");await renderMenu();
}
function openMenuModal(id=null,categoryId=null){
  const item=id?cache.menu.find(x=>String(x.id)===String(id)):null;
  const cats=cache.categories.map(c=>`<option value="${c.id}" ${String(item?.category_id||categoryId)===String(c.id)?"selected":""}>${esc(c.name)}</option>`).join("");
  openModal(item?"Edit menu item":"Add menu item",`<div class="form-grid">
    <div class="full-col"><label>Name<input id="mName" value="${esc(item?.name||"")}></label></div>
    <div><label>Category<select id="mCategory">${cats}</select></label></div><div><label>Price (₦)<input id="mPrice" type="number" min="0" value="${item?.price??""}"></label></div>
    <div class="full-col"><label>Description<textarea id="mDesc">${esc(item?.description||"")}</textarea></label></div><div class="full-col"><label>Photo (optional)<input id="mImage" value="${esc(item?.image_url||"")}" placeholder="images/platter.jpg or https://…"><small class="muted" style="display:block;margin-top:6px;font-size:.68rem">Items with a photo appear in “A Taste of Firefly” on the menu page. Leave empty to keep an item out of it.</small></label></div>
    <div><label>Available<select id="mAvailable"><option value="true" ${item?.available!==false?"selected":""}>Available</option><option value="false" ${item?.available===false?"selected":""}>Sold Out</option></select></label></div>
    <div><label>Featured<select id="mFeatured"><option value="false" ${!item?.featured?"selected":""}>No</option><option value="true" ${item?.featured?"selected":""}>Yes</option></select></label></div>
  </div>`,[{text:"Cancel",class:"secondary-button",action:closeModal},{text:"Save",class:"primary-button",action:()=>saveMenu(item?.id)}]);
}
async function saveMenu(id){
  const payload={name:$("#mName").value.trim(),category_id:$("#mCategory").value,price:Number($("#mPrice").value),description:$("#mDesc").value.trim(),image_url:$("#mImage").value.trim()||null,available:$("#mAvailable").value==="true",featured:$("#mFeatured").value==="true",updated_at:new Date().toISOString()};
  if(!payload.name||!Number.isFinite(payload.price)){toast("Name and price are required.","error");return}
  const q=id?db.from("menu_items").update(payload).eq("id",id):db.from("menu_items").insert({...payload,display_order:cache.menu.length});
  const {error}=await q;if(error){toast(error.message,"error");return}closeModal();toast(id?"Menu item updated.":"Menu item added.");await renderMenu();
}
function openCategoryModal(){
  openModal("Add category",`<label>Category name<input id="catName"></label><label>Description<textarea id="catDesc"></textarea></label>`,[{text:"Cancel",class:"secondary-button",action:closeModal},{text:"Save",class:"primary-button",action:saveCategory}]);
}
async function saveCategory(){
  const name=$("#catName").value.trim();if(!name){toast("Category name is required.","error");return}
  const {error}=await db.from("menu_categories").insert({name,description:$("#catDesc").value.trim(),display_order:cache.categories.length});
  if(error){toast(error.message,"error");return}closeModal();toast("Category added.");await renderMenu();
}

async function renderOrders(){
  const root=$("#pageContent");root.innerHTML=`<div class="page-header"><div><div class="eyebrow">CUSTOMER ORDERS</div><h1>Orders</h1><p>Track orders recorded before the WhatsApp handoff.</p></div></div><div class="toolbar"><input id="orderSearch" placeholder="Search order or customer…"><select id="orderFilter"><option>All</option><option>New</option><option>Preparing</option><option>Done</option><option>Cancelled</option></select></div><section class="panel" id="orderPanel"><div class="empty">Loading orders…</div></section>`;
  const {data,error}=await fetchTable("orders",{order:"created_at",limit:500});if(error){$("#orderPanel").innerHTML=`<div class="empty">Could not load orders. ${esc(error.message)}</div>`;return}
  cache.orders=data||[];bindOrderFilters();drawOrders();
}
function bindOrderFilters(){$("#orderSearch").addEventListener("input",drawOrders);$("#orderFilter").addEventListener("change",drawOrders)}
function drawOrders(){
  const q=($("#orderSearch")?.value||"").toLowerCase(), f=$("#orderFilter")?.value||"All";
  const rows=cache.orders.filter(x=>`${x.id} ${x.customer_name} ${x.phone}`.toLowerCase().includes(q)&& (f==="All"||x.status===f));
  $("#orderPanel").innerHTML=rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Type</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>#${esc(String(x.id).slice(0,8))}</strong></td><td>${esc(x.customer_name||"—")}<small class="muted">${esc(x.phone||"")}</small></td><td>${fmtNaira(x.total)}</td><td>${esc(x.order_type||"—")}</td><td>${statusBadge(x.status)}</td><td>${dateOnly(x.created_at)}</td><td><button class="mini-button" onclick='viewOrder(${JSON.stringify(x.id)})'>View</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No orders found.</div>`;
}
async function viewOrder(id){
  const x=cache.orders.find(o=>String(o.id)===String(id));if(!x)return;
  let items=[];if(db){const r=await db.from("order_items").select("*").eq("order_id",id);items=r.data||[]}
  openModal("Order details",`<div class="form-grid"><div><label>Customer<input value="${esc(x.customer_name||"—")}" disabled></label></div><div><label>Phone<input value="${esc(x.phone||"—")}" disabled></label></div><div><label>Total<input value="${fmtNaira(x.total)}" disabled></label></div><div><label>Status<select id="orderStatus"><option ${x.status==="New"?"selected":""}>New</option><option ${x.status==="Preparing"?"selected":""}>Preparing</option><option ${x.status==="Done"?"selected":""}>Done</option><option ${x.status==="Cancelled"?"selected":""}>Cancelled</option></select></label></div><div class="full-col"><label>Items<textarea disabled>${items.map(i=>`${i.quantity} × ${i.item_name} — ${fmtNaira(i.subtotal)}`).join("\n")||"No item details saved."}</textarea></label></div></div>`,[{text:"Close",class:"secondary-button",action:closeModal},{text:"Save status",class:"primary-button",action:async()=>{const {error}=await db.from("orders").update({status:$("#orderStatus").value,updated_at:new Date().toISOString()}).eq("id",id);if(error){toast(error.message,"error");return}closeModal();toast("Order updated.");await renderOrders();}}]);
}

async function renderGallery(){
  const root=$("#pageContent");root.innerHTML=`<div class="page-header"><div><div class="eyebrow">VISUAL CONTENT</div><h1>Gallery</h1><p>Keep the café's gallery and slideshow organized.</p></div><button class="primary-button" onclick="openGalleryModal()">+ Add image</button></div><section class="panel" id="galleryPanel"><div class="empty">Loading gallery…</div></section>`;
  const {data,error}=await fetchTable("gallery",{order:"display_order",ascending:true});if(error){$("#galleryPanel").innerHTML=`<div class="empty">Could not load gallery. ${esc(error.message)}</div>`;return}
  cache.gallery=data||[];drawGallery();
}
function drawGallery(){
  $("#galleryPanel").innerHTML=cache.gallery.length?`<div class="gallery-grid">${cache.gallery.map(x=>`<article class="gallery-card"><img src="${esc(x.image_url)}" alt="${esc(x.caption||"Firefly Café")}"><div class="gallery-info"><strong>${esc(x.caption||"Untitled")}</strong><small>${esc(x.category||"Uncategorized")}</small><div style="display:flex;gap:5px;flex-wrap:wrap;margin:0 0 8px">${x.show_in_gallery?`<span class="status done">Gallery</span>`:""}${x.show_in_slideshow?`<span class="status preparing">Background</span>`:""}${!x.show_in_gallery&&!x.show_in_slideshow?`<span class="status cancelled">Hidden</span>`:""}</div><div class="row-actions"><button class="mini-button" onclick='toggleGallery(${JSON.stringify(x.id)},"gallery",${!!x.show_in_gallery})'>${x.show_in_gallery?"Remove from gallery":"Add to gallery"}</button><button class="mini-button" onclick='toggleGallery(${JSON.stringify(x.id)},"slideshow",${!!x.show_in_slideshow})'>${x.show_in_slideshow?"Remove from background":"Use as background"}</button></div></div></article>`).join("")}</div>`:`<div class="empty">No gallery images yet. Add an image record to begin.</div>`;
}
async function toggleGallery(id,type,current){
  const field=type==="gallery"?"show_in_gallery":"show_in_slideshow";const {error}=await db.from("gallery").update({[field]:!current,updated_at:new Date().toISOString()}).eq("id",id);if(error){toast(error.message,"error");return}toast("Gallery updated.");await renderGallery();
}
function openGalleryModal(){
  openModal("Add gallery image",`<p class="muted" style="font-size:.75rem">This simple version stores an image URL. You can upgrade it to Supabase Storage uploads after the core dashboard is working.</p><label>Image URL or path<input id="gUrl" placeholder="images/backgrounds/coffee.jpg or https://…"></label><label>Caption<input id="gCaption"></label><label>Category<select id="gCategory"><option>Food</option><option>People</option><option>Interior</option><option>Vibe</option></select></label><label>Show in the Gallery section<select id="gInGallery"><option value="true">Yes</option><option value="false">No</option></select></label><label>Use as a background slideshow image<select id="gInSlideshow"><option value="false">No</option><option value="true">Yes</option></select><small class="muted" style="display:block;margin-top:6px;font-size:.68rem">Tip: keep background-only photos in images/backgrounds and gallery photos in images/gallery.</small></label>`,[{text:"Cancel",class:"secondary-button",action:closeModal},{text:"Save",class:"primary-button",action:saveGallery}]);
}
async function saveGallery(){
  const image_url=$("#gUrl").value.trim();if(!image_url){toast("Image URL is required.","error");return}
  if($("#gInGallery").value!=="true"&&$("#gInSlideshow").value!=="true"){toast("Choose at least one place for this image to appear.","error");return}
  const {error}=await db.from("gallery").insert({image_url,caption:$("#gCaption").value.trim(),category:$("#gCategory").value,display_order:cache.gallery.length,show_in_gallery:$("#gInGallery").value==="true",show_in_slideshow:$("#gInSlideshow").value==="true"});
  if(error){toast(error.message,"error");return}closeModal();toast("Gallery image added.");await renderGallery();
}

async function renderSettings(){
  const root=$("#pageContent");root.innerHTML=`<div class="page-header"><div><div class="eyebrow">BUSINESS INFO</div><h1>Site Settings</h1><p>Update information that should not require code edits.</p></div><button class="primary-button" onclick="saveSettings()">Save settings</button></div><div class="settings-grid"><section class="panel setting-section"><h3>Contact</h3><p>Public contact details used by the website.</p><label>WhatsApp number<input id="sWhatsApp"></label><label>Phone number<input id="sPhone"></label><label>Address<input id="sAddress"></label><label>Google Maps link<input id="sMaps"></label></section><section class="panel setting-section"><h3>Announcement</h3><p>Optional message shown on the customer website.</p><label>Message<textarea id="sAnnouncement"></textarea></label><label>Banner status<select id="sBanner"><option value="true">Enabled</option><option value="false">Disabled</option></select></label><h3 style="margin-top:25px">Opening hours</h3><div id="hours"></div></section></div>`;
  const {data,error}=await db.from("site_settings").select("*").limit(1).maybeSingle();
  if(error && error.code!=="PGRST116"){toast(error.message,"error");return}
  const s=data||{};$("#sWhatsApp").value=s.whatsapp_number||"";$("#sPhone").value=s.phone_number||"";$("#sAddress").value=s.address||"";$("#sMaps").value=s.google_maps_link||"";$("#sAnnouncement").value=s.announcement||"";$("#sBanner").value=String(s.announcement_enabled??false);
  const {data:hours}=await db.from("opening_hours").select("*").order("day_index");const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  $("#hours").innerHTML=days.map((day,i)=>{const h=(hours||[]).find(x=>Number(x.day_index)===i)||{};return `<div class="hours-row"><span>${day}</span><select data-day="${i}" class="hOpen"><option value="true" ${h.is_open!==false?"selected":""}>Open</option><option value="false" ${h.is_open===false?"selected":""}>Closed</option></select><input class="hStart" data-day="${i}" type="time" value="${h.open_time||"10:00"}"><input class="hEnd" data-day="${i}" type="time" value="${h.close_time||"22:00"}"></div>`}).join("");
}
async function saveSettings(){
  const payload={id:1,whatsapp_number:$("#sWhatsApp").value.trim(),phone_number:$("#sPhone").value.trim(),address:$("#sAddress").value.trim(),google_maps_link:$("#sMaps").value.trim(),announcement:$("#sAnnouncement").value.trim(),announcement_enabled:$("#sBanner").value==="true",updated_at:new Date().toISOString()};
  const {error}=await db.from("site_settings").upsert(payload,{onConflict:"id"});if(error){toast(error.message,"error");return}
  const rows=$$(".hOpen").map((el,i)=>({day_index:i,is_open:el.value==="true",open_time:$(`.hStart[data-day="${i}"]`).value,close_time:$(`.hEnd[data-day="${i}"]`).value,updated_at:new Date().toISOString()}));
  const hr=await db.from("opening_hours").upsert(rows,{onConflict:"day_index"});if(hr.error){toast(hr.error.message,"error");return}
  toast("Settings saved.");
}

function openModal(title,body,actions=[]){
  $("#modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${title}</h3><button class="icon-button" onclick="closeModal()">×</button></div><div class="modal-body">${body}</div><div class="modal-foot">${actions.map((a,i)=>`<button class="${a.class}" id="modalAction${i}">${a.text}</button>`).join("")}</div></div></div>`;
  actions.forEach((a,i)=>$(`#modalAction${i}`).addEventListener("click",a.action));
  $("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
}
function closeModal(){$("#modalRoot").innerHTML=""}

window.navigate=navigate;window.viewReservation=viewReservation;window.openReservationModal=openReservationModal;window.openMenuModal=openMenuModal;window.openCategoryModal=openCategoryModal;window.toggleMenu=toggleMenu;window.viewOrder=viewOrder;window.openGalleryModal=openGalleryModal;window.toggleGallery=toggleGallery;window.closeModal=closeModal;

document.addEventListener("DOMContentLoaded",init);