// ==========================================
// 1. 全局状态管理
// ==========================================
const store = {
    mode: 'api', // 'api', 'history', 'mock'
    collections: [],
    requests: [],
    mocks: [],
    history: [],
    
    // 多标签状态
    tabs: [], 
    activeTabId: null,

    // Mock 规则状态
    currentMock: { id: 0, path_pattern: "", method: "GET", status_code: 200, response_body: "", response_headers: {}, is_active: true },
    
    // 全局指针 (指向 activeTab 的数据)
    current: null, 
    response: null
};

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEvents();
    injectExtraUI(); // [修复] 现在此函数已定义
    
    // Mock Host Input 切换显示
    const chk = document.getElementById('use-mock-chk');
    const hostInp = document.getElementById('mock-host-input');
    if(chk && hostInp) {
        hostInp.value = window.location.origin;
        chk.addEventListener('change', () => hostInp.style.display = chk.checked ? 'block' : 'none');
    }
});

async function init() {
    await loadData();
    openNewTab(); // 默认标签
    switchMode('api');
}

async function loadData() {
    try {
        const [c, r, m, h] = await Promise.all([
            fetch('/api/collections'),
            fetch('/api/requests'),
            fetch('/api/mocks'),
            fetch('/api/history')
        ]);
        store.collections = (await c.json()) || [];
        store.requests = (await r.json()) || [];
        store.mocks = (await m.json()) || [];
        store.history = (await h.json()) || [];
    } catch (e) { console.error(e); }
}

// ==========================================
// 2. 动态 UI 注入 (修复 Missing Function)
// ==========================================

function injectExtraUI() {
    const apiToolbar = document.querySelector('#view-api .toolbar');
    // 防止重复注入
    if (apiToolbar && !document.getElementById('use-mock-chk')) {
        const btnSend = document.getElementById('btn-send');
        
        const mockDiv = document.createElement('div');
        mockDiv.style.display = 'flex';
        mockDiv.style.alignItems = 'center';
        mockDiv.style.margin = '0 10px';
        mockDiv.style.borderRight = '1px solid #eee';
        mockDiv.style.paddingRight = '10px';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'use-mock-chk';
        chk.style.cursor = 'pointer';
        
        const lbl = document.createElement('label');
        lbl.innerText = 'Use Mock';
        lbl.htmlFor = 'use-mock-chk';
        lbl.style.marginLeft = '4px';
        lbl.style.marginRight = '5px';
        lbl.style.cursor = 'pointer';
        lbl.style.fontSize = '12px';
        
        const hostInput = document.createElement('input');
        hostInput.type = 'text';
        hostInput.id = 'mock-host-input';
        hostInput.placeholder = "http://host:port";
        hostInput.style.width = '120px';
        hostInput.style.fontSize = '11px';
        hostInput.style.padding = '3px';
        hostInput.style.border = '1px solid #ccc';
        hostInput.style.borderRadius = '3px';
        hostInput.style.display = 'none';
        
        chk.addEventListener('change', () => { hostInput.style.display = chk.checked ? 'block' : 'none'; });
        
        mockDiv.appendChild(chk);
        mockDiv.appendChild(lbl);
        mockDiv.appendChild(hostInput);
        
        if(btnSend) apiToolbar.insertBefore(mockDiv, btnSend);
    }
}

// ==========================================
// 3. 标签页管理 (Tab System)
// ==========================================

// [修改] 增加 source 参数用于判断是否已打开
function openNewTab(reqData = null, source = null) {
    // 1. 检查是否已存在相同来源的标签 (且不是新建的空标签)
    if (source) {
        const existingTab = store.tabs.find(t => t.source && t.source.type === source.type && t.source.id === source.id);
        if (existingTab) {
            setActiveTab(existingTab.id);
            return;
        }
    }

    const tabId = 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newTab = {
        id: tabId,
        name: reqData ? (reqData.name || reqData.url || 'New Request') : 'New Request',
        data: reqData ? JSON.parse(JSON.stringify(reqData)) : createEmptyRequest(),
        response: { rawBody: "", isBinary: false, headers: {} },
        source: source // 保存来源信息 { type: 'request'|'history', id: ... }
    };
    ensureRequestStruct(newTab.data);
    store.tabs.push(newTab);
    setActiveTab(tabId);
    renderTabBar();
}

function setActiveTab(tabId) {
    store.activeTabId = tabId;
    const tab = store.tabs.find(t => t.id === tabId);
    if (!tab) return;

    store.current = tab.data;
    store.response = tab.response;

    loadTabToUI();
    renderTabBar();
    
    if (store.mode === 'mock') switchMode('api');
}

function closeTab(e, tabId) {
    e.stopPropagation();
    const idx = store.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    store.tabs.splice(idx, 1);
    
    if (store.activeTabId === tabId) {
        if (store.tabs.length > 0) {
            const newIdx = Math.max(0, idx - 1);
            setActiveTab(store.tabs[newIdx].id);
        } else {
            openNewTab();
        }
    } else {
        renderTabBar();
    }
}

function loadTabToUI() {
    renderCurrentRequest();
    renderResponseUI(); // [修复] 此函数现已定义
}

function renderTabBar() {
    const container = document.getElementById('tab-bar');
    container.innerHTML = '';
    store.tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = `workspace-tab ${tab.id === store.activeTabId ? 'active' : ''}`;
        el.onclick = () => setActiveTab(tab.id);
        el.innerHTML = `
            <span class="tab-method req-${tab.data.method}">${tab.data.method}</span>
            <span class="tab-name">${escapeHtml(tab.name)}</span>
            <span class="tab-close" onclick="closeTab(event, '${tab.id}')">×</span>
        `;
        container.appendChild(el);
    });
    const addBtn = document.createElement('div');
    addBtn.className = 'tab-add-btn';
    addBtn.innerText = '+';
    addBtn.onclick = () => openNewTab();
    container.appendChild(addBtn);
}

function createEmptyRequest() {
    return { id: 0, collection_id: 0, name: "New Request", method: "GET", url: "", params: [], headers: [], auth: { type: "none", basic: {}, bearer: {} }, body: { type: "none", raw_content: "", form_data: [], url_encoded: [] } };
}

function ensureRequestStruct(req) {
    if(!req.params) req.params=[]; if(!req.headers) req.headers=[]; if(!req.auth) req.auth={type:'none',basic:{},bearer:{}}; if(!req.body) req.body={type:'none',raw_content:'',form_data:[],url_encoded:[]};
    ensureEmptyRow(req.params); ensureEmptyRow(req.headers); ensureEmptyRow(req.body.form_data); ensureEmptyRow(req.body.url_encoded);
}

// ==========================================
// 4. 侧边栏与模式
// ==========================================

window.switchMode = (mode) => {
    store.mode = mode;
    document.getElementById('mode-api').classList.toggle('active', mode === 'api');
    document.getElementById('mode-history').classList.toggle('active', mode === 'history');
    document.getElementById('mode-mock').classList.toggle('active', mode === 'mock');
    
    const isMock = mode === 'mock';
    document.getElementById('view-api').style.display = isMock ? 'none' : 'flex';
    document.getElementById('view-mock').style.display = isMock ? 'flex' : 'none';
    document.getElementById('tab-bar').style.display = isMock ? 'none' : 'flex';

    const title = document.getElementById('sidebar-title');
    const tools = document.querySelector('.sidebar-tools');
    
    if (mode === 'api') {
        title.innerText = 'Collections';
        tools.style.display = 'flex';
        renderCollectionTree();
    } else if (mode === 'history') {
        title.innerText = 'History Log';
        tools.style.display = 'none';
        renderHistoryList();
    } else {
        title.innerText = 'Mock Rules';
        tools.style.display = 'flex';
        renderMockList();
    }
};

// [修改] 历史记录渲染 - 添加删除功能
function renderHistoryList(){
    const c=document.getElementById('sidebar-list');c.innerHTML='';
    if(!store.history.length){c.innerHTML='<div style="padding:20px;color:#999;text-align:center">No history</div>';return;}
    
    // 添加清空全部按钮
    const clearDiv = document.createElement('div');
    clearDiv.style.padding = '10px';
    clearDiv.style.textAlign = 'center';
    clearDiv.style.borderBottom = '1px solid #eee';
    clearDiv.innerHTML = `<button class="btn btn-sm btn-danger" style="width:100%" onclick="clearAllHistory()">Clear All History</button>`;
    c.appendChild(clearDiv);

    const g={};
    store.history.forEach(i=>{
        const d=new Date(i.created_at);
        const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if(!g[k])g[k]=[];g[k].push(i)
    });
    Object.keys(g).sort().reverse().forEach(k=>{
        // 日期分组头部 + 删除日期组按钮
        const h=document.createElement('div');
        h.className='history-date-group';
        h.style.display = 'flex';
        h.style.justifyContent = 'space-between';
        h.style.alignItems = 'center';
        h.innerHTML=`<span>${k}</span><span title="Delete ${k}" style="cursor:pointer;opacity:0.5;font-size:14px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5">🗑️</span>`;
        // 绑定删除日期事件
        h.querySelector('span:last-child').onclick = (e) => { e.stopPropagation(); deleteHistoryDate(k); };
        c.appendChild(h);

        g[k].forEach(i=>{
            const t=new Date(i.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const el=document.createElement('div');el.className='tree-content';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            // 添加单条删除按钮 (x)
            el.innerHTML=`
                <span class="req-method req-${i.method}" style="font-size:9px;width:30px;">${i.method}</span>
                <span class="tree-label" style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(i.url)}</span>
                <span class="history-time" style="font-size:10px;color:#ccc;margin-right:5px;">${t}</span>
                <span title="Delete Item" style="cursor:pointer;color:#999;font-weight:bold;padding:0 4px;" onmouseover="this.style.color='red'" onmouseout="this.style.color='#999'">×</span>
            `;
            el.onclick=()=>{
                const d=i.request; d.id=0; d.name=i.url;
                openNewTab(d, { type: 'history', id: i.id });
            };
            // 绑定单条删除事件
            el.querySelector('span:last-child').onclick = (e) => { e.stopPropagation(); deleteHistoryItem(i.id); };
            c.appendChild(el);
        });
    });
}

// [新增] 历史记录操作函数
async function deleteHistoryItem(id) {
    if(!confirm("Delete this history item?")) return;
    try {
        await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
        // 更新本地
        store.history = store.history.filter(h => h.id !== id);
        renderHistoryList();
    } catch(e) { alert("Delete failed"); }
}

async function deleteHistoryDate(dateStr) {
    if(!confirm(`Delete all history for ${dateStr}?`)) return;
    try {
        await fetch(`/api/history?date=${dateStr}`, { method: 'DELETE' });
        // 更新本地
        store.history = store.history.filter(h => {
            const d = new Date(h.created_at);
            const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return k !== dateStr;
        });
        renderHistoryList();
    } catch(e) { alert("Delete failed"); }
}

window.clearAllHistory = async () => {
    if(!confirm("Are you sure you want to clear ALL history?")) return;
    try {
        await fetch('/api/history', { method: 'DELETE' });
        store.history = [];
        renderHistoryList();
    } catch(e) { alert("Clear failed"); }
};

function renderCollectionTree(){
    const c=document.getElementById('sidebar-list');c.innerHTML='';
    const m={0:[]};if(store.requests){store.requests.forEach(r=>{const cid=r.collection_id||0;if(!m[cid])m[cid]=[];m[cid].push(r)});}
    const rt=document.createElement('div');rt.innerHTML=`<div class="tree-content" style="color:#666;font-size:12px;padding-left:24px;">root (drop here)</div>`;rt.ondragover=e=>{e.preventDefault();rt.style.background='#e8f0fe'};rt.ondrop=async e=>{e.preventDefault();rt.style.background='transparent';const id=e.dataTransfer.getData('reqId');if(id)await moveRequest(parseInt(id),0)};c.appendChild(rt);
    function bt(cols){
        const d=document.createElement('div');
        cols.forEach(col=>{
            const n=document.createElement('div');n.className='tree-node';
            const t=document.createElement('div');t.className='tree-content';t.innerHTML=`<span class="tree-toggle">▶</span><span class="tree-label">📁 ${escapeHtml(col.name)}</span>`;
            t.ondragover=e=>{e.preventDefault();t.classList.add('drag-over')};t.ondragleave=()=>{t.classList.remove('drag-over')};t.ondrop=async e=>{e.preventDefault();t.classList.remove('drag-over');const id=e.dataTransfer.getData('reqId');if(id)await moveRequest(parseInt(id),col.id)};
            t.onclick=e=>{e.stopPropagation();const cb=n.querySelector('.tree-children');const tg=n.querySelector('.tree-toggle');if(cb.style.display==='block'){cb.style.display='none';tg.classList.remove('open')}else{cb.style.display='block';tg.classList.add('open')}};
            n.appendChild(t);
            const cb=document.createElement('div');cb.className='tree-children';cb.appendChild(bt(col.children||[]));
            if(m[col.id])m[col.id].forEach(r=>cb.appendChild(cre(r)));
            n.appendChild(cb);d.appendChild(n)
        });
        return d
    }
    c.appendChild(bt(store.collections));if(m[0])m[0].forEach(r=>c.appendChild(cre(r)));
}

function cre(r){
    const el=document.createElement('div');el.className='tree-content';el.style.paddingLeft="24px";el.draggable=true;
    el.innerHTML=`<span class="req-method req-${r.method}">${r.method}</span><span class="tree-label">${escapeHtml(r.name)}</span>`;
    el.ondragstart=e=>{e.dataTransfer.setData('reqId',r.id)};
    el.onclick=()=> {
        // [修改] 传递 source 标识，避免重复打开
        openNewTab(r, { type: 'request', id: r.id });
    };
    return el;
}

async function moveRequest(rid,cid){const r=store.requests.find(x=>x.id===rid);if(!r||r.collection_id===cid)return;r.collection_id=cid;try{await fetch(`/api/requests/${rid}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});await loadData();renderCollectionTree();}catch(e){alert("Move failed");}}

// ==========================================
// 5. 请求发送与响应 (修复 setRespView)
// ==========================================

async function sendRequest() {
    const btn = document.getElementById('btn-send');
    btn.innerText = 'Sending...';
    
    // 重置响应数据
    store.response.rawBody = "";
    store.response.isBinary = false;
    store.response.headers = {};
    store.response.status = "";
    store.response.time_ms = "";
    store.response.error = "";
    
    renderResponseUI(); // 清空界面

    // 构造 Payload
    let requestUrl = store.current.url;
    const useMock = document.getElementById('use-mock-chk')?.checked;
    
    if (useMock) {
        let pathAndQuery = requestUrl;
        try { if (requestUrl.startsWith('http')) { const u = new URL(requestUrl); pathAndQuery = u.pathname + u.search; } } catch(e){}
        if (!pathAndQuery.startsWith('/')) pathAndQuery = '/' + pathAndQuery;
        let mockHost = document.getElementById('mock-host-input')?.value.trim() || window.location.origin;
        mockHost = mockHost.replace(/\/+$/, '');
        requestUrl = `${mockHost}/mock${pathAndQuery}`;
    }

    const payload = {
        method: store.current.method,
        url: requestUrl,
        params: store.current.params,
        headers: store.current.headers,
        auth: store.current.auth,
        body_type: store.current.body.type,
        raw_body: store.current.body.raw_content,
        form_data: store.current.body.form_data,
        url_encoded: store.current.body.url_encoded
    };

    // 异步保存历史
    const historyPayload = JSON.parse(JSON.stringify(store.current));
    fetch('/api/history', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(historyPayload) })
        .then(async () => {
            const hRes = await fetch('/api/history');
            store.history = await hRes.json();
            if (store.mode === 'history') renderHistoryList();
        }).catch(console.error);

    try {
        const res = await fetch('/api/proxy/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        // 更新 Store
        store.response.rawBody = data.body;
        store.response.isBinary = data.is_binary;
        store.response.headers = data.headers || {};
        store.response.status = data.status;
        store.response.time_ms = data.time_ms;
        store.response.error = data.error;

        // [修复] 统一使用 renderResponseUI 刷新界面
        renderResponseUI();

    } catch (e) {
        store.response.error = "Frontend Error: " + e.message;
        renderResponseUI();
    } finally {
        btn.innerText = 'Send';
    }
}

// [修复] 提取的 UI 渲染函数 (解决 Missing Function)
function renderResponseUI() {
    const data = store.response;
    if(!data) return;

    // Status
    const statusEl = document.getElementById('resp-status');
    statusEl.innerText = data.status || '-';
    statusEl.className = (data.status >= 200 && data.status < 300) ? 'status-200' : 'status-400';
    document.getElementById('resp-time').innerText = (data.time_ms || 0) + ' ms';

    // Headers
    const hBody = document.getElementById('resp-headers-tbody');
    hBody.innerHTML = '';
    if (data.headers) {
        for (const [k, v] of Object.entries(data.headers)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${escapeHtml(k)}</td><td>${escapeHtml(v.join ? v.join(', ') : v)}</td>`;
            hBody.appendChild(tr);
        }
    }

    // Reset Views
    document.getElementById('resp-preview-box').innerHTML = '';
    document.getElementById('resp-hex-box').innerHTML = '';
    document.getElementById('resp-body').classList.remove('hidden');
    document.getElementById('resp-preview-box').classList.remove('active');
    document.getElementById('resp-hex-box').classList.remove('active');
    document.getElementById('btn-view-preview').style.display = 'none';
    document.getElementById('btn-view-hex').style.display = 'none';

    // Error Handling
    if (data.error) {
        document.getElementById('resp-body').value = data.error;
        // 确保显示文本区域
        setRespView('raw');
        return;
    }

    // View Logic
    const contentType = getHeader(data.headers, 'content-type').toLowerCase();
    const isImage = contentType.includes('image');
    const isHtml = contentType.includes('html');
    
    if (data.is_binary) document.getElementById('btn-view-hex').style.display = 'block';
    if (isImage || isHtml) document.getElementById('btn-view-preview').style.display = 'block';

    // Auto Switch
    if (data.is_binary) {
        if (isImage) setRespView('preview');
        else setRespView('hex');
    } else {
        if (isHtml) setRespView('preview');
        else setRespView('pretty');
    }
}

// [修复] 将函数声明提升到顶层，确保可被调用
function setRespView(mode) {
    const txtArea = document.getElementById('resp-body');
    const prevBox = document.getElementById('resp-preview-box');
    const hexBox = document.getElementById('resp-hex-box');
    
    ['pretty', 'raw', 'preview', 'hex'].forEach(b => {
        const el = document.getElementById('btn-view-' + b);
        if(el) { if(b === mode) el.classList.add('active'); else el.classList.remove('active'); }
    });

    txtArea.classList.add('hidden');
    prevBox.classList.remove('active');
    hexBox.classList.remove('active');

    if (mode === 'preview') {
        prevBox.classList.add('active');
        renderPreview(prevBox);
    } else if (mode === 'hex') {
        hexBox.classList.add('active');
        renderHexView(hexBox);
    } else {
        txtArea.classList.remove('hidden');
        renderText(txtArea, mode);
    }
    // 暴露给 Window 以便 onclick 调用
    window.setRespView = setRespView;
}
// 初始化暴露
window.setRespView = setRespView;

function renderPreview(container) {
    container.innerHTML = '';
    const contentType = getHeader(store.response.headers, 'content-type').toLowerCase();
    
    if (store.response.isBinary && contentType.includes('image')) {
        container.innerHTML = `<div class="img-wrapper"><img src="data:${contentType};base64,${store.response.rawBody}" /></div>`;
    } else if (contentType.includes('html')) {
        const iframe = document.createElement('iframe');
        iframe.className = 'html-wrapper';
        container.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        const content = store.response.isBinary ? atob(store.response.rawBody) : store.response.rawBody;
        doc.write(content);
        doc.close();
    } else {
        container.innerHTML = `<div style="padding:20px;color:#666;">Preview not available for ${contentType}</div>`;
    }
}

function renderText(textarea, mode) {
    if (store.response.isBinary) {
        textarea.value = "(Binary Data - Switch to Hex View)";
        return;
    }
    if (mode === 'pretty') {
        try {
            const j = JSON.parse(store.response.rawBody);
            textarea.value = JSON.stringify(j, null, 2);
        } catch {
            textarea.value = store.response.rawBody;
        }
    } else {
        textarea.value = store.response.rawBody;
    }
}

function renderHexView(container) {
    container.innerHTML = '';
    let bytes;
    try {
        if (store.response.isBinary) {
            const binString = atob(store.response.rawBody);
            bytes = new Uint8Array(binString.length);
            for (let i=0; i<binString.length; i++) bytes[i] = binString.charCodeAt(i);
        } else {
            const enc = new TextEncoder();
            bytes = enc.encode(store.response.rawBody);
        }
    } catch(e) { container.innerText = "Error decoding content"; return; }

    const wrapper = document.createElement('div');
    wrapper.className = 'hex-viewer';
    let html = '';
    for (let i = 0; i < bytes.length; i += 16) {
        html += `<span class="hex-offset">${i.toString(16).padStart(8, '0')}</span>`;
        let hexStr = '';
        let asciiStr = '';
        for (let j = 0; j < 16; j++) {
            if (i + j < bytes.length) {
                const b = bytes[i + j];
                hexStr += b.toString(16).padStart(2, '0') + ' ';
                asciiStr += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
            } else {
                hexStr += '   ';
            }
        }
        html += `<span class="hex-bytes">${hexStr}</span>`;
        html += `<span class="hex-ascii">|${asciiStr}|</span>\n`;
        if (i > 1024 * 50) { html += `\n... Truncated ...`; break; }
    }
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
}

// ==========================================
// 6. 通用渲染逻辑
// ==========================================

function renderCurrentRequest() {
    const c = store.current;
    if(!c) return;
    document.getElementById('req-method').value = c.method;
    document.getElementById('req-url').value = c.url;
    renderKVTable('params-container', c.params, updateParamsFromTable);
    renderKVTable('headers-container', c.headers, ()=>{});
    document.getElementById('auth-type').value = c.auth.type||'none'; toggleAuthFields();
    if(c.auth.bearer) document.getElementById('auth-bearer-token').value=c.auth.bearer.token||'';
    if(c.auth.basic){document.getElementById('auth-basic-user').value=c.auth.basic.username||'';document.getElementById('auth-basic-pass').value=c.auth.basic.password||'';}
    document.getElementsByName('body-type').forEach(r=>r.checked=(r.value===c.body.type)); toggleBodyFields();
    document.getElementById('raw-body-input').value=c.body.raw_content||'';
    renderKVTable('form-data-container', c.body.form_data, ()=>{});
    renderKVTable('urlencoded-container', c.body.url_encoded, ()=>{});
    const tab = store.tabs.find(t=>t.id===store.activeTabId);
    if(tab) { tab.name = c.url || c.name || "New Request"; renderTabBar(); }
}

function handleUrlInput() {
    const val = document.getElementById('req-url').value;
    store.current.url = val;
    const tab = store.tabs.find(t=>t.id===store.activeTabId);
    if(tab) { tab.name = val || "New Request"; renderTabBar(); }
    if (!val.includes('?')) return;
    try {
        const u = new URL(val.startsWith('http')?val:'http://d/'+val);
        const np = []; u.searchParams.forEach((v,k)=>np.push({key:k,value:v,enabled:true,description:''}));
        ensureEmptyRow(np); store.current.params = np;
        renderKVTable('params-container', np, updateParamsFromTable);
    } catch(e){}
}

function updateParamsFromTable() {
    const urlStr = document.getElementById('req-url').value;
    try {
        const u = new URL(urlStr.startsWith('http')?urlStr:'http://d/'+urlStr);
        Array.from(u.searchParams.keys()).forEach(k=>u.searchParams.delete(k));
        store.current.params.forEach(p=>{if(p.key&&p.enabled)u.searchParams.append(p.key,p.value)});
        let f = urlStr.startsWith('http')?u.toString():u.pathname+u.search;
        if(!urlStr.startsWith('http'))f=f.replace('http://d/','');
        document.getElementById('req-url').value = f; store.current.url = f;
    } catch(e){}
}

// ==========================================
// 7. 工具与 Mock
// ==========================================

function escapeHtml(t) { if(!t)return""; if(typeof t!=='string')t=String(t); return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function ensureEmptyRow(list) { if(!list)return; if(list.length===0||list[list.length-1].key!=='')list.push({key:'',value:'',enabled:true}); }
function getHeader(h,k){if(!h)return"";const l=k.toLowerCase();for(const x in h){if(x.toLowerCase()===l)return Array.isArray(h[x])?h[x][0]:h[x];}return"";}
function renderKVTable(id, list, cb) {
    const tb=document.getElementById(id); if(!tb)return; tb.innerHTML='';
    list.forEach((it,ix)=>{
        const tr=document.createElement('tr'); tr.className='kv-row';
        tr.innerHTML=`<td><input type="checkbox" class="kv-check" ${it.enabled!==false?'checked':''}></td><td><input type="text" class="kv-input key" value="${escapeHtml(it.key)}"></td><td><input type="text" class="kv-input val" value="${escapeHtml(it.value)}"></td><td width="30"><span class="kv-delete">×</span></td>`;
        tr.querySelectorAll('input').forEach(i=>i.oninput=()=>{it.key=tr.querySelector('.key').value;it.value=tr.querySelector('.val').value;it.enabled=tr.querySelector('.kv-check').checked;if(ix===list.length-1&&(it.key||it.value)){ensureEmptyRow(list);renderKVTable(id,list,cb);}if(cb)cb();});
        tr.querySelector('.kv-delete').onclick=()=>{if(list.length>1){list.splice(ix,1);renderKVTable(id,list,cb);if(cb)cb();}else{it.key='';it.value='';renderKVTable(id,list,cb);}};
        tb.appendChild(tr);
    });
}
function toggleAuthFields(){const t=document.getElementById('auth-type').value;document.querySelectorAll('.auth-config').forEach(e=>e.classList.add('hidden'));if(t==='bearer')document.getElementById('auth-bearer').classList.remove('hidden');if(t==='basic')document.getElementById('auth-basic').classList.remove('hidden');}
function toggleBodyFields(){const t=document.querySelector('input[name="body-type"]:checked').value;document.getElementById('body-raw-editor').classList.add('hidden');document.getElementById('body-form-data').classList.add('hidden');document.getElementById('body-urlencoded').classList.add('hidden');if(t==='raw')document.getElementById('body-raw-editor').classList.remove('hidden');if(t==='form-data')document.getElementById('body-form-data').classList.remove('hidden');if(t==='x-www-form-urlencoded')document.getElementById('body-urlencoded').classList.remove('hidden');}
window.formatJSON=()=>{try{const el=document.getElementById('raw-body-input');el.value=JSON.stringify(JSON.parse(el.value),null,2);store.current.body.raw_content=el.value;}catch(e){alert("Invalid JSON");}};

// Save / Import / Export
window.openSaveModal=()=>{document.getElementById('save-modal').style.display='flex';document.getElementById('save-name').value=store.current.name||'New Request'; renderCollectionSelect(); const f=document.getElementById('save-modal-footer'); f.innerHTML=''; const c=document.createElement('button');c.className='btn btn-secondary';c.innerText='Cancel';c.onclick=closeSaveModal;c.style.marginRight='10px';f.appendChild(c); const s=document.createElement('button');s.className='btn btn-primary';s.innerText=store.current.id>0?'Update Existing':'Save';s.onclick=()=>confirmSave(store.current.id>0?'update':'create');f.appendChild(s); if(store.current.id>0){const sn=document.createElement('button');sn.className='btn btn-primary';sn.innerText='Save As New';sn.style.backgroundColor='#28a745';sn.style.marginLeft='10px';sn.onclick=()=>confirmSave('create');f.appendChild(sn);}};
window.closeSaveModal=()=>{document.getElementById('save-modal').style.display='none';};
function renderCollectionSelect(){const s=document.getElementById('save-collection');s.innerHTML='<option value="0">Root</option>'; const fn=(cols,p='')=>{cols.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.text=p+c.name;s.appendChild(o);if(c.children)fn(c.children,p+'-- ');})}; fn(store.collections);s.value=store.current.collection_id||0;}
window.quickCreateCollection=async()=>{const n=prompt("Name:");if(!n)return;await fetch('/api/collections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,parent_id:0})});await loadData();if(store.mode==='api')renderCollectionTree();renderCollectionSelect();};
window.confirmSave=async(act)=>{const n=document.getElementById('save-name').value;if(!n)return alert("Name required"); store.current.name=n; store.current.collection_id=parseInt(document.getElementById('save-collection').value); const u=act==='create'?'/api/requests':`/api/requests/${store.current.id}`; const m=act==='create'?'POST':'PUT'; if(act==='create') store.current.id=0; try{const r=await fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:JSON.stringify(store.current)});if(r.ok){closeSaveModal();if(act==='create')store.current.id=(await r.json()).id; await loadData(); renderCollectionTree();}else alert("Fail");}catch(e){alert("Err");}};
window.handleExportData = () => window.open('/api/export', '_blank');
window.triggerImport = () => document.getElementById('import-file').click();
document.getElementById('import-file').onchange = async (e) => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev)=>{ try { await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:ev.target.result}); await loadData(); if(store.mode==='api')renderCollectionTree(); else if(store.mode==='history')renderHistoryList(); else renderMockList(); alert("Imported"); } catch(ex){alert("Error");} }; r.readAsText(f); };
window.exportCurrentRequest = () => { const data={version:"1.0",exported_at:new Date().toISOString(),requests:[store.current]}; downloadJSON(data,`req_${store.current.name||'unt'}.json`); };
window.exportCurrentMock = () => { const data={version:"1.0",exported_at:new Date().toISOString(),mock_rules:[store.currentMock]}; downloadJSON(data,`mock_${store.currentMock.path_pattern.replace(/\//g,'_')}.json`); };
function downloadJSON(d,n){const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}

// Mock CRUD (Shortened for brevity but complete)
function renderMockList() { const c=document.getElementById('sidebar-list'); c.innerHTML=''; if(!store.mocks.length){c.innerHTML='<div style="padding:20px;color:#999;text-align:center">No mocks</div>';return;} store.mocks.forEach(m=>{const el=document.createElement('div'); el.className=`mock-item ${store.currentMock.id===m.id?'active':''}`; el.innerHTML=`<div class="mock-status ${m.is_active?'on':''}"></div><span class="req-method req-${m.method}">${m.method}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.path_pattern)}</span>`; el.onclick=()=>loadMock(m); c.appendChild(el);}); }
function loadMock(m){store.currentMock=JSON.parse(JSON.stringify(m));if(!store.currentMock.response_headers)store.currentMock.response_headers={};renderMockForm();renderMockList();}
window.resetMockForm=()=>{store.currentMock={id:0,path_pattern:"",method:"GET",status_code:200,response_body:"",response_headers:{},is_active:true};renderMockForm();renderMockList();}
function renderMockForm(){ const m=store.currentMock; document.getElementById('mock-path').value=m.path_pattern; document.getElementById('mock-method').value=m.method; document.getElementById('mock-status').value=m.status_code; document.getElementById('mock-body').value=m.response_body||''; document.getElementById('mock-active').checked=m.is_active; const h=Object.entries(m.response_headers||{}).map(([k,v])=>({key:k,value:v,enabled:true})); ensureEmptyRow(h); renderKVTable('mock-headers-container',h,()=>{}); document.getElementById('btn-delete-mock').style.display=m.id>0?'inline-block':'none'; updateMockUrlPreview(); }
window.saveMockRule=async()=>{ const m=store.currentMock; m.path_pattern=document.getElementById('mock-path').value; m.method=document.getElementById('mock-method').value; m.status_code=parseInt(document.getElementById('mock-status').value)||200; m.response_body=document.getElementById('mock-body').value; m.is_active=document.getElementById('mock-active').checked; m.response_headers={}; document.querySelectorAll('#mock-headers-container .kv-row').forEach(r=>{const k=r.querySelector('.key').value; const v=r.querySelector('.val').value; if(k)m.response_headers[k]=v;}); const url=m.id?`/api/mocks/${m.id}`:'/api/mocks'; const meth=m.id?'PUT':'POST'; try{const r=await fetch(url,{method:meth,headers:{'Content-Type':'application/json'},body:JSON.stringify(m)}); if(r.ok){if(meth==='POST')m.id=(await r.json()).id; await loadData(); renderMockList(); alert("Saved");}else alert("Failed");}catch(e){alert("Error");} };
window.deleteMockRule=async()=>{if(!confirm("Delete?"))return; await fetch(`/api/mocks/${store.currentMock.id}`,{method:'DELETE'}); await loadData(); resetMockForm();};
window.updateMockUrlPreview=()=>{const p=document.getElementById('mock-path').value; const u=`${location.protocol}//${location.hostname}:${location.port}/mock/${p.startsWith('/')?p.substring(1):p}`; document.querySelector('#mock-url-preview span').innerText=u;}
window.copyMockUrl=()=>{navigator.clipboard.writeText(document.querySelector('#mock-url-preview span').innerText);alert("Copied");};
window.formatMockJSON=()=>{try{const el=document.getElementById('mock-body');el.value=JSON.stringify(JSON.parse(el.value),null,2);}catch(e){alert("Invalid");}};

// Events Setup
function setupEvents() {
    document.getElementById('req-url').oninput = handleUrlInput;
    document.getElementById('req-method').onchange = (e) => store.current.method = e.target.value;
    document.getElementById('btn-send').onclick = sendRequest;
    window.switchTab = (tab) => { document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active')); document.querySelectorAll('.tab-content-container').forEach(el => el.classList.remove('active')); Array.from(document.querySelectorAll('.nav-tab')).find(t => t.innerText.toLowerCase().includes(tab)).classList.add('active'); document.getElementById('tab-' + tab).classList.add('active'); };
    window.switchRespTab = (tab) => { document.querySelectorAll('.resp-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.response-content').forEach(c => c.classList.remove('active')); Array.from(document.querySelectorAll('.resp-tab')).find(t => t.innerText.toLowerCase().includes(tab)).classList.add('active'); document.getElementById('resp-tab-' + tab).classList.add('active'); };
    document.getElementById('auth-type').onchange = (e) => { store.current.auth.type = e.target.value; toggleAuthFields(); };
    document.getElementById('auth-bearer-token').oninput = (e) => store.current.auth.bearer.token = e.target.value;
    document.getElementById('auth-basic-user').oninput = (e) => store.current.auth.basic.username = e.target.value;
    document.getElementById('auth-basic-pass').oninput = (e) => store.current.auth.basic.password = e.target.value;
    document.getElementsByName('body-type').forEach(r => { r.onchange = (e) => { store.current.body.type = e.target.value; toggleBodyFields(); }; });
    document.getElementById('raw-body-input').oninput = (e) => store.current.body.raw_content = e.target.value;
    document.getElementById('mock-path').oninput = updateMockUrlPreview;
}