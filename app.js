const SUPABASE_URL="https://inzeuglkmkpeiwnqllxd.supabase.co";
const SUPABASE_KEY="sb_publishable_mzy4l3yr8NtOlyOdrXNuww_Phz7f9Rp";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null,currentRole="viewer",funds=[],income=[],expenses=[];

const $=id=>document.getElementById(id);
const money=(n,c="USD")=>new Intl.NumberFormat(undefined,{style:"currency",currency:c}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);

async function loadUser(){
  const {data:{user}}=await db.auth.getUser(); if(!user){showLogin();return}
  currentUser=user;
  const {data:role}=await db.from("user_roles").select("role,full_name").eq("user_id",user.id).maybeSingle();
  currentRole=role?.role||"viewer";
  $("userInfo").textContent=`${role?.full_name||user.email} • ${currentRole}`;
  document.querySelectorAll(".admin-only").forEach(x=>x.style.display=currentRole==="admin"?"":"none");
  document.querySelectorAll(".audit-only").forEach(x=>x.style.display=["admin","pastor"].includes(currentRole)?"":"none");
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
  await refresh();
}
function showLogin(){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden")}
async function refresh(){
  const [f,i,e]=await Promise.all([
    db.from("church_funds").select("*").eq("is_active",true).order("name"),
    db.from("income_records").select("*,church_funds(name,currency)").order("transaction_date",{ascending:false}),
    db.from("expense_records").select("*,church_funds(name,currency)").order("transaction_date",{ascending:false})
  ]);
  if(f.error||i.error||e.error){console.error(f.error||i.error||e.error);return}
  funds=f.data||[];income=i.data||[];expenses=e.data||[];render();
}
function render(){
  const totalI=income.reduce((s,x)=>s+Number(x.amount),0),totalE=expenses.reduce((s,x)=>s+Number(x.amount),0);
  $("totalIncome").textContent=money(totalI);$("totalExpenses").textContent=money(totalE);$("balance").textContent=money(totalI-totalE);$("fundCount").textContent=funds.length;
  ["incomeFund","expenseFund"].forEach(id=>$(id).innerHTML=funds.map(f=>`<option value="${f.id}">${esc(f.name)} (${f.currency})</option>`).join(""));
  $("fundGrid").innerHTML=funds.map(f=>{
    const inc=income.filter(x=>x.fund_id===f.id).reduce((s,x)=>s+Number(x.amount),0);
    const exp=expenses.filter(x=>x.fund_id===f.id).reduce((s,x)=>s+Number(x.amount),0);
    return `<div class="fund"><span>${esc(f.name)}</span><strong>${money(Number(f.opening_balance)+inc-exp,f.currency)}</strong><small class="muted">Opening: ${money(f.opening_balance,f.currency)}</small></div>`
  }).join("");
  const tx=[...income.map(x=>({...x,type:"Income"})),...expenses.map(x=>({...x,type:"Expense"}))].sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date)).slice(0,15);
  $("recentTable").innerHTML=tx.map(x=>`<tr><td>${x.transaction_date}</td><td>${x.type}</td><td>${esc(x.church_funds?.name||"")}</td><td>${money(x.amount,x.currency)}</td><td>${esc(x.description||x.category||"")}</td></tr>`).join("")||`<tr><td colspan="5">No transactions yet.</td></tr>`;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
$("loginForm").addEventListener("submit",async ev=>{ev.preventDefault();$("loginError").textContent="";const {error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)$("loginError").textContent=error.message;else await loadUser()});
$("logoutBtn").onclick=async()=>{await db.auth.signOut();showLogin()};
$("refreshBtn").onclick=refresh;
document.querySelectorAll(".nav").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));$(btn.dataset.section).classList.add("active");$("pageTitle").textContent=btn.textContent.trim()});
$("mobileMenu").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
$("incomeDate").value=today();$("expenseDate").value=today();
$("incomeForm").onsubmit=async ev=>{ev.preventDefault();const fund=funds.find(f=>f.id===$("incomeFund").value);const payload={fund_id:fund.id,transaction_date:$("incomeDate").value,amount:Number($("incomeAmount").value),currency:fund.currency,category:$("incomeCategory").value.trim(),received_from:$("incomeFrom").value.trim()||null,payment_method:$("incomeMethod").value,receipt_number:$("incomeReceipt").value.trim()||null,description:$("incomeDescription").value.trim()||null,recorded_by:currentUser.id};const {error}=await db.from("income_records").insert(payload);$("incomeMsg").textContent=error?error.message:"Income saved successfully.";if(!error){ev.target.reset();$("incomeDate").value=today();await refresh()}};
$("expenseForm").onsubmit=async ev=>{ev.preventDefault();const fund=funds.find(f=>f.id===$("expenseFund").value);const payload={fund_id:fund.id,transaction_date:$("expenseDate").value,amount:Number($("expenseAmount").value),currency:fund.currency,category:$("expenseCategory").value.trim(),paid_to:$("expenseTo").value.trim()||null,payment_method:$("expenseMethod").value,receipt_number:$("expenseReceipt").value.trim()||null,description:$("expenseDescription").value.trim()||null,recorded_by:currentUser.id};const {error}=await db.from("expense_records").insert(payload);$("expenseMsg").textContent=error?error.message:"Expense saved successfully.";if(!error){ev.target.reset();$("expenseDate").value=today();await refresh()}};
$("reportBtn").onclick=()=>{const from=$("reportFrom").value,to=$("reportTo").value;const filter=(x)=>!from||x.transaction_date>=from;const filter2=(x)=>!to||x.transaction_date<=to;const inc=income.filter(x=>filter(x)&&filter2(x)).reduce((s,x)=>s+Number(x.amount),0),exp=expenses.filter(x=>filter(x)&&filter2(x)).reduce((s,x)=>s+Number(x.amount),0);$("reportOutput").innerHTML=`<p><strong>Period:</strong> ${from||"Beginning"} to ${to||"Today"}</p><p>Total income: <strong>${money(inc)}</strong></p><p>Total expenses: <strong>${money(exp)}</strong></p><p>Net movement: <strong>${money(inc-exp)}</strong></p>`};
db.auth.onAuthStateChange(()=>setTimeout(loadUser,0));loadUser();
