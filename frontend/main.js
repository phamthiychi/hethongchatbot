// ===========================
// ⚡️ CẤU HÌNH CHẾ ĐỘ
// ===========================
const isReadOnly = !document.getElementById('addForm'); 
let allData = [];
let currentPage = 1;
let rowsPerPage = 5;
// ===========================
// ⚡️ LOAD DATA
// ===========================
function loadQuestions() {
  fetch('http://127.0.0.1:3000/api/questions')
    .then(res => res.json())
    .then(data => {
      allData = data;
      currentPage = 1;
      isReadOnly ? renderTableOnlyView() : renderTable();
    });
}

function loadDanhMuc() {
  fetch('http://127.0.0.1:3000/api/filters')
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('danhmuc');
      if (!select) return;

      select.innerHTML = '';
      data.danhmuc.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.ten;
        select.appendChild(opt);
      });
    });
}

// ===========================
// ⚡️ RENDER TABLES
// ===========================
function renderTable() {
  const tbody = document.querySelector('#questionTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
  const filteredData = allData.filter(item =>
    item.cauhoi.toLowerCase().includes(searchTerm) ||
    item.cautraloi.toLowerCase().includes(searchTerm) ||
    item.danhmuc.toLowerCase().includes(searchTerm)
  );
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;

  filteredData.slice(start, end).forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${start + index + 1}</td>
      <td>${item.danhmuc}</td>
      <td class="cauhoi" data-id="${item.id}">${item.cauhoi}</td>
      <td class="traloi" data-id="${item.id}">${item.cautraloi}</td>
      <td><button class="btn bg-white ms-1 fs-6" data-id="${item.id}" data-action="delete">🗑</button></td>
      <td><button class="btn bg-white ms-1 fs-6" data-action="edit">🖌️</button></td>
    `;
    tbody.appendChild(row);
  });
  renderPagination(filteredData.length);
}

function renderTableOnlyView() {
  const tbody = document.querySelector('#questionTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
  const filteredData = allData.filter(item =>
    item.cauhoi.toLowerCase().includes(searchTerm) ||
    item.cautraloi.toLowerCase().includes(searchTerm) ||
    item.danhmuc.toLowerCase().includes(searchTerm)
  );
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;

  filteredData.slice(start, end).forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.cauhoi}</td>
      <td>${item.cautraloi}</td>
    `;
    tbody.appendChild(row);
  });
  renderPagination(filteredData.length);
}

// ===========================
// ⚡️ PAGINATION
// ===========================
function renderPagination(totalRows) {
  const container = document.getElementById('paginationControls');
  if (!container) return;

  container.innerHTML = '';
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const createBtn = (label, page) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-primary btn-sm mx-1';
    btn.textContent = label;
    btn.disabled = page === currentPage;
    btn.onclick = () => {
      currentPage = page;
      isReadOnly ? renderTableOnlyView() : renderTable();
    };
    return btn;
  };
  if (totalPages > 1) {
    if (currentPage > 1) container.appendChild(createBtn('←', currentPage - 1));
    for (let i = 1; i <= totalPages; i++) {
      container.appendChild(createBtn(i, i));
    }
    if (currentPage < totalPages) container.appendChild(createBtn('→', currentPage + 1));
  }
}

// ===========================
// ⚡️ DELETE / EDIT CÂU HỎI
// ===========================
function deleteQuestion(id) {
  if (!confirm('Bạn có chắc chắn muốn xoá câu hỏi này?')) return;

  fetch(`http://127.0.0.1:3000/api/questions/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) loadQuestions();
      else alert('❌ Lỗi khi xoá!');
    });
}

function toggleEditRow(button) {
  const row = button.closest('tr');
  const isEditing = button.textContent.includes('💾');
  const cauhoiCell = row.querySelector('.cauhoi');
  const traloiCell = row.querySelector('.traloi');

  if (isEditing) {
    const id = cauhoiCell.getAttribute('data-id');
    const newCauhoi = cauhoiCell.textContent.trim();
    const newTraloi = traloiCell.textContent.trim();

    fetch(`http://127.0.0.1:3000/api/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cauhoi: newCauhoi, traloi: newTraloi })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          cauhoiCell.contentEditable = false;
          traloiCell.contentEditable = false;
          button.textContent = '🖌️';
        } else {
          alert('❌ Lỗi khi lưu dữ liệu');
        }
      });
  } else {
    cauhoiCell.contentEditable = true;
    traloiCell.contentEditable = true;
    cauhoiCell.focus();
    button.textContent = '💾';
  }
}

// ===========================
// ⚡️ DANH MỤC
// ===========================
function loadDanhMucList() {
  fetch('http://127.0.0.1:3000/api/loaddanhmuc')
  .then(res => res.json())
  .then(data => {
    // ✅ data LÀ MẢNG
    if (!Array.isArray(data)) {
      console.error('❌ Lỗi tải danh mục!');
      return;
    }

    const uniqueData = [];
    const seen = new Set();

    data.forEach(item => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        uniqueData.push(item);
      }
    });

    const danhmucTable = document.getElementById('danhmucTable');
    if (!danhmucTable) return;

    const tbody = danhmucTable.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    uniqueData.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index +1}</td>
        <td class="danhmuc-name" data-id="${item.id}">${item.ten}</td>
        <td>
            <button class="btn bg-white ms-1 fs-6" data-action="edit-danhmuc">🖌️</button>
            <button class="btn bg-white ms-1 fs-6" data-action="delete-danhmuc">🗑</button>
        </td>`;
      tbody.appendChild(tr);
    });
  });

}

function deleteDanhMuc(id) {
  if (!confirm('Bạn có chắc chắn muốn xoá danh mục này?')) return;

  fetch(`http://127.0.0.1:3000/api/danhmuc/${id}`, {
    method: 'DELETE'
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('✅ Xóa danh mục thành công!');
        loadDanhMucList();
      } else {
        alert('❌ Lỗi khi xoá danh mục!');
      }
    });
}

function editDanhMuc(button) {
  const row = button.closest('tr');
  const tenCell = row.querySelector('.danhmuc-name');
  const isEditing = button.textContent.includes('💾');

  if (isEditing) {
    const id = tenCell.getAttribute('data-id');
    const ten = tenCell.textContent.trim();

    fetch(`http://127.0.0.1:3000/api/danhmuc/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ten })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          tenCell.contentEditable = false;
          button.textContent = '🖌️';
        } else {
          alert('❌ Lỗi khi cập nhật danh mục!');
        }
      });
  } else {
    tenCell.contentEditable = true;
    tenCell.focus();
    button.textContent = '💾';
  }
}

// ===========================
// ⚡️ MAIN INIT
// ===========================
document.addEventListener('DOMContentLoaded', function() {
  
  loadDanhMuc();
  loadQuestions();
  loadDanhMucList();
  const addForm = document.getElementById('addForm');
  if (addForm) {
    addForm.addEventListener('submit', e => {
      e.preventDefault();
      const danhmuc = document.getElementById('danhmuc')?.value.trim();
      const cauhoi = document.getElementById('newQuestion')?.value.trim();
      const traloi = document.getElementById('newAnswer')?.value.trim();

      if (!danhmuc || !cauhoi || !traloi) {
        alert('❗ Vui lòng nhập đầy đủ các trường.');
        return;
      }
      //console.log(danhmuc);
      fetch('http://127.0.0.1:3000/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ danhmuc, cauhoi, traloi })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('✅ Đã thêm câu hỏi thành công!');
            addForm.reset();
            loadQuestions();
          } else {
            alert('❌ Lỗi khi thêm: ' + data.message);
          }
        })
        .catch(err => {
          alert('❌ Lỗi gửi dữ liệu: ' + err.message);
        });
    });
}

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      isReadOnly ? renderTableOnlyView() : renderTable();
    });
  }
  const rowsPerPageInput = document.getElementById('rowsPerPage');
  if (rowsPerPageInput) {
    rowsPerPageInput.addEventListener('change', function() {
      rowsPerPage = parseInt(this.value);
      currentPage = 1;
      isReadOnly ? renderTableOnlyView() : renderTable();
    });
  }
  const table = document.getElementById('questionTable');
  if (table) {
    table.addEventListener('click', function(event) {
      const target = event.target;

      if (target.dataset.action === 'delete') {
        deleteQuestion(target.dataset.id);
      } else if (target.dataset.action === 'edit') {
        toggleEditRow(target);
      }
    });
  }

  const danhmucTable = document.getElementById('danhmucTable');
  if (danhmucTable) {
    danhmucTable.addEventListener('click', function(event) {
      const target = event.target;

      if (target.dataset.action === 'delete-danhmuc') {
        const id = target.closest('tr')?.querySelector('.danhmuc-name')?.dataset.id;
        deleteDanhMuc(id);
      } else if (target.dataset.action === 'edit-danhmuc') {
        editDanhMuc(target);
      }
    });
  }

  const danhMucForm = document.getElementById('danhmucForm');
  if (danhMucForm) {
    danhMucForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const ten = document.getElementById('danhmucInput')?.value.trim();
      if (!ten) {
        alert('❗ Vui lòng nhập tên danh mục!');
        return;
      }

      fetch('http://127.0.0.1:3000/api/danhmuc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ten })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('✅ Đã thêm danh mục thành công!');
            danhMucForm.reset();
            loadDanhMucList();
          } else {
            alert('❌ Lỗi khi thêm danh mục: ' + data.message);
          }
        })
        .catch(err => {
          alert('❌ Lỗi kết nối: ' + err.message);
        });
    });
  }
});
function animateCount(element, endValue, duration = 1000, suffix = "") {
  let start = 0;
  const stepTime = Math.max(10, Math.floor(duration / endValue));
  const timer = setInterval(() => {
    start++;
    element.textContent = start + suffix;
    if (start >= endValue) clearInterval(timer);
  }, stepTime);
}
function randomColor() {
  const hex = Math.floor(Math.random() * 16777215).toString(16);
  return '#' + hex.padStart(6, '0');
}
  

