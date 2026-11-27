/* Pacman Packagings - lightweight bookkeeping app
 * Data is stored in browser localStorage under STORAGE_KEY.
 */
const STORAGE_KEY = 'pacman_packagings_v1';

const DEFAULT_STATE = {
  contacts: [
    { id: uid(), type: 'Customer', name: 'Sample Customer', company: 'Acme Store', phone: '', email: '', address: '', notes: 'Replace with your real customer' },
    { id: uid(), type: 'Supplier', name: 'Sample Supplier', company: 'Paper Mills', phone: '', email: '', address: '', notes: 'Replace with your real supplier' }
  ],
  items: [
    { id: uid(), name: 'Paper Bag - Small', sku: 'PB-S', category: 'Finished Good', unit: 'pcs', stock: 100, reorder: 20, cost: 2, price: 5 },
    { id: uid(), name: 'Kraft Paper Roll', sku: 'RM-KR', category: 'Raw Material', unit: 'kg', stock: 50, reorder: 15, cost: 80, price: 0 }
  ],
  invoices: [
    { id: uid(), number: 'INV-001', date: today(), dueDate: today(7), contactId: null, contactName: 'Sample Customer', items: [{ desc: 'Paper Bag - Small', qty: 100, rate: 5 }], tax: 0, paid: 0, status: 'Pending', notes: '' }
  ],
  expenses: [
    { id: uid(), date: today(), type: 'Expense', category: 'Raw Material', contactName: 'Paper Mills', description: 'Sample purchase', amount: 2000, method: 'Cash', notes: '' }
  ],
  production: [
    { id: uid(), date: today(), machine: 'Machine 1', product: 'Paper Bag - Small', target: 200, produced: 150, waste: 5, notes: '' }
  ]
};

function uid() {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function fmtMoney(n) {
  const num = Number(n || 0);
  return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let currentView = 'dashboard';

const viewMeta = {
  dashboard: ['Dashboard', 'Overview of your business today.'],
  customers: ['Customers & Suppliers', 'Manage contacts, balances and history.'],
  inventory: ['Inventory / Items', 'Track products, raw materials and stock levels.'],
  invoices: ['Invoices & Payments', 'Create invoices, record payments, track outstanding.'],
  expenses: ['Expenses & Purchases', 'Log money spent, supplier bills and categories.'],
  production: ['Daily Production', 'Record daily machine output and targets.']
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function openModal(title, bodyHtml) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  $('#modal').classList.remove('hidden');
  $('#modal').setAttribute('aria-hidden', 'false');
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal').setAttribute('aria-hidden', 'true');
  $('#modalBody').innerHTML = '';
}

function invoiceTotal(inv) {
  const subtotal = (inv.items || []).reduce((s, it) => s + num(it.qty) * num(it.rate), 0);
  return subtotal + num(inv.tax);
}
function invoiceBalance(inv) {
  return Math.max(0, invoiceTotal(inv) - num(inv.paid));
}
function contactBalance(contact) {
  if (contact.type === 'Customer') {
    return state.invoices.filter(i => i.contactName === contact.name || i.contactId === contact.id)
      .reduce((s, i) => s + invoiceBalance(i), 0);
  }
  return state.expenses.filter(e => e.contactName === contact.name)
    .reduce((s, e) => s + num(e.amount), 0);
}

function setView(view) {
  currentView = view;
  $all('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  const [title, sub] = viewMeta[view];
  $('#viewTitle').textContent = title;
  $('#viewSubtitle').textContent = sub;
  render();
}

function render() {
  renderDashboard();
  renderCustomers();
  renderInventory();
  renderInvoices();
  renderExpenses();
  renderProduction();
}

function statCard(label, value, meta, cls='') {
  return `<div class="card"><div class="stat-label">${esc(label)}</div><div class="stat-value ${cls}">${value}</div><div class="stat-meta">${esc(meta)}</div></div>`;
}

function renderDashboard() {
  const totalSales = state.invoices.reduce((s, i) => s + invoiceTotal(i), 0);
  const received = state.invoices.reduce((s, i) => s + num(i.paid), 0);
  const receivable = state.invoices.reduce((s, i) => s + invoiceBalance(i), 0);
  const expenses = state.expenses.reduce((s, e) => s + num(e.amount), 0);
  const profit = received - expenses;
  const todayStr = today();
  const prodToday = state.production.filter(p => p.date === todayStr);
  const producedToday = prodToday.reduce((s, p) => s + num(p.produced), 0);
  const targetToday = prodToday.reduce((s, p) => s + num(p.target), 0);

  const recentInvoices = [...state.invoices].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const lowStock = state.items.filter(i => num(i.stock) <= num(i.reorder));

  $('#view-dashboard').innerHTML = `
    <div class="grid stats">
      ${statCard('Total Sales (Invoiced)', fmtMoney(totalSales), `${state.invoices.length} invoice(s)`)}
      ${statCard('Payments Received', fmtMoney(received), 'Cash collected', 'good')}
      ${statCard('Expenses / Purchases', fmtMoney(expenses), `${state.expenses.length} entry/entries`, 'warn')}
      ${statCard('Net (Received - Spent)', fmtMoney(profit), profit >= 0 ? 'Positive' : 'Negative', profit >= 0 ? 'good' : 'warn')}
    </div>
    <div class="grid stats">
      ${statCard('Receivables', fmtMoney(receivable), 'Outstanding from customers', receivable > 0 ? 'warn' : 'good')}
      ${statCard("Today's Production", producedToday.toLocaleString(), `Target: ${targetToday.toLocaleString()} units`)}
      ${statCard('Customers / Suppliers', `${state.contacts.filter(c=>c.type==='Customer').length} / ${state.contacts.filter(c=>c.type==='Supplier').length}`, 'Active contacts')}
      ${statCard('Low Stock Items', String(lowStock.length), lowStock.length ? 'Need reorder' : 'Stock healthy', lowStock.length ? 'warn' : 'good')}
    </div>
    <div class="grid two-col">
      <div class="card">
        <h3>Recent Invoices</h3>
        <div class="list">
          ${recentInvoices.length ? recentInvoices.map(i => `
            <div class="list-row">
              <div><div class="list-title">${esc(i.number)} — ${esc(i.contactName || 'Customer')}</div><div class="list-meta">${esc(i.date)} · Due ${esc(i.dueDate || '-')}</div></div>
              <div style="text-align:right"><div class="list-val">${fmtMoney(invoiceTotal(i))}</div><div class="list-meta">${esc(i.status)} · Bal ${fmtMoney(invoiceBalance(i))}</div></div>
            </div>`).join('') : '<div class="empty">No invoices yet.</div>'}
        </div>
      </div>
      <div class="card">
        <h3>Low Stock / Reorder</h3>
        <div class="list">
          ${lowStock.length ? lowStock.map(i => `
            <div class="list-row">
              <div><div class="list-title">${esc(i.name)}</div><div class="list-meta">Reorder at ${esc(i.reorder)} ${esc(i.unit)}</div></div>
              <div class="list-val" style="color:#b7791f">${esc(i.stock)} ${esc(i.unit)}</div>
            </div>`).join('') : '<div class="empty">All stock above reorder level.</div>'}
        </div>
      </div>
    </div>`;
}

/* CONTACTS */
function renderCustomers() {
  const q = ($('#contactSearch')?.value || '').toLowerCase();
  const rows = state.contacts.filter(c => !q || [c.name,c.company,c.type,c.phone,c.email].join(' ').toLowerCase().includes(q));
  $('#view-customers').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3>Contacts</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input class="search" id="contactSearch" placeholder="Search contacts..." value="${esc(q)}">
          <button class="btn" id="addContactBtn">+ Add Contact</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Type</th><th>Company</th><th>Phone</th><th>Balance</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(c => `<tr>
            <td data-label="Name"><strong>${esc(c.name)}</strong><div class="muted">${esc(c.email || '')}</div></td>
            <td data-label="Type"><span class="badge ${c.type==='Customer'?'received':'pending'}">${esc(c.type)}</span></td>
            <td data-label="Company">${esc(c.company || '-')}</td>
            <td data-label="Phone">${esc(c.phone || '-')}</td>
            <td data-label="Balance"><strong>${fmtMoney(contactBalance(c))}</strong></td>
            <td class="row-actions">
              <button class="btn btn-sm btn-ghost" data-edit-contact="${c.id}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del-contact="${c.id}">Delete</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="6" class="empty">No contacts yet.</td></tr>'}
        </tbody></table></div>
    </div>`;
  $('#addContactBtn').onclick = () => openContactForm();
  $('#contactSearch').oninput = renderCustomers;
  $all('[data-edit-contact]').forEach(b => b.onclick = () => openContactForm(state.contacts.find(c=>c.id===b.dataset.editContact)));
  $all('[data-del-contact]').forEach(b => b.onclick = () => { if(confirm('Delete this contact?')) { state.contacts = state.contacts.filter(c=>c.id!==b.dataset.delContact); saveState(); render(); toast('Contact deleted'); }});
}

function openContactForm(c=null) {
  const x = c || { type:'Customer', name:'', company:'', phone:'', email:'', address:'', notes:'' };
  openModal(c ? 'Edit Contact' : 'Add Contact', `
    <form id="contactForm">
      <div class="form-grid">
        <div class="field"><label>Type</label><select name="type"><option ${x.type==='Customer'?'selected':''}>Customer</option><option ${x.type==='Supplier'?'selected':''}>Supplier</option></select></div>
        <div class="field"><label>Name</label><input name="name" required value="${esc(x.name)}"></div>
        <div class="field"><label>Company</label><input name="company" value="${esc(x.company)}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(x.phone)}"></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(x.email)}"></div>
        <div class="field"><label>Address</label><input name="address" value="${esc(x.address)}"></div>
        <div class="field full"><label>Notes</label><textarea name="notes">${esc(x.notes||'')}</textarea></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button><button class="btn">${c?'Save':'Add Contact'}</button></div>
    </form>`);
  $('#cancelModal').onclick = closeModal;
  $('#contactForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const rec = { id: c?.id || uid(), type:f.get('type'), name:f.get('name').trim(), company:f.get('company').trim(), phone:f.get('phone').trim(), email:f.get('email').trim(), address:f.get('address').trim(), notes:f.get('notes').trim() };
    if (c) state.contacts = state.contacts.map(o => o.id===c.id?rec:o); else state.contacts.unshift(rec);
    saveState(); closeModal(); render(); toast(c?'Contact updated':'Contact added');
  };
}
/* INVENTORY */
function renderInventory() {
  const q = ($('#itemSearch')?.value || '').toLowerCase();
  const rows = state.items.filter(i => !q || [i.name,i.sku,i.category].join(' ').toLowerCase().includes(q));
  $('#view-inventory').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3>Items / Inventory</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input class="search" id="itemSearch" placeholder="Search items..." value="${esc(q)}">
          <button class="btn" id="addItemBtn">+ Add Item</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Reorder</th><th>Cost</th><th>Price</th><th></th></tr></thead>
        <tbody>${rows.length ? rows.map(i => `<tr>
          <td data-label="Item"><strong>${esc(i.name)}</strong><div class="muted">${esc(i.sku||'')}</div></td>
          <td data-label="Category">${esc(i.category||'-')}</td>
          <td data-label="Stock">${esc(i.stock)} ${esc(i.unit||'')} ${num(i.stock)<=num(i.reorder)?'<span class="badge overdue">Low</span>':''}</td>
          <td data-label="Reorder">${esc(i.reorder)} ${esc(i.unit||'')}</td>
          <td data-label="Cost">${fmtMoney(i.cost)}</td>
          <td data-label="Price">${fmtMoney(i.price)}</td>
          <td class="row-actions">
            <button class="btn btn-sm btn-ghost" data-edit-item="${i.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del-item="${i.id}">Delete</button>
          </td></tr>`).join('') : '<tr><td colspan="7" class="empty">No items yet.</td></tr>'}
        </tbody></table></div>
    </div>`;
  $('#addItemBtn').onclick = () => openItemForm();
  $('#itemSearch').oninput = renderInventory;
  $all('[data-edit-item]').forEach(b => b.onclick = () => openItemForm(state.items.find(i=>i.id===b.dataset.editItem)));
  $all('[data-del-item]').forEach(b => b.onclick = () => { if(confirm('Delete this item?')) { state.items = state.items.filter(i=>i.id!==b.dataset.delItem); saveState(); render(); toast('Item deleted'); }});
}
function openItemForm(it=null) {
  const x = it || { name:'', sku:'', category:'Finished Good', unit:'pcs', stock:0, reorder:0, cost:0, price:0 };
  openModal(it?'Edit Item':'Add Item', `
    <form id="itemForm"><div class="form-grid">
      <div class="field"><label>Name</label><input name="name" required value="${esc(x.name)}"></div>
      <div class="field"><label>SKU</label><input name="sku" value="${esc(x.sku||'')}"></div>
      <div class="field"><label>Category</label><select name="category">${['Finished Good','Raw Material','Packaging','Other'].map(o=>`<option ${x.category===o?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="field"><label>Unit</label><input name="unit" value="${esc(x.unit||'pcs')}"></div>
      <div class="field"><label>Stock</label><input name="stock" type="number" step="any" value="${esc(x.stock)}"></div>
      <div class="field"><label>Reorder Level</label><input name="reorder" type="number" step="any" value="${esc(x.reorder)}"></div>
      <div class="field"><label>Cost</label><input name="cost" type="number" step="any" value="${esc(x.cost)}"></div>
      <div class="field"><label>Selling Price</label><input name="price" type="number" step="any" value="${esc(x.price)}"></div>
    </div><div class="form-actions"><button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button><button class="btn">${it?'Save':'Add Item'}</button></div></form>`);
  $('#cancelModal').onclick = closeModal;
  $('#itemForm').onsubmit = e => {
    e.preventDefault(); const f=new FormData(e.target);
    const rec = { id: it?.id||uid(), name:f.get('name').trim(), sku:f.get('sku').trim(), category:f.get('category'), unit:f.get('unit').trim(), stock:num(f.get('stock')), reorder:num(f.get('reorder')), cost:num(f.get('cost')), price:num(f.get('price')) };
    if (it) state.items = state.items.map(o=>o.id===it.id?rec:o); else state.items.unshift(rec);
    saveState(); closeModal(); render(); toast(it?'Item updated':'Item added');
  };
}

/* INVOICES */
function renderInvoices() {
  const q = ($('#invSearch')?.value || '').toLowerCase();
  const rows = state.invoices.filter(i => !q || [i.number,i.contactName,i.status].join(' ').toLowerCase().includes(q));
  $('#view-invoices').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3>Invoices</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input class="search" id="invSearch" placeholder="Search invoices..." value="${esc(q)}">
          <button class="btn" id="addInvBtn">+ New Invoice</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Customer</th><th>Date / Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.length ? rows.map(i => { const bal=invoiceBalance(i); const st=bal<=0?'Paid':(i.dueDate && i.dueDate < today() ? 'Overdue' : i.status||'Pending'); return `<tr>
          <td data-label="Invoice"><strong>${esc(i.number)}</strong></td>
          <td data-label="Customer">${esc(i.contactName||'-')}</td>
          <td data-label="Date">${esc(i.date)}<div class="muted">Due ${esc(i.dueDate||'-')}</div></td>
          <td data-label="Total">${fmtMoney(invoiceTotal(i))}</td>
          <td data-label="Paid">${fmtMoney(i.paid)}</td>
          <td data-label="Balance"><strong>${fmtMoney(bal)}</strong></td>
          <td data-label="Status"><span class="badge ${st.toLowerCase()}">${esc(st)}</span></td>
          <td class="row-actions">
            <button class="btn btn-sm btn-ghost" data-pay-inv="${i.id}">Payment</button>
            <button class="btn btn-sm btn-ghost" data-edit-inv="${i.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del-inv="${i.id}">Delete</button>
          </td></tr>`; }).join('') : '<tr><td colspan="8" class="empty">No invoices yet.</td></tr>'}
        </tbody></table></div>
    </div>`;
  $('#addInvBtn').onclick = () => openInvoiceForm();
  $('#invSearch').oninput = renderInvoices;
  $all('[data-edit-inv]').forEach(b => b.onclick = () => openInvoiceForm(state.invoices.find(i=>i.id===b.dataset.editInv)));
  $all('[data-del-inv]').forEach(b => b.onclick = () => { if(confirm('Delete this invoice?')) { state.invoices = state.invoices.filter(i=>i.id!==b.dataset.delInv); saveState(); render(); toast('Invoice deleted'); }});
  $all('[data-pay-inv]').forEach(b => b.onclick = () => openPaymentForm(state.invoices.find(i=>i.id===b.dataset.payInv)));
}
function nextInvNumber() {
  const n = state.invoices.length + 1;
  return 'INV-' + String(n).padStart(3,'0');
}
function openInvoiceForm(inv=null) {
  const customers = state.contacts.filter(c=>c.type==='Customer');
  const x = inv || { number: nextInvNumber(), date: today(), dueDate: today(7), contactName: customers[0]?.name || '', items:[{desc:'',qty:1,rate:0}], tax:0, paid:0, status:'Pending', notes:'' };
  const itemsRows = (x.items&&x.items.length?x.items:[{desc:'',qty:1,rate:0}]).map((it,idx)=>`
    <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;">
      <div class="field"><label>${idx===0?'Description':''}</label><input name="desc" value="${esc(it.desc)}" placeholder="Item / service"></div>
      <div class="field"><label>${idx===0?'Qty':''}</label><input name="qty" type="number" step="any" value="${esc(it.qty)}"></div>
      <div class="field"><label>${idx===0?'Rate':''}</label><input name="rate" type="number" step="any" value="${esc(it.rate)}"></div>
      <div class="field"><label>&nbsp;</label><button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">✕</button></div>
    </div>`).join('');
  openModal(inv?'Edit Invoice':'New Invoice', `
    <form id="invForm">
      <div class="form-grid">
        <div class="field"><label>Invoice No.</label><input name="number" required value="${esc(x.number)}"></div>
        <div class="field"><label>Customer</label><input name="contactName" list="custList" required value="${esc(x.contactName||'')}"><datalist id="custList">${customers.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist></div>
        <div class="field"><label>Date</label><input name="date" type="date" required value="${esc(x.date)}"></div>
        <div class="field"><label>Due Date</label><input name="dueDate" type="date" value="${esc(x.dueDate||'')}"></div>
      </div>
      <div class="field full" style="margin-top:14px;"><label>Line Items</label><div id="invItems">${itemsRows}</div><button type="button" class="btn btn-sm btn-ghost" id="addLineBtn">+ Add line</button></div>
      <div class="form-grid" style="margin-top:14px;">
        <div class="field"><label>Tax</label><input name="tax" type="number" step="any" value="${esc(x.tax||0)}"></div>
        <div class="field"><label>Amount Paid</label><input name="paid" type="number" step="any" value="${esc(x.paid||0)}"></div>
        <div class="field full"><label>Notes</label><textarea name="notes">${esc(x.notes||'')}</textarea></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button><button class="btn">${inv?'Save':'Create Invoice'}</button></div>
    </form>`);
  $('#cancelModal').onclick = closeModal;
  $('#addLineBtn').onclick = () => {
    const div = document.createElement('div');
    div.innerHTML = `<div class="form-grid" style="grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;"><div class="field"><input name="desc" placeholder="Item / service"></div><div class="field"><input name="qty" type="number" step="any" value="1"></div><div class="field"><input name="rate" type="number" step="any" value="0"></div><div class="field"><button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">✕</button></div></div>`;
    $('#invItems').appendChild(div.firstElementChild);
  };
  $('#invForm').onsubmit = e => {
    e.preventDefault(); const f=new FormData(e.target);
    const descs = f.getAll('desc'), qtys=f.getAll('qty'), rates=f.getAll('rate');
    const items = descs.map((d,i)=>({desc:d.trim(), qty:num(qtys[i]), rate:num(rates[i])})).filter(it=>it.desc || it.qty || it.rate);
    const rec = { id: inv?.id||uid(), number:f.get('number').trim(), date:f.get('date'), dueDate:f.get('dueDate'), contactName:f.get('contactName').trim(), items, tax:num(f.get('tax')), paid:num(f.get('paid')), status:'Pending', notes:f.get('notes').trim() };
    const bal = Math.max(0, rec.items.reduce((s,it)=>s+num(it.qty)*num(it.rate),0)+num(rec.tax)-num(rec.paid));
    rec.status = bal <= 0 ? 'Paid' : (rec.dueDate && rec.dueDate < today() ? 'Overdue' : 'Pending');
    if (inv) state.invoices = state.invoices.map(o=>o.id===inv.id?rec:o); else state.invoices.unshift(rec);
    saveState(); closeModal(); render(); toast(inv?'Invoice updated':'Invoice created');
  };
}
function openPaymentForm(inv) {
  if (!inv) return;
  const bal = invoiceBalance(inv);
  openModal(`Record Payment — ${inv.number}`, `
    <form id="payForm"><div class="form-grid">
      <div class="field"><label>Outstanding</label><input value="${fmtMoney(bal)}" disabled></div>
      <div class="field"><label>Payment Amount</label><input name="amount" type="number" step="any" max="${bal}" value="${bal}" required></div>
      <div class="field full"><label>Payment Date</label><input name="date" type="date" value="${today()}" required></div>
    </div><div class="form-actions"><button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button><button class="btn">Record Payment</button></div></form>`);
  $('#cancelModal').onclick = closeModal;
  $('#payForm').onsubmit = e => {
    e.preventDefault(); const f=new FormData(e.target);
    const amt = Math.min(bal, Math.max(0, num(f.get('amount'))));
    inv.paid = num(inv.paid) + amt;
    const newBal = invoiceBalance(inv);
    inv.status = newBal <= 0 ? 'Paid' : (inv.dueDate && inv.dueDate < today() ? 'Overdue' : 'Pending');
    state.expenses.unshift({ id: uid(), date: f.get('date'), type: 'Received', category: 'Customer Payment', contactName: inv.contactName, description: `Payment for ${inv.number}`, amount: amt, method: 'Cash', notes: '' });
    saveState(); closeModal(); render(); toast('Payment recorded');
  };
}

/* EXPENSES */
function renderExpenses() {
  const q = ($('#expSearch')?.value || '').toLowerCase();
  const rows = state.expenses.filter(e => !q || [e.date,e.type,e.category,e.contactName,e.description].join(' ').toLowerCase().includes(q));
  $('#view-expenses').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3>Expenses & Purchases</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input class="search" id="expSearch" placeholder="Search..." value="${esc(q)}">
          <button class="btn" id="addExpBtn">+ Add Entry</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Party</th><th>Description</th><th>Amount</th><th></th></tr></thead>
        <tbody>${rows.length ? rows.map(e => `<tr>
          <td data-label="Date">${esc(e.date)}</td>
          <td data-label="Type"><span class="badge ${e.type==='Received'?'received':'spent'}">${esc(e.type)}</span></td>
          <td data-label="Category">${esc(e.category||'-')}</td>
          <td data-label="Party">${esc(e.contactName||'-')}</td>
          <td data-label="Description">${esc(e.description||'-')}</td>
          <td data-label="Amount"><strong>${fmtMoney(e.amount)}</strong></td>
          <td class="row-actions">
            <button class="btn btn-sm btn-ghost" data-edit-exp="${e.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del-exp="${e.id}">Delete</button>
          </td></tr>`).join('') : '<tr><td colspan="7" class="empty">No entries yet.</td></tr>'}
        </tbody></table></div>
    </div>`;
  $('#addExpBtn').onclick = () => openExpenseForm();
  $('#expSearch').oninput = renderExpenses;
  $all('[data-edit-exp]').forEach(b => b.onclick = () => openExpenseForm(state.expenses.find(e=>e.id===b.dataset.editExp)));
  $all('[data-del-exp]').forEach(b => b.onclick = () => { if(confirm('Delete this entry?')) { state.expenses = state.expenses.filter(e=>e.id!==b.dataset.delExp); saveState(); render(); toast('Entry deleted'); }});
}
function openExpenseForm(ex=null) {
  const x = ex || { date: today(), type:'Expense', category:'Raw Material', contactName:'', description:'', amount:0, method:'Cash', notes:'' };
  openModal(ex?'Edit Entry':'Add Expense / Purchase', `
    <form id="expForm"><div class="form-grid">
      <div class="field"><label>Date</label><input name="date" type="date" required value="${esc(x.date)}"></div>
      <div class="field"><label>Type</label><select name="type"><option ${x.type==='Expense'?'selected':''}>Expense</option><option ${x.type==='Purchase'?'selected':''}>Purchase</option><option ${x.type==='Received'?'selected':''}>Received</option></select></div>
      <div class="field"><label>Category</label><input name="category" value="${esc(x.category||'')}" placeholder="Raw Material, Rent, Wages..."></div>
      <div class="field"><label>Party / Contact</label><input name="contactName" value="${esc(x.contactName||'')}"></div>
      <div class="field full"><label>Description</label><input name="description" value="${esc(x.description||'')}"></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" step="any" required value="${esc(x.amount)}"></div>
      <div class="field"><label>Method</label><select name="method">${['Cash','Bank','UPI','Cheque','Other'].map(m=>`<option ${x.method===m?'selected':''}>${m}</option>`).join('')}</select></div>
      <div class="field full"><label>Notes</label><textarea name="notes">${esc(x.notes||'')}</textarea></div>
    </div><div class="form-actions"><button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button><button class="btn">${ex?'Save':'Add Entry'}</button></div></form>`);
  $('#cancelModal').onclick = closeModal;
  $('#expForm').onsubmit = e => {
    e.preventDefault(); const f=new FormData(e.target);
    const rec = { id: ex?.id||uid(), date:f.get('date'), type:f.get('type'), category:f.get('category').trim(), contactName:f.get('contactName').trim(), description:f.get('description').trim(), amount:num(f.get('amount')), method:f.get('method'), notes:f.get('notes').trim() };
    if (ex) state.expenses = state.expenses.map(o=>o.id===ex.id?rec:o); else state.expenses.unshift(rec);
    saveState(); closeModal(); render(); toast(ex?'Entry updated':'Entry added');
  };
}

/* PRODUCTION */
function renderProduction() {
  const q = ($('#prodSearch')?.value || '').toLowerCase();
  const rows = state.production.filter(p => !q || [p.date,p.machine,p.product,p.notes].join(' ').toLowerCase().includes(q));
  $('#view-production').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3>Daily Production</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input class="search" id="prodSearch" placeholder="Search..." value="${esc(q)}">
          <button class="btn" id="addProdBtn">+ Add Production</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Machine</th><th>Product</th><th>Target</th><th>Produced</th><th>Waste</th><th></th></tr></thead>
        <tbody>${rows.length ? rows.map(p => `<tr>
          <td data-label="Date">${esc(p.date)}</td>
          <td data-label="Machine">${esc(p.machine||'-')}</td>
          <td data-label="Product">${esc(p.product||'-')}</td>
          <td data-label="Target">${esc(p.target)}</td>
          <td data-label="Produced"><strong>${esc(p.produced)}</strong></td>
          <td data-label="Waste">${esc(p.waste||0)}</td>
          <td class="row-actions">
            <button class="btn btn-sm btn-ghost" data-edit-prod="${p.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del-prod="${p.id}">Delete</button>
          </td></tr>`).join('') : '<tr><td colspan="7" class="empty">No production entries yet.</td></tr>'}
        </tbody></table></div>
    </div>`;
  $('#addProdBtn').onclick = () => openProductionForm();
  $('#prodSearch').oninput = renderProduction;
  $all('[data-edit-prod]').forEach(b => b.onclick = () => openProductionForm(state.production.find(p=>p.id===b.dataset.editProd)));
  $all('[data-del-prod]').forEach(b => b.onclick = () => { if(confirm('Delete this entry?')) { state.production = state.production.filter(p=>p.id!==b.dataset.delProd); saveState(); render(); toast('Entry deleted'); }});
}
function openProductionForm(p=null) {
  const x = p || { date: today(), machine:'Machine 1', product:'', target:0, produced:0, waste:0, notes:'' };
  openModal(p?'Edit Production':'Add Production', `
    <form id="prodForm"><div class="form-grid">
      <div class="field"><label>Date</label><input name="date" type="date" required value="${esc(x.date)}"></div>
      <div class="field"><label>Machine</label><input name="machine" value="${esc(x.machine||'')}"></div>
      <div class="field full"><label>Product</label><input name="product" value="${esc(x.product||'')}" placeholder="Paper bag type"></div>
      <div class="field"><label>Target Qty</label><input name="target" type="number" step="any" value="${esc(x.target)}"></div>
      <div class="field"><label>Produced Qty</label><input name="produced" type="number" step="any" value="${esc(x.produced)}"></div>
      <div class="field"><label>Waste Qty</label><input name="waste" type="number" step="any" value="${esc(x.waste||0)}"></div>
      <div class="field full"><label>Notes</label><textarea name="notes">${esc(x.notes||'')}</textarea></div>
    </div><div class="form-actions"><button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button><button class="btn">${p?'Save':'Add Entry'}</button></div></form>`);
  $('#cancelModal').onclick = closeModal;
  $('#prodForm').onsubmit = e => {
    e.preventDefault(); const f=new FormData(e.target);
    const rec = { id:p?.id||uid(), date:f.get('date'), machine:f.get('machine').trim(), product:f.get('product').trim(), target:num(f.get('target')), produced:num(f.get('produced')), waste:num(f.get('waste')), notes:f.get('notes').trim() };
    if (p) state.production = state.production.map(o=>o.id===p.id?rec:o); else state.production.unshift(rec);
    saveState(); closeModal(); render(); toast(p?'Entry updated':'Entry added');
  };
}

/* EXPORT / IMPORT / INIT */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pacman-packagings-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Data exported');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('bad');
      state = { ...structuredClone(DEFAULT_STATE), ...parsed };
      saveState(); render(); toast('Data imported');
    } catch { alert('Invalid data file.'); }
  };
  reader.readAsText(file);
}

document.addEventListener('click', e => {
  if (e.target.id === 'modalClose' || e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function init() {
  $('#todayPill').textContent = new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  $all('.nav-item').forEach(btn => btn.onclick = () => setView(btn.dataset.view));
  $('#exportBtn').onclick = exportData;
  $('#importInput').onchange = e => { const f=e.target.files[0]; if(f) importData(f); e.target.value=''; };
  render();
  setView('dashboard');
}
init();
