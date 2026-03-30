let rareData = JSON.parse(localStorage.getItem('rareData') || '[]');
updateRareDropdown();

function toggleModal(show) {
    document.getElementById('settingsModal').style.display = show ? 'block' : 'none';
    if (show) document.getElementById('rareJsonInput').value = JSON.stringify(rareData, null, 4);
}

function saveSettings() {
    try {
        const input = document.getElementById('rareJsonInput').value;
        const parsed = JSON.parse(input);
        if (!Array.isArray(parsed)) throw new Error("格式非陣列");
        rareData = parsed;
        localStorage.setItem('rareData', JSON.stringify(rareData));
        updateRareDropdown();
        toggleModal(false);
    } catch (e) {
        alert('JSON 格式錯誤！');
    }
}

function updateRareDropdown() {
    const select = document.getElementById('rareSelect');
    select.innerHTML = '<option value="0">全部稀有度</option>';
    rareData.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.rare_id;
        opt.textContent = item.rare;
        select.appendChild(opt);
    });
}

async function copyText(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const oldText = btn.innerText;
        btn.innerText = 'OK!';
        setTimeout(() => btn.innerText = oldText, 800);
    } catch (err) { alert('複製失敗'); }
}

async function fetchData() {
    const keyword = document.getElementById('keyword').value;
    const rareId = document.getElementById('rareSelect').value;
    const tableBody = document.getElementById('cardTableBody');
    const searchBtn = document.getElementById('searchBtn');

    if(!keyword) return;

    searchBtn.disabled = true;
    tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">查詢中...</td></tr>';

    const payload = {
        "game_id": 1, "type": 1, "key_word": keyword,
        "rare_id": parseInt(rareId), "page": 1, "page_nums": 50,
        "order_type": 0, "order_sort": 0, "filter_no_sale": false
    };
const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
const targetUrl = 'https://ygo.iwantcard.tw/api/Goods/getList';

try {
        const response = await fetch('https://ygo.iwantcard.tw/api/Goods/getList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        const list = res.data.list || [];
        tableBody.innerHTML = '';
        
// 在 script.js 的 list.forEach 區塊中替換為以下結構
        list.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <img src="${item.goods_thumb}" class="card-img">
                </td>
                <td>
                    <div style="font-weight:bold; font-size: 16px;">${item.goods_title}</div>
                </td>
                <td><span class="rare-tag">${item.rare}</span></td>
                <td>
                    <div class="price">$${item.sell_min_price}</div>
                    <div style="color:#999; font-size:12px;">~</div>
                    <div class="price">$${item.sell_max_price}</div>
                </td>
                <td class="action-cell">
                    <button class="btn-copy" onclick="copyText('${item.goods_title}', this)">複製名稱</button>
                    <button class="btn-copy" onclick="copyText('${item.goods_thumb}', this)">複製圖片</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state" style="color:red;">API 請求失敗，請檢查 CORS。</td></tr>';
    } finally {
        searchBtn.disabled = false;
    }
}