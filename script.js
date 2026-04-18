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

    // 2. 排序稀有度資料
    rareData = [...rareData].sort((a, b) => parseInt(a.rare_id) - parseInt(b.rare_id));

    // 3. 渲染排序後的資料
    rareData.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.rare_id;
        opt.textContent = item.rare;
        select.appendChild(opt);
    });
}

// --- 3. 核心功能：名稱格式化與清單管理 ---

// 優化後的名稱格式化：[店名] 遊戲王 {卡號去-} {卡號} {純卡名} ({稀有度})
function formatListingName(officialCardNo, apiTitle, rarity) {
    const cardNoClean = officialCardNo.replace('-', '').toLowerCase();
    
    // 輸出格式：[店名] 遊戲王 {去槓小寫} {官方大寫卡號} {純名} ({稀有度})
    return `${shopName} 遊戲王 ${cardNoClean} ${officialCardNo.toUpperCase()} ${apiTitle} (${rarity})`;
}

// 點擊「寫入」或「快速加入」時執行的動作
// 修改後的 addToList 函式
function addToList(data) {
    // 檢查是否有選取地端圖片
    const cdnDisplay = document.getElementById('cdnUrlDisplay');
    const cdnPath = cdnDisplay ? cdnDisplay.innerText.trim() : "";

    // 如果地端有選圖，則覆蓋掉原本的 API 圖片路徑
    if (cdnPath !== "") {
        data.img = cdnPath;
    }

    pendingData.push(data);
    updatePreviewTable();
    
    // 成功加入提示
    showToast(`✅ 已加入清單：${data.title.substring(0, 15)}...`);
}


// --- 4. API 查詢與介面互動 ---
async function fetchData() {
    // 1. 取得輸入並轉為小寫
    const fullKeyword = document.getElementById('keyword').value.trim().toLowerCase();
    const rareId = document.getElementById('rareSelect').value;
    const tableBody = document.getElementById('cardTableBody');
    const searchBtn = document.getElementById('searchBtn');

    if (!fullKeyword) return;

    searchBtn.disabled = true;
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">正在搜尋卡片...</td></tr>';

    try {
        const response = await fetch('https://ygo.iwantcard.tw/api/Goods/getList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "game_id": 1,
                "type": 1,
                "series_id": "",
                "rare_id": parseInt(rareId),
                "page": 1,
                "page_nums": 50, 
                "order_type": 0,
                "order_sort": 0,
                "periodical_id": 0,
                "key_word": fullKeyword, // 直接傳入完整的輸入 (例如 loch-jp001)
                "show_type": 0,
                "is_peek": 0,
                "hot": 0,
                "filter_no_sale": false
            })
        });

        const res = await response.json();
        let list = res.data.list || [];
        
        // 偵錯：看看 API 到底丟了什麼回來
        console.log("📥 API 回傳結果:", list);

        // 2. 依然保留過濾邏輯，但比對的是 fullKeyword
        // 這樣可以過濾掉 API 亂吐的無關卡片 (例如搜尋 loch-jp001 卻跑出戰刀匠)
        const searchUpper = fullKeyword.toUpperCase();
        list = list.filter(item => {
            const sn = (item.goods_sn || "").toUpperCase();
            const title = (item.goods_title || "").toUpperCase();
            return sn.includes(searchUpper) || title.includes(searchUpper);
        });

        tableBody.innerHTML = '';
        
        if (list.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">找不到符合 "${fullKeyword}" 的資料。</td></tr>`;
            return;
        }

        const defQty = document.getElementById('defaultQty').value || 1;
        const defPrice = document.getElementById('defaultPrice').value || "";
        const boxCode = document.getElementById('boxCode').value;

        // 在 fetchData 或 fetchData2 的 list.forEach 循環中調整：
        list.forEach(item => {
            const officialSn = item.goods_sn || fullKeyword.toUpperCase();
            // 這裡的預覽名稱也同步不傳入 boxCode
            const previewName = formatListingName(officialSn, item.goods_title, item.rare);
            const finalPrice = defPrice || item.sell_min_price;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.goods_thumb}" class="card-img"></td>
                <td>
                    <div style="color:#666; font-size:12px;">${item.goods_title}</div>
                    <div class="listing-name-preview" style="background:#fff7e6; padding:5px; border-radius:4px;">${previewName}</div>
                </td>
                <td><span class="rare-tag">${item.rare}</span></td>
                <td><span type="number">${item.rare_id}</span></td>
                <td>$${item.sell_min_price} ~ $${item.sell_max_price}</td>
                <td>
                    <input type="number" class="row-qty" value="${defQty}" style="width:50px;">
                    <input type="number" class="row-price" value="${finalPrice}" style="width:70px;">
                </td>
                <td class="action-cell">
                    <button class="btn-copy" onclick="copyText('${previewName.replace(/'/g, "\\'")}', this)">名</button>
                    <button class="btn-search" style="background:#ffc107; color:#000; margin-top:5px;" 
                        onclick="prepareAddToList(this, '${item.goods_title.replace(/'/g, "\\'")}', '${item.goods_thumb}')">加入</button>
                </td>`;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("❌ Error:", error);
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">發生錯誤，請查看 Console。</td></tr>';
    } finally { 
        searchBtn.disabled = false; 
    }
}
// --- 4. API 查詢與介面互動 (備用)---

async function fetchData2() {
    // 1. 取得輸入並轉為小寫，去除空白
    const fullKeyword = document.getElementById('keyword').value.trim().toLowerCase();
    const rareId = document.getElementById('rareSelect').value;
    const tableBody = document.getElementById('cardTableBody');
    const searchBtn = document.getElementById('searchBtn');

    if (!fullKeyword) return;

    // 2. 拆分關鍵字 (同樣保持小寫處理)
    const parts = fullKeyword.split('-');
    const prefix = parts[0]; 
    const suffix = parts.length > 1 ? parts[1] : "";

    console.log(`🔎 偵錯 - Prefix: ${prefix}, Suffix: ${suffix}`);

    searchBtn.disabled = true;
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">正在搜尋系列...</td></tr>';

    try {
        const response = await fetch('https://ygo.iwantcard.tw/api/Goods/getList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "game_id": 1,
                "type": 1,
                "series_id": "",
                "rare_id": parseInt(rareId),
                "page": 1,
                "page_nums": 100, 
                "order_type": 0,
                "order_sort": 0,
                "periodical_id": 0,
                "key_word": prefix, // 送出小寫 prefix
                "show_type": 0,
                "is_peek": 0,
                "hot": 0,
                "filter_no_sale": false
            })
        });

        const res = await response.json();
        let list = res.data.list || [];
        console.log("🔍 偵錯 - 所有回傳標題:", list.map(item => item));

        // 3. 過濾時強制統一轉大寫進行比對 (無視大小寫)
        if (suffix) {
            const searchSuffix = suffix.toUpperCase();
            list = list.filter(item => {
                // 標題與 Suffix 都轉大寫後比對
                return item.goods_sn.toUpperCase().includes(searchSuffix);
            });
        }

        tableBody.innerHTML = '';
        
        if (list.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">找不到符合 "${fullKeyword}" 的資料。</td></tr>`;
            return;
        }

        const defQty = document.getElementById('defaultQty').value || 1;
        const defPrice = document.getElementById('defaultPrice').value || "";
        const boxCode = document.getElementById('boxCode').value;
        list.forEach(item => {
            const officialSn = item.goods_sn || fullKeyword.toUpperCase();
            const previewName = formatListingName(officialSn, item.goods_title, item.rare);
            const finalPrice = defPrice || item.sell_min_price;
            
            // 取得 rare_id，若 item.rare_id 不存在，嘗試 item.goods_rare_id 或顯示 '-'
            const rid = item.rare_id || item.goods_rare_id || "-";

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.goods_thumb}" class="card-img"></td>
                <td>
                    <div style="color:#666; font-size:12px;">${item.goods_title}</div>
                    <div class="listing-name-preview" style="background:#fff7e6; padding:5px; border-radius:4px;">${previewName}</div>
                </td>
                <td><span class="rare-tag">${item.rare_id} (ID: ${item.rare_id})</span></td>
                <td>$${item.sell_min_price} ~ $${item.sell_max_price}</td>
                <td>
                    <input type="number" class="row-qty" value="${defQty}" style="width:50px;">
                    <input type="number" class="row-price" value="${finalPrice}" style="width:70px;">
                </td>
                <td class="action-cell">
                    <button class="btn-copy" onclick="copyText('${previewName.replace(/'/g, "\\'")}', this)">名</button>
                    <button class="btn-search" style="background:#ffc107; color:#000; margin-top:5px;" 
                        onclick="prepareAddToList(this, '${item.goods_title.replace(/'/g, "\\'")}', '${item.goods_thumb}')">加入</button>
                </td>`;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally { 
        searchBtn.disabled = false; 
    }
}
// 輔助函式：點擊加入時，抓取該列輸入框的最新數值
// 輔助函式：點擊加入時，抓取該列輸入框的最新數值
function prepareAddToList(btn, apiTitle, imgPath) {
    // 1. 抓取畫面上方的即時欄位數值
    const keyword = document.getElementById('keyword').value.trim();
    const qty = document.getElementById('defaultQty').value || 1;
    const boxCode = document.getElementById('boxCode').value.trim(); // 修正：抓取代號
    
    // 2. 抓取該列對應的數值
    const row = btn.closest('tr');
    const rarity = row.querySelector('.rare-tag').innerText;
    
    // 修正：優先抓取該列的「自訂價」輸入框，若為空則抓取上方「預設自訂價」
    const rowPriceInput = row.querySelector('.row-price').value;
    const price = rowPriceInput || document.getElementById('defaultPrice').value || "";
    
    // 3. 生成包含代號的商品名稱 (傳入 boxCode)
    // 格式範例：[微笑小舖] 遊戲王 {去槓卡號} {官方卡號} {卡名} ({稀有度}) {代號}
    let listingName = formatListingName(keyword, apiTitle, rarity);
    if (boxCode) {
        listingName += ` ${boxCode}`; // 手動將代號串接在名稱最後
    }
    
    // 4. 呼叫加入清單
    addToList({
        title: listingName,
        price: price,
        qty: qty,
        img: imgPath
    });
    
    // 5. 顯示預覽容器
    const container = document.getElementById('previewContainer');
    if (container) container.style.display = 'block';
}

// 頂部工具列的快速加入按鈕
function writeCurrentToExcel() {
    const keyword = document.getElementById('keyword').value;
    const qty = document.getElementById('defaultQty').value;
    const price = document.getElementById('defaultPrice').value;
    const boxCode = document.getElementById('boxCode').value.trim(); // 加入這行
    const rareSelect = document.getElementById('rareSelect');
    const rareText = rareSelect.options[rareSelect.selectedIndex].text;
    const imgPath = document.getElementById('cdnUrlDisplay').innerText || "";

    let listingName = formatListingName(keyword, "(手動輸入)", rareText);
    if (boxCode) listingName += ` ${boxCode}`; // 加入這行

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
    // 此功能已隨著快速加入廢棄，保持空函式避免 HTML 報錯
    return true;
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