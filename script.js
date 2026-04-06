// --- 1. 全域變數與初始化 ---
let rareData = JSON.parse(localStorage.getItem('rareData') || '[]');
let shopName = localStorage.getItem('shopName') || '[微笑小舖]';
const GITHUB_BASE = "https://raw.githubusercontent.com/JohnChang1/card-search2/main/";

let pendingData = []; // 暫存準備匯出的資料清單

// 初始化執行
updateRareDropdown();
initGlobalListeners();

// --- 2. 設定相關功能 (Modal) ---
function toggleModal(show) {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = show ? 'block' : 'none';
    if (show) {
        document.getElementById('rareJsonInput').value = JSON.stringify(rareData, null, 4);
        document.getElementById('shopNameInput').value = shopName;
    }
}

function saveSettings() {
    try {
        shopName = document.getElementById('shopNameInput').value;
        localStorage.setItem('shopName', shopName);
        
        const input = document.getElementById('rareJsonInput').value;
        const parsed = JSON.parse(input);
        if (!Array.isArray(parsed)) throw new Error("格式非陣列");
        rareData = parsed;
        localStorage.setItem('rareData', JSON.stringify(rareData));
        
        updateRareDropdown();
        toggleModal(false);
    } catch (e) {
        alert('設定儲存失敗，請檢查格式！');
    }
}

function updateRareDropdown() {
    const select = document.getElementById('rareSelect');
    if (!select) return;
    select.innerHTML = '<option value="0">全部稀有度</option>';
    rareData.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.rare_id;
        opt.textContent = item.rare;
        select.appendChild(opt);
    });
}

// --- 3. 核心功能：名稱格式化與清單管理 ---

// 優化後的名稱格式化：[店名] 遊戲王 {卡號去-} {卡號} {純卡名} ({稀有度})
function formatListingName(cardNoInput, apiTitle, rarity) {
    const cardNo = cardNoInput.toUpperCase(); // 例如: LOCH-JP002
    const cardNoClean = cardNo.replace(/-/g, '').toLowerCase(); // 例如: lochjp002

    // 使用 Regex 移除 API 標題中已有的編號（不分大小寫），避免重複顯示
    let pureCardName = apiTitle.replace(new RegExp(cardNo, 'gi'), '').trim();
    pureCardName = pureCardName.replace(/^[-—\s]+/, ''); // 移除剩餘的橫槓或空白

    return `${shopName} 遊戲王 ${cardNoClean} ${cardNo} ${pureCardName} (${rarity})`;
}

// 點擊「寫入」或「快速加入」時執行的動作
// 修改後的 addToList 函式
function addToList(data) {
    const rareId = document.getElementById('rareSelect').value;
    if (rareId === "0") {
        showToast("⚠️ 請先選擇稀有度 (不可為全部)");
        return;
    }

    // --- 關鍵修改：檢查是否有選取地端圖片 ---
    const cdnDisplay = document.getElementById('cdnUrlDisplay');
    const cdnPath = cdnDisplay ? cdnDisplay.innerText.trim() : "";

    // 如果 CDN 路徑不為空，則覆蓋掉原本傳入的圖片路徑 (API 圖片)
    if (cdnPath !== "") {
        data.img = cdnPath;
    }

    pendingData.push(data);
    updatePreviewTable();
    
    // 加入後建議清空選取狀態，避免下一張卡片誤用同一張圖
    // 如果你想要連續使用同一張圖，可以把下面這兩行註解掉
    // document.querySelectorAll('.album-item').forEach(i => i.classList.remove('selected'));
    // document.getElementById('cdnUrlDisplay').innerText = "";

    showToast(`✅ 已加入清單 (目前 ${pendingData.length} 筆)`);
}

// --- 4. API 查詢與介面互動 ---

async function fetchData() {
    const keyword = document.getElementById('keyword').value;
    const rareId = document.getElementById('rareSelect').value;
    const tableBody = document.getElementById('cardTableBody');
    const searchBtn = document.getElementById('searchBtn');

    if(!keyword) return;
    searchBtn.disabled = true;
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">查詢中...</td></tr>';

    try {
        const response = await fetch('https://ygo.iwantcard.tw/api/Goods/getList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "game_id": 1, "type": 1, "key_word": keyword,
                "rare_id": parseInt(rareId), "page": 1, "page_nums": 50,
                "order_type": 0, "order_sort": 0, "filter_no_sale": false
            })
        });

        const res = await response.json();
        const list = res.data.list || [];
        tableBody.innerHTML = '';
        
        const defQty = document.getElementById('defaultQty').value || 1;
        const defPrice = document.getElementById('defaultPrice').value || "";

        if (list.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">找不到相關卡片。</td></tr>';
            return;
        }

        list.forEach(item => {
            const currentKeyword = document.getElementById('keyword').value;
            const listingName = formatListingName(currentKeyword, item.goods_title, item.rare);
            const finalPrice = defPrice || item.sell_min_price;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.goods_thumb}" class="card-img"></td>
                <td>
                    <div style="color:#666; font-size:12px;">${item.goods_title}</div>
                    <div class="listing-name-preview" style="font-weight:bold;">${listingName}</div>
                </td>
                <td><span class="rare-tag">${item.rare}</span><br><small>(ID: ${item.rare_id})</small></td>
                <td>$${item.sell_min_price} ~ $${item.sell_max_price}</td>
                <td>
                    <input type="number" class="row-qty" value="${defQty}" style="width:50px;">
                    <input type="number" class="row-price" value="${finalPrice}" style="width:70px;">
                </td>
                <td class="action-cell">
                    <button class="btn-copy" onclick="copyText('${listingName}', this)">名</button>
                    <button class="btn-search" style="background:#ffc107; color:#000; margin-top:5px;" 
                        onclick="addToList({title:'${listingName.replace(/'/g, "\\'")}', price:'${finalPrice}', qty:'${defQty}', img:'${item.goods_thumb}'})">加入</button>
                </td>`;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="6">查詢失敗，請檢查網路。</td></tr>';
    } finally { 
        searchBtn.disabled = false; 
        checkGlobalBtn(); 
    }
}

// 頂部工具列的快速加入按鈕
function writeCurrentToExcel() {
    const keyword = document.getElementById('keyword').value;
    const qty = document.getElementById('defaultQty').value;
    const price = document.getElementById('defaultPrice').value;
    const rareSelect = document.getElementById('rareSelect');
    const rareText = rareSelect.options[rareSelect.selectedIndex].text;
    const imgPath = document.getElementById('cdnUrlDisplay').innerText || "";

    const listingName = formatListingName(keyword, "(手動輸入)", rareText);

    addToList({
        title: listingName,
        price: price,
        qty: qty,
        img: imgPath
    });
}

// --- 5. Excel 匯出與預覽功能 ---

function exportToNewExcel() {
    if (pendingData.length === 0) {
        alert("清單是空的！");
        return;
    }

    // 建立二維陣列作為 Excel 內容，第一列為標題
    const excelRows = [
        ["類別ID", "商品名稱", "商品描述", "", "", "", "", "", "", "", "", "", "價格", "數量", "", "", "", "", "圖片連結"] 
    ];

    pendingData.forEach(item => {
        const row = [];
        row[0] = "101392";          // A: 類別ID
        row[1] = item.title;        // B: 商品名稱
        row[2] = "";                // C: 商品描述
        row[12] = item.price;       // M: 價格
        row[13] = item.qty;         // N: 數量
        row[18] = item.img;         // S: 圖片連結
        
        // AF~AJ (索引 31~35) 填入 "開啟"
        for(let i=31; i<=35; i++) row[i] = "開啟";
        
        excelRows.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "上傳清單");

    XLSX.writeFile(workbook, `微笑小舖匯出_${new Date().getTime()}.xlsx`);
}

function updatePreviewTable() {
    const container = document.getElementById('previewContainer');
    const tbody = document.getElementById('previewTableBody');
    const countSpan = document.getElementById('pendingCount');
    
    if (pendingData.length > 0) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        return;
    }

    countSpan.innerText = pendingData.length;
    tbody.innerHTML = '';

    pendingData.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #666; text-align:center;">${index + 1}</td>
            <td style="font-weight: bold;">${item.title}</td>
            <td>$${item.price}</td>
            <td>${item.qty}</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #007bff; font-size: 11px;" title="${item.img}">
                ${item.img}
            </td>
            <td style="text-align:center;">
                <button onclick="removeFromList(${index})" style="background:none; border:none; color:#dc3545; cursor:pointer; font-size:18px; font-weight:bold;">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}



// 新增：刪除指定索引資料的函式
function removeFromList(index) {
    // 移除陣列中該索引的資料
    pendingData.splice(index, 1);
    // 重新繪製表格
    updatePreviewTable();
    showToast("🗑️ 已移除該筆資料");
}

function clearPending() {
    if(confirm("確定要清空待匯出清單嗎？")) {
        pendingData = [];
        updatePreviewTable();
    }
}

// --- 6. 工具類函式 (Toast, 監聽器等) ---

function initGlobalListeners() {
    const inputs = ['keyword', 'defaultQty', 'defaultPrice', 'rareSelect'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', checkGlobalBtn);
            el.addEventListener('input', checkGlobalBtn);
        }
    });
}

function checkGlobalBtn() {
    const keyword = document.getElementById('keyword').value;
    const qty = document.getElementById('defaultQty').value;
    const price = document.getElementById('defaultPrice').value;
    const rareId = document.getElementById('rareSelect').value;
    
    const btn = document.getElementById('globalWriteBtn');
    
    // 條件：關鍵字、數量、價格皆有值，且稀有度不能為 "0" (全部)
    const canWrite = keyword && qty && price && rareId !== "0";
    
    if (btn) {
        btn.disabled = !canWrite;
        btn.style.opacity = canWrite ? "1" : "0.5";
        btn.title = rareId === "0" ? "請先選擇特定稀有度" : "";
    }
}

function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function copyText(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const old = btn.innerText; btn.innerText = 'OK!';
        setTimeout(() => btn.innerText = old, 800);
    } catch (e) { alert('複製失敗'); }
}

function handleFiles(files) {
    const gallery = document.getElementById('localGallery');
    const folderInput = document.getElementById('folderName').value || "images";
    gallery.innerHTML = '';
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
        const url = URL.createObjectURL(file);
        const sdnUrl = `${GITHUB_BASE}${folderInput}/${file.name}`;
        const div = document.createElement('div');
        div.className = 'album-item';
        div.innerHTML = `<img class="google-drive-viewer" src="${url}"><div style="font-size:12px; margin-top:5px; text-align:center;">${file.name}</div>`;
        div.onclick = () => {
            document.querySelectorAll('.album-item').forEach(i => i.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('cdnPanel').style.display = 'block';
            document.getElementById('cdnUrlDisplay').innerText = sdnUrl;
        };
        gallery.appendChild(div);
    });
}