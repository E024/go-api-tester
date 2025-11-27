// ==========================================
// 1. 全局状态管理
// ==========================================
const store = {
    mode: 'api', // 'api' | 'mock'
    collections: [],
    requests: [],
    mocks: [],
    
    // API 请求状态
    current: { 
        id: 0, 
        collection_id: 0, 
        name: "", 
        method: "GET", 
        url: "", 
        params: [], 
        headers: [], 
        auth: { type: "none", basic: {}, bearer: {} }, 
        body: { type: "none", raw_content: "", form_data: [], url_encoded: [] } 
    },
    
    // API 响应状态
    response: { 
        rawBody: "", 
        isBinary: false, 
        headers: {} 
    },
    
    // Mock 规则状态
    currentMock: { 
        id: 0, 
        path_pattern: "", 
        method: "GET", 
        status_code: 200, 
        response_body: "", 
        response_headers: {}, 
        is_active: true 
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEvents();
    injectExtraUI(); // 注入额外的导出按钮和 Mock 开关
});

async function init() {
    await loadData();
    switchMode('api'); // 默认进入 API 模式
}

async function loadData() {
    try {
        const [c, r, m] = await Promise.all([
            fetch('/api/collections'),
            fetch('/api/requests'),
            fetch('/api/mocks')
        ]);
        store.collections = (await c.json()) || [];
        store.requests = (await r.json()) || [];
        store.mocks = (await m.json()) || [];
    } catch (e) { 
        console.error("Data load error", e); 
    }
}

// 动态注入 UI 按钮（Export Current & Use Mock Checkbox）
function injectExtraUI() {
    // 为 API Toolbar 添加功能
    const apiToolbar = document.querySelector('#view-api .toolbar');
    if (apiToolbar) {
        const btnSend = document.getElementById('btn-send');

        // 1. 添加 "Use Mock" 复选框
        const mockDiv = document.createElement('div');
        mockDiv.style.display = 'flex';
        mockDiv.style.alignItems = 'center';
        mockDiv.style.marginRight = '10px';
        mockDiv.style.marginLeft = '5px';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'use-mock-chk';
        chk.style.cursor = 'pointer';
        
        const lbl = document.createElement('label');
        lbl.innerText = 'Use Mock';
        lbl.htmlFor = 'use-mock-chk';
        lbl.style.fontSize = '12px';
        lbl.style.marginLeft = '4px';
        lbl.style.cursor = 'pointer';
        lbl.style.userSelect = 'none';
        lbl.style.color = '#555';
        lbl.style.fontWeight = '500';
        
        mockDiv.appendChild(chk);
        mockDiv.appendChild(lbl);
        
        // 插入到 Send 按钮之前
        if (btnSend) {
            apiToolbar.insertBefore(mockDiv, btnSend);
        }

        // 2. 添加导出按钮
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerText = 'Export';
        btn.title = 'Export Current Request';
        btn.onclick = exportCurrentRequest;
        btn.style.marginLeft = '5px';
        apiToolbar.appendChild(btn);
    }

    // 为 Mock Toolbar 添加导出按钮
    const mockToolbar = document.querySelector('#view-mock .toolbar > div:last-child');
    if (mockToolbar) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerText = 'Export';
        btn.title = 'Export Current Mock Rule';
        btn.onclick = exportCurrentMock;
        btn.style.marginLeft = '5px';
        mockToolbar.appendChild(btn);
    }
}

// ==========================================
// 2. 模式切换 (API vs Mock)
// ==========================================

window.switchMode = (mode) => {
    store.mode = mode;
    
    // UI 切换
    document.getElementById('mode-api').classList.toggle('active', mode === 'api');
    document.getElementById('mode-mock').classList.toggle('active', mode === 'mock');
    document.getElementById('view-api').style.display = mode === 'api' ? 'flex' : 'none';
    document.getElementById('view-mock').style.display = mode === 'mock' ? 'flex' : 'none';

    // 侧边栏内容更新
    const title = document.getElementById('sidebar-title');
    const addBtn = document.getElementById('btn-sidebar-add');
    
    if (mode === 'api') {
        title.innerText = 'Collections';
        addBtn.onclick = openCollectionModal;
        renderSidebar(); 
        
        // 确保 API 界面有一个初始状态
        if(store.current.id === 0 && store.current.url === "") {
             ensureEmptyRow(store.current.params);
             ensureEmptyRow(store.current.headers);
             renderCurrentRequest();
        }
    } else {
        title.innerText = 'Mock Rules';
        addBtn.onclick = resetMockForm; 
        renderMockList();
        
        // 确保 Mock 界面有一个初始状态
        if(store.currentMock.id === 0 && store.currentMock.path_pattern === "") {
            renderMockForm();
        }
    }
};

window.handleSidebarAdd = () => {
    if (store.mode === 'api') openCollectionModal();
    else resetMockForm();
};

// ==========================================
// 3. 数据导入 / 导出逻辑 (精细化 & 智能合并)
// ==========================================

// 导出全部
window.handleExportData = () => {
    window.open('/api/export', '_blank');
};

// 导出当前请求
window.exportCurrentRequest = () => {
    const data = {
        version: "1.0",
        exported_at: new Date().toISOString(),
        collections: [], // 暂不导出关联的分组结构，仅导出请求本身
        requests: [store.current],
        mock_rules: []
    };
    downloadJSON(data, `request_${store.current.name || 'untitled'}.json`);
};

// 导出当前 Mock
window.exportCurrentMock = () => {
    const data = {
        version: "1.0",
        exported_at: new Date().toISOString(),
        collections: [],
        requests: [],
        mock_rules: [store.currentMock]
    };
    downloadJSON(data, `mock_${store.currentMock.path_pattern.replace(/\//g, '_')}.json`);
};

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.triggerImport = () => {
    document.getElementById('import-file').click();
};

// 智能导入逻辑：前端处理合并与更新
document.getElementById('import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importData = JSON.parse(event.target.result);
            await smartImport(importData);
        } catch (err) {
            alert("Invalid JSON file: " + err.message);
        }
        e.target.value = ''; // 清空以允许重复选择
    };
    reader.readAsText(file);
};

async function smartImport(data) {
    // 1. 刷新最新数据
    await loadData();
    
    let stats = { updatedCols: 0, newCols: 0, updatedReqs: 0, newReqs: 0, updatedMocks: 0, newMocks: 0 };
    const colIdMap = {}; // OldID -> NewID/ExistingID

    // 2. 处理分组 (Collections)
    if (data.collections) {
        let pending = [...data.collections];
        let lastLen = -1;
        
        while (pending.length > 0 && pending.length !== lastLen) {
            lastLen = pending.length;
            const nextPending = [];
            
            for (const col of pending) {
                let parentID = 0;
                let ready = true;
                
                if (col.parent_id !== 0) {
                    if (colIdMap[col.parent_id]) {
                        parentID = colIdMap[col.parent_id];
                    } else {
                        ready = false; // 父节点还没处理
                    }
                }
                
                if (ready) {
                    // 重新获取扁平列表辅助查找
                    const flatCols = flattenCollections(store.collections);
                    const exist = flatCols.find(c => c.name === col.name && c.parent_id === parentID);
                    
                    if (exist) {
                        // 更新映射
                        colIdMap[col.id] = exist.id;
                        stats.updatedCols++;
                    } else {
                        // 新建
                        const res = await fetch('/api/collections', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ name: col.name, parent_id: parentID })
                        });
                        const newCol = await res.json();
                        colIdMap[col.id] = newCol.id;
                        
                        // 手动推入本地缓存以便后续查找
                        store.collections.push({id: newCol.id, name: col.name, parent_id: parentID, children: []});
                        stats.newCols++;
                    }
                } else {
                    nextPending.push(col);
                }
            }
            pending = nextPending;
        }
    }

    // 3. 处理请求 (Requests)
    if (data.requests) {
        for (const req of data.requests) {
            const targetColId = req.collection_id ? (colIdMap[req.collection_id] || 0) : 0;
            
            // 查找重复 (同名 + 同分组)
            const exist = store.requests.find(r => r.name === req.name && (r.collection_id || 0) === targetColId);
            
            req.collection_id = targetColId;
            
            if (exist) {
                req.id = exist.id; // 复用 ID
                await fetch(`/api/requests/${exist.id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(req)
                });
                stats.updatedReqs++;
            } else {
                req.id = 0; // 确保 ID 为 0 以新建
                await fetch('/api/requests', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(req)
                });
                stats.newReqs++;
            }
        }
    }

    // 4. 处理 Mock (Mock Rules)
    if (data.mock_rules) {
        for (const mock of data.mock_rules) {
            // 查找重复 (Path + Method)
            const exist = store.mocks.find(m => m.path_pattern === mock.path_pattern && m.method === mock.method);
            
            if (exist) {
                mock.id = exist.id;
                await fetch(`/api/mocks/${exist.id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(mock)
                });
                stats.updatedMocks++;
            } else {
                mock.id = 0;
                await fetch('/api/mocks', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(mock)
                });
                stats.newMocks++;
            }
        }
    }

    await loadData(); // 最终刷新
    if (store.mode === 'api') renderSidebar(); else renderMockList();
    
    alert(`Import Completed!\n` +
          `Collections: ${stats.newCols} new, ${stats.updatedCols} merged\n` +
          `Requests: ${stats.newReqs} new, ${stats.updatedReqs} updated\n` +
          `Mocks: ${stats.newMocks} new, ${stats.updatedMocks} updated`);
}

// 辅助：将树状分组展平
function flattenCollections(cols) {
    let res = [];
    if (!cols) return res;
    for (const c of cols) {
        res.push(c);
        if (c.children) res = res.concat(flattenCollections(c.children));
    }
    return res;
}

// ==========================================
// 4. API Request 核心逻辑
// ==========================================

function loadRequest(req) {
    store.current = JSON.parse(JSON.stringify(req));
    
    // 补全缺省字段
    if (!store.current.params) store.current.params = [];
    if (!store.current.headers) store.current.headers = [];
    if (!store.current.auth) store.current.auth = { type: 'none', basic: {}, bearer: {} };
    if (!store.current.body) store.current.body = { type: 'none', raw_content: '', form_data: [], url_encoded: [] };

    ensureEmptyRow(store.current.params);
    ensureEmptyRow(store.current.headers);
    ensureEmptyRow(store.current.body.form_data);
    ensureEmptyRow(store.current.body.url_encoded);

    renderCurrentRequest();
}

function renderCurrentRequest() {
    const c = store.current;
    
    // 基础信息
    document.getElementById('req-method').value = c.method;
    document.getElementById('req-url').value = c.url; 

    // 渲染各部分
    renderKVTable('params-container', c.params, updateParamsFromTable);
    renderKVTable('headers-container', c.headers, () => {});

    // Auth
    document.getElementById('auth-type').value = c.auth.type || 'none';
    toggleAuthFields();
    if(c.auth.bearer) document.getElementById('auth-bearer-token').value = c.auth.bearer.token || '';
    if(c.auth.basic) {
        document.getElementById('auth-basic-user').value = c.auth.basic.username || '';
        document.getElementById('auth-basic-pass').value = c.auth.basic.password || '';
    }

    // Body
    const radios = document.getElementsByName('body-type');
    radios.forEach(r => r.checked = (r.value === c.body.type));
    toggleBodyFields();
    
    document.getElementById('raw-body-input').value = c.body.raw_content || '';
    renderKVTable('form-data-container', c.body.form_data, () => {});
    renderKVTable('urlencoded-container', c.body.url_encoded, () => {});
    
    // 同步一次 URL Params
    updateParamsFromTable();
}

// URL 输入框改变 -> 解析到 Params 表格
function handleUrlInput() {
    const val = document.getElementById('req-url').value;
    store.current.url = val;

    if (!val.includes('?')) return;

    try {
        const dummy = val.startsWith('http') ? val : 'http://dummy/' + val;
        const urlObj = new URL(dummy);
        
        // 保留旧描述
        const oldMap = {};
        store.current.params.forEach(p => { if(p.key) oldMap[p.key] = p.description; });
        
        const newParams = [];
        urlObj.searchParams.forEach((v, k) => {
            newParams.push({ key: k, value: v, description: oldMap[k] || '', enabled: true });
        });
        
        ensureEmptyRow(newParams);
        store.current.params = newParams;
        
        renderKVTable('params-container', store.current.params, updateParamsFromTable);
    } catch (e) {}
}

// Params 表格改变 -> 组装 URL
function updateParamsFromTable() {
    const urlStr = document.getElementById('req-url').value;
    
    try {
        const hasProtocol = urlStr.startsWith('http');
        const tempBase = hasProtocol ? urlStr : 'http://placeholder/' + (urlStr || '');
        const urlObj = new URL(tempBase);
        
        // 清除原有 Search Params
        const keys = Array.from(urlObj.searchParams.keys());
        keys.forEach(k => urlObj.searchParams.delete(k));
        
        // 追加新参数
        store.current.params.forEach(p => {
            if (p.key && p.enabled) urlObj.searchParams.append(p.key, p.value);
        });

        let finalUrl = hasProtocol ? urlObj.toString() : urlObj.pathname + urlObj.search;
        if (!hasProtocol) finalUrl = finalUrl.replace('http://placeholder/', '');
        
        // 更新 UI (不触发 Input 事件) 和 Store
        document.getElementById('req-url').value = finalUrl;
        store.current.url = finalUrl;
    } catch (e) {}
}

// ==========================================
// 5. 发送请求与响应处理
// ==========================================

async function sendRequest() {
    const btn = document.getElementById('btn-send');
    btn.innerText = 'Sending...';
    
    // 重置响应 UI
    store.response = { rawBody: "", isBinary: false, headers: {} };
    document.getElementById('resp-body').value = '';
    document.getElementById('resp-headers-tbody').innerHTML = '';
    
    // 隐藏所有视图
    document.getElementById('resp-preview-box').innerHTML = '';
    document.getElementById('resp-hex-box').innerHTML = '';
    document.getElementById('resp-body').classList.remove('hidden');
    
    // 隐藏视图按钮
    document.getElementById('btn-view-preview').style.display = 'none';
    document.getElementById('btn-view-hex').style.display = 'none';
    
    switchRespTab('body');

    // --- Mock 集成 ---
    let requestUrl = store.current.url;
    // 获取复选框状态 (安全访问)
    const useMock = document.getElementById('use-mock-chk')?.checked;
    
    if (useMock) {
        // 1. 解析出 Path 和 Query
        let pathAndQuery = requestUrl;
        try {
            if (requestUrl.startsWith('http')) {
                const u = new URL(requestUrl);
                pathAndQuery = u.pathname + u.search;
            }
        } catch(e) {}
        
        if (!pathAndQuery.startsWith('/')) pathAndQuery = '/' + pathAndQuery;
        
        // 2. 构造本地 Mock URL (e.g., http://localhost:17780/mock/users)
        requestUrl = `${window.location.origin}/mock${pathAndQuery}`;
        console.log("Using Mock URL:", requestUrl);
    }

    // 构造 Payload
    const payload = {
        method: store.current.method,
        url: requestUrl, // 使用可能经过 Mock 处理的 URL
        params: store.current.params,
        headers: store.current.headers,
        auth: store.current.auth,
        body_type: store.current.body.type,
        raw_body: store.current.body.raw_content,
        form_data: store.current.body.form_data,
        url_encoded: store.current.body.url_encoded
    };

    try {
        const res = await fetch('/api/proxy/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        // 状态码
        const statusEl = document.getElementById('resp-status');
        statusEl.innerText = data.status;
        statusEl.className = data.status >= 200 && data.status < 300 ? 'status-200' : 'status-400';
        document.getElementById('resp-time').innerText = (data.time_ms || 0) + ' ms';

        // 错误处理
        if (data.error) {
            document.getElementById('resp-body').value = "System Error: " + data.error;
            setRespView('raw');
            return;
        }

        // 保存响应数据
        store.response.rawBody = data.body;
        store.response.isBinary = data.is_binary;
        store.response.headers = data.headers || {};

        // 渲染 Headers
        const hBody = document.getElementById('resp-headers-tbody');
        hBody.innerHTML = '';
        for (const [k, v] of Object.entries(store.response.headers)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${escapeHtml(k)}</td><td>${escapeHtml(v.join ? v.join(', ') : v)}</td>`;
            hBody.appendChild(tr);
        }

        // 智能视图切换
        const contentType = getHeader(data.headers, 'content-type').toLowerCase();
        const isImage = contentType.includes('image');
        const isHtml = contentType.includes('html');
        
        // 显示按钮
        if (data.is_binary) document.getElementById('btn-view-hex').style.display = 'block';
        if (isImage || isHtml) document.getElementById('btn-view-preview').style.display = 'block';

        // 自动选择视图
        if (data.is_binary) {
            if (isImage) setRespView('preview');
            else setRespView('hex');
        } else {
            if (isHtml) setRespView('preview');
            else setRespView('pretty');
        }

    } catch (e) {
        document.getElementById('resp-body').value = "Frontend Request Error: " + e.message;
    } finally {
        btn.innerText = 'Send';
    }
}

// 响应视图切换 (Pretty / Raw / Preview / Hex)
window.setRespView = (mode) => {
    const txtArea = document.getElementById('resp-body');
    const prevBox = document.getElementById('resp-preview-box');
    const hexBox = document.getElementById('resp-hex-box');
    
    // 更新按钮状态
    ['pretty', 'raw', 'preview', 'hex'].forEach(b => {
        const el = document.getElementById('btn-view-' + b);
        if(el) { if(b === mode) el.classList.add('active'); else el.classList.remove('active'); }
    });

    // 隐藏所有容器
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
};

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
        // 如果是二进制 HTML (Gzip 解压失败等情况)，需解码 Base64，否则直接写文本
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
    } catch(e) { container.innerText = "Error decoding content for Hex view"; return; }

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
        if (i > 1024 * 50) { html += `\n... Truncated (>50KB) ...`; break; }
    }
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
}

// ==========================================
// 6. API Save / Save As Logic
// ==========================================

window.openSaveModal = () => {
    document.getElementById('save-modal').style.display = 'flex';
    document.getElementById('save-name').value = store.current.name || 'New Request';
    renderCollectionSelect();
    
    const footer = document.getElementById('save-modal-footer');
    footer.innerHTML = '';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-secondary';
    btnCancel.innerText = 'Cancel';
    btnCancel.onclick = closeSaveModal;
    btnCancel.style.marginRight = '10px';
    footer.appendChild(btnCancel);

    if (store.current.id && store.current.id > 0) {
        const btnUpdate = document.createElement('button');
        btnUpdate.className = 'btn btn-primary';
        btnUpdate.innerText = 'Update Existing';
        btnUpdate.style.marginRight = '10px';
        btnUpdate.onclick = () => confirmSave('update');
        footer.appendChild(btnUpdate);

        const btnSaveAs = document.createElement('button');
        btnSaveAs.className = 'btn btn-primary';
        btnSaveAs.innerText = 'Save As New';
        btnSaveAs.style.backgroundColor = '#28a745';
        btnSaveAs.onclick = () => confirmSave('create');
        footer.appendChild(btnSaveAs);
    } else {
        const btnSave = document.createElement('button');
        btnSave.className = 'btn btn-primary';
        btnSave.innerText = 'Save';
        btnSave.onclick = () => confirmSave('create');
        footer.appendChild(btnSave);
    }
};

window.confirmSave = async (action) => {
    const name = document.getElementById('save-name').value;
    const colId = parseInt(document.getElementById('save-collection').value);
    
    if (!name) return alert("Name is required");

    store.current.name = name;
    store.current.collection_id = colId;

    let method, url;

    if (action === 'create') {
        method = 'POST';
        url = '/api/requests';
        store.current.id = 0; // Reset ID for new creation
    } else {
        method = 'PUT';
        url = `/api/requests/${store.current.id}`;
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(store.current)
        });

        if (res.ok) {
            closeSaveModal();
            if (action === 'create') {
                const data = await res.json();
                store.current.id = data.id;
            }
            await loadData();
            renderSidebar();
        } else {
            alert("Save failed");
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// ==========================================
// 7. Mock Management Logic
// ==========================================

function renderMockList() {
    const container = document.getElementById('sidebar-list');
    container.innerHTML = '';
    
    if (!store.mocks || store.mocks.length === 0) {
        container.innerHTML = '<div style="padding:20px; color:#999; text-align:center;">No mock rules.<br>Click + to add one.</div>';
        return;
    }

    store.mocks.forEach(m => {
        const el = document.createElement('div');
        el.className = 'mock-item';
        if (store.currentMock.id === m.id) el.classList.add('active');
        
        el.innerHTML = `
            <div class="mock-status ${m.is_active ? 'on' : ''}"></div>
            <span class="req-method req-${m.method}">${m.method}</span>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.path_pattern)}</span>
            <span style="font-size:10px; color:#999; margin-left:5px;">${m.status_code}</span>
        `;
        el.onclick = () => loadMock(m);
        container.appendChild(el);
    });
}

function loadMock(mock) {
    store.currentMock = JSON.parse(JSON.stringify(mock));
    if (!store.currentMock.response_headers) store.currentMock.response_headers = {};
    renderMockForm();
    renderMockList(); 
}

window.resetMockForm = () => {
    store.currentMock = { id: 0, path_pattern: "", method: "GET", status_code: 200, response_body: "", response_headers: {}, is_active: true };
    renderMockForm();
    renderMockList();
};

function renderMockForm() {
    const m = store.currentMock;
    document.getElementById('mock-path').value = m.path_pattern;
    document.getElementById('mock-method').value = m.method;
    document.getElementById('mock-status').value = m.status_code;
    document.getElementById('mock-body').value = m.response_body || '';
    document.getElementById('mock-active').checked = m.is_active;
    
    const headerList = Object.entries(m.response_headers || {}).map(([k, v]) => ({ key: k, value: v, enabled: true }));
    ensureEmptyRow(headerList);
    
    renderKVTable('mock-headers-container', headerList, () => {});
    document.getElementById('btn-delete-mock').style.display = m.id > 0 ? 'inline-block' : 'none';
    updateMockUrlPreview();
}

window.updateMockUrlPreview = () => {
    const path = document.getElementById('mock-path').value;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const url = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/mock/${cleanPath}`;
    const el = document.querySelector('#mock-url-preview span');
    if(el) el.innerText = url;
};

window.copyMockUrl = () => {
    const url = document.querySelector('#mock-url-preview span').innerText;
    navigator.clipboard.writeText(url).then(() => alert("Copied!"));
};

window.formatMockJSON = () => {
    try {
        const val = document.getElementById('mock-body').value;
        document.getElementById('mock-body').value = JSON.stringify(JSON.parse(val), null, 2);
    } catch(e) { alert("Invalid JSON"); }
};

window.saveMockRule = async () => {
    const m = store.currentMock;
    m.path_pattern = document.getElementById('mock-path').value;
    if (!m.path_pattern) return alert("Path pattern is required");
    if (!m.path_pattern.startsWith('/')) m.path_pattern = '/' + m.path_pattern;
    
    m.method = document.getElementById('mock-method').value;
    m.status_code = parseInt(document.getElementById('mock-status').value) || 200;
    m.response_body = document.getElementById('mock-body').value;
    m.is_active = document.getElementById('mock-active').checked;
    
    // Harvest Headers
    m.response_headers = {};
    const rows = document.querySelectorAll('#mock-headers-container .kv-row');
    rows.forEach(r => {
        const k = r.querySelector('.key').value;
        const v = r.querySelector('.val').value;
        const e = r.querySelector('.kv-check').checked;
        if(k && e) m.response_headers[k] = v;
    });

    const method = m.id ? 'PUT' : 'POST';
    const url = m.id ? `/api/mocks/${m.id}` : '/api/mocks';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(m)
        });
        if (res.ok) {
            if (method === 'POST') {
                const data = await res.json();
                m.id = data.id;
            }
            await loadData();
            renderMockList();
            alert("Mock Rule Saved");
        } else {
            alert("Save failed");
        }
    } catch (e) { alert("Error: " + e.message); }
};

window.deleteMockRule = async () => {
    if (!confirm("Are you sure you want to delete this mock rule?")) return;
    try {
        await fetch(`/api/mocks/${store.currentMock.id}`, { method: 'DELETE' });
        await loadData();
        resetMockForm();
    } catch (e) { alert("Delete failed"); }
};

// ==========================================
// 8. Sidebar & Common Helpers
// ==========================================

function renderSidebar() {
    if (store.mode === 'mock') { renderMockList(); return; }
    
    const sidebar = document.getElementById('sidebar-list');
    sidebar.innerHTML = '';
    
    const map = { 0: [] };
    if (store.requests) {
        store.requests.forEach(r => {
            const cid = r.collection_id || 0;
            if(!map[cid]) map[cid] = [];
            map[cid].push(r);
        });
    }

    const rootTarget = document.createElement('div');
    rootTarget.innerHTML = `<div class="tree-content" style="color:#666; font-size:12px; padding-left:24px;">root (drop here)</div>`;
    rootTarget.ondragover = (e) => { e.preventDefault(); rootTarget.style.background = '#e8f0fe'; };
    rootTarget.ondrop = async (e) => { 
        e.preventDefault(); 
        rootTarget.style.background = 'transparent'; 
        const rid = e.dataTransfer.getData('reqId'); 
        if(rid) await moveRequest(parseInt(rid), 0); 
    };
    sidebar.appendChild(rootTarget);

    function buildTree(cols) {
        const container = document.createElement('div');
        if (cols) {
            cols.forEach(col => {
                const node = document.createElement('div');
                node.className = 'tree-node';
                
                const title = document.createElement('div');
                title.className = 'tree-content';
                title.innerHTML = `<span class="tree-toggle">▶</span><span class="tree-label">📁 ${escapeHtml(col.name)}</span>`;
                
                // Drag Target
                title.ondragover = (e) => { e.preventDefault(); title.classList.add('drag-over'); };
                title.ondragleave = () => { title.classList.remove('drag-over'); };
                title.ondrop = async (e) => { 
                    e.preventDefault(); 
                    title.classList.remove('drag-over'); 
                    const rid = e.dataTransfer.getData('reqId'); 
                    if(rid) await moveRequest(parseInt(rid), col.id); 
                };

                title.onclick = (e) => {
                    e.stopPropagation();
                    const cb = node.querySelector('.tree-children');
                    const tg = node.querySelector('.tree-toggle');
                    if (cb.style.display === 'block') {
                        cb.style.display = 'none';
                        tg.classList.remove('open');
                    } else {
                        cb.style.display = 'block';
                        tg.classList.add('open');
                    }
                };
                
                node.appendChild(title);
                const childBox = document.createElement('div');
                childBox.className = 'tree-children';
                childBox.appendChild(buildTree(col.children));
                
                if (map[col.id]) {
                    map[col.id].forEach(req => childBox.appendChild(createReqEl(req)));
                }
                node.appendChild(childBox);
                container.appendChild(node);
            });
        }
        return container;
    }

    sidebar.appendChild(buildTree(store.collections));
    if (map[0]) map[0].forEach(req => sidebar.appendChild(createReqEl(req)));
}

function createReqEl(req) {
    const el = document.createElement('div');
    el.className = 'tree-content';
    el.style.paddingLeft = "24px";
    el.draggable = true;
    el.innerHTML = `<span class="req-method req-${req.method}">${req.method}</span><span class="tree-label">${escapeHtml(req.name)}</span>`;
    el.ondragstart = (e) => { e.dataTransfer.setData('reqId', req.id); };
    el.onclick = () => loadRequest(req);
    return el;
}

async function moveRequest(reqId, newColId) {
    const req = store.requests.find(r => r.id === reqId);
    if (!req || req.collection_id === newColId) return;
    req.collection_id = newColId;
    
    try {
        await fetch(`/api/requests/${reqId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req)
        });
        await loadData();
        renderSidebar();
    } catch (e) { alert("Move failed"); }
}

function renderCollectionSelect() {
    const sel = document.getElementById('save-collection');
    sel.innerHTML = '<option value="0">Root (No Collection)</option>';
    function addOpts(cols, prefix='') {
        cols.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.text = prefix + c.name;
            sel.appendChild(opt);
            if(c.children) addOpts(c.children, prefix + '-- ');
        });
    }
    addOpts(store.collections);
    sel.value = store.current.collection_id || 0;
}

window.quickCreateCollection = async () => {
    const name = prompt("Name:");
    if (!name) return;
    await fetch('/api/collections', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, parent_id: 0}) });
    await loadData();
    renderSidebar();
    if(document.getElementById('save-modal').style.display === 'flex') {
        renderCollectionSelect();
    }
};

window.openCollectionModal = window.quickCreateCollection;
window.closeSaveModal = () => document.getElementById('save-modal').style.display = 'none';

// 通用 KV 表格渲染
function renderKVTable(id, list, cb) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    tbody.innerHTML = '';
    
    list.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'kv-row';
        tr.innerHTML = `
            <td><input type="checkbox" class="kv-check" ${item.enabled !== false ? 'checked' : ''}></td>
            <td><input type="text" class="kv-input key" value="${escapeHtml(item.key)}" placeholder="Key"></td>
            <td><input type="text" class="kv-input val" value="${escapeHtml(item.value)}" placeholder="Value"></td>
            ${item.type 
                ? `<td><input type="text" class="kv-input" value="${item.type}" readonly></td>` 
                : `<td><input type="text" class="kv-input desc" value="${escapeHtml(item.description || '')}" placeholder="Description"></td>`}
            <td><span class="kv-delete">×</span></td>
        `;

        const inputs = tr.querySelectorAll('input');
        inputs.forEach(input => {
            input.oninput = () => {
                item.key = tr.querySelector('.key').value;
                item.value = tr.querySelector('.val').value;
                if(!item.type) item.description = tr.querySelector('.desc').value;
                item.enabled = tr.querySelector('.kv-check').checked;
                
                if (idx === list.length - 1 && (item.key || item.value)) {
                    ensureEmptyRow(list);
                    renderKVTable(id, list, cb);
                }
                if (cb) cb();
            };
            if(input.type === 'checkbox') input.onchange = input.oninput;
        });

        tr.querySelector('.kv-delete').onclick = () => {
            if (list.length > 1) {
                list.splice(idx, 1);
                renderKVTable(id, list, cb);
                if (cb) cb();
            } else {
                item.key = ''; item.value = ''; renderKVTable(id, list, cb);
            }
        };
        tbody.appendChild(tr);
    });
}

function ensureEmptyRow(list) {
    if (!list) return;
    if (list.length === 0 || list[list.length - 1].key !== '') {
        list.push({ key: '', value: '', description: '', enabled: true });
    }
}

function getHeader(headers, key) {
    if (!headers) return "";
    const lower = key.toLowerCase();
    for (const k in headers) {
        if (k.toLowerCase() === lower) {
            const val = headers[k];
            return Array.isArray(val) ? val[0] : val;
        }
    }
    return "";
}

function escapeHtml(text) {
    if (!text) return "";
    if (typeof text !== 'string') text = String(text);
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toggleAuthFields() {
    const t = document.getElementById('auth-type').value;
    document.querySelectorAll('.auth-config').forEach(e => e.classList.add('hidden'));
    if (t === 'bearer') document.getElementById('auth-bearer').classList.remove('hidden');
    if (t === 'basic') document.getElementById('auth-basic').classList.remove('hidden');
}

function toggleBodyFields() {
    const t = document.querySelector('input[name="body-type"]:checked').value;
    document.getElementById('body-raw-editor').classList.add('hidden');
    document.getElementById('body-form-data').classList.add('hidden');
    document.getElementById('body-urlencoded').classList.add('hidden');
    
    if (t === 'raw') document.getElementById('body-raw-editor').classList.remove('hidden');
    if (t === 'form-data') document.getElementById('body-form-data').classList.remove('hidden');
    if (t === 'x-www-form-urlencoded') document.getElementById('body-urlencoded').classList.remove('hidden');
}

window.formatJSON = () => {
    try {
        const el = document.getElementById('raw-body-input');
        if(!el.offsetParent) return;
        const val = el.value;
        el.value = JSON.stringify(JSON.parse(val), null, 2);
        store.current.body.raw_content = el.value;
    } catch (e) { alert("Invalid JSON"); }
};

// 统一事件绑定
function setupEvents() {
    // API UI Events
    document.getElementById('req-url').oninput = handleUrlInput;
    document.getElementById('req-method').onchange = (e) => store.current.method = e.target.value;
    
    window.switchTab = (tab) => {
        document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content-container').forEach(el => el.classList.remove('active'));
        Array.from(document.querySelectorAll('.nav-tab')).find(t => t.innerText.toLowerCase().includes(tab)).classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
    };
    
    window.switchRespTab = (tab) => {
        document.querySelectorAll('.resp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.response-content').forEach(c => c.classList.remove('active'));
        Array.from(document.querySelectorAll('.resp-tab')).find(t => t.innerText.toLowerCase().includes(tab)).classList.add('active');
        document.getElementById('resp-tab-' + tab).classList.add('active');
    };
    
    document.getElementById('auth-type').onchange = (e) => { store.current.auth.type = e.target.value; toggleAuthFields(); };
    document.getElementById('auth-bearer-token').oninput = (e) => store.current.auth.bearer.token = e.target.value;
    document.getElementById('auth-basic-user').oninput = (e) => store.current.auth.basic.username = e.target.value;
    document.getElementById('auth-basic-pass').oninput = (e) => store.current.auth.basic.password = e.target.value;
    
    document.getElementsByName('body-type').forEach(r => { 
        r.onchange = (e) => { store.current.body.type = e.target.value; toggleBodyFields(); }; 
    });
    
    document.getElementById('raw-body-input').oninput = (e) => store.current.body.raw_content = e.target.value;
    document.getElementById('btn-send').onclick = sendRequest;
    
    // Mock UI Events
    document.getElementById('mock-path').oninput = updateMockUrlPreview;
}