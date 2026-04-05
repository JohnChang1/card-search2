// --- 1. 全域變數與初始化 ---
let rareData = JSON.parse(localStorage.getItem('rareData') || '[]');
let shopName = localStorage.getItem('shopName') || '[微笑小舖]';
const GITHUB_BASE = "https://raw.githubusercontent.com/JohnChang1/card-search2/main/";

updateRareDropdown();

// --- 2. 設定相關功能 (Modal) ---
function toggleModal(show) {
    document.getElementById('settingsModal').style.display = show ? 'block' : 'none';
    if (show) {
        document.getElementById('rareJsonInput').value = JSON.stringify(rareData, null, 4);
        document.getElementById('shopNameInput').value = shopName;
    }
}

function saveSettings() {
    try {
        // 儲存店名
        shopName = document.getElementById('shopNameInput').value;
        localStorage.setItem('shopName', shopName);
        
        // 儲存稀有度 JSON
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

// --- 3. 核心功能：格式化上架名稱 ---
function formatListingName(item) {
    // 從標題擷取編號 (例如從 "PHNI-JP052 賜予炎之加護的聖域" 抓出 "PHNI-JP052")
    // 如果 API 有提供 goods_title_code 則優先使用
    const cardNo = item.goods_title_code || item.goods_title.split(' ')[0] || "";
    const cardNoClean = cardNo.replace(/-/g, ''); // 去除所有橫槓
    const cardName = item.goods_title.replace(cardNo, '').trim(); // 去除編號後的卡名
    const rarity = item.rare;

    // 格式: [店名] 遊戲王 {卡號去-} {卡號} {卡名} ({稀有度})
    return `${shopName} 遊戲王 ${cardNoClean} ${cardNo} ${cardName} (${rarity})`;
}

// --- 4. API 查詢功能 ---
async function fetchData() {
    const keyword = document.getElementById('keyword').value;
    const rareId = document.getElementById('rareSelect').value;
    const tableBody = document.getElementById('cardTableBody');
    const searchBtn = document.getElementById('searchBtn');

    if(!keyword) return;

    searchBtn.disabled = true;
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">查詢中...</td></tr>';

    const payload = {
        "game_id": 1, "type": 1, "key_word": keyword,
        "rare_id": parseInt(rareId), "page": 1, "page_nums": 50,
        "order_type": 0, "order_sort": 0, "filter_no_sale": false
    };

    try {
        const response = await fetch('https://ygo.iwantcard.tw/api/Goods/getList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        const list = res.data.list || [];
        tableBody.innerHTML = '';
        
        if (list.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">找不到相關卡片。</td></tr>';
            return;
        }

        // 讀取預設值
        const defQty = document.getElementById('defaultQty').value || 1;
        const defPrice = document.getElementById('defaultPrice').value || "";

        list.forEach(item => {
            const listingName = formatListingName(item);
            const finalPrice = defPrice || item.sell_min_price; // 如果沒設自定義價，用最低市價

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.goods_thumb}" class="card-img"></td>
                <td>
                    <div style="color:#666; font-size:12px; margin-bottom:4px;">原始標題: ${item.goods_title}</div>
                    <div class="listing-name-preview" style="font-weight:bold; color:#007bff;">${listingName}</div>
                </td>
                <td><span class="rare-tag">${item.rare}</span></td>
                <td>
                    <div class="price">$${item.sell_min_price} ~ $${item.sell_max_price}</div>
                </td>
                <td>
                    <div style="display:flex; gap:5px; flex-direction:column;">
                        <input type="number" class="edit-qty" value="${defQty}" style="width:60px;" title="數量">
                        <input type="number" class="edit-price" value="${finalPrice}" style="width:80px;" title="上架價格">
                    </div>
                </td>
                <td class="action-cell">
                    <button class="btn-copy" onclick="copyText('${listingName}', this)">複製商品名</button>
                    <button class="btn-copy" style="margin-top:5px; background:#6c757d; color:white;" onclick="copyText('${item.goods_thumb}', this)">複製圖片</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color:red;">API 請求失敗，請檢查網路或 CORS 設定。</td></tr>';
    } finally {
        searchBtn.disabled = false;
    }
}

// --- 5. 工具類功能 (複製/圖庫) ---
async function copyText(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const oldText = btn.innerText;
        btn.innerText = 'OK!';
        setTimeout(() => btn.innerText = oldText, 800);
    } catch (err) { alert('複製失敗'); }
}

function handleFiles(files) {
    const gallery = document.getElementById('localGallery');
    const folderInput = document.getElementById('folderName').value || "images";
    gallery.innerHTML = '';

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        gallery.innerHTML = '<p>資料夾內沒有圖片檔案。</p>';
        return;
    }

    imageFiles.forEach(file => {
        const localBlobUrl = URL.createObjectURL(file);
        const fileName = file.name;
        const sdnUrl = `${GITHUB_BASE}${folderInput}/${fileName}`;

        const div = document.createElement('div');
        div.className = 'album-item';
        div.innerHTML = `
            <img class="google-drive-viewer" src="${localBlobUrl}" title="${fileName}">
            <div style="text-align:center; font-size:12px; margin-top:5px;">${fileName}</div>
        `;

        div.onclick = () => {
            document.querySelectorAll('.album-item').forEach(i => i.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('cdnPanel').style.display = 'block';
            document.getElementById('cdnUrlDisplay').innerText = sdnUrl;
        };
        gallery.appendChild(div);
    });
}

function copyCDNPath() {
    const url = document.getElementById('cdnUrlDisplay').innerText;
    navigator.clipboard.writeText(url);
    const btn = document.querySelector('#cdnPanel .btn-copy');
    const oldText = btn.innerText;
    btn.innerText = "複製成功！";
    setTimeout(() => btn.innerText = oldText, 1000);
}